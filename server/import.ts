import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { snapshotSchema } from '../src/model.js';
import { atomicWrite, privateDir } from './storage.js';
const path=process.argv[2];
if(!path)throw new Error('Usage: npx tsx server/import.ts /private/path/snapshot.json');
try {
 const snapshot=snapshotSchema.parse(JSON.parse(await readFile(path,'utf8')));
 await atomicWrite(join(privateDir,'snapshot.json'),snapshot);
 console.log('Private snapshot validated and imported.');
} catch {console.error('Import rejected: invalid snapshot or inaccessible file. Existing data was preserved.');process.exitCode=1;}
