const assert=require('node:assert/strict'),C=require('./dist/combat.js'),A=require('./dist/timing-auto.js'),D=require('./dist/data.json');
const ids=['s019','s015','s062','s059','s025','s003','s012','s060','s066'];
D.baseSlots=['s062','s059','s060','s019','s015'];
const sim=C.run(D,ids),base=C.run(D,ids,60,false);
assert.deepEqual(sim.active,['파멸']);assert.ok(sim.casts>base.casts);assert.ok(Math.abs(sim.busy+sim.wait-60)<1e-6);
assert.ok(sim.events.some(e=>e.id!=='s066'&&e.start>sim.events.find(e=>e.id==='s066').end));
for(const p of sim.procs){assert.ok(p.changes.every(c=>c.id!=='s066'));}
assert.ok(sim.procs[0].time<10);assert.equal(sim.windows[0].end-sim.windows[0].start,20);
assert.equal(sim.events.find(e=>e.id==='s066').parts.prep,1);
const skill=(id,family,extra={})=>({id,name:id,family,basic:{cooldown:10},referenceNumbers:{m:500,dc:[{hits:1}]},...extra});
for(const family of Object.keys(C.rules)){
 const normals=D.skills.filter(s=>s.family===family&&!s.ultimate&&A.motion(s)).slice(0,3),ult=D.skills.find(s=>s.family===family&&s.ultimate),ss=C.run({...D,baseSlots:normals.map(s=>s.id)},[...normals,ult].map(s=>s.id),180);
 assert.equal(ss.missing.length,0,family);assert.ok(Math.abs(ss.busy+ss.wait-180)<.00001,family);assert.ok(ss.events.every((e,i)=>!i||e.start>=ss.events[i-1].end),family);
}
const synthetic={skills:[skill('a','기만'),skill('b','기만'),skill('c','기만'),skill('u','기만',{ultimate:true})]},g=C.run(synthetic,['a','b','c','u']);
assert.equal(g.events.find(e=>e.id==='b').cooldownEnd,5.5);assert.ok(g.procs.every(p=>p.changes.every(c=>c.id!=='u')));
const mixed={skills:['x','y','z'].map(id=>skill(id,'주술')).concat(skill('other','강타'))},hex=C.run(mixed,['other','x','y','z']);
assert.ok(hex.procs.some(p=>p.changes.some(c=>c.id==='other')),'Intended hex reduction affects other normal families');
const smashData={skills:['a','b','c'].map(id=>skill(id,'강타',{basic:{cooldown:4},referenceNumbers:{m:500,cm:500,dc:[{hits:1},{hits:1},{hits:1}]}})).concat(skill('u','강타',{ultimate:true,basic:{cooldown:12}}))};
const smash=C.run(smashData,['a','b','c','u'],60);assert.ok(smash.procs.some(p=>p.name==='강압 발동'));assert.ok(smash.events.some(e=>e.modifiers.some(m=>m.includes('최대 차지'))&&e.parts.charge===0));
const partial=C.run({skills:[skill('a','강타',{referenceNumbers:{m:30000}})]},['a'],20);assert.equal(partial.busy,20);assert.equal(partial.casts,0);assert.equal(partial.events[0].completed,false);
const absentData={skills:[{...skill('a','강타'),timingEffects:{mark:{duration:5}}},skill('b','강타')]};assert.equal(A.assess(absentData,{events:[{id:'b',end:1,cycle:1,completed:true}]},{source:'a',target:'b',effect:'mark'}).first,'absent');
assert.deepEqual(C.active({...D,baseSlots:ids.slice(0,5)},ids),[]);assert.deepEqual(C.active(D,ids),['파멸'],'Explicit base equipment controls activation');
console.log('Combat: 12 styles, priority, resets, charge, intended hex, activation, partial casts and time conservation passed.');

