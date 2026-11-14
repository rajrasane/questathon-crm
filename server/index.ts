import express from 'express';
import { resolve } from 'node:path';
import { readWorkspace } from './storage.js';
const app=express();
app.disable('x-powered-by');
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');next();});
app.get('/api/workspace',async(_req,res)=>{res.setHeader('Cache-Control','no-store');res.json(await readWorkspace());});
app.use('/api',(_req,res)=>{res.status(404).json({error:'No such operation'});});
if(process.env.NODE_ENV==='production')app.use(express.static(resolve('dist')));
else {const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
const port=Number(process.env.PORT || 3000);
app.listen(port,process.env.HOST || '127.0.0.1',()=>console.log(`Account Brief listening on port ${port}`));
