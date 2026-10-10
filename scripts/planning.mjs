#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table } from './lib/format.mjs';
import { page, table as htmlTable, writeOut } from './lib/render.mjs';
export const commands=['help','list','show','buy-plan','shortages','excess','forecast','backtest','supplier-review','late-orders','attention','reviews','compliance','activity','weekly-review','scenario','add','update','log','resolve','override','order','receive','demand','import','export','draft-order','draft-review'];
const numeric=new Set(['on_hand','allocated','unit_cost','lead_days','review_days','safety_days','moq','pack']);
const ints=new Set(['lead_days','review_days','safety_days']);
const dates=new Set(['stock_asof','history_start','history_through']);
const editable=['name','supplier','owner','currency',...numeric,...dates,'active'];
function need(v,k){if(v===undefined||v===null||String(v).trim()==='')throw Error(`Required: --${k}`);return String(v).trim();}
function num(v,k,min=0){const n=Number(need(v,k));if(!Number.isFinite(n)||n<min)throw Error(`${k} must be a finite number >= ${min}`);return n;}
function date(v,k){const s=need(v,k);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error(`${k} must be a real YYYY-MM-DD date`);return s;}
function val(k,v){if(v==='null')return null;if(numeric.has(k)){const n=num(v,k,k==='pack'?Number.MIN_VALUE:0);if(ints.has(k)&&!Number.isInteger(n))throw Error(`${k} must be an integer`);return n;}if(dates.has(k))return date(v,k);if(k==='active'){if(!['true','false'].includes(String(v)))throw Error('active must be true or false');return String(v)==='true';}if(k==='currency'&&!/^[A-Z]{3}$/.test(v))throw Error('currency must be a three-letter uppercase code');return need(v,k);}
export async function match(db,ref){ref=need(ref,'ref');const rows=await db.query(`SELECT * FROM positions WHERE lower(sku||'@'||location)=lower($1) OR id::text=$1 OR id::text LIKE $2 OR lower(sku)=lower($1) OR lower(name) LIKE $3 ORDER BY sku,location`,[ref,ref+'%', '%'+ref.toLowerCase()+'%']);if(rows.length!==1)throw Error(rows.length?`Ambiguous reference; use SKU@location or id:\n${rows.map(r=>`${r.id} ${r.sku}@${r.location} ${r.name}`).join('\n')}`:`No item matches ${ref}`);return rows[0];}
async function tx(db,fn,dry=false){await db.exec('BEGIN');try{const result=await fn();await db.exec(dry?'ROLLBACK':'COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}
async function audit(db,p,action,actor,before,after,evidence){await db.query('INSERT INTO activity(position_id,action,actor,before_data,after_data,evidence) VALUES($1,$2,$3,$4,$5,$6)',[p,action,actor,before?JSON.stringify(before):null,after?JSON.stringify(after):null,evidence]);}
const reads={
 'list':'SELECT id,sku,location,name,supplier,owner,active FROM positions ORDER BY sku,location',
 'buy-plan':"SELECT * FROM v_plan WHERE buy_units>0 OR readiness<>'ready' ORDER BY currency,buy_cost DESC NULLS LAST,sku,location",
 'shortages':"SELECT sku,location,readiness,days_cover,lead_days,available,inbound FROM v_plan JOIN positions USING(id,sku,location) WHERE v_plan.readiness='ready' AND days_cover<lead_days ORDER BY days_cover,sku",
 'excess':"SELECT sku,location,currency,excess_units,round(excess_units*unit_cost,2) AS excess_cost FROM v_plan JOIN positions USING(id,sku,location,currency) WHERE excess_units>0 ORDER BY currency,excess_units DESC",
 'forecast':"SELECT sku,location,readiness,round(daily_units,3) daily_units,units_90,forecast_basis,override_until FROM v_demand ORDER BY sku,location",
 'backtest':"SELECT sku,location,round(units_prev60/2.0,2) predicted_last30,units_30 actual_last30,round(abs(units_prev60/2.0-units_30),2) absolute_period_error FROM v_demand WHERE history_start<=current_date-90 AND history_through>=current_date-1 ORDER BY absolute_period_error DESC,sku",
 'supplier-review':"SELECT supplier,currency,count(*) FILTER(WHERE buy_units>0) lines_to_buy,coalesce(sum(buy_cost),0) proposed_cost,count(*) FILTER(WHERE readiness<>'ready') blocked_lines FROM v_plan GROUP BY supplier,currency ORDER BY supplier,currency",
 'late-orders':"SELECT o.reference,p.sku,p.location,o.units-o.received outstanding,o.due,current_date-o.due days_late FROM orders o JOIN positions p ON p.id=o.position_id WHERE o.status='open' AND o.units>o.received AND o.due<current_date ORDER BY o.due,o.reference",
 'attention':'SELECT * FROM v_attention ORDER BY issue,sku,location',
 'reviews':"SELECT r.id,p.sku,p.location,r.note,r.actor,r.due,r.resolved FROM reviews r JOIN positions p ON p.id=r.position_id ORDER BY r.due,r.id",
 'compliance':'SELECT * FROM v_compliance ORDER BY rule,sku,location',
 'activity':'SELECT * FROM activity ORDER BY created_at DESC,id DESC LIMIT 100'
};
const aliases={sku:['Item code','Code','Item','SKU'],location:['Location','Warehouse'],name:['Description','Name'],on_hand:['Stock on hand','On hand','On Hand','Quantity'],allocated:['Allocated','Committed'],unit_cost:['Unit cost','Cost price'],lead_days:['Lead time','Lead time days'],review_days:['Review days'],safety_days:['Safety days'],moq:['MOQ','Minimum order quantity'],pack:['Pack size','Order multiple'],supplier:['Supplier'],owner:['Owner','Planner'],currency:['Currency'],stock_asof:['Stock date','As of'],history_start:['History start'],history_through:['History through'],source_value:['Value','Stock value'],source_model_value:['Model value']};
async function importRows(db,kind,o,actor){
 const filename=path.resolve(need(o.file,'file'));const input=fs.readFileSync(filename,'utf8');const rows=parseCsv(input);if(!rows.length)throw Error('No data rows');
 const mapping=o.map?JSON.parse(fs.readFileSync(o.map,'utf8')):{};
 for(const k of Object.keys(mapping))if(!Object.keys(aliases).includes(k))throw Error(`Unknown mapping field ${k}`);
 const seen=new Set();let inserted=0,updated=0,unchanged=0;
 return tx(db,async()=>{
 for(const [index,row] of rows.entries()){
  if(kind==='netstock'){
   const out={};for(const [k,names] of Object.entries(aliases)){const x=pick(row,...(mapping[k]?[mapping[k]]:[]),k,...names);if(x!=='')out[k]=numeric.has(k)||dates.has(k)||k==='currency'?val(k,x):k.startsWith('source_')?num(x,k):x;}
   out.sku=need(out.sku,`item code in row ${index+2}`);out.location=need(out.location||o.location,`location in row ${index+2}`);out.name=out.name||out.sku;
   const key=out.sku+'@'+out.location;if(seen.has(key))throw Error(`Duplicate item/location in import: ${key}`);seen.add(key);
   const old=(await db.query('SELECT * FROM positions WHERE sku=$1 AND location=$2',[out.sku,out.location]))[0];
   // JSON object key order differs in PostgreSQL jsonb; compare canonical key order.
   const equalSource=old&&Object.keys(row).length===Object.keys(old.source).length&&Object.keys(row).every(k=>row[k]===old.source[k]);
   if(old&&Object.entries(out).every(([k,v])=>String(old[k])===String(v))&&equalSource){unchanged++;continue;}
   if(old&&!o.update)throw Error(`Changed row ${key}; review then use --update`);
   let result;
   if(old){const keys=Object.keys(out).filter(k=>!['sku','location'].includes(k));result=(await db.query(`UPDATE positions SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')},source=$${keys.length+1} WHERE id=$${keys.length+2} RETURNING *`,[...keys.map(k=>out[k]),JSON.stringify(row),old.id]))[0];updated++;}
   else{const keys=Object.keys(out);result=(await db.query(`INSERT INTO positions(${keys.join(',')},source) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')},$${keys.length+1}) RETURNING *`,[...Object.values(out),JSON.stringify(row)]))[0];inserted++;}
   await audit(db,result.id,'import netstock',actor,old,result,path.basename(filename));
  }else if(kind==='demand'){
   const p=await match(db,need(pick(row,'SKU'),'SKU')+'@'+need(pick(row,'Location'),'Location'));
   const day=date(pick(row,'Date'),'Date');if(day>=new Date().toISOString().slice(0,10))throw Error('Demand date must precede today');
   const units=num(pick(row,'Units'),'Units');const key=p.id+day;if(seen.has(key))throw Error('Duplicate demand day');seen.add(key);
   const old=(await db.query('SELECT * FROM demand WHERE position_id=$1 AND day=$2',[p.id,day]))[0];
   if(old&&Number(old.units)===units){unchanged++;continue;}if(old&&!o.update)throw Error('Changed demand; use --update after review');
   const result=(await db.query('INSERT INTO demand(position_id,day,units,source_ref) VALUES($1,$2,$3,$4) ON CONFLICT(position_id,day) DO UPDATE SET units=excluded.units,source_ref=excluded.source_ref RETURNING *',[p.id,day,units,path.basename(filename)]))[0];
   old?updated++:inserted++;await audit(db,p.id,'import demand',actor,old,result,path.basename(filename));
  }else throw Error('Import supports netstock or demand');
 }
 await db.query('INSERT INTO imports(filename,sha256,kind,row_count,actor) VALUES($1,$2,$3,$4,$5)',[path.basename(filename),createHash('sha256').update(input).digest('hex'),kind,rows.length,actor]);
 return {kind,rows:rows.length,inserted,updated,unchanged,dry_run:Boolean(o['dry-run'])};
 },Boolean(o['dry-run']));
}
export async function run(db,cmd,o={},args=[]){
 if(!commands.includes(cmd))throw Error(`Unknown command ${cmd}; use help`);
 if(cmd==='help')return commands.map(command=>({command}));
 if(reads[cmd])return db.query(reads[cmd]);
 if(cmd==='show'){const p=await match(db,o.ref);return {item:p,plan:await db.query('SELECT * FROM v_plan WHERE id=$1',[p.id]),orders:await db.query('SELECT * FROM orders WHERE position_id=$1 ORDER BY due',[p.id])};}
 if(cmd==='weekly-review')return {buy_plan:await run(db,'buy-plan'),attention:await run(db,'attention'),supplier_review:await run(db,'supplier-review')};
 if(cmd==='scenario'){const uplift=num(o['demand-percent']??0,'demand-percent',-100);const days=num(o['extra-lead']??0,'extra-lead',-365);if(!Number.isInteger(days))throw Error('extra-lead must be integer');return db.query('SELECT * FROM planning($1,$2) ORDER BY sku,location',[1+uplift/100,days]);}
 if(cmd==='export'){
  const dir=path.resolve(o.out||path.join(REPO_ROOT,'exports',new Date().toISOString().replace(/[:.]/g,'-')));fs.mkdirSync(dir,{recursive:true});
  const result=[];for(const t of ['positions','demand','orders','overrides','reviews','activity','imports']){const rows=await db.query(`SELECT * FROM ${t} ORDER BY id`);const file=path.join(dir,t+'.json');if(fs.existsSync(file))throw Error(`Export exists: ${file}`);fs.writeFileSync(file,JSON.stringify(rows,null,2)+'\n');result.push({records:t,count:rows.length,file});}return result;
 }
 if(cmd.startsWith('draft-')){
  const p=cmd==='draft-order'?await match(db,o.ref):null;
  const rows=p?await db.query('SELECT * FROM v_plan WHERE id=$1',[p.id]):await run(db,'attention');
  if(p&&(rows[0]?.readiness!=='ready'||Number(rows[0].buy_units)<=0))throw Error('No ready purchase suggestion for this item');
  const title=p?'Draft purchase request':'Draft weekly planning review';
  const file=writeOut('drafts',`${cmd}-${p?.id||'all'}-${Date.now()}`,page({title,subtitle:'DRAFT: human review required. Nothing sent or ordered.',sections:[{title:'Current records',html:htmlTable(rows)}]}));return {file,rows:rows.length};
 }
 const actor=need(o.actor,'actor');
 if(cmd==='import')return importRows(db,args[0],o,actor);
 return tx(db,async()=>{
  if(cmd==='add'){
   const keys=['sku','location','name'];const values=keys.map(k=>need(o[k],k));for(const k of editable.filter(k=>k!=='name'))if(o[k.replaceAll('_','-')]!==undefined){keys.push(k);values.push(val(k,o[k.replaceAll('_','-')]));}
   const row=(await db.query(`INSERT INTO positions(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,values))[0];await audit(db,row.id,cmd,actor,null,row,'manual entry');return row;
  }
  if(cmd==='resolve'){
   const ref=need(o.review,'review');const found=await db.query('SELECT * FROM reviews WHERE id::text LIKE $1',[ref+'%']);if(found.length!==1)throw Error(`Review needs unique id: ${found.map(x=>x.id).join(', ')}`);
   const old=found[0], row=(await db.query('UPDATE reviews SET resolved=true WHERE id=$1 RETURNING *',[old.id]))[0];await audit(db,old.position_id,cmd,actor,old,row,need(o.evidence,'evidence'));return row;
  }
  let p=await match(db,o.ref);
  // Row locks serialize stock and purchase receipts on the shared database.
  p=(await db.query('SELECT * FROM positions WHERE id=$1 FOR UPDATE',[p.id]))[0];
  if(cmd==='update'){
   const keys=editable.filter(k=>o[k.replaceAll('_','-')]!==undefined);if(!keys.length)throw Error('No editable fields supplied');const values=keys.map(k=>val(k,o[k.replaceAll('_','-')]));
   const row=(await db.query(`UPDATE positions SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${keys.length+1} RETURNING *`,[...values,p.id]))[0];await audit(db,p.id,cmd,actor,p,row,need(o.evidence,'evidence'));return row;
  }
  let row;
  if(cmd==='log')row=(await db.query('INSERT INTO reviews(position_id,note,actor,due) VALUES($1,$2,$3,$4) RETURNING *',[p.id,need(o.note,'note'),actor,date(o.due,'due')]))[0];
  if(cmd==='override'){
   const until=date(o.until,'until');if(until<new Date().toISOString().slice(0,10))throw Error('Override must expire today or later');
   row=(await db.query('INSERT INTO overrides(position_id,daily_units,valid_until,reason,actor) VALUES($1,$2,$3,$4,$5) RETURNING *',[p.id,num(o.daily,'daily'),until,need(o.reason,'reason'),actor]))[0];
  }
  if(cmd==='order')row=(await db.query('INSERT INTO orders(reference,position_id,units,due,evidence) VALUES($1,$2,$3,$4,$5) RETURNING *',[need(o.reference,'reference'),p.id,num(o.units,'units',Number.MIN_VALUE),date(o.due,'due'),need(o.evidence,'evidence')]))[0];
  if(cmd==='receive'){
   const ord=(await db.query('SELECT * FROM orders WHERE reference=$1 AND position_id=$2 FOR UPDATE',[need(o.reference,'reference'),p.id]))[0];if(!ord||ord.status!=='open')throw Error('Open order not found');
   const units=num(o.units,'units',Number.MIN_VALUE);if(Number(ord.received)+units>Number(ord.units))throw Error('Receipt exceeds outstanding quantity');
   if(p.on_hand===null||!p.stock_asof||p.stock_asof<new Date(Date.now()-7*86400000).toISOString().slice(0,10))throw Error('Refresh stock snapshot before receiving');
   row=(await db.query("UPDATE orders SET received=received+$1,status=CASE WHEN received+$1=units THEN 'closed' ELSE 'open' END WHERE id=$2 RETURNING *",[units,ord.id]))[0];
   const fresh=(await db.query('UPDATE positions SET on_hand=on_hand+$1 WHERE id=$2 RETURNING *',[units,p.id]))[0];await audit(db,p.id,'stock receipt',actor,p,fresh,need(o.evidence,'evidence'));await audit(db,p.id,cmd,actor,ord,row,o.evidence);return row;
  }
  if(cmd==='demand'){
   const day=date(o.date,'date');if(day>=new Date().toISOString().slice(0,10))throw Error('Demand date must precede today');const old=(await db.query('SELECT * FROM demand WHERE position_id=$1 AND day=$2',[p.id,day]))[0];
   if(old&&!o.update)throw Error('Demand exists; --update replaces the daily total');
   row=(await db.query('INSERT INTO demand(position_id,day,units,source_ref) VALUES($1,$2,$3,$4) ON CONFLICT(position_id,day) DO UPDATE SET units=excluded.units,source_ref=excluded.source_ref RETURNING *',[p.id,day,num(o.units,'units'),need(o.evidence,'evidence')]))[0];await audit(db,p.id,cmd,actor,old,row,o.evidence);return row;
  }
  if(!row)throw Error('Unsupported mutation');await audit(db,p.id,cmd,actor,null,row,o.evidence||o.reason||o.note||'recorded by operator');return row;
 });
}
const allowed=new Set(['json','ref','actor','sku','location','name','supplier','owner','currency','on-hand','allocated','unit-cost','lead-days','review-days','safety-days','moq','pack','stock-asof','history-start','history-through','active','evidence','note','due','review','daily','until','reason','reference','units','date','update','file','map','dry-run','out','demand-percent','extra-lead']);
export function parse(argv){const args=[],o={};for(let i=0;i<argv.length;i++){const a=argv[i];if(!a.startsWith('--')){args.push(a);continue;}const [k,...rest]=a.slice(2).split('=');if(!allowed.has(k))throw Error(`Unknown flag --${k}`);if(['json','update','dry-run'].includes(k)){if(rest.length)throw Error(`--${k} takes no value`);o[k]=true;}else{o[k]=rest.length?rest.join('='):argv[++i];if(o[k]===undefined||o[k].startsWith('--'))throw Error(`Missing value for --${k}`);}}return {cmd:args.shift()||'help',args,o};}
function display(result){if(Array.isArray(result)){return table(result,Object.keys(result[0]||{}).map(key=>({key,label:key,width:48,format:v=>v&&typeof v==='object'?JSON.stringify(v):v})));}return Object.entries(result).map(([k,v])=>Array.isArray(v)?`${k}\n${display(v)}`:`${k}: ${typeof v==='object'?JSON.stringify(v):v}`).join('\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{const {cmd,args,o}=parse(process.argv.slice(2));db=await getDb();const result=await run(db,cmd,o,args);console.log(o.json?JSON.stringify(result,null,2):display(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
