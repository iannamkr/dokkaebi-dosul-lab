const assert=require('node:assert/strict');
const D=require('./dist/data.json'),O=require('./dist/optimizer.js'),Sim=require('./dist/simulation.js'),H=require('./dist/kkaebi-gg/hunting.json');
const zone=id=>H.zones.find(z=>z.id===id),dok=zone('101011'),ruin=zone('101014'),id=n=>D.skills.find(s=>s.name===n).id;

// Calibration (2026-10-18 독기 지대 recordings): ~7–9 monsters on a 32.7 m × 26.8 m screen, ~9.8 kills/min single target.
const screen=O.density(dok)*32.7*26.8;assert(screen>7&&screen<10,'Density matches the monsters seen on screen: '+screen);
assert(O.density(ruin)>O.density(dok),'마을 폐허 is denser than 독기 지대');
assert.equal(O.pull(dok,0),0);assert(Math.abs(O.pull(dok,5)/O.pull(dok,2.5)-4)<1e-9,'Pull grows with the area');
assert.equal(O.reach({kind:'single',radius:0}),0);assert.equal(O.reach({kind:'circle',radius:5}),5);
assert(Math.abs(O.reach({kind:'line',radius:7.5,width:1.3})**2*Math.PI-7.5*1.3)<1e-9,'A line counts its own area');

const single=["s071","s003","s012","s069","s010","s085","s007","s001","s075"],singleBase=["s071","s003","s012","s007","s001"];
const area=['불굴','방패 밀기','얼음화살','내려찍기','암습','연속 찌르기','방패 충격파','찌르기','강인한 의지'].map(id),areaBase=['얼음화살','내려찍기','강인한 의지','찌르기','연속 찌르기'].map(id);
const hunt=(ids,base,z)=>O.hunt(Sim.run({...D,baseSlots:base},ids,'185547',180),D,z,20532);
const s=hunt(single,singleBase,dok),a=hunt(area,areaBase,dok);
assert(s.attackers===1&&s.pulledPerMin===0,'Single-target skills fight one monster at a time');
assert(s.killsPerMin>0,'Single-target hunt produces a measurable skill-only kill rate: '+s.killsPerMin);
const measuredBasic=O.hunt(Sim.run({...D,baseSlots:singleBase},single,'185547',180),D,dok,20532,1,{damage:5000,interval:1,range:2});
assert(measuredBasic.basicAttackMeasured&&measuredBasic.basicAttacks>0&&measuredBasic.basicDamage>0,'Measured basic attacks are executed in skill-idle windows');
assert(measuredBasic.killsPerMin>s.killsPerMin,'Measured basic attacks raise total kill throughput');
assert(a.attackers>1&&a.pulledPerMin>0,'Area attacks pull the monsters in range');
assert(hunt(area,areaBase,ruin).attackers>a.attackers,'A denser zone pulls more');
assert.equal(O.hunt(Sim.run({...D,baseSlots:singleBase},single,'185547',180),D,null,20532),null,'No zone, no hunt');

// 2026-10-18 043203: measured +3,124/min with the single build (90,540 → 96,787 in 120 s), then the recommended area build
// lost ~42,000/min. With incoming fixed per build the engine had predicted +3,186; per-monster incoming must reject it.
const stats={attack:20532,maxHp:101115,regen:2751,regenPeriod:5},overrides={'s085:0':'542'},ctx={stats,overrides,profile:'185547',horizon:180,zone:dok};
const base=O.evaluate(D,single,singleBase,{...ctx,keepRun:true}),measured=O.calibrate({sustainAt:base.sustainAt,stats,hpStart:90540,hpEnd:96787,seconds:120});
const perMob=measured/base.attackers,full={...ctx,perMob,regenPerMin:O.regenPerMin(stats),margin:0};
const keep=O.evaluate(D,single,singleBase,full),fail=O.evaluate(D,area,areaBase,full);
assert(Math.abs((keep.perMin-keep.need)-3124)<5,'The measured build reproduces its own measurement');
assert(fail.incoming>keep.incoming,'The area build takes more damage');assert(fail.perMin-fail.need<0,'The 043203 build no longer survives: '+(fail.perMin-fail.need));
// The search ranks by kills per minute and gives every build its own need.
const search=O.createSearch(D,{ids:single,baseSlots:singleBase},{...full,margin:1000,families:['절명','연타','강인','헌신','파멸'],iterations:40,polish:20,seed:7});
while(!search.step(1000).finished);const r=search.results(3);
for(const c of r.best){assert(c.verification.margin>=0);assert.equal(c.verification.need,c.verification.worst.need);assert(Math.abs(c.verification.need-(c.verification.worst.incoming-O.regenPerMin(stats)+1000))<0.02,'Need is the build’s own incoming − regen + margin');assert(c.verification.minPower>0);}
const g=search.grouped(5);assert(g.similar.every(c=>c.changes<=3)&&g.different.every(c=>c.changes>=4),'Groups split by skills changed');assert(g.feasible>=g.sets&&g.sets>0);
for(const l of [g.similar,g.different])for(let i=1;i<l.length;i++)assert(l[i-1].verification.minPower>=l[i].verification.minPower,'Each group is ranked by kills');
assert.equal(new Set([...g.similar,...g.different].map(c=>[...c.ids].sort().join())).size,g.similar.length+g.different.length,'One entry per skill set');
// Ultimates: every checked family's ultimate is tried (locked 척살·제압 never), and a switched build keeps the condition.
const names=search.ultimates.map(i=>D.skills.find(x=>x.id===i).name).sort();assert.deepEqual(names,['대폭발','방패 낙하','암습','개전의 가호','폭주'].sort());
const ultOf=c=>c.ids.find(i=>D.skills.find(x=>x.id===i).ultimate),counts={};for(const c of g.different){const u=ultOf(c);counts[u]=(counts[u]||0)+1;}
for(const [u,n] of Object.entries(counts))if(u!=='s010')assert(n<=3,'A switched ultimate fills at most 3 places');
assert(g.similar.every(c=>c.ids.filter(id=>!single.includes(id)).length<=3),'Similarity is based on changed skills, including ultimate swaps');
const Q=require('./dist/sequence.js');for(const c of [...g.similar,...g.different])assert.deepEqual(Q.validate({...D,baseSlots:c.baseSlots},c.ids).issues,[],'Grouped builds satisfy their ultimate');
// Improvements: each lever alone, when applied, makes the failing 043203 build survive on its worst preset.
const im=O.improvements(D,area,areaBase,{...full,margin:1000},{zones:H.zones});assert(im.deficit>0&&im.regen.to>im.regen.from);
const worst={...full,margin:1000,profile:im.profile,horizon:im.horizon,scenario:im.scenarioConfig},roomAt=c=>{const r=O.evaluate(D,area,areaBase,c);return r.perMin-r.need;};
assert(roomAt({...worst,regenPerMin:O.regenPerMin({...stats,regen:im.regen.to})})>=-1,'Regen target works');
if(im.incomingCut!==null)assert(roomAt({...worst,perMob:perMob*(1-im.incomingCut/100)})>=0,'Incoming cut works');
if(im.maxHp)assert(roomAt({...worst,stats:{...stats,maxHp:im.maxHp.to}})>=0,'Max HP target works');
for(let i=1;i<im.zones.length;i++)assert(im.zones[i-1].recommendedPower>=im.zones[i].recommendedPower,'Zones hardest first');assert(im.zones.every(z=>z.room>=0));
console.log('Hunt model: zone density, pull area, kill speed, per-monster incoming and the 043203 area-build regression result groups, ultimate switching and improvements passed.');
