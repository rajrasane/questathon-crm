import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
test('production browser assets exclude server credentials, transport and synthetic fixtures',async t=>{
 let files:string[];try{files=await readdir('dist/assets');}catch{t.skip('Run npm run build before this check');return;}
 const content=(await Promise.all(files.map(f=>readFile(join('dist/assets',f),'utf8')))).join('\n');
 for(const forbidden of ['AQ_TOKEN','CRM_INGESTION_OWNER','api/public/mcp','synthetic-test-secret','Synthetic test account'])assert.equal(content.includes(forbidden),false,`Browser bundle includes ${forbidden}`);
});
