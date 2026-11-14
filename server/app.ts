import express from 'express';
import { resolve } from 'node:path';
import { readWorkspace, privateDir } from './storage.js';
import { ingestionStatus } from './pipeline.js';
export async function createApp({dir=privateDir,production=process.env.NODE_ENV==='production'}:{dir?:string;production?:boolean}={}) {
 const app=express();app.disable('x-powered-by');
 app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');next();});
 app.use((req,res,next)=>{let path:string;try{path=decodeURIComponent(req.path);}catch{res.sendStatus(400);return;}if(/(?:^|\/)\.private(?:\/|$)|(?:^|\/)server(?:\/|$)/.test(path)){res.sendStatus(404);return;}next();});
 app.get('/api/workspace',async(_req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({...await readWorkspace(dir),ingestion:await ingestionStatus(dir)});}catch{res.status(500).json({state:'error',snapshot:null,message:'Private cache status unavailable.',loadedAt:null});}});
 app.use('/api',(_req,res)=>{res.status(404).json({error:'No such operation'});});
 let close=async()=>{};
 if(production)app.use(express.static(resolve('dist')));
 else{const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);close=()=>vite.close();}
 return {app,close};
}
