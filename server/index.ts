import { createApp } from './app.js';
import { startIngestion } from './bootstrap.js';
const {app}=await createApp();
const portArg=process.argv.indexOf('--port');
const port=Number(process.env.PORT || (portArg>=0?process.argv[portArg+1]:3000));
app.listen(port,process.env.HOST || '127.0.0.1',()=>console.log(`Account Brief listening on port ${port}`));
startIngestion();
