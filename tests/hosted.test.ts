import test from "node:test";
import assert from "node:assert/strict";
import {
  acquireScript,
  publishScript,
  releaseScript,
  authenticated,
  hostedStep,
  hostedWorkspace,
  RestRedis,
  type Redis,
} from "../server/hosted.js";
class MemoryRedis implements Redis {
  state: string | null = null;
  lease: string | null = null;
  next = 0;
  now = 0;
  async command(a: (string | number)[]): Promise<unknown> {
    if (a[0] === "GET") return this.state;
    if (a[1] === acquireScript) {
      if (this.lease || this.now < this.next) return 0;
      this.lease = String(a[5]);
      this.next = this.now + 61000;
      return 1;
    }
    if (a[1] === publishScript) {
      if (this.lease !== a[5]) return 0;
      this.state = String(a[6]);
      return 1;
    }
    if (a[1] === releaseScript) {
      if (this.lease === a[4]) this.lease = null;
      return 1;
    }
    throw Error("Unexpected command");
  }
}
const discovery = {
  format: "account-quest-v2-export/1",
  exported_at: "2035-01-01T00:00:00.000Z",
  accounts: [
    {
      id: "SYNTH",
      name: "Synthetic hosted account",
      stakeholders: [],
      facts: [],
      opportunities: [],
      offers: [],
    },
  ],
  files: [],
};
const response = (data: unknown) =>
  new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [{ type: "text", text: JSON.stringify(data) }],
        isError: false,
      },
    }),
  );
test("hosted state persists across instances; shared cooldown and failed calls consume budget", async () => {
  const owner = process.env.CRM_INGESTION_OWNER,
    token = process.env.AQ_TOKEN;
  let calls = 0;
  const redis = new MemoryRedis();
  const request: typeof fetch = async (_url, options) => {
    calls++;
    assert.ok(
      new Headers(options?.headers)
        .get("Accept")
        ?.includes("text/event-stream"),
    );
    const body = JSON.parse(String(options?.body));
    return response(
      body.params.name === "get_my_accounts"
        ? discovery
        : body.params.name === "get_all_paperwork"
          ? { account: "SYNTH", records: [] }
          : { signals: [] },
    );
  };
  try {
    delete process.env.CRM_INGESTION_OWNER;
    assert.equal((await hostedStep(redis, request)).status, "disabled");
    assert.equal(calls, 0);
    process.env.CRM_INGESTION_OWNER = "hosted";
    process.env.AQ_TOKEN = "synthetic-hosted-secret";
    assert.equal((await hostedStep(redis, request)).status, "ok");
    assert.equal(calls, 1);
    await hostedStep(redis, request);
    assert.equal(calls, 1);
    redis.now += 61000;
    await hostedStep(redis, request);
    assert.equal(calls, 2);
    redis.now += 61000;
    await hostedStep(redis, request);
    assert.equal(calls, 3);
    const first = JSON.parse(redis.state!).snapshot.generatedAt;
    redis.now += 61000;
    const same = await hostedStep(redis, request);
    assert.equal("changed" in same && same.changed, false);
    assert.equal(JSON.parse(redis.state!).snapshot.generatedAt, first);
    const workspace = await hostedWorkspace(redis);
    assert.equal(workspace.snapshot?.accounts.length, 1);
    assert.equal(workspace.snapshot?.accounts[0].actions.length, 3);
    assert.ok(!("bundle" in workspace));
    assert.ok(workspace.ingestion?.lastCheckedAt);
    redis.now += 61000;
    await hostedStep(redis, async () => {
      calls++;
      throw Error("Synthetic failure");
    });
    const failedCalls = calls;
    await hostedStep(redis, request);
    assert.equal(calls, failedCalls);
    assert.equal(JSON.parse(redis.state!).snapshot.generatedAt, first);
    assert.ok(JSON.parse(redis.state!).error);
  } finally {
    if (owner === undefined) delete process.env.CRM_INGESTION_OWNER;
    else process.env.CRM_INGESTION_OWNER = owner;
    if (token === undefined) delete process.env.AQ_TOKEN;
    else process.env.AQ_TOKEN = token;
  }
});
test("ingestion authorization fails closed and Redis errors never disclose credentials", async () => {
  assert.equal(authenticated(undefined, "secret"), false);
  assert.equal(authenticated("Bearer wrong", "secret"), false);
  assert.equal(authenticated("Bearer secret", "secret"), true);
  assert.equal(authenticated("Bearer secret", ""), false);
  const redis = new RestRedis(
    "https://synthetic.invalid",
    "synthetic-redis-secret",
    async () =>
      new Response(JSON.stringify({ error: "synthetic-redis-secret" })),
  );
  await assert.rejects(
    redis.command(["GET", "test"]),
    (e) => e instanceof Error && !e.message.includes("synthetic-redis-secret"),
  );
  const failed = await hostedWorkspace(redis);
  assert.equal(failed.state, "error");
  assert.equal(failed.snapshot, null);
});
test("empty durable store is unconfigured and a lost lease cannot overwrite current state", async () => {
  const redis = new MemoryRedis();
  assert.equal((await hostedWorkspace(redis)).state, "unconfigured");
  redis.lease = "new-owner";
  assert.equal(
    await redis.command([
      "EVAL",
      publishScript,
      2,
      "lease",
      "state",
      "old-owner",
      "invalid",
    ]),
    0,
  );
  assert.equal(redis.state, null);
  assert.ok(acquireScript.includes("61000"));
  assert.ok(releaseScript.includes("redis.call('GET'"));
});

test("hosted changed signals reanalyze once and preserve event versions", async () => {
  const owner = process.env.CRM_INGESTION_OWNER,
    token = process.env.AQ_TOKEN;
  const redis = new MemoryRedis();
  let summary = "A synthetic operational change.";
  const request: typeof fetch = async (_url, options) => {
    const name = JSON.parse(String(options?.body)).params.name;
    return response(
      name === "get_my_accounts"
        ? discovery
        : name === "get_all_paperwork"
          ? { account: "SYNTH", records: [] }
          : {
              signals: [
                {
                  id: "synthetic-event",
                  account: "SYNTH",
                  dated: "2035-01-02",
                  title: "Synthetic change",
                  summary,
                  records: [],
                },
              ],
            },
    );
  };
  try {
    process.env.CRM_INGESTION_OWNER = "hosted";
    process.env.AQ_TOKEN = "synthetic-only";
    for (let i = 0; i < 3; i++) {
      redis.now = i * 61000;
      await hostedStep(redis, request);
    }
    let state = JSON.parse(redis.state!);
    assert.equal(state.events.length, 1);
    assert.equal(state.snapshot.accounts[0].signals.length, 1);
    summary = "The programme lead is leaving; no successor is named.";
    redis.now += 61000;
    const changed = await hostedStep(redis, request);
    assert.ok("changed" in changed && changed.changed);
    state = JSON.parse(redis.state!);
    assert.equal(state.events.length, 2);
    assert.equal(state.snapshot.accounts[0].signals.length, 1);
    assert.equal(
      state.snapshot.accounts[0].actions[0].title,
      "Secure a successor and decision-maker introductions",
    );
    redis.now += 61000;
    await hostedStep(redis, request);
    assert.equal(JSON.parse(redis.state!).events.length, 2);
  } finally {
    if (owner === undefined) delete process.env.CRM_INGESTION_OWNER;
    else process.env.CRM_INGESTION_OWNER = owner;
    if (token === undefined) delete process.env.AQ_TOKEN;
    else process.env.AQ_TOKEN = token;
  }
});
