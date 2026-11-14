import { createApp } from './app.js';
import { startIngestion } from './bootstrap.js';
import { reanalyzeCached } from './pipeline.js';
try { await reanalyzeCached(); } catch { console.error('Cached analysis could not be refreshed; retaining the last validated snapshot.'); }
const {app}=await createApp();
const portArg=process.argv.indexOf('--port');
const port=Number(process.env.PORT || (portArg>=0?process.argv[portArg+1]:3000));
app.listen(port,process.env.HOST || '127.0.0.1',()=>console.log(`Account Brief listening on port ${port}`));
startIngestion();
