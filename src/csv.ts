// Shared CSV reader: quoted fields and newlines, no formula execution.
export function parseCsv(text:string):Record<string,string>[] {
 const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
 for(let i=0;i<text.length;i++) {const c=text[i];if(c==='"'){if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('Unclosed CSV quote');if(cell || row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}const headers=rows.shift()||[];
 return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]||''])));
}
