import {parseCsv} from './csv';
import type {Source} from './model';
export function usageSeries(sources:Source[],account:string){
 const records=sources.filter(s=>s.account===account && s.title.endsWith('usage_weekly.csv') && (s.origin==='paperwork'||s.origin==='signal')).sort((a,b)=>(a.origin==='signal'?1:0)-(b.origin==='signal'?1:0)||(a.eventDate||'').localeCompare(b.eventDate||''));
 const rows=new Map<string,{week:string;dock:string;flights:number;sourceId:string}>();
 try{for(const s of records)for(const r of parseCsv(s.excerpt)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.week_start)||!Number.isFinite(Date.parse(r.week_start))||!r.dock_id||!/^\d+$/.test(r.flights)||!Number.isSafeInteger(Number(r.flights)))return {points:[],invalid:true};
  rows.set(`${r.week_start}:${r.dock_id}`,{week:r.week_start,dock:r.dock_id,flights:Number(r.flights),sourceId:s.id});
 }}catch{return {points:[],invalid:true};}
 const weeks=new Map<string,{week:string;flights:number;docks:number;sourceIds:string[]}>();
 for(const row of rows.values()){const v=weeks.get(row.week)||{week:row.week,flights:0,docks:0,sourceIds:[]};v.flights+=row.flights;v.docks++;v.sourceIds=[...new Set([...v.sourceIds,row.sourceId])];weeks.set(row.week,v);}
 return {points:[...weeks.values()].sort((a,b)=>a.week.localeCompare(b.week)),invalid:false};
}
