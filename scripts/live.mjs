import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

if (!stdin.isTTY || !stdout.isTTY) {
 console.error('Start this command in your own interactive terminal. Do not pipe a credential.');
 process.exit(1);
}
try {
 await readFile(resolve(process.env.CRM_DATA_DIR || '.private', 'bundle.json'));
} catch {
 console.error('Import the private runtime bundle before starting live mode.');
 process.exit(1);
}
const rl=createInterface({input:stdin,output:stdout});
console.log('This server will become the only MCP caller. Stop Work and every other caller first.');
const confirmed=await rl.question('Have all other MCP callers stopped? Type yes to confirm: ');
rl.close();
if(confirmed.trim().toLowerCase()!=='yes') {
 console.log('Live mode was not started. Cached mode remains available with npm run dev.');
 process.exit(0);
}
function hiddenToken() {
 return new Promise((resolveToken,reject)=>{
  let token='';
  stdout.write('MCP token (hidden; kept in process memory only): ');
  stdin.setRawMode(true);stdin.setEncoding('utf8');stdin.resume();
  function finish(error) {stdin.off('data',receive);stdin.setRawMode(false);stdin.pause();stdout.write('\n');if(error)reject(error);else resolveToken(token.trim());}
  function receive(chunk) {
   for(const char of chunk) {
    if(char==='\u0003'){finish(new Error('Cancelled.'));return;}
    if(char==='\r'||char==='\n'){finish();return;}
    if(char==='\u007f'||char==='\b'){token=token.slice(0,-1);continue;}
    if(char>=' ')token+=char;
   }
  }
  stdin.on('data',receive);
 });
}
let token;
try {token=await hiddenToken();}catch{console.error('Cancelled.');process.exit(1);}
if(!token){console.error('No token entered. Live mode was not started.');process.exit(1);}
console.log('Starting live mode. The first signal check waits 65 seconds to allow the previous caller’s cooldown.');
console.log('Use npm run live:status in another terminal to verify the result.');
const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{
 stdio:'inherit',env:{...process.env,AQ_TOKEN:token,CRM_INGESTION_OWNER:'this-process'},
});
token=undefined;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>{console.error('Could not start the account server.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
