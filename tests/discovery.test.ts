import test from "node:test";
import assert from "node:assert/strict";
import {
  discoveryDue,
  mergeDiscovery,
  unknownAccountSignature,
} from "../server/discovery.js";
const exported = (id: string) => ({
  format: "account-quest-v2-export/1",
  exported_at: "2030-01-01T00:00:00.000Z",
  accounts: [
    {
      id,
      name: "Synthetic discovery account",
      stakeholders: [],
      facts: [],
      opportunities: [],
      offers: [],
    },
  ],
  files: [],
});
test("discovery refresh preserves cached packs, signals and known accounts on partial discovery responses", () => {
  const first = mergeDiscovery(null, exported("SYNTH-X"));
  first.paperwork_x = { account: "SYNTH-X", records: [] };
  first.signals = { signals: [] };
  const next = mergeDiscovery(first, exported("SYNTH-Z"));
  assert.equal(next.accounts.accounts.length, 2);
  assert.deepEqual(next.paperwork_x, first.paperwork_x);
  assert.deepEqual(next.signals, first.signals);
  assert.equal(
    mergeDiscovery(next, exported("SYNTH-Z")).accounts.accounts.length,
    2,
  );
});
test("unrecognized signal account triggers discovery early, while repeated unchanged unknowns do not create a discovery loop", () => {
  const b = mergeDiscovery(null, exported("SYNTH-X"));
  assert.equal(discoveryDue(b, 1000, "", 2000), false);
  b.signals = {
    signals: [
      {
        id: "synthetic-new-account",
        account: "SYNTH-Z",
        dated: "2030-01-02",
        title: "Synthetic account change",
        summary: "Synthetic report",
        records: [],
      },
    ],
  };
  assert.equal(unknownAccountSignature(b), "SYNTH-Z");
  assert.equal(discoveryDue(b, 1000, "", 2000), true);
  assert.equal(discoveryDue(b, 1000, "SYNTH-Z", 2000), false);
  assert.equal(discoveryDue(b, 1000, "SYNTH-Z", 601000), true);
});

test('released drops load through their own tools without discarding morning accounts', async()=>{
 const {pendingFetch}=await import('../server/bootstrap.js');
 const b=mergeDiscovery(null,exported('SYNTH-X'));
 b.released_accounts=[{id:'SYNTH-NEW',name:'Synthetic released account'}];
 assert.deepEqual(pendingFetch(b),{name:'get_new_account',args:{account:'SYNTH-NEW'}});
 const merged=mergeDiscovery(b,exported('SYNTH-NEW'));
 merged.dropAccountIds=['SYNTH-NEW'];
 for(const a of merged.accounts.accounts)merged['paperwork_'+a.id]={account:a.id,records:[]};
 merged.accounts.files=[{id:'synthetic-file',title:'Synthetic file',path:'synthetic.txt',account:'SYNTH-NEW'}];
 assert.deepEqual(pendingFetch(merged),{name:'get_new_account_file',args:{account:'SYNTH-NEW',file_id:'synthetic-file'}});
});
