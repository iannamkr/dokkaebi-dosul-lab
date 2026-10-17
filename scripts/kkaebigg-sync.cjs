#!/usr/bin/env node
'use strict';
// Pulls kkaebigg.com's public data (skill numbers, buff dictionary, maps, monsters) into dist/kkaebigg/.
// Runs only when the user asks (CLI or the local server's sync button); a failed or malformed fetch keeps the previous snapshot.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DEFAULT_OUT=path.join(ROOT,'dist/kkaebigg');
const USER_AGENT='dokkaebi-dosul-lab/1.0 (user-initiated local sync)';
const SOURCES=[
 {key:'skills',path:'/data/skills.json',kind:'json',check:d=>Array.isArray(d.skills)&&d.skills.length>=100&&d.skills.every(s=>Number.isInteger(s.id)&&s.n&&s.num)},
 {key:'buffs',path:'/buffs/',kind:'html',scriptId:'bf-data',check:d=>Array.isArray(d.groups)&&d.groups.length>=100&&d.groups.every(g=>g.n!==undefined&&Array.isArray(g.v))},
 {key:'maps',path:'/maps/',kind:'html',scriptId:'mp-data',check:d=>Array.isArray(d.zones)&&d.zones.length>0&&d.zones.every(z=>Array.isArray(z.mons))},
 {key:'monsters',path:'/monsters/',kind:'html',scriptId:'mn-data',check:d=>Array.isArray(d.cards)&&d.cards.length>=100&&d.cards.every(c=>c.n&&(c.hp===null||Array.isArray(c.hp)))&&d.cards.filter(c=>c.hp).length>=d.cards.length/2}
];
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
function extractScript(html,id){
 const re=new RegExp(`<script\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`,'i'),m=html.match(re);
 if(!m)throw Error(`${id} 데이터를 페이지에서 찾지 못했습니다. 사이트 구조가 바뀌었을 수 있습니다.`);
 return JSON.parse(m[1]);
}
function readJSON(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
// What changed since the previous snapshot, in terms the engine cares about.
function diff(prev,next){
 const out={skills:[],buffGroups:null,mapZones:null,monsters:null};
 if(prev.skills&&next.skills){
  const old=new Map(prev.skills.skills.map(s=>[s.id,s]));
  for(const s of next.skills.skills){const o=old.get(s.id);if(!o){out.skills.push({id:s.id,name:s.n,change:'추가'});continue;}
   const fields=[];if(JSON.stringify(o.num)!==JSON.stringify(s.num))fields.push('수치');if(JSON.stringify(o.hit)!==JSON.stringify(s.hit))fields.push('효과 설명');if(JSON.stringify(o.ef)!==JSON.stringify(s.ef))fields.push('단계별 수치');
   if(fields.length)out.skills.push({id:s.id,name:s.n,change:fields.join('·')});}
 }
 if(prev.buffs&&next.buffs)out.buffGroups={before:prev.buffs.groups.length,after:next.buffs.groups.length,changed:sha(JSON.stringify(prev.buffs.groups))!==sha(JSON.stringify(next.buffs.groups))};
 if(prev.maps&&next.maps)out.mapZones={before:prev.maps.zones.length,after:next.maps.zones.length};
 if(prev.monsters&&next.monsters)out.monsters={before:prev.monsters.cards.length,after:next.monsters.cards.length};
 return out;
}
// The page only needs skill numbers and the buff dictionary at load; maps and monsters stay as JSON files.
function snapshotScript(meta,skills,buffs){return `window.KKAEBIGG_SNAPSHOT=${JSON.stringify({meta,skills,buffs})};\n`;}
async function sync({base=process.env.KKAEBIGG_BASE||'https://kkaebigg.com',outDir=process.env.KKAEBIGG_OUT||DEFAULT_OUT,fetchImpl=globalThis.fetch,now=()=>new Date()}={}){
 const fetched={},sources={};
 for(const src of SOURCES){
  const url=new URL(src.path,base).href;
  const res=await fetchImpl(url,{headers:{'User-Agent':USER_AGENT,'Accept':src.kind==='json'?'application/json':'text/html'}});
  if(!res.ok)throw Error(`${url} 응답 ${res.status}`);
  const text=await res.text();let data;
  try{data=src.kind==='json'?JSON.parse(text):extractScript(text,src.scriptId);}catch(e){throw Error(`${url}: ${e.message}`);}
  if(!src.check(data))throw Error(`${url}: 예상한 데이터 형식이 아닙니다. 기존 고정본을 유지합니다.`);
  fetched[src.key]=data;sources[src.key]={url,version:data._src||null,bytes:Buffer.byteLength(text),sha256:sha(JSON.stringify(data))};
 }
 const prev=Object.fromEntries(SOURCES.map(s=>[s.key,readJSON(path.join(outDir,s.key+'.json'))]));
 const meta={schema:'kkaebigg-snapshot-v1',fetchedAt:now().toISOString(),base,sources,counts:{skills:fetched.skills.skills.length,buffGroups:fetched.buffs.groups.length,mapZones:fetched.maps.zones.length,monsters:fetched.monsters.cards.length}};
 const changes=diff(prev,fetched);
 // Write everything to a temp folder first so a crash never leaves a half-updated snapshot.
 fs.mkdirSync(outDir,{recursive:true});const tmp=fs.mkdtempSync(path.join(outDir,'.sync-'));
 try{
  for(const s of SOURCES)fs.writeFileSync(path.join(tmp,s.key+'.json'),JSON.stringify(fetched[s.key]));
  fs.writeFileSync(path.join(tmp,'meta.json'),JSON.stringify({...meta,changes},null,1));
  fs.writeFileSync(path.join(tmp,'snapshot.js'),snapshotScript(meta,fetched.skills,fetched.buffs));
  for(const f of fs.readdirSync(tmp))fs.renameSync(path.join(tmp,f),path.join(outDir,f));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 return {meta,changes};
}
module.exports={sync,extractScript,diff,SOURCES,USER_AGENT};
if(require.main===module){
 sync().then(({meta,changes})=>{
  console.log(`깨비지지 고정본 갱신: ${meta.fetchedAt}`);
  for(const [k,v] of Object.entries(meta.sources))console.log(`- ${k}: ${v.version||'버전 표기 없음'} · ${(v.bytes/1024).toFixed(0)}KB`);
  console.log(changes.skills.length?`변경된 도술 ${changes.skills.length}개: `+changes.skills.map(s=>`${s.name}(${s.change})`).join(', '):'도술 수치 변경 없음');
 }).catch(e=>{console.error('동기화 실패: '+e.message);process.exitCode=1;});
}
