import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decodeToolResult } from '../server/adapter.js';
import { dealSchema, statementSchema, money, type Deal } from '../src/model.js';
import { Deals } from '../src/Deals.js';
import { StatementView } from '../src/StatementView.js';
const unknownMoney={amount:null,currency:null,basis:'unknown' as const,sourceIds:[]};
function deal():Deal{return {key:'synthetic-only',title:'Synthetic test opportunity',sourceIds:['test-source'],stage:{text:'Identified',kind:'reported',sourceIds:['test-source']},worthUpTo:unknownMoney,blockers:null,deadline:null,deadlineSourceIds:[],offers:null};}
test('MCP JSON text is decoded before output validation',()=>{
 const result=decodeToolResult({content:[{type:'text',text:'{"count":3}'}],isError:false});assert.deepEqual(result,{count:3});
 assert.throws(()=>decodeToolResult({content:[{type:'text',text:'not JSON'}],isError:false}),/valid JSON/);
 assert.throws(()=>decodeToolResult({content:[],isError:false}));
 assert.throws(()=>decodeToolResult({content:[{type:'image',text:'{}'}]}),/first MCP/);
 assert.throws(()=>decodeToolResult({content:[{type:'text',text:'{}'}],isError:true}),/tool error/);
 assert.throws(()=>decodeToolResult({count:3}));
});
test('claim, told, reported and verified retain distinct source-backed semantics',()=>{
 for(const kind of ['claim','told','reported','verified'] as const){
  assert.equal(statementSchema.parse({text:'Synthetic statement',kind,sourceIds:['test-source']}).kind,kind);
  assert.equal(statementSchema.safeParse({text:'Synthetic statement',kind,sourceIds:[]}).success,false);
 }
});
test('per-deal null values stay unknown with no assumed currency',()=>{
 const parsed=dealSchema.parse(deal());assert.equal(parsed.worthUpTo.amount,null);assert.equal(parsed.worthUpTo.currency,null);assert.equal(money(parsed.worthUpTo),'Unknown');assert.equal(parsed.blockers,null);assert.equal(parsed.deadline,null);
 const html=renderToStaticMarkup(createElement(Deals,{deals:[parsed],citations:ids=>ids.join(','),statement:s=>`${s.kind}: ${s.text}`}));
 assert.match(html,/Synthetic test opportunity/);assert.match(html,/test-source/);assert.match(html,/Unknown — confirm blockers/);assert.match(html,/Unknown — confirm timing/);assert.doesNotMatch(html,/€|\$0|£/);
});
test('open, declined and won offers are preserved without calculating revenue',()=>{
 const data=deal();data.offers=['open','declined','won'].map(status=>({title:'Synthetic offer',sourceIds:['test-source'],status:status as 'open'|'declined'|'won',statusSourceIds:['test-source'],value:unknownMoney}));
 const parsed=dealSchema.parse(data);assert.deepEqual(parsed.offers?.map(o=>o.status),['open','declined','won']);
 const html=renderToStaticMarkup(createElement(Deals,{deals:[parsed],citations:()=>null,statement:s=>s.text}));assert.match(html,/Won offers do not automatically become booked value/);
 data.offers[0].statusSourceIds=[];assert.equal(dealSchema.safeParse(data).success,false);
});
test('a missing deal list and an empty deal list remain distinct',()=>{
 const props={citations:()=>null,statement:(s:{text:string})=>s.text};
 assert.match(renderToStaticMarkup(createElement(Deals,{...props,deals:null})),/Deal records are pending/);
 assert.match(renderToStaticMarkup(createElement(Deals,{...props,deals:[]})),/No deals are listed/);
});

test('claim rendering stays visibly distinct from reported and verified',()=>{
 for(const kind of ['claim','told','reported','verified'] as const){
  const html=renderToStaticMarkup(createElement(StatementView,{value:{text:'Synthetic assertion',kind,sourceIds:['test-source']},citations:ids=>ids.join(',')}));
  assert.ok(html.includes(`class="label ${kind}">${kind}</span>`));assert.match(html,/test-source/);
 }
});
test('JSON and SSE transports produce the same RPC envelope',async()=>{
 const {readRpcResponse}=await import('../server/adapter.js');
 const envelope={jsonrpc:'2.0',id:'synthetic',result:{content:[{type:'text',text:'{}'}]}};
 assert.deepEqual(await readRpcResponse(new Response(JSON.stringify(envelope),{headers:{'Content-Type':'application/json'}})),envelope);
 assert.deepEqual(await readRpcResponse(new Response(`: keepalive\n\nevent: message\ndata: ${JSON.stringify(envelope)}\n\n`,{headers:{'Content-Type':'text/event-stream'}})),envelope);
 await assert.rejects(readRpcResponse(new Response('data: not-json\n\n',{headers:{'Content-Type':'text/event-stream'}})));
});
