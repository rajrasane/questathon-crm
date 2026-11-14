import { readFile } from 'node:fs/promises';
import { importRuntime } from './pipeline.js';
if(!process.argv[2])throw new Error('Provide the private bundle path');
try {await importRuntime(JSON.parse(await readFile(process.argv[2],'utf8')));console.log('Private bundle validated and normalized.');}
catch {console.error('Private import failed validation. No account details printed.');process.exitCode=1;}
