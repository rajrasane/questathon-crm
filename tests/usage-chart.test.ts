import test from 'node:test';import assert from 'node:assert/strict';import {usageSeries} from '../src/usageChart.js';import type {Source} from '../src/model.js';
const source=(id:string,text:string,origin:Source['origin']='paperwork',account='SYNTH'):Source=>({id,title:'usage_weekly.csv',account,origin,excerpt:text,locator:'Synthetic fixture',retrievedAt:null,eventDate:origin==='signal'?'2030-02-01':undefined});
const csv='week_start,dock_id,flights\n';
test('chart replaces updated device-week rows, preserves provenance and excludes other accounts',()=>{
 const p=usageSeries([source('base',csv+'2030-01-07,D1,10\n2030-01-07,D2,5\n2030-01-21,D1,0'),source('update',csv+'2030-01-07,D1,12','signal'),source('other',csv+'2030-01-07,D1,99','paperwork','OTHER')],'SYNTH').points;
 assert.deepEqual(p,[{week:'2030-01-07',flights:17,docks:2,sourceIds:['update','base']},{week:'2030-01-21',flights:0,docks:1,sourceIds:['base']}]);
});
test('chart keeps missing data distinct from zero and refuses invalid measurements',()=>{
 assert.deepEqual(usageSeries([],'SYNTH'),{points:[],invalid:false});
 assert.equal(usageSeries([source('bad',csv+'2030-01-07,D1,unknown')],'SYNTH').invalid,true);
 assert.equal(usageSeries([source('zero',csv+'2030-01-07,D1,0')],'SYNTH').points[0].flights,0);
});
