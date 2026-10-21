(function(root){
'use strict';
// Applies a kkaebigg.com snapshot to the engine data and links skill effects to the buff dictionary.
// dist/data.json was built from the same source (kkaebigg id N = local sNNN with N+1), so only values that differ are replaced.
const localId=id=>'s'+String(id+1).padStart(3,'0');
const round=n=>Math.round(n*100)/100;
function apply(data,snap){
 const report={applied:false,changes:[],unmatched:[],meta:snap?.meta||null};
 if(!data?.skills||!snap?.skills?.skills)return report;
 for(const k of snap.skills.skills){
  const s=data.skills.find(x=>x.id===localId(k.id));
  if(!s||s.name!==k.n){report.unmatched.push(k.n);continue;}
  s.referenceNumbers=s.referenceNumbers||{};
  // Execution reads basic.cooldown independently of the reference snapshot.
  if(typeof k.num?.cd==='number'&&s.basic&&s.basic.cooldown!==round(k.num.cd)){
   report.changes.push({id:s.id,name:s.name,field:'basic.cooldown',before:s.basic.cooldown,after:round(k.num.cd)});s.basic.cooldown=round(k.num.cd);
  }
  for(const key of Object.keys(s.referenceNumbers))if(!(key in (k.num||{}))){report.changes.push({id:s.id,name:s.name,field:'referenceNumbers.'+key,before:s.referenceNumbers[key],after:null});delete s.referenceNumbers[key];}
  s.referenceProgression={effects:k.ef||[],hit:k.hit||[],awakening:k.ak??null,source:'https://kkaebigg.com/data/skills.json'};
  for(const [key,value] of Object.entries(k.num||{})){
   if(JSON.stringify(s.referenceNumbers[key])===JSON.stringify(value))continue;
   report.changes.push({id:s.id,name:s.name,field:'referenceNumbers.'+key,before:s.referenceNumbers[key],after:value});s.referenceNumbers[key]=value;

  }
  s.referenceDetail=s.referenceDetail||{buffs:[],debuffs:[]};
  if(k.d&&s.referenceDetail.description!==k.d){report.changes.push({id:s.id,name:s.name,field:'도술 설명',before:s.referenceDetail.description||null,after:k.d});s.referenceDetail.description=k.d;}
  for(const h of k.hit||[]){
   const list=h.t==='강화'?(s.referenceDetail.buffs=s.referenceDetail.buffs||[]):h.t==='약화'?(s.referenceDetail.debuffs=s.referenceDetail.debuffs||[]):null;if(!list||!h.n)continue;
   const description=(h.l||[]).join(' '),entry=list.find(b=>b.name===h.n),linked=link(snap,h.n);
   // The skill feed carries names/descriptions while the buff dictionary carries lifetimes.
   // Only copy a single, finite lifetime. Ambiguous candidates stay unconfirmed instead of
   // being guessed; a later sync can fill them once the source disambiguates the entry.
   const duration=linked&&!linked.ambiguous&&Number.isFinite(linked.life)&&linked.life>0?linked.life:null;
   if(!entry){list.push({name:h.n,description,duration});report.changes.push({id:s.id,name:s.name,field:'효과 추가',before:null,after:h.n});if(duration!==null)report.changes.push({id:s.id,name:s.name,field:'효과 지속시간 · '+h.n,before:null,after:duration});}
   else{
    if(entry.description!==description){report.changes.push({id:s.id,name:s.name,field:'효과 설명 · '+h.n,before:entry.description,after:description});entry.description=description;}
    if(duration!==null&&entry.duration!==duration){report.changes.push({id:s.id,name:s.name,field:'효과 지속시간 · '+h.n,before:entry.duration??null,after:duration});entry.duration=duration;}
   }
  }
 }
 report.applied=true;return report;
}
// Buff dictionary values: ApplyShield [basis, flat, rate in 1/100 %], DamageDown in 1/100 %, life in ms (-1 = until removed).
function shieldParams(g){return g.v.map(v=>(v.a||[]).find(a=>a[0]==='ApplyShield')?.[2]).filter(Boolean);}
function damageDown(g){return g.v.map(v=>(v.a||[]).find(a=>a[0]==='ApplyAttr'&&a[2]?.[0]==='DamageDown')?.[2]?.[1]).filter(x=>x!==undefined).map(Number);}
function link(snap,name,amount){
 const groups=(snap?.buffs?.groups||[]).filter(g=>g.n===name);if(!groups.length)return null;
 let matches=groups;
 if(amount){
  // Tooltips round rates (2.45% is shown as 2.4%), so allow 0.1%p.
  const near=(rate,pct)=>Math.abs(Number(rate)-pct*100)<=10;
  const byShield=groups.filter(g=>shieldParams(g).some(([basis,flat,rate])=>Number(flat)===amount.flat&&(amount.atkPct?basis==='Attack'&&near(rate,amount.atkPct):amount.hpPct?basis==='Maxhp'&&near(rate,amount.hpPct):Number(rate)===0)));
  const byHeal=amount.flat?groups.filter(g=>g.v.some(v=>(v.a||[]).some(a=>a[0]==='DotHp'&&Number(a[2]?.[0])===amount.flat))):[];
  const byDown=amount.reducePct?groups.filter(g=>damageDown(g).includes(Math.round(amount.reducePct*100))):[];
  if(byShield.length)matches=byShield;else if(byHeal.length)matches=byHeal;else if(byDown.length)matches=byDown;
 }
 const lives=[...new Set(matches.flatMap(g=>g.v.map(v=>v.life)))],dups=[...new Set(matches.map(g=>g.dup))];
 return {name,candidates:matches.length,lives:lives.map(l=>l<0?Infinity:l/1000),life:lives.length===1?(lives[0]<0?Infinity:lives[0]/1000):null,dup:dups.length===1?dups[0]:null,ambiguous:lives.length!==1};
}
const api={apply,link,localId};
if(typeof module!=='undefined')module.exports=api;
else{
 root.DosulKkaebigg=api;const snap=root.KKAEBIGG_SNAPSHOT||null;
 api.snapshot=snap;api.report=root.DOSUL_DATA&&snap?apply(root.DOSUL_DATA,snap):{applied:false,changes:[],unmatched:[],meta:null};
}
})(typeof window!=='undefined'?window:globalThis);
