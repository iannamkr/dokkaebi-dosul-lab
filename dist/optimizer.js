(function(root){
'use strict';
// Generic build search: keeps the slot count, then searches the ultimate (any one of the allowed families), skills, order
// and base equipment. Switching the ultimate brings in three of its family and re-fits the base slots for its condition.
// Sustain amounts are parsed from skill text; durations and overwrite rules come from the kkaebigg buff dictionary snapshot.
// Incoming damage per monster is a user input or a measurement; how many monsters attack comes from zone density (hunt).
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
// Hunting zones: spawn-weighted monster stats. Incoming damage moves between zones by the attack ratio,
// an estimate because the defence formula is not public.
function zoneSummary(zone){
 if(!zone?.monsters?.length)return null;const ms=zone.monsters,w=m=>Math.max(1,m.spawns??m.spawn?.count??1),total=ms.reduce((a,m)=>a+w(m),0);
 const avg=k=>ms.reduce((a,m)=>a+m[k]*w(m),0)/total;
 return {id:zone.id,name:zone.name,recommendedPower:zone.recommendedPower,levels:zone.levels,coins:zone.coins,monsters:ms.length,spawns:total,
  attack:round(avg('attack')),maxAttack:Math.max(...ms.map(m=>m.attack)),hp:round(avg('hp')),maxHp:Math.max(...ms.map(m=>m.hp))};
}
function zoneScale(from,to){const a=zoneSummary(from),b=zoneSummary(to);return a&&b&&a.attack>0?b.attack/a.attack:1;}

// Monsters never attack first: only the ones a skill has hit fight back. An area attack therefore pulls every monster
// standing in its area, and they keep attacking until they die.
// Calibrated on the 2026-10-18 recordings in 독기 지대: 불굴's 5 m ring (456 px wide) against the ~7 monsters on screen
// gives the map scale; kill speed on the target bar (≈9.8 kills/min, 45k HP) against coefficient × attack gives the share
// of the coefficient that ends up as damage (defence, crits and walking between monsters included).
const M_PER_PX=0.95,DAMAGE_RATE=0.155;
const pullCache=new Map();
function spawnPoints(zone){
 if(!zone?.map?.width||!zone.monsters)return [];
 return zone.monsters.flatMap(m=>(m.points||m.spawn?.points||[]).map(([x,y])=>[x/100*zone.map.width*M_PER_PX,y/100*zone.map.height*M_PER_PX]));
}
// Monsters per square metre around a monster (where the player fights). Spawn points sit 3 m+ apart but monsters roam,
// so density is averaged over a 12 m neighbourhood instead of counting exact neighbours.
const DENSITY_RADIUS=12;
function density(zone){
 if(!zone)return 0;if(pullCache.has(zone.id))return pullCache.get(zone.id);
 const p=spawnPoints(zone),r2=DENSITY_RADIUS**2;let n=0;for(const a of p)for(const b of p)if(a!==b&&(a[0]-b[0])**2+(a[1]-b[1])**2<=r2)n++;
 const v=p.length?n/p.length/(Math.PI*r2):0;pullCache.set(zone.id,v);return v;
}
// Expected number of other monsters inside an area of the given radius.
function pull(zone,radius){return radius>0?density(zone)*Math.PI*radius*radius:0;}
// Radius of a circle with the same area as the attack shape.
function reach(g){
 if(g.kind==='circle'||g.kind==='target'||g.kind==='chain')return g.radius;
 if(g.kind==='line')return Math.sqrt(g.radius*g.width/Math.PI);
 if(g.kind==='cone')return Math.sqrt(g.angle/2*g.radius*g.radius/Math.PI);
 return 0;
}
function castCoefficient(s){const n=s.referenceNumbers||{},ds=n.cm?[n.dc?.at(-1)].filter(Boolean):n.dc||[];return ds.reduce((a,d)=>a+(Number.isFinite(d.basic_coefficient)?d.basic_coefficient*d.hits:0),0);}
// Expected-value hunt over the cast timeline: single-target hits finish one monster at a time, area hits pull the
// monsters in range (up to the target cap) and damage every engaged one. Returns the time-averaged number of monsters
// attacking the player and kills per minute in the zone. The next monster is engaged as soon as one dies, so a
// single-target build always fights exactly one (faster kills never look like less damage taken).
function hunt(run,data,zone,attack,rate=DAMAGE_RATE){
 const hp=zoneSummary(zone)?.hp;if(!hp||!(attack>0))return null;
 const byId=Object.fromEntries(data.skills.map(s=>[s.id,s])),events=run.schedule.events.filter(e=>e.completed&&e.end<=run.horizon).sort((a,b)=>a.end-b.end);
 let groups=[{w:1,h:hp}],t=0,alive=0,kills=0,pulled=0;const engaged=()=>groups.reduce((a,g)=>a+g.w,0);
 // Never fewer than one monster: when the engaged ones are (expected to be) dead, the next one is engaged.
 const engageNext=()=>{const w=engaged();if(w<1-1e-9)groups.push({w:1-w,h:hp});};
 for(const e of events){
  const s=byId[e.id],g=Sim.geometry(s),coef=castCoefficient(s);if(g.kind==='support'||g.kind==='unknown'||!coef)continue;
  alive+=engaged()*(e.end-t);t=e.end;if(!groups.length)groups.push({w:1,h:hp});
  const d=rate*attack*coef/100;
  if(g.kind==='single'){
   if(groups[0].w>1){const f=groups[0];groups.splice(0,1,{w:1,h:f.h},{w:f.w-1,h:f.h});}
   const f=groups[0];if(d>=f.h){kills+=f.w;groups.shift();engageNext();}else f.h-=d;continue;
  }
  // Monsters near the target are already engaged; only the rest of the expected neighbourhood joins.
  const near=Math.min(Math.max(0,g.cap-1),pull(zone,reach(g))),fresh=Math.max(0,near-(engaged()-1));
  if(fresh>1e-9){groups.push({w:fresh,h:hp});pulled+=fresh;}
  const hit=Math.min(1,g.cap/Math.max(engaged(),1e-9));
  for(const x of groups)x.h-=d*hit;
  for(const x of groups.filter(x=>x.h<=0))kills+=x.w;groups=groups.filter(x=>x.h>0);engageNext();
 }
 alive+=engaged()*(run.horizon-t);
 return {attackers:round(alive/run.horizon*1000)/1000,killsPerMin:round(kills/(run.horizon/60)),pulledPerMin:round(pulled/(run.horizon/60)),monsterHp:hp};
}
function evaluate(data,ids,baseSlots,ctx){
 const v=Q.validate({...data,baseSlots},ids);if(v.issues.length)return {valid:false,issue:v.issues.join(' / ')};
 const run=Sim.run({...data,baseSlots},ids,ctx.profile||PROFILES[0],ctx.horizon||180);
 if(run.validation.issues.length||run.schedule.missing.length)return {valid:false,issue:[...run.validation.issues,...run.schedule.missing].join(' / ')};
 const multi=run.impacts.filter(i=>i.targets.length>1).length;
 if(ctx.singleOnly&&multi)return {valid:false,issue:'여러 대상 동시 적중'};
 // With a zone, power is kills per minute and incoming damage grows with the monsters the build pulls.
 const h=ctx.zone?hunt(run,data,ctx.zone,Number(ctx.stats?.attack)):null,attackers=h?h.attackers:1;
 const incoming=Number(ctx.perMob)>0?round(ctx.perMob*attackers):ctx.incoming;
 const s=sustain(run,data,ids,ctx.stats,ctx.overrides,{incoming,snapshot:ctx.snapshot}),partial=run.rows.filter(r=>r.unknown.includes('피해 계수')).map(r=>r.name);
 const need=Number(ctx.perMob)>0?round(incoming-(Number(ctx.regenPerMin)||0)+(Number(ctx.margin)||0)):ctx.need;
 const out={valid:true,coefficient:round(run.metrics.coefficient),power:h?h.killsPerMin:round(run.metrics.coefficient),hunt:h,attackers,incoming:incoming??null,need:need??null,
  perMin:s.perMin,full:s.full,modeled:s.modeled,rows:s.rows,unquantified:s.unquantified,multiTargetHits:multi,partial,active:run.schedule.active,idle:round(run.schedule.wait),casts:run.schedule.casts};
 // Calibration re-runs the shield timeline on the same simulation at other incoming values.
 if(ctx.keepRun)out.sustainAt=incoming=>sustain(run,data,ids,ctx.stats,ctx.overrides,{incoming,snapshot:ctx.snapshot}).perMin;
 return out;
}
// Worst case over every video preset and observation length.
function verify(data,ids,baseSlots,ctx){
 let worst=null;const runs=[];
 for(const horizon of HORIZONS)for(const profile of PROFILES){
  const r=evaluate(data,ids,baseSlots,{...ctx,keepRun:false,profile,horizon});if(!r.valid)return {valid:false,issue:`${profile}/${horizon}초: ${r.issue}`};
  const need=r.need??ctx.need;runs.push({profile,horizon,coefficient:r.coefficient,power:r.power,perMin:r.perMin,need,attackers:r.attackers,incoming:r.incoming});
  const room=need===null||need===undefined?r.perMin:r.perMin-need;
  if(!worst||room<worst.room)worst={...r,profile,horizon,room,need};
 }
 const long=runs.filter(r=>r.horizon===180),hasNeed=worst.need!==null&&worst.need!==undefined;
 return {valid:true,minPerMin:worst.perMin,minCoefficient:Math.min(...long.map(r=>r.coefficient)),minPower:Math.min(...long.map(r=>r.power)),
  attackers:Math.max(...long.map(r=>r.attackers)),incoming:worst.incoming,need:hasNeed?worst.need:null,margin:hasNeed?round(worst.room):null,worst,runs};
}
// What would make a build survive, one lever at a time, solved on the build's worst preset (profile and length) so the
// target matches the verification: incoming damage cut, natural regen, max HP, attack, and the zones where it already holds (hardest first).
// Each value is the smallest change that reaches the need (which includes the safety margin); null = that lever alone is not enough.
function improvements(data,ids,baseSlots,ctx,opts={}){
 const v=verify(data,ids,baseSlots,ctx);if(!v.valid)return null;
 const w=v.worst,wctx={...ctx,profile:w.profile,horizon:w.horizon},st=ctx.stats||{};
 const room=c=>{const r=evaluate(data,ids,baseSlots,c);return r.valid?r.perMin-r.need:-Infinity;};
 const solve=(make,lo,hi)=>{if(room(make(hi))<0)return null;for(let i=0;i<14;i++){const m=(lo+hi)/2;if(room(make(m))>=0)hi=m;else lo=m;}return hi;};
 const deficit=Math.max(0,round(w.need-w.perMin)),out={deficit,profile:w.profile,horizon:w.horizon,perMob:ctx.perMob};
 const period=Number(st.regenPeriod)||5,regen=Number(st.regen)||0;
 out.regen={from:regen,to:Math.ceil(regen+deficit/(60/period))};
 if(deficit>0){
  const cut=solve(f=>({...wctx,perMob:ctx.perMob*(1-f)}),0,0.95);out.incomingCut=cut===null?null:Math.ceil(cut*1000)/10;
  const hp=solve(f=>({...wctx,stats:{...st,maxHp:st.maxHp*f}}),1,4);out.maxHp=hp===null?null:{from:st.maxHp,to:Math.ceil(st.maxHp*hp)};
  const atk=solve(f=>({...wctx,stats:{...st,attack:st.attack*f}}),1,4);out.attack=atk===null?null:{from:st.attack,to:Math.ceil(st.attack*atk)};
 }else{out.incomingCut=0;out.maxHp={from:st.maxHp,to:st.maxHp};out.attack={from:st.attack,to:st.attack};}
 // Zones: damage per monster moves with the spawn-weighted attack ratio; density and monster HP come from each zone.
 if(opts.zones&&ctx.zone){
  out.zones=opts.zones.map(z=>{const r=evaluate(data,ids,baseSlots,{...wctx,zone:z,perMob:ctx.perMob*zoneScale(ctx.zone,z)});
   return r.valid?{id:z.id,name:z.name,recommendedPower:z.recommendedPower,killsPerMin:r.power,room:round(r.perMin-r.need)}:null;})
   .filter(x=>x&&x.room>=0).sort((a,b)=>b.recommendedPower-a.recommendedPower||b.killsPerMin-a.killsPerMin);
 }
 return out;
}
function pool(data,ids,{families,singleOnly}){
 const keep=new Set(ids.filter(id=>!data.skills.find(s=>s.id===id)?.ultimate));
 return data.skills.filter(s=>!s.ultimate&&(keep.has(s.id)||(families.includes(s.family)&&typeof s.basic?.cooldown==='number'&&(!singleOnly||s.targeting?.kind==='single'||s.damage===false)))).map(s=>s.id);
}
function rng(seed){let x=(seed>>>0)||1;return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);}
function createSearch(data,current,opts){
 const byId=Object.fromEntries(data.skills.map(s=>[s.id,s])),isUlt=id=>!!byId[id]?.ultimate;
 const ult=current.ids.find(isUlt)||null,normals=current.ids.filter(id=>id!==ult);
 const ctx={stats:opts.stats,overrides:opts.overrides||{},singleOnly:!!opts.singleOnly,profile:opts.profile||'185547',horizon:180,need:opts.need,incoming:opts.incoming,snapshot:opts.snapshot,
  zone:opts.zone||null,perMob:opts.perMob,regenPerMin:opts.regenPerMin,margin:opts.margin};
 const candidates=pool(data,current.ids,opts),cache=new Map(),archive=new Map(),random=rng(opts.seed||20261018);
 // Only a build that already has an ultimate may switch it; ultimates of unchecked families (locked) never enter.
 const ultimates=ult?[...new Set([ult,...data.skills.filter(s=>s.ultimate&&(opts.families||[]).includes(s.family)&&typeof s.basic?.cooldown==='number').map(s=>s.id)])]:[];
 // `iterations` is spread over the near chains as before; far chains add the same per-chain budget and must keep
 // at least FAR skills different from the current build, so the "different builds" group is really explored.
 const FAR=4,nearChains=Math.max(1,opts.chains||3),farChains=Math.max(0,opts.farChains??2),perChain=Math.ceil(Math.max(30,opts.iterations||4000)/nearChains),total=perChain*(nearChains+farChains),chains=nearChains+farChains;
 const changed=s=>s.ids.filter(id=>!current.ids.includes(id)).length;
 const key=s=>s.ids.join()+'|'+[...s.base].sort().join();
 const ev=s=>{const k=key(s);if(!cache.has(k))cache.set(k,evaluate(data,s.ids,s.base,ctx));return cache.get(k);};
 const start={ids:[...current.ids],base:[...current.baseSlots]},startEval=ev(start);
 // Each build has its own need: pulling more monsters raises the damage it must absorb.
 const scale=Math.max(1e-6,startEval.valid?startEval.power:1),needOf=r=>r.need??ctx.need,has=n=>n!==null&&n!==undefined;
 const penalty=r=>{const need=needOf(r);return has(need)?Math.max(0,need-r.perMin)*3*scale/Math.max(need,1):0;};
 // Equal power is common (order changes nothing); the tiny sustain term breaks those ties toward more room.
 const score=r=>r.valid?r.power-penalty(r)+(r.perMin-(needOf(r)||0))*1e-9*scale:-Infinity;
 const feasible=r=>r.valid&&(!has(needOf(r))||r.perMin>=needOf(r));
 let cur=start,curScore=score(startEval),done=0,chain=0,temp=0.03*scale;
 const pick=a=>a[Math.floor(random()*a.length)];
 // New ultimate in the same slot; skills of its family replace others until three are in the build, then the base
 // slots are re-fitted so the ultimate's condition (three of its family equipped) holds.
 function switchUltimate(s,u){
  const n={ids:[...s.ids],base:[...s.base]},old=n.ids.find(isUlt);if(!old||!u||u===old)return n;n.ids[n.ids.indexOf(old)]=u;
  const fam=byId[u].family,own=()=>n.ids.filter(id=>!isUlt(id)&&byId[id].family===fam).length,avail=candidates.filter(id=>byId[id].family===fam&&!n.ids.includes(id));
  while(own()<3&&avail.length){const out=pick(n.ids.filter(id=>!isUlt(id)&&byId[id].family!==fam));if(!out)break;const inn=avail.splice(Math.floor(random()*avail.length),1)[0];n.ids[n.ids.indexOf(out)]=inn;const bi=n.base.indexOf(out);if(bi>=0)n.base[bi]=inn;}
  n.base=Q.fit(data,n.ids,n.base);return n;
 }
 function replaceOne(s){const n={ids:[...s.ids],base:[...s.base]},out=pick(n.ids.filter(id=>!isUlt(id)&&current.ids.includes(id))||[]),avail=candidates.filter(id=>!n.ids.includes(id));if(!out||!avail.length)return n;const inn=pick(avail);n.ids[n.ids.indexOf(out)]=inn;const bi=n.base.indexOf(out);if(bi>=0)n.base[bi]=inn;return n;}
 function mutate(s){
  const n={ids:[...s.ids],base:[...s.base]},m=random();
  // Only the ultimate-exploring far chain switches ultimates; the other chains keep the current one.
  if(ultimates.length>1&&chain>=nearChains&&(chain-nearChains)%2===1&&random()<0.05)return switchUltimate(s,pick(ultimates.filter(u=>!n.ids.includes(u))));
  if(m<0.35){const a=Math.floor(random()*n.ids.length),b=Math.floor(random()*n.ids.length);[n.ids[a],n.ids[b]]=[n.ids[b],n.ids[a]];}
  else if(m<0.6){const a=Math.floor(random()*n.ids.length),b=Math.floor(random()*n.ids.length);const [x]=n.ids.splice(a,1);n.ids.splice(b,0,x);}
  else if(m<0.85){const out=pick(n.ids.filter(id=>!isUlt(id))),avail=candidates.filter(id=>!n.ids.includes(id));if(!out||!avail.length)return n;const inn=pick(avail);n.ids[n.ids.indexOf(out)]=inn;const bi=n.base.indexOf(out);if(bi>=0)n.base[bi]=inn;}
  else{const avail=n.ids.filter(id=>!isUlt(id)&&!n.base.includes(id));if(!avail.length||!n.base.length)return n;n.base[Math.floor(random()*n.base.length)]=pick(avail);}
  return n;
 }
 // Builds that fall short are kept too (best room first), so a zone nobody survives still shows how close it gets.
 const nearMiss=new Map();
 function remember(s,r){if(r.valid&&!feasible(r)){const k=key(s);if(!nearMiss.has(k)){nearMiss.set(k,{ids:s.ids,baseSlots:s.base,coefficient:r.coefficient,power:r.power,perMin:r.perMin,room:r.perMin-(needOf(r)||0)});if(nearMiss.size>400){const keep=[...nearMiss].sort((a,b)=>b[1].room-a[1].room).slice(0,200);nearMiss.clear();keep.forEach(([k,v])=>nearMiss.set(k,v));}}}if(!feasible(r))return;const k=key(s);if(!archive.has(k))archive.set(k,{ids:s.ids,baseSlots:s.base,coefficient:r.coefficient,power:r.power,perMin:r.perMin,room:r.perMin-(needOf(r)||0)});}
 remember(start,startEval);
 // Every single swap, move, skill replacement and base change of one build.
 function neighbors(s){
  const out=[],n=s.ids.length,avail=candidates.filter(id=>!s.ids.includes(id));
  for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){const ids=[...s.ids];[ids[a],ids[b]]=[ids[b],ids[a]];out.push({ids,base:[...s.base]});}
  for(let a=0;a<n;a++)for(let b=0;b<n;b++){if(a===b||b===a-1)continue;const ids=[...s.ids];const [x]=ids.splice(a,1);ids.splice(b,0,x);out.push({ids,base:[...s.base]});}
  for(const old of s.ids)if(!isUlt(old))for(const inn of avail)out.push({ids:s.ids.map(x=>x===old?inn:x),base:s.base.map(x=>x===old?inn:x)});
  for(let i=0;i<s.base.length;i++)for(const id of s.ids)if(!isUlt(id)&&!s.base.includes(id)){const base=[...s.base];base[i]=id;out.push({ids:[...s.ids],base});}
  // Another ultimate whose family already has three skills in the build: swap it in and re-fit the base slots.
  const own=s.ids.find(isUlt);if(own)for(const u of ultimates)if(!s.ids.includes(u)&&s.ids.filter(id=>!isUlt(id)&&byId[id].family===byId[u].family).length>=3){const ids=s.ids.map(x=>x===own?u:x);out.push({ids,base:Q.fit(data,ids,s.base)});}
  return out;
 }
 // Random search alone stops near good builds; polishing climbs from the best ones until no single change helps.
 const polishBudget=Math.max(0,opts.polish??Math.round(total*0.6));
 let polished=0,queue=null,pc=null,pcScore=0,nb=[],ni=0,bestN=null,bestNS=-Infinity;
 function step(budgetMs=40){
  const end=Date.now()+budgetMs;
  while(Date.now()<end){
   if(done<total){
        if(done>0&&done%perChain===0&&chain<Math.floor(done/perChain)){chain=Math.floor(done/perChain);cur=start;
     if(chain<nearChains){for(let i=0;i<chain*3;i++)cur=mutate(cur);}else{for(let i=0;i<FAR+chain-nearChains;i++)cur=replaceOne(cur);if((chain-nearChains)%2===1&&ultimates.length>1)cur=switchUltimate(cur,pick(ultimates.filter(u=>u!==ult)));}
     curScore=score(ev(cur));temp=0.03*scale;}
    const next=mutate(cur);if(chain>=nearChains&&changed(next)<FAR){done++;continue;}const r=ev(next),s=score(r);
    if(s>=curScore||random()<Math.exp((s-curScore)/Math.max(temp,1e-9))){cur=next;curScore=s;}
    remember(next,r);temp=Math.max(0.0006*scale,temp*Math.pow(0.02,1/perChain));done++;continue;
   }
   if(polished>=polishBudget)break;
   // Polish the best near builds and the best far ones (4+ skills changed) so both result groups are refined.
   if(!queue){const all=distinct().sort((a,b)=>b.power-a.power||b.room-a.room),far=c=>changed(c)>=FAR;queue=[...all.filter(c=>!far(c)).slice(0,3),...all.filter(far).slice(0,3)].map(c=>({ids:[...c.ids],base:[...c.baseSlots]}));}
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
  for(const c of archive.values()){const k=[...c.ids].sort().join()+'|'+c.power+'|'+c.perMin,prev=groups.get(k);if(!prev||overlap(c)>overlap(prev))groups.set(k,c);}
  return [...groups.values()];
 }
 function results(limit=5){
  const list=distinct(),verified=[],checked=new Set();
  const check=c=>{const k=key({ids:c.ids,base:c.baseSlots});if(checked.has(k))return null;checked.add(k);const v=verify(data,c.ids,c.baseSlots,ctx);return v.valid&&(v.margin===null||v.margin>=0)?{...c,verification:v}:null;};
  for(const c of [...list].sort((a,b)=>b.power-a.power||b.room-a.room)){if(verified.length>=limit)break;const r=check(c);if(r)verified.push(r);}
  // Also surface the roomiest option that keeps at least 97% of the best damage.
  const best=verified[0]?.power||0,roomy=list.filter(c=>c.power>=best*0.97).sort((a,b)=>b.room-a.room).slice(0,limit*2);
  const roomOf=v=>v.margin??v.minPerMin;
  let safest=null;for(const c of roomy){const r=check(c)||verified.find(v=>v.ids.join()===c.ids.join()&&v.baseSlots.join()===c.baseSlots.join());if(r&&(!safest||roomOf(r.verification)>roomOf(safest.verification)))safest=r;}
  return {best:verified,safest};
 }
 // One entry per skill set (its best verified order and equipment), split by how many skills differ from the current build:
 // `similar` changes at most `maxChanges` skills (0 = only order or equipment), `different` changes more.
 function grouped(limit=10,maxChanges=3,PER_ULTIMATE=3){
  const start=new Set(current.ids),sets=new Map();
  for(const c of archive.values()){const k=[...c.ids].sort().join();if(!sets.has(k))sets.set(k,[]);sets.get(k).push(c);}
  const rank=(a,b)=>b.power-a.power||b.room-a.room,lists=[...sets.values()].map(l=>l.sort(rank)).sort((a,b)=>rank(a[0],b[0]));
  const out={similar:[],different:[]};
  for(const list of lists){
   const changes=list[0].ids.filter(id=>!start.has(id)).length,group=changes<=maxChanges?'similar':'different',u=list[0].ids.find(isUlt);
   // The current ultimate keeps the similar group and half of the different one; a switched ultimate gets PER_ULTIMATE places.
   const cap=u!==ult?PER_ULTIMATE:group==='similar'?limit:Math.ceil(limit/2);if(out[group].filter(c=>c.ids.includes(u)).length>=cap)continue;
   if(out[group].length>=limit){if(out.similar.length>=limit&&out.different.length>=limit)break;continue;}
   // A skill set's best layout can fail on another preset; try its next layouts before giving up on it.
   for(const c of list.slice(0,3)){const v=verify(data,c.ids,c.baseSlots,ctx);if(v.valid&&(v.margin===null||v.margin>=0)){out[group].push({...c,verification:v,changes});break;}}
  }
  const byResult=(a,b)=>b.verification.minPower-a.verification.minPower||b.verification.margin-a.verification.margin;
  out.similar.sort(byResult);out.different.sort(byResult);
  // Closest builds that still fall short: one per skill set, most room first, verified like the others.
  const closest=[],seen=new Set();
  for(const c of [...nearMiss.values()].sort((a,b)=>b.room-a.room)){if(closest.length>=3)break;const k=[...c.ids].sort().join();if(seen.has(k))continue;seen.add(k);const v=verify(data,c.ids,c.baseSlots,ctx);if(v.valid)closest.push({...c,verification:v,changes:c.ids.filter(id=>!start.has(id)).length});}
  return {...out,closest,feasible:archive.size,sets:sets.size,maxChanges};
 }
 return {step,results,grouped,pool:candidates,ultimate:ult,ultimates,slots:normals.length,start:startEval};
}
const api={improvements,castCoefficient,hunt,pull,density,reach,spawnPoints,mPerPx:M_PER_PX,damageRate:DAMAGE_RATE,zoneSummary,zoneScale,parseAmount,parseReduction,timeline,sources,amount,needsStats,sustain,regenPerMin,calibrate,evaluate,verify,pool,createSearch,profiles:PROFILES,horizons:HORIZONS};
if(typeof module!=='undefined')module.exports=api;else root.DosulOptimizer=api;
})(typeof window!=='undefined'?window:globalThis);
