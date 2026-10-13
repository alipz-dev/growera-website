import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const IDS_FILE=path.resolve(process.env.ITEM_IDS_FILE||"data/item-ids.txt");
const OUT_DIR=path.resolve(process.env.TEXTURE_DIR||"assets/items");
const PROGRESS_FILE=path.resolve("data/texture-progress.json");
const MANIFEST_FILE=path.join(OUT_DIR,"manifest.json");
const SERVER_ID=process.env.GT_SERVER_ID||"1791";
const API_BASE=(process.env.GT_TEXTURE_API||"https://api.gtps.cloud/api/item/texture").replace(/\/+$/,"");
const BATCH_SIZE=clamp(process.env.BATCH_SIZE,250,1,500);
const CONCURRENCY=clamp(process.env.CONCURRENCY,3,1,6);
const DELAY=clamp(process.env.REQUEST_DELAY_MS,150,0,5000);
const RETRIES=clamp(process.env.MAX_RETRIES,3,0,8);
const TIMEOUT=clamp(process.env.TIMEOUT_MS,15000,3000,60000);
const RESET=process.env.RESET_PROGRESS==="true";
const EXTS=[".png",".jpg",".jpeg",".webp",".gif"];
function clamp(v,d,min,max){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):d}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function parseIds(t){const s=new Set();for(const raw of t.split(/\r?\n/)){const l=raw.trim();if(!l||l.startsWith("#"))continue;const m=l.match(/^(\d+)\s*(?::|\s|$)/);if(m){const n=Number(m[1]);if(Number.isSafeInteger(n)&&n>=0)s.add(n)}}return [...s].sort((a,b)=>a-b)}
function imageExt(b){
 if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return ".png";
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return ".jpg";
 if(b.length>=12&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP")return ".webp";
 if(b.length>=6&&["GIF87a","GIF89a"].includes(b.toString("ascii",0,6)))return ".gif";
 return null;
}
async function existing(id){for(const ext of EXTS){const file=path.join(OUT_DIR,`${id}${ext}`);try{const s=await fs.stat(file);if(s.isFile()&&s.size>0)return{file:`${id}${ext}`,bytes:s.size}}catch{}}return null}
async function fetchImage(id){
 const url=`${API_BASE}/${encodeURIComponent(SERVER_ID)}/${encodeURIComponent(id)}`;let last="unknown error";
 for(let a=0;a<=RETRIES;a++){try{
  const r=await fetch(url,{signal:AbortSignal.timeout(TIMEOUT),headers:{"user-agent":"GROWERA-texture-collector/2.0","accept":"image/png,image/jpeg,image/webp,image/gif,application/octet-stream,*/*"}});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const b=Buffer.from(await r.arrayBuffer()),ext=imageExt(b);
  if(!ext)throw new Error(`Not a recognized image (${r.headers.get("content-type")||"unknown type"}, ${b.length} bytes)`);
  return{url,b,ext};
 }catch(e){last=e.message||String(e);if(a<RETRIES)await sleep(700*(a+1))}}
 throw new Error(last);
}
await fs.mkdir(OUT_DIR,{recursive:true});
const ids=parseIds(await fs.readFile(IDS_FILE,"utf8"));
if(!ids.length)throw new Error(`No IDs in ${IDS_FILE}; run scripts/sync-item-ids.mjs first.`);
const hash=crypto.createHash("sha256").update(ids.join("\n")).digest("hex");
let progress={listHash:hash,nextIndex:0};
try{const p=JSON.parse(await fs.readFile(PROGRESS_FILE,"utf8"));if(!RESET&&p.listHash===hash&&Number.isInteger(p.nextIndex))progress.nextIndex=Math.max(0,Math.min(ids.length,p.nextIndex))}catch{}
if(RESET)progress.nextIndex=0;
const start=progress.nextIndex,end=Math.min(ids.length,start+BATCH_SIZE),batch=ids.slice(start,end);
if(!batch.length){console.log(`All ${ids.length} IDs have been visited. Use RESET_PROGRESS=true to rescan; existing images are kept.`);process.exit(0)}
let manifest={version:2,serverId:SERVER_ID,apiBase:API_BASE,items:{},failed:{},updatedAt:null};
try{const old=JSON.parse(await fs.readFile(MANIFEST_FILE,"utf8"));if(old&&typeof old==="object"){if(old.items&&typeof old.items==="object")manifest.items=old.items;if(old.failed&&typeof old.failed==="object")manifest.failed=old.failed;if(!old.items&&!old.failed)for(const[k,v]of Object.entries(old))if(/^\d+$/.test(k)&&v&&typeof v==="object")manifest.items[k]=v}}catch{}
let cursor=0,downloaded=0,skipped=0,failed=0;const failures=[];
async function worker(){while(true){const i=cursor++;if(i>=batch.length)return;const id=batch[i];const old=await existing(id);if(old){skipped++;manifest.items[id]={...(manifest.items[id]||{}),file:old.file,bytes:old.bytes,status:"present"};delete manifest.failed[id];continue}
 try{const x=await fetchImage(id),name=`${id}${x.ext}`,dest=path.join(OUT_DIR,name);try{await fs.writeFile(dest,x.b,{flag:"wx"})}catch(e){if(e.code!=="EEXIST")throw e}const st=await fs.stat(dest);downloaded++;manifest.items[id]={file:name,bytes:st.size,status:"downloaded",source:x.url,downloadedAt:new Date().toISOString()};delete manifest.failed[id];console.log(`OK ${id} -> ${name} (${st.size} bytes)`)}
 catch(e){failed++;const msg=e.message||String(e);manifest.failed[id]={error:msg,at:new Date().toISOString()};failures.push({id,error:msg});console.warn(`FAIL ${id}: ${msg}`)}
 if(DELAY)await sleep(DELAY)
}}
await Promise.all(Array.from({length:CONCURRENCY},()=>worker()));
await fs.writeFile(PROGRESS_FILE,JSON.stringify({listHash:hash,nextIndex:end,totalIds:ids.length,updatedAt:new Date().toISOString()},null,2)+"\n");
manifest.version=2;manifest.serverId=SERVER_ID;manifest.apiBase=API_BASE;manifest.updatedAt=new Date().toISOString();manifest.stats={totalIds:ids.length,batchStartIndex:start,batchEndIndex:end,batchSize:batch.length,downloadedThisRun:downloaded,skippedExistingThisRun:skipped,failedThisRun:failed};
await fs.writeFile(MANIFEST_FILE,JSON.stringify(manifest,null,2)+"\n");
await fs.writeFile(path.resolve("data/texture-failures-last-run.json"),JSON.stringify(failures,null,2)+"\n");
console.log(`Batch done: ${start+1}-${end}/${ids.length}; downloaded=${downloaded}, existing=${skipped}, failed=${failed}. Existing images are never deleted.`);
