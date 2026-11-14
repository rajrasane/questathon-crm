import {
  discoveryDue,
  mergeDiscovery,
  unknownAccountSignature,
} from "./discovery.js";
import { mkdir, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { McpAdapter, RateLimitError } from "./adapter.js";
import {
  accessSchema,
  exportSchema,
  paperworkSchema,
  fileSchema,
  bundleSchema,
  type Bundle,
} from "./raw.js";
import { atomicWrite, privateDir } from "./storage.js";
import { readOptional, persistBundle, pollOnce } from "./pipeline.js";
// Tool names and inputs were verified against the supplied tools/list, not guessed.
const tools = [
  {name:"whoami",input:z.object({}).strict(),output:accessSchema,mode:"read" as const},
  {name:"get_new_account",input:z.object({account:z.string()}).strict(),output:exportSchema,mode:"read" as const},
  {name:"get_new_account_file",input:z.object({account:z.string(),file_id:z.string()}).strict(),output:fileSchema,mode:"read" as const},
  {
    name: "get_my_accounts",
    input: z.object({}).strict(),
    output: exportSchema,
    mode: "read" as const,
  },
  {
    name: "get_all_paperwork",
    input: z.object({ account: z.string() }).strict(),
    output: paperworkSchema,
    mode: "read" as const,
  },
  {
    name: "get_file",
    input: z.object({ id: z.string() }).strict(),
    output: fileSchema,
    mode: "read" as const,
  },
];
export function pendingFetch(
  bundle: Bundle | null,
): { name: string; args: Record<string, string> } | null {
  if (!bundle) return { name: "get_my_accounts", args: {} };
  const released = bundle.released_accounts as {id:string;name:string}[] | undefined;
  const missing = released?.find(a => !bundle.accounts.accounts.some(known=>known.id===a.id));
  if(missing) return {name:"get_new_account",args:{account:missing.id}};
  const packs = Object.values(bundle).flatMap((v) => {
    const p = paperworkSchema.safeParse(v);
    return p.success ? [p.data] : [];
  });
  for (const account of bundle.accounts.accounts)
    if (!packs.some((p) => p.account === account.id))
      return { name: "get_all_paperwork", args: { account: account.id } };
  for (const file of bundle.accounts.files)
    if (
      !bundle.fetched_files?.some((f) => f.id === file.id) &&
      bundle.roi_file?.id !== file.id
    )
      return (bundle.dropAccountIds as string[] | undefined)?.includes(file.account || "")
        ? {name:"get_new_account_file",args:{account:file.account!,file_id:file.id}}
        : { name: "get_file", args: { id: file.id } };
  return null;
}
export async function ingestionStep(
  dir = privateDir,
  request: typeof fetch = fetch,
  now = Date.now,
) {
  if (
    process.env.CRM_INGESTION_OWNER !== "this-process" ||
    !process.env.AQ_TOKEN
  )
    return { mode: "cached", changed: false };
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const lock = join(dir, "bootstrap.lock");
  try {
    await mkdir(lock);
  } catch {
    return { mode: "busy", changed: false };
  }
  try {
    const stored = await readOptional(join(dir, "bundle.json"));
    let bundle = stored === undefined ? null : bundleSchema.parse(stored);
    const discovery = (await readOptional(
      join(dir, "discovery-status.json"),
    )) as { checkedAt: number; unknowns: string } | undefined;
    const task =
      pendingFetch(bundle) ||
      (discoveryDue(
        bundle,
        discovery?.checkedAt ?? null,
        discovery?.unknowns || "",
        now(),
      )
        ? { name: "whoami", args: {} }
        : null);
    if (!task) return await pollOnce(dir, request, now);
    const adapter = new McpAdapter(dir, tools, request, now);
    const result = await adapter.call(task.name, task.args, {
      refresh: task.name === "get_my_accounts" || task.name === "whoami",
    });
    if(task.name === "whoami") bundle={...bundle!,released_accounts:accessSchema.parse(result.data).new_accounts};
    else if(task.name === "get_new_account") {
      const ids=bundle!.dropAccountIds as string[] || [];
      bundle=mergeDiscovery(bundle,result.data);
      bundle.dropAccountIds=[...new Set([...ids,...exportSchema.parse(result.data).accounts.map(a=>a.id)])];
    }
    else if (task.name === "get_my_accounts")
      bundle = mergeDiscovery(bundle, result.data);
    else if (task.name === "get_all_paperwork") {
      const pack = paperworkSchema.parse(result.data);
      if (pack.account !== task.args.account)
        throw new Error("Paperwork account mismatch");
      bundle = { ...bundle!, [`paperwork_${pack.account}`]: pack };
    } else {
      const file = fileSchema.parse(result.data);
      if (file.id !== (task.args.id || task.args.file_id)) throw new Error("File identity mismatch");
      bundle = {
        ...bundle!,
        fetched_files: [...(bundle!.fetched_files || []), file],
      };
    }
    await persistBundle(bundle, dir);
    if (task.name === "get_my_accounts" || task.name === "whoami")
      await atomicWrite(join(dir, "discovery-status.json"), {
        checkedAt: now(),
        unknowns: unknownAccountSignature(bundle),
      });
    await atomicWrite(join(dir, "bootstrap-status.json"), {
      phase: pendingFetch(bundle) ? "fetching" : "ready",
      lastCompletedTool: task.name,
      lastCompletedAt: result.retrievedAt,
      error: null,
    });
    return { mode: "initializing", changed: true };
  } catch (error) {
    await atomicWrite(join(dir, "bootstrap-status.json"), {
      phase: "error",
      error:
        error instanceof RateLimitError
          ? "Shared MCP cooldown; waiting for the next cycle."
          : "Initial MCP fetch failed. Retaining validated cached data; retrying next cycle.",
    });
    return { mode: "error", changed: false };
  } finally {
    await rmdir(lock);
  }
}
export function startIngestion(dir = privateDir) {
  if (
    process.env.CRM_INGESTION_OWNER !== "this-process" ||
    !process.env.AQ_TOKEN
  )
    return () => {};
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    try {
      await ingestionStep(dir);
    } catch {
      console.error("MCP ingestion unavailable; retrying on next interval.");
    } finally {
      if (!stopped) {
        timer = setTimeout(() => void tick(), 65_000);
        timer.unref();
      }
    }
  };
  timer = setTimeout(() => void tick(), 65_000);
  timer.unref();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
