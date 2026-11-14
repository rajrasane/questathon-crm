import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
let status;
try{status=JSON.parse(await readFile(resolve(process.env.CRM_DATA_DIR || '.private','poll-status.json'),'utf8'));}
catch{console.log('No successful live-check record yet. Start npm run live and allow at least 65 seconds.');process.exit(0);}
console.log(`Last successful signal check: ${status.lastCheckedAt || 'none'}`);
console.log(`Last data change: ${status.lastChangedAt || 'none recorded'}`);
console.log(`Latest check: ${status.error || 'succeeded'}`);
console.log('This is the persisted check record. Confirm the live server is still running in its terminal.');
