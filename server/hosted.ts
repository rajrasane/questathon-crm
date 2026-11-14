import {
  discoveryDue,
  mergeDiscovery,
  unknownAccountSignature,
} from "./discovery.js";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  snapshotSchema,
  completeness,
  type WorkspaceResponse,
} from "../src/model.js";
import {
  bundleSchema,
  exportSchema,
  paperworkSchema,
  fileSchema,
  signalsSchema,
  type Bundle,
} from "./raw.js";
import { normalizeBundle, digest } from "./normalize.js";
import { pendingFetch } from "./bootstrap.js";
import { mergeSignals } from "./pipeline.js";
import { decodeToolResult, readRpcResponse } from "./adapter.js";

export interface Redis {
  command(args: (string | number)[]): Promise<unknown>;
}
export class RestRedis implements Redis {
  constructor(
    private url = process.env.UPSTASH_REDIS_REST_URL,
    private token = process.env.UPSTASH_REDIS_REST_TOKEN,
    private request: typeof fetch = fetch,
  ) {}
  async command(args: (string | number)[]) {
    if (!this.url || !this.token || !this.url.startsWith("https://"))
      throw Error("Persistent storage is not configured");
    const response = await this.request(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw Error("Persistent storage request failed");
    const result = z
      .object({ result: z.unknown().optional(), error: z.string().optional() })
      .parse(await response.json());
    if (result.error) throw Error("Persistent storage command failed");
    return result.result;
  }
}
export const keys = {
  state: "{questathon}:state",
  lease: "{questathon}:lease",
  rate: "{questathon}:rate",
};
// Redis TTLs use server time. Reserve before I/O; releases never erase the cooldown.
export const acquireScript = `if redis.call('EXISTS',KEYS[1])==1 or redis.call('EXISTS',KEYS[2])==1 then return 0 end
redis.call('SET',KEYS[1],ARGV[1],'PX',90000)
redis.call('SET',KEYS[2],'reserved','PX',61000)
return 1`;
export const publishScript = `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
redis.call('SET',KEYS[2],ARGV[2])
return 1`;
export const releaseScript = `if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`;
const stateSchema = z.object({
  bundle: bundleSchema,
  discoveryCheckedAt: z.number().nullable().default(null),
  discoveryUnknowns: z.string().default(""),
  snapshot: snapshotSchema,
  fingerprint: z.string(),
  events: z.array(
    z.object({ account: z.string(), id: z.string(), hash: z.string() }),
  ),
  lastCheckedAt: z.string().nullable(),
  lastChangedAt: z.string().nullable(),
  error: z.string().nullable(),
});
type State = z.infer<typeof stateSchema>;
async function readState(redis: Redis): Promise<State | null> {
  const raw = await redis.command(["GET", keys.state]);
  return raw === null
    ? null
    : stateSchema.parse(JSON.parse(z.string().parse(raw)));
}
export function authenticated(
  header: string | undefined,
  secret = process.env.CRON_SECRET,
) {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`),
    received = Buffer.from(header);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
export async function hostedWorkspace(
  redis: Redis = new RestRedis(),
): Promise<WorkspaceResponse> {
  try {
    const state = await readState(redis);
    if (!state)
      return {
        state: "unconfigured",
        snapshot: null,
        loadedAt: null,
        message: "Waiting for the first hosted MCP fetch.",
      };
    const snapshot = state.snapshot;
    const stale = Date.now() - Date.parse(snapshot.generatedAt) > 86400000;
    return {
      state: stale
        ? "stale"
        : snapshot.accounts.length === 0 ||
            snapshot.accounts.some((a) => !completeness(a))
          ? "partial"
          : "ready",
      snapshot,
      loadedAt: new Date().toISOString(),
      message: stale
        ? "Cached analysis needs a freshness check."
        : "Evidence loaded from persistent storage. Unknowns remain explicit.",
      ingestion: {
        mode: process.env.CRM_INGESTION_OWNER === "hosted" ? "live" : "cached",
        lastCheckedAt: state.lastCheckedAt,
        lastChangedAt: state.lastChangedAt,
        error: state.error,
      },
    };
  } catch {
    return {
      state: "error",
      snapshot: null,
      loadedAt: null,
      message:
        "Persistent workspace unavailable. Check the server storage configuration.",
    };
  }
}
const schemas: Record<string, z.ZodType> = {
  get_my_accounts: exportSchema,
  get_all_paperwork: paperworkSchema,
  get_file: fileSchema,
  get_signals: signalsSchema,
};
export async function hostedStep(
  redis: Redis = new RestRedis(),
  request: typeof fetch = fetch,
) {
  if (process.env.CRM_INGESTION_OWNER !== "hosted" || !process.env.AQ_TOKEN)
    return { status: "disabled" };
  const owner = randomUUID();
  if (
    (await redis.command([
      "EVAL",
      acquireScript,
      2,
      keys.lease,
      keys.rate,
      owner,
    ])) !== 1
  )
    return { status: "cooldown" };
  let previous: State | null = null;
  async function publish(state: State) {
    if (
      (await redis.command([
        "EVAL",
        publishScript,
        2,
        keys.lease,
        keys.state,
        owner,
        JSON.stringify(stateSchema.parse(state)),
      ])) !== 1
    )
      throw Error("Hosted ingestion lease expired");
  }
  try {
    previous = await readState(redis);
    const task = pendingFetch(previous?.bundle || null) || {
      name: discoveryDue(
        previous?.bundle || null,
        previous?.discoveryCheckedAt ?? null,
        previous?.discoveryUnknowns || "",
        Date.now(),
      )
        ? "get_my_accounts"
        : "get_signals",
      args: {},
    };
    const response = await request(
      "https://questathon.aihackerscollective.com/api/public/mcp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${process.env.AQ_TOKEN}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: owner,
          method: "tools/call",
          params: { name: task.name, arguments: task.args },
        }),
        signal: AbortSignal.timeout(25_000),
      },
    );
    if (!response.ok) throw Error("Upstream unavailable");
    const envelope = z
      .object({ result: z.unknown().optional(), error: z.unknown().optional() })
      .parse(await readRpcResponse(response));
    if (envelope.error) throw Error("Upstream tool error");
    const data = schemas[task.name].parse(decodeToolResult(envelope.result));
    let bundle: Bundle;
    if (task.name === "get_my_accounts")
      bundle = mergeDiscovery(previous?.bundle || null, data);
    else if (task.name === "get_all_paperwork") {
      const pack = paperworkSchema.parse(data);
      if (pack.account !== task.args.account) throw Error("Account mismatch");
      bundle = { ...previous!.bundle, [`paperwork_${pack.account}`]: pack };
    } else if (task.name === "get_file") {
      const file = fileSchema.parse(data);
      if (file.id !== task.args.id) throw Error("File mismatch");
      bundle = {
        ...previous!.bundle,
        fetched_files: [...(previous!.bundle.fetched_files || []), file],
      };
    } else bundle = mergeSignals(previous!.bundle, data);
    const fingerprint = digest({ version: 3, bundle });
    const changed = fingerprint !== previous?.fingerprint;
    const now = new Date().toISOString();
    const snapshot = changed
      ? normalizeBundle(bundle, now)
      : previous!.snapshot;
    const events = new Map(
      (previous?.events || []).map((e) => [
        `${e.account}:${e.id}:${e.hash}`,
        e,
      ]),
    );
    for (const signal of bundle.signals?.signals || []) {
      const hash = digest(signal);
      events.set(`${signal.account}:${signal.id}:${hash}`, {
        account: signal.account,
        id: signal.id,
        hash,
      });
    }
    await publish({
      bundle,
      discoveryCheckedAt:
        task.name === "get_my_accounts"
          ? Date.now()
          : (previous?.discoveryCheckedAt ?? null),
      discoveryUnknowns:
        task.name === "get_my_accounts"
          ? unknownAccountSignature(bundle)
          : previous?.discoveryUnknowns || "",
      snapshot,
      fingerprint,
      events: [...events.values()],
      lastCheckedAt:
        task.name === "get_signals" ? now : previous?.lastCheckedAt || null,
      lastChangedAt: changed ? now : previous?.lastChangedAt || null,
      error: null,
    });
    return { status: "ok", resource: task.name, changed };
  } catch {
    if (previous)
      await publish({
        ...previous,
        error:
          "Signal or baseline check failed. Retaining the last validated snapshot.",
      }).catch(() => {});
    return { status: "error" };
  } finally {
    await redis.command(["EVAL", releaseScript, 1, keys.lease, owner]);
  }
}
