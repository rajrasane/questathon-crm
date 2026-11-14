import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingestionStep } from "../server/bootstrap.js";
import { readWorkspace } from "../server/storage.js";
const discovery = {
  format: "account-quest-v2-export/1",
  exported_at: "2030-01-01T00:00:00.000Z",
  accounts: [
    {
      id: "SYNTHETIC",
      name: "Synthetic bootstrap account",
      stakeholders: [],
      facts: [],
      opportunities: [],
      offers: [],
    },
  ],
  files: [
    {
      id: "synthetic-file",
      title: "Synthetic file",
      path: "synthetic.csv",
      account: "SYNTHETIC",
    },
  ],
};
function mocked(calls: string[]): typeof fetch {
  return async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push(body.params.name);
    let data: unknown;
    if (body.params.name === "get_my_accounts") data = discovery;
    else if (body.params.name === "get_all_paperwork")
      data = {
        account: "SYNTHETIC",
        records: [
          {
            path: "contract.txt",
            kind: "contract",
            text: "Synthetic contract, no financial amount supplied.",
          },
        ],
      };
    else if (body.params.name === "get_file")
      data = {
        id: "synthetic-file",
        name: "synthetic.csv",
        text: "field,value\nsynthetic,1\n",
      };
    else data = { signals: [] };
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          content: [{ type: "text", text: JSON.stringify(data) }],
          isError: false,
        },
      }),
      { status: 200 },
    );
  };
}
async function run(action: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "crm-bootstrap-"));
  const owner = process.env.CRM_INGESTION_OWNER,
    token = process.env.AQ_TOKEN;
  try {
    process.env.CRM_INGESTION_OWNER = "this-process";
    process.env.AQ_TOKEN = "synthetic-only";
    await action(dir);
  } finally {
    if (owner === undefined) delete process.env.CRM_INGESTION_OWNER;
    else process.env.CRM_INGESTION_OWNER = owner;
    if (token === undefined) delete process.env.AQ_TOKEN;
    else process.env.AQ_TOKEN = token;
    await rm(dir, { recursive: true, force: true });
  }
}
test("empty storage fetches from MCP first, caches each baseline once, then checks signals", () =>
  run(async (dir) => {
    const calls: string[] = [];
    const request = mocked(calls);
    let now = 100000;
    for (let i = 0; i < 5; i++) {
      await ingestionStep(dir, request, () => now);
      now += 65000;
    }
    assert.deepEqual(calls, [
      "get_my_accounts",
      "get_all_paperwork",
      "get_file",
      "get_signals",
      "get_signals",
    ]);
    const snapshot = (await readWorkspace(dir)).snapshot!;
    assert.equal(snapshot.accounts[0].name, discovery.accounts[0].name);
    assert.ok(
      snapshot.sources.some(
        (s) => s.id === "synthetic-file" && s.excerpt.includes("synthetic,1"),
      ),
    );
  }));
test("bootstrap resumes after restart and respects the same cooldown as signal polling", () =>
  run(async (dir) => {
    const calls: string[] = [];
    const request = mocked(calls);
    let now = 100000;
    await ingestionStep(dir, request, () => now);
    await ingestionStep(dir, request, () => now);
    assert.equal(calls.length, 1);
    now += 65000;
    await ingestionStep(dir, request, () => now);
    assert.deepEqual(calls, ["get_my_accounts", "get_all_paperwork"]);
    const cache = JSON.parse(await readFile(join(dir, "bundle.json"), "utf8"));
    assert.equal(cache.accounts.accounts.length, 1);
  }));
test("missing credentials never sends a request or creates fake account records", () =>
  run(async (dir) => {
    delete process.env.AQ_TOKEN;
    const calls: string[] = [];
    await ingestionStep(dir, mocked(calls));
    assert.equal(calls.length, 0);
    assert.equal((await readWorkspace(dir)).snapshot, null);
  }));
test("failed initial response can retry without a manual import or losing validated cache", () =>
  run(async (dir) => {
    let attempts = 0;
    let now = 100000;
    const calls: string[] = [];
    const success = mocked(calls);
    const request: typeof fetch = async (url, init) => {
      attempts++;
      return attempts === 1
        ? new Response("failure", { status: 503 })
        : success(url, init);
    };
    await ingestionStep(dir, request, () => now);
    assert.equal((await readWorkspace(dir)).snapshot, null);
    now += 65000;
    await ingestionStep(dir, request, () => now);
    assert.equal((await readWorkspace(dir)).snapshot?.accounts.length, 1);
  }));
test("a surprise third account is discovered without refetching existing paperwork or bypassing cooldown", () =>
  run(async (dir) => {
    const account = (id: string) => ({
      id,
      name: `Synthetic account ${id}`,
      stakeholders: [],
      facts: [],
      opportunities: [],
      offers: [],
    });
    let expanded = false;
    let now = 100000;
    const calls: { name: string; account?: string }[] = [];
    const request: typeof fetch = async (_url, init) => {
      const params = JSON.parse(String(init?.body)).params;
      calls.push({ name: params.name, account: params.arguments.account });
      const data =
        params.name === "whoami" ? {new_accounts:expanded?[{id:"SYNTH-Z",name:"Synthetic released account"}]:[]} : params.name === "get_new_account" ? {...discovery,accounts:[account("SYNTH-Z")],files:[]} : params.name === "get_my_accounts"
          ? {
              ...discovery,
              accounts: [
                account("SYNTH-X"),
                account("SYNTH-Y"),
              ],
              files: [],
            }
          : params.name === "get_all_paperwork"
            ? { account: params.arguments.account, records: [] }
            : { signals: [] };
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { content: [{ type: "text", text: JSON.stringify(data) }] },
        }),
      );
    };
    for (let i = 0; i < 4; i++) {
      await ingestionStep(dir, request, () => now);
      now += 65000;
    }
    assert.equal((await readWorkspace(dir)).snapshot?.accounts.length, 2);
    expanded = true;
    now += 10 * 60000;
    await ingestionStep(dir, request, () => now);
    assert.equal((await readWorkspace(dir)).snapshot?.accounts.length, 2);
    now += 65000;
    await ingestionStep(dir, request, () => now);
    assert.equal((await readWorkspace(dir)).snapshot?.accounts.length, 3);
    const count = calls.length;
    await ingestionStep(dir, request, () => now);
    assert.equal(calls.length, count);
    now += 65000;
    await ingestionStep(dir, request, () => now);
    assert.equal(calls.at(-1)?.account, "SYNTH-Z");
    for (const id of ["SYNTH-X", "SYNTH-Y", "SYNTH-Z"])
      assert.equal(
        calls.filter((c) => c.name === "get_all_paperwork" && c.account === id)
          .length,
        1,
      );
    assert.ok(
      (await readWorkspace(dir)).snapshot?.accounts.every(
        (a) => a.actions.length === 3 && a.bookValue.amount === null,
      ),
    );
  }));
