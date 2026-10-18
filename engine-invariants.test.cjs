// Engine invariants re-derived from run logs over seeded random builds of every family (2026-10-18 audit).
const assert=require('node:assert/strict'),R='./';
const Sim=require(R+'dist/simulation.js'),Q=require(R+'dist/sequence.js'),D=require(R+'dist/data.json');
const byId=new Map(D.skills.map(s=>[s.id,s])),EPS=1e-6,r2=n=>Math.round(n*1e6)/1e6;
const RESETS=['강압 발동','요기범람 발동','연쇄 발동'];
let seed=20261018;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),pick=a=>a[Math.floor(rnd()*a.length)];
const usable=D.skills.filter(s=>{try{return Sim.run({...D,baseSlots:s.ultimate?undefined:[s.id]},[s.id],'185547',20).schedule.missing.length===0||s.ultimate;}catch{return false;}});
const normals=usable.filter(s=>!s.ultimate),ults=usable.filter(s=>s.ultimate);
function randomBuild(){
 const ult=rnd()<0.85?pick(ults):null;const fam=ult?normals.filter(s=>s.family===ult.family):[];if(ult&&fam.length<3)return null;
 const ids=new Set();const base=[];if(ult){while(base.length<3){const s=pick(fam);if(!base.includes(s.id))base.push(s.id);}base.forEach(i=>ids.add(i));}
 while(ids.size<8)ids.add(pick(normals).id);
 const others=[...ids].filter(i=>!base.includes(i));while(base.length<5)base.push(others.splice(Math.floor(rnd()*others.length),1)[0]);
 const order=[...ids];if(ult)order.push(ult.id);for(let i=order.length-1;i>0;i--){const k=Math.floor(rnd()*(i+1));[order[i],order[k]]=[order[k],order[i]];}
 return {ids:order,base};
}
const counts={},examples={};const fail=(code,msg)=>{counts[code]=(counts[code]||0)+1;(examples[code]??=[]).length<4&&examples[code].push(msg);};
function audit(ids,base,profile,H){
 const run=Sim.run({...D,baseSlots:base},ids,profile,H);const tag=`[${ids.map(i=>byId.get(i).name).join('>')}|${profile}/${H}]`;
 if(run.schedule.missing.length){fail('blocked',tag+' '+run.schedule.missing.join('/'));return;}
 const S=run.schedule,ev=S.events,imp=run.impacts,cond=run.conditions,apps=run.effectApplications,cap=id=>Math.max(1,byId.get(id).usage?.charges||1),cd=id=>byId.get(id).basic.cooldown;
 // A. timeline
 for(let i=1;i<ev.length;i++)if(ev[i].start<ev[i-1].end-EPS)fail('overlap',tag+' '+ev[i].start);
 const busy=ev.reduce((a,e)=>a+Math.min(e.end,H)-e.start,0),idle=S.idle.reduce((a,g)=>a+g.end-g.start,0);
 if(Math.abs(busy+idle-H)>0.05&&ev.at(-1)?.completed!==false)fail('time-conservation',tag+` ${r2(busy)}+${r2(idle)}`);
 // independent charge model rebuilt from casts + logged cooldown changes
 const state=new Map(ids.map(id=>[id,{ch:cap(id),next:null}]));
 const started=new Set();
 const changesAt=S.procs.flatMap(p=>p.changes.map(c=>({...c,trigger:p.trigger,time:p.time,reset:RESETS.includes(p.name)}))).sort((a,b)=>a.time-b.time);let ci=0;
 const settle=t=>{for(const [id,s] of state)while(s.next!==null&&s.next<=t+1e-6){s.ch++;s.next=s.ch<cap(id)?r2(s.next+cd(id)):null;}};
 const applyChanges=t=>{while(ci<changesAt.length&&changesAt[ci].time<=t+EPS){if(changesAt[ci].trigger&&!started.has(changesAt[ci].trigger.id+':'+changesAt[ci].trigger.cycle))break;const c=changesAt[ci++],s=state.get(c.id);settle(c.time);
   if(c.after<=c.time+1e-6){s.ch=c.reset?cap(c.id):Math.min(cap(c.id),s.ch+1);s.next=s.ch>=cap(c.id)?null:r2(c.time+cd(c.id));}else s.next=c.after;}};
 const readyAt=(id,t)=>{const s=state.get(id);return s.ch>0?-1:s.next;};
 let gi=0;
 for(const e of ev){
  // idle intervals before this cast: nothing may be available
  while(gi<S.idle.length&&S.idle[gi].end<=e.start+EPS){const g=S.idle[gi++];applyChanges(g.start);settle(g.start);for(const id of ids){const r=readyAt(id);if(r!==null&&r<g.end-1e-6&&g.end<H-EPS)fail('idle-while-ready',tag+` ${g.start}-${g.end} ${byId.get(id).name} ${r}`);}}
  applyChanges(e.start);settle(e.start);
  const st=state.get(e.id);if(st.ch<1&&!(e.recastStage>1))fail('cast-without-charge',tag+` ${byId.get(e.id).name}@${e.start}`);
  const slot=ids.indexOf(e.id);for(const id of ids.slice(0,slot))if(state.get(id).ch>0)fail('priority',tag+` ${e.start}s ${byId.get(e.id).name} over ${byId.get(id).name}`);
  if(!e.recastStage||e.recastStage===1)st.ch--;if(st.next===null){let c=cd(e.id);const lock=e.modifiers.find(m=>m.startsWith('자물쇠'));if(lock)c=Math.max(0,c-Number(lock.match(/(\d+)초/)[1]));st.next=r2(e.start+c);}
  started.add(e.id+':'+e.cycle);applyChanges(e.start);
  if(e.completed)applyChanges(e.end);
 }
 // B. hits
 const hitsPer=s=>{const n=s.referenceNumbers||{};if(s.damage===false||n.nd)return 0;const dc=n.dc||[];if(!dc.length)return 1;return n.cm?dc.at(-1).hits||1:dc.reduce((a,d)=>a+(d.hits||0),0)||1;};
 const unknownTiming=new Set(S.unknownHits.map(x=>x.split(' · ')[0]));
 for(const e of ev.filter(e=>e.completed)){const s=byId.get(e.id);if(unknownTiming.has(s.name)||s.hitTiming?.offsets)continue;const n=S.hits.filter(h=>h.id===e.id&&h.index===e.cycle).length;const want=s.usage?.recasts?1:Number.isInteger(s.hitTiming?.count)?s.hitTiming.count:hitsPer(s);if(n!==want)fail('hit-count',tag+` ${s.name}@${e.start} ${n}/${want}`);}
 for(const h of S.hits){const e=ev.find(x=>x.id===h.id&&x.cycle===h.index);if(!e||h.time<e.start-EPS||h.time>e.end+EPS)fail('hit-outside-cast',tag+` ${h.id}#${h.index}@${h.time}`);}
 for(const i of imp){if(i.targets.length>i.geometry.cap)fail('over-cap',tag+` ${i.id}`);for(const p of i.positions){const d=Math.hypot(p.x-i.origin.x,p.y-i.origin.y),g=i.geometry,lim=g.kind==='single'?g.range:g.kind==='target'||g.kind==='chain'?Infinity:Math.max(g.radius,g.range||0)+g.width;if(d>lim+0.02)fail('out-of-range',tag+` ${i.id} ${g.kind} d=${r2(d)} lim=${r2(lim)}`);}
  if(!i.targets.length){const e=ev.find(x=>x.id===i.id&&i.time>=x.start-EPS&&i.time<=x.end+EPS);const e2=ev.find(x=>x.id===i.id&&i.time>=x.start-0.01&&i.time<=x.end+0.01),crossed=e2&&Math.floor(e2.start/20+1e-9)!==Math.floor(i.time/20+1e-9);fail(crossed?'whiff-wave-reset':'whiff-other',tag+' '+byId.get(i.id).name+'@'+i.time);}}
 // C. effects/conditions (application wave is 0-based in the log)
 const same=(a,c)=>a.effect===c.effect&&(c.scope==='self'?a.target===null:(a.target===c.target&&a.wave===c.wave));
 for(const c of cond){if(!['yes','no'].includes(c.status)||c.effect==='최대 차지')continue;
  // Same-instant rule: an effect applied exactly at the hit counts only if its cast began before the hitting cast.
  const hitCast=ev.find(e=>e.id===c.id&&c.time>=e.start-EPS&&c.time<=e.end+EPS);
  const before=a=>a.appliedAt<c.time-EPS||(Math.abs(a.appliedAt-c.time)<=EPS&&ev.some(e=>e.id===a.source&&Math.abs(((byId.get(a.source).timingEffects?.[a.effect]?.application||'end')==='start'?e.start:e.end)-a.appliedAt)<=EPS&&e.start<hitCast.start-EPS));
  const act=apps.filter(a=>same(a,c)&&a.confirmed&&a.duration!==null&&before(a)&&a.expiresAt>c.time+1e-6).length>0;
  const had=apps.some(a=>same(a,c)&&before(a));
  if(c.status==='yes'&&!act)fail('cond-yes-without-effect',tag+` ${c.id} ${c.effect}@${c.time}`);
  if(c.status==='no'&&act)fail('cond-no-with-effect',tag+` ${c.id} ${c.effect}@${c.time}`);
  if(c.status==='no'&&c.reason==='expired'&&!had)fail('cond-expired-unexplained',tag+` ${c.effect}@${c.time}`);
  if(c.status==='no'&&c.reason==='not-applied'&&had)fail('cond-notapplied-but-had',tag+` ${c.effect}@${c.time}`);
  if(!imp.some(i=>i.id===c.id&&Math.abs(i.time-c.time)<1e-6&&i.wave===c.wave&&(c.scope==='self'||i.targets.includes(c.target-1))))fail('cond-not-at-hit',tag+` ${c.id}@${c.time}`);}
 for(const a of apps){if(a.target===null)continue;const ok=imp.some(i=>i.id===a.source&&i.wave===a.wave&&i.targets.includes(a.target-1)&&i.time<=a.appliedAt+EPS);if(!ok&&a.confirmed)fail('debuff-without-hit',tag+` ${a.effect}@${a.appliedAt}`);}
 // D. Jeolmyeong forms only from damaging casts, max 5
 if(S.active.includes('절명')){const g=S.gauges;let prev=0;for(const x of g){const v=x.values['절명'];const e=ev.find(y=>Math.abs(y.end-x.time)<EPS&&y.completed);if(v>prev&&(!e||byId.get(e.id).damage===false||hitsPer(byId.get(e.id))===0))fail('form-without-damage',tag+` ${x.time}`);if(v>5)fail('form-over-5',tag);prev=v;}}
 // E. aggregates
 for(const row of run.rows){const h=imp.filter(i=>i.id===row.id);if(h.length!==row.hitChecks||h.reduce((a,i)=>a+i.targets.length,0)!==row.targetHits)fail('row-aggregate',tag+' '+row.name);}
 const coef=run.rows.reduce((a,r)=>a+r.coefficient,0);if(Math.abs(coef-run.metrics.coefficient)>0.05)fail('metric-coefficient',tag);
 for(const x of [run.metrics.coefficient,run.metrics.coverage,busy])if(!Number.isFinite(x))fail('non-finite',tag);
 // F. determinism
 const again=Sim.run({...D,baseSlots:base},ids,profile,H);if(JSON.stringify(again.impacts)!==JSON.stringify(imp))fail('nondeterministic',tag);
}
const N=60;let built=0,runs=0;
while(built<N){const b=randomBuild();if(!b)continue;if(Q.validate({...D,baseSlots:b.base},b.ids).issues.length)continue;built++;for(const p of Sim.profiles)for(const h of [60,180]){audit(b.ids,b.base,p.id,h);runs++;}}
assert.deepEqual(counts,{},'Invariant violations:\n'+Object.entries(examples).map(([k,v])=>k+': '+counts[k]+'\n  '+v.join('\n  ')).join('\n'));

// Regressions for the v4 fixes, each reproduced from a case found by the audit.
const nameId=n=>D.skills.find(s=>s.name===n).id;
{ // 1. A cast that straddles the 20 s reset hits the new wave instead of nothing.
 const ids=['s071','s003','s012','s069','s010','s085','s007','s001','s075'],r=Sim.run({...D,baseSlots:['s003','s007','s001','s071','s012']},ids,'185547',60);
 const straddle=r.schedule.events.find(e=>e.id==='s075'&&e.start<20&&e.end>20);assert(straddle,'fixture still straddles the reset');
 assert(r.impacts.filter(i=>i.id==='s075'&&i.time>=20&&i.time<=straddle.end).every(i=>i.targets.length===1&&i.wave===2));
 assert(r.impacts.every(i=>i.targets.length>0),'Single-target build never whiffs');
}
{ // 2. Same instant: the earlier cast's last hit does not get the next cast's start buff (정밀 from 밀쳐내는 화살).
 const ids=['생명의 축복','용사비등','주먹 지르기','밀쳐내는 화살','방패 밀기','도깨비 불','필력종횡','화염구'].map(nameId),r=Sim.run({...D,baseSlots:ids.slice(0,5)},ids,'183432',60);
 const end=r.schedule.events.find(e=>e.id==='s011').end,next=r.schedule.events.find(e=>e.id==='s037');assert.equal(next.start,end);
 assert.equal(r.conditions.find(c=>c.id==='s011'&&Math.abs(c.time-end)<1e-6).status,'no');
}
{ // 3+4. Effect times keep engine precision; self conditions are judged once per hit; waves are 1-based everywhere.
 const ids=['집중 연타','주먹 지르기','광기의 칼놀림','내려치기','지진','간파의 눈','회전 난격','이중 사격','폭주'].map(nameId);
 const ult=D.skills.find(s=>s.id===ids[8]),fam=ids.filter(i=>D.skills.find(s=>s.id===i).family===ult.family&&i!==ult.id).slice(0,3),base=[...fam,...ids.filter(i=>!fam.includes(i)&&i!==ult.id)].slice(0,5);
 const r=Sim.run({...D,baseSlots:base},ids,'183432',180);
 assert(r.effectApplications.some(a=>String(a.appliedAt).split('.')[1]?.length>2),'Application times are not rounded to 0.01 s');
 const self=r.conditions.filter(c=>c.scope==='self');assert.equal(new Set(self.map(c=>c.id+'@'+c.time+'@'+c.effect)).size,self.length,'One self-condition record per hit');
 assert(r.effectApplications.every(a=>a.wave>=1)&&r.impacts.every(i=>i.wave>=1)&&r.conditions.every(c=>c.wave>=1));
}
console.log(`Engine invariants: ${built} random builds × 4 environments × 60/180 s (${runs} runs), timeline/charges/priority/hits/conditions/forms/aggregates/determinism and v4 regressions passed`);
