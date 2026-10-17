(function(root){
'use strict';
// Generic build search: keeps the current ultimate and slot count, then searches skills, order and base equipment.
// Sustain amounts are parsed from skill text; durations and overwrite rules come from the kkaebigg buff dictionary snapshot.
// Incoming damage is a user input or a measurement; monster attack data does not exist in any source.
const Sim=typeof module!=='undefined'?require('./simulation.js'):root.DosulSimulation;
const Q=typeof module!=='undefined'?require('./sequence.js'):root.DosulSequence;
const K=typeof module!=='undefined'?require('./kkaebigg.js'):root.DosulKkaebigg;
const PROFILES=Sim.profiles.map(p=>p.id),HORIZONS=[60,120,180],STEP=0.05,MAX_REDUCTION=0.9;
const number=s=>Number(String(s).replace(/,/g,''));
const round=n=>Math.round(n*100)/100;
const defaultSnapshot=()=>typeof module!=='undefined'?null:(K?.snapshot||null);

// "공격력의 3.7% + 2,190", "최대 체력의 0.4%", "체력 500 회복", "보호막 1,460", "최대 5회"
function parseAmount(text){
 const t=String(text||'').replace(/\s+/g,' ');let m,atkPct=0,hpPct=0,flat=0,times=1;
 if((m=t.match(/공격력의 ?([\d.]+)%/)))atkPct=+m[1];
 if((m=t.match(/최대 체력(?:의)? ?([\d.]+)%/)))hpPct=+m[1];
 if((m=t.match(/\+ ?([\d,]+)(?![\d.,]* ?%)/)))flat=number(m[1]);
 else if((m=t.match(/(?:체력|보호막) ?([\d,]+)(?![\d.,]* ?%)/)))flat=number(m[1]);
 if((m=t.match(/최대 ?(\d+)회/)))times=+m[1];
 return atkPct||hpPct||flat?{atkPct,hpPct,flat,times}:null;
}
function parseReduction(text){const m=String(text||'').match(/받는 피해(?:를|가)? ?([\d.]+)% ?감소/);return m?+m[1]:null;}
function sustainKind(text){
 if(/제거|받는 (?:체력 )?(?:치유|회복)/.test(text))return 'none';
 if(/받는 피해[^.]*감소/.test(text))return 'reduce';
 if(/보호막/.test(text))return 'shield';
 if(/회복/.test(text))return 'heal';
 return 'none';
}
// Every self heal, shield and damage reduction the data describes with a number, plus what cannot be quantified.
function sources(skill,snapshot=defaultSnapshot()){
 const out=[],unquantified=[];
 (skill.referenceDetail?.buffs||[]).forEach((b,i)=>{
  const text=`${b.name||''} ${b.description||''}`.trim(),kind=sustainKind(text);if(kind==='none')return;
  const effect=(b.name||'').match(/^(.+?) \(/)?.[1];
  const condition=effect?(skill.conditions||[]).find(c=>c.effect===effect&&/회복|보호막|피해 감소/.test(c.result)):null;
  const amount=kind==='reduce'?(parseReduction(b.description||text)?{reducePct:parseReduction(b.description||text)}:null):parseAmount(b.description||text);
  if(!amount){unquantified.push({skillId:skill.id,label:b.name||kind,text:b.description,reason:'수치 미확인'});return;}
  const link=snapshot&&K?K.link(snapshot,b.name,amount):null;
  out.push({key:`${skill.id}:${i}`,skillId:skill.id,kind,label:b.name||kind,text:b.description,atkPct:0,hpPct:0,flat:0,times:1,...amount,
   condition:condition?{effect:condition.effect,result:condition.result,scope:condition.scope}:null,
   life:link&&!link.ambiguous?link.life:null,dup:link?.dup||null,link:link?{candidates:link.candidates,lives:link.lives,ambiguous:link.ambiguous}:null});
 });
 return {sources:out,unquantified};
}
function amount(src,stats={},overrides={}){
 const each=Number(overrides[src.key])>0?Number(overrides[src.key]):src.atkPct/100*(Number(stats.attack)||0)+src.hpPct/100*(Number(stats.maxHp)||0)+src.flat;
 return each*src.times;
}
function needsStats(list){return {attack:list.some(s=>s.atkPct),maxHp:list.some(s=>s.hpPct)};}
function triggerTimes(run,id,src){
 return src.condition?run.conditions.filter(c=>c.id===id&&c.effect===src.condition.effect&&c.result===src.condition.result&&c.scope===src.condition.scope&&c.status==='yes').map(c=>c.time)
  :run.schedule.events.filter(e=>e.id===id&&e.completed).map(e=>e.end);
}
// Steady incoming damage hits reductions first, then the soonest-expiring shields. "Replace" restarts a shield at full value,
// so the unspent part of the old one is lost; shields of different buffs coexist.
function timeline(horizon,perSecond,shields,reductions){
 const events=[...shields.map(e=>({...e,type:'shield'})),...reductions.map(e=>({...e,type:'reduce'}))].sort((a,b)=>a.t-b.t);
 const active=new Map(),reducing=new Map(),absorbed={},prevented={};let i=0;
 for(let t=0;t<horizon-1e-9;t+=STEP){
  while(i<events.length&&events[i].t<=t+1e-9){const e=events[i++],end=e.t+(Number.isFinite(e.life)?e.life:Infinity);
   if(e.type==='shield'){const cur=active.get(e.key);active.set(e.key,{amount:e.dup==='Stack'&&cur?cur.amount+e.amount:e.amount,end});}else reducing.set(e.key,{pct:e.pct,end});}
  for(const [k,v] of active)if(v.end<=t||v.amount<=0)active.delete(k);
  for(const [k,v] of reducing)if(v.end<=t)reducing.delete(k);
  let dmg=perSecond*STEP;const total=[...reducing.values()].reduce((a,r)=>a+r.pct,0),cut=Math.min(MAX_REDUCTION,total);
  if(cut>0){const saved=dmg*cut;for(const [k,r] of reducing)prevented[k]=(prevented[k]||0)+saved*r.pct/total;dmg-=saved;}
  for(const [k,v] of [...active].sort((a,b)=>a[1].end-b[1].end)){if(dmg<=0)break;const use=Math.min(v.amount,dmg);v.amount-=use;dmg-=use;absorbed[k]=(absorbed[k]||0)+use;}
 }
 return {absorbed,prevented};
}
// opts.incoming: damage per minute before shields and reductions. Without it shields count in full and reductions are not converted.
function sustain(run,data,ids,stats,overrides={},opts={}){
 const minutes=run.horizon/60,rows=[],unquantified=[],snapshot=opts.snapshot===undefined?defaultSnapshot():opts.snapshot,incoming=Number(opts.incoming)>0?Number(opts.incoming):null;
 const shieldEvents=[],reduceEvents=[];
 for(const id of ids){
  const skill=data.skills.find(s=>s.id===id);if(!skill)continue;const parsed=sources(skill,snapshot);unquantified.push(...parsed.unquantified);
  for(const src of parsed.sources){
   const times=triggerTimes(run,id,src),row={...src,name:skill.name,triggers:times.length,overridden:Number(overrides[src.key])>0};
   if(src.kind==='reduce'){
    if(src.life===null){unquantified.push({skillId:id,label:src.label,text:src.text,reason:src.link?`지속시간 후보 ${src.link.lives.map(l=>Number.isFinite(l)?l+'초':'무한').join('/')} 중 확정 불가`:'버프 사전에서 찾지 못함'});continue;}
    times.forEach(t=>reduceEvents.push({t,key:src.key,pct:src.reducePct/100,life:src.life}));
    rows.push({...row,each:null,full:null,perMin:null});continue;
   }
   const each=amount(src,stats,overrides);row.each=round(each);row.full=round(times.length*each/minutes);row.perMin=row.full;
   // Without a dictionary entry the duration and overwrite rule are unknown, so the shield keeps its full value.
   if(src.kind==='shield'&&src.life!==null)times.forEach(t=>shieldEvents.push({t,key:src.key,amount:each,life:src.life,dup:src.dup}));
   rows.push(row);
  }
 }
 let modeled=false;
 if(incoming!==null){
  const r=timeline(run.horizon,incoming/60,shieldEvents,reduceEvents);modeled=true;
  for(const row of rows){
   if(row.kind==='shield'&&row.life!==null)row.perMin=round((r.absorbed[row.key]||0)/minutes);
   if(row.kind==='reduce')row.perMin=round((r.prevented[row.key]||0)/minutes);
  }
 }
 const kept=rows.filter(r=>r.perMin!==null);
 return {perMin:round(kept.reduce((a,r)=>a+r.perMin,0)),full:round(kept.reduce((a,r)=>a+(r.full??0),0)),rows,unquantified,modeled};
}
function regenPerMin(stats={}){const amount=Number(stats.regen)||0,period=Number(stats.regenPeriod)||5;return amount>0?amount*60/period:0;}
// Net HP change while hunting with the measured build: incoming = sustain(incoming) + natural regen - net gain.
// Absorption depends on incoming, so iterate to the fixed point when a sustain function is given.
function calibrate({sustainPerMin,sustainAt,stats,hpStart,hpEnd,seconds}){
 if(!(seconds>0)||!Number.isFinite(hpStart)||!Number.isFinite(hpEnd))return null;
 const base=regenPerMin(stats)-(hpEnd-hpStart)*60/seconds;
 if(typeof sustainAt!=='function')return round(sustainPerMin+base);
 let x=sustainAt(null)+base;for(let i=0;i<30;i++){const next=sustainAt(Math.max(1,x))+base;if(Math.abs(next-x)<0.5){x=next;break;}x=next;}
 return round(x);
}
function evaluate(data,ids,baseSlots,ctx){
 const v=Q.validate({...data,baseSlots},ids);if(v.issues.length)return {valid:false,issue:v.issues.join(' / ')};
 const run=Sim.run({...data,baseSlots},ids,ctx.profile||PROFILES[0],ctx.horizon||180);
 if(run.validation.issues.length||run.schedule.missing.length)return {valid:false,issue:[...run.validation.issues,...run.schedule.missing].join(' / ')};
 const multi=run.impacts.filter(i=>i.targets.length>1).length;
 if(ctx.singleOnly&&multi)return {valid:false,issue:'여러 대상 동시 적중'};
 const s=sustain(run,data,ids,ctx.stats,ctx.overrides,{incoming:ctx.incoming,snapshot:ctx.snapshot}),partial=run.rows.filter(r=>r.unknown.includes('피해 계수')).map(r=>r.name);
 const out={valid:true,coefficient:round(run.metrics.coefficient),perMin:s.perMin,full:s.full,modeled:s.modeled,rows:s.rows,unquantified:s.unquantified,multiTargetHits:multi,partial,active:run.schedule.active};
 // Calibration re-runs the shield timeline on the same simulation at other incoming values.
 if(ctx.keepRun)out.sustainAt=incoming=>sustain(run,data,ids,ctx.stats,ctx.overrides,{incoming,snapshot:ctx.snapshot}).perMin;
 return out;
}
// Worst case over every video preset and observation length.
function verify(data,ids,baseSlots,ctx){
 let worst=null;const runs=[];
 for(const horizon of HORIZONS)for(const profile of PROFILES){
  const r=evaluate(data,ids,baseSlots,{...ctx,keepRun:false,profile,horizon});if(!r.valid)return {valid:false,issue:`${profile}/${horizon}초: ${r.issue}`};
  runs.push({profile,horizon,coefficient:r.coefficient,perMin:r.perMin});
  if(!worst||r.perMin<worst.perMin)worst={...r,profile,horizon};
 }
 const long=runs.filter(r=>r.horizon===180);
 return {valid:true,minPerMin:worst.perMin,minCoefficient:Math.min(...long.map(r=>r.coefficient)),margin:ctx.need===null||ctx.need===undefined?null:round(worst.perMin-ctx.need),worst,runs};
}
function pool(data,ids,{families,singleOnly}){
 const keep=new Set(ids.filter(id=>!data.skills.find(s=>s.id===id)?.ultimate));
 return data.skills.filter(s=>!s.ultimate&&(keep.has(s.id)||(families.includes(s.family)&&typeof s.basic?.cooldown==='number'&&(!singleOnly||s.targeting?.kind==='single'||s.damage===false)))).map(s=>s.id);
}
function rng(seed){let x=(seed>>>0)||1;return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);}
function createSearch(data,current,opts){
 const ult=current.ids.find(id=>data.skills.find(s=>s.id===id)?.ultimate)||null,normals=current.ids.filter(id=>id!==ult);
 const ctx={stats:opts.stats,overrides:opts.overrides||{},singleOnly:!!opts.singleOnly,profile:opts.profile||'185547',horizon:180,need:opts.need,incoming:opts.incoming,snapshot:opts.snapshot};
 const candidates=pool(data,current.ids,opts),cache=new Map(),archive=new Map(),random=rng(opts.seed||20261018);
 const total=Math.max(30,opts.iterations||4000),chains=Math.max(1,opts.chains||3),perChain=Math.ceil(total/chains);
 const key=s=>s.ids.join()+'|'+[...s.base].sort().join();
 const ev=s=>{const k=key(s);if(!cache.has(k))cache.set(k,evaluate(data,s.ids,s.base,ctx));return cache.get(k);};
 const start={ids:[...current.ids],base:[...current.baseSlots]},startEval=ev(start);
 const scale=Math.max(1,startEval.valid?startEval.coefficient:1),need=ctx.need;
 const penalty=r=>need===null||need===undefined?0:Math.max(0,need-r.perMin)*3*scale/Math.max(need,1);
 // Equal damage is common (order changes nothing); the tiny sustain term breaks those ties toward more room.
 const score=r=>r.valid?r.coefficient-penalty(r)+r.perMin*1e-4:-Infinity;
 const feasible=r=>r.valid&&(need===null||need===undefined||r.perMin>=need);
 let cur=start,curScore=score(startEval),done=0,chain=0,temp=0.03*scale;
 const pick=a=>a[Math.floor(random()*a.length)];
 function mutate(s){
  const n={ids:[...s.ids],base:[...s.base]},m=random();
  if(m<0.35){const a=Math.floor(random()*n.ids.length),b=Math.floor(random()*n.ids.length);[n.ids[a],n.ids[b]]=[n.ids[b],n.ids[a]];}
  else if(m<0.6){const a=Math.floor(random()*n.ids.length),b=Math.floor(random()*n.ids.length);const [x]=n.ids.splice(a,1);n.ids.splice(b,0,x);}
  else if(m<0.85){const out=pick(n.ids.filter(id=>id!==ult)),avail=candidates.filter(id=>!n.ids.includes(id));if(!out||!avail.length)return n;const inn=pick(avail);n.ids[n.ids.indexOf(out)]=inn;const bi=n.base.indexOf(out);if(bi>=0)n.base[bi]=inn;}
  else{const avail=n.ids.filter(id=>id!==ult&&!n.base.includes(id));if(!avail.length||!n.base.length)return n;n.base[Math.floor(random()*n.base.length)]=pick(avail);}
  return n;
 }
 function remember(s,r){if(!feasible(r))return;const k=key(s);if(!archive.has(k))archive.set(k,{ids:s.ids,baseSlots:s.base,coefficient:r.coefficient,perMin:r.perMin});}
 remember(start,startEval);
 // Every single swap, move, skill replacement and base change of one build.
 function neighbors(s){
  const out=[],n=s.ids.length,avail=candidates.filter(id=>!s.ids.includes(id));
  for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){const ids=[...s.ids];[ids[a],ids[b]]=[ids[b],ids[a]];out.push({ids,base:[...s.base]});}
  for(let a=0;a<n;a++)for(let b=0;b<n;b++){if(a===b||b===a-1)continue;const ids=[...s.ids];const [x]=ids.splice(a,1);ids.splice(b,0,x);out.push({ids,base:[...s.base]});}
  for(const old of s.ids)if(old!==ult)for(const inn of avail)out.push({ids:s.ids.map(x=>x===old?inn:x),base:s.base.map(x=>x===old?inn:x)});
  for(let i=0;i<s.base.length;i++)for(const id of s.ids)if(id!==ult&&!s.base.includes(id)){const base=[...s.base];base[i]=id;out.push({ids:[...s.ids],base});}
  return out;
 }
 // Random search alone stops near good builds; polishing climbs from the best ones until no single change helps.
 const polishBudget=Math.max(0,opts.polish??Math.round(total*0.6));
 let polished=0,queue=null,pc=null,pcScore=0,nb=[],ni=0,bestN=null,bestNS=-Infinity;
 function step(budgetMs=40){
  const end=Date.now()+budgetMs;
  while(Date.now()<end){
   if(done<total){
    if(done>0&&done%perChain===0&&chain<Math.floor(done/perChain)){chain=Math.floor(done/perChain);cur=start;for(let i=0;i<chain*3;i++)cur=mutate(cur);curScore=score(ev(cur));temp=0.03*scale;}
    const next=mutate(cur),r=ev(next),s=score(r);
    if(s>=curScore||random()<Math.exp((s-curScore)/Math.max(temp,1e-9))){cur=next;curScore=s;}
    remember(next,r);temp=Math.max(0.0006*scale,temp*Math.pow(0.02,1/perChain));done++;continue;
   }
   if(polished>=polishBudget)break;
   if(!queue)queue=distinct().sort((a,b)=>b.coefficient-a.coefficient||b.perMin-a.perMin).slice(0,4).map(c=>({ids:[...c.ids],base:[...c.baseSlots]}));
   if(!pc){pc=queue.shift();if(!pc){polished=polishBudget;break;}pcScore=score(ev(pc));nb=neighbors(pc);ni=0;bestN=null;bestNS=-Infinity;}
   if(ni<nb.length){const n=nb[ni++],fresh=!cache.has(key(n)),r=ev(n),s=score(r);remember(n,r);if(s>bestNS){bestN=n;bestNS=s;}if(fresh)polished++;continue;}
   if(bestN&&bestNS>pcScore+1e-9){pc=bestN;pcScore=bestNS;nb=neighbors(pc);ni=0;bestN=null;bestNS=-Infinity;}else pc=null;
  }
  return {done:done+Math.min(polished,polishBudget),total:total+polishBudget,finished:done>=total&&polished>=polishBudget,evaluated:cache.size,feasible:archive.size};
 }
 // Base slots outside the active shinsik often change nothing; keep one entry per identical outcome, closest to the current equipment.
 function distinct(){
  const groups=new Map(),overlap=c=>c.baseSlots.filter(id=>current.baseSlots.includes(id)).length;
  // Orders that only swap skills without changing any outcome are the same choice for the player.
  for(const c of archive.values()){const k=[...c.ids].sort().join()+'|'+c.coefficient+'|'+c.perMin,prev=groups.get(k);if(!prev||overlap(c)>overlap(prev))groups.set(k,c);}
  return [...groups.values()];
 }
 function results(limit=5){
  const list=distinct(),verified=[],checked=new Set();
  const check=c=>{const k=key({ids:c.ids,base:c.baseSlots});if(checked.has(k))return null;checked.add(k);const v=verify(data,c.ids,c.baseSlots,ctx);return v.valid&&(v.margin===null||v.margin>=0)?{...c,verification:v}:null;};
  for(const c of [...list].sort((a,b)=>b.coefficient-a.coefficient||b.perMin-a.perMin)){if(verified.length>=limit)break;const r=check(c);if(r)verified.push(r);}
  // Also surface the roomiest option that keeps at least 97% of the best damage.
  const best=verified[0]?.coefficient||0,roomy=list.filter(c=>c.coefficient>=best*0.97).sort((a,b)=>b.perMin-a.perMin).slice(0,limit*2);
  let safest=null;for(const c of roomy){const r=check(c)||verified.find(v=>v.ids.join()===c.ids.join()&&v.baseSlots.join()===c.baseSlots.join());if(r&&(!safest||r.verification.minPerMin>safest.verification.minPerMin))safest=r;}
  return {best:verified,safest};
 }
 return {step,results,pool:candidates,ultimate:ult,slots:normals.length,start:startEval};
}
const api={parseAmount,parseReduction,timeline,sources,amount,needsStats,sustain,regenPerMin,calibrate,evaluate,verify,pool,createSearch,profiles:PROFILES,horizons:HORIZONS};
if(typeof module!=='undefined')module.exports=api;else root.DosulOptimizer=api;
})(typeof window!=='undefined'?window:globalThis);
