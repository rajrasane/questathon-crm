import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
let status;
try{status=JSON.parse(await readFile(resolve(process.env.CRM_DATA_DIR || '.private','poll-status.json'),'utf8'));}
catch{
 try{const initial=JSON.parse(await readFile(resolve(process.env.CRM_DATA_DIR || '.private','bootstrap-status.json'),'utf8'));console.log(`Initial fetch: ${initial.phase}`);console.log(`Last completed resource: ${initial.lastCompletedTool || 'none yet'}`);if(initial.error)console.log(initial.error);}
 catch{console.log('Waiting for the first MCP fetch. Start npm run dev with the server credential configured.');}
 console.log('Initial resources load one per 65-second cycle; signal checks follow after baseline completion.');process.exit(0);
}
console.log(`Last successful signal check: ${status.lastCheckedAt || 'none'}`);
console.log(`Last data change: ${status.lastChangedAt || 'none recorded'}`);
console.log(`Latest check: ${status.error || 'succeeded'}`);
console.log('This is the persisted check record. Confirm the live server is still running in its terminal.');
