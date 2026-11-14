import { copyFile, chmod } from 'node:fs/promises';
import { constants } from 'node:fs';
try {
 await copyFile('.env.example','.env.local',constants.COPYFILE_EXCL);
 await chmod('.env.local',0o600);
 console.log('Created .env.local. Add AQ_TOKEN there; this file is ignored by Git.');
} catch(error) {
 if(error.code==='EEXIST')console.log('.env.local already exists; preserved without changes.');
 else throw error;
}
