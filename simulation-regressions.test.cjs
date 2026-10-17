const assert=require('node:assert/strict'),fs=require('fs'),Sim=require('./dist/simulation.js'),H=require('./dist/hit-timing.js'),Report=require('./dist/simulation-report.js'),raw=require('./dist/data.json');
const ids=['s060','s071','s078','s026','s021','s015','s068','s073','s067'],data={...structuredClone(raw),baseSlots:['s071','s068','s067','s060','s015']};
const invalid=Sim.run({...data,baseSlots:ids.slice(0,5)},ids);assert.equal(invalid.frames.length,0);assert.equal(invalid.schedule.events.length,0);assert(invalid.schedule.missing.some(x=>x.includes('방패 낙하')));assert.equal(Report.create(data,ids,invalid).calculation.status,'blocked');
for(const bad of [null,{},'s071',['s071','s071'],['s073'],['s001'],ids])assert(Sim.run({...data,baseSlots:bad},ids).schedule.missing.length,'Invalid equipment must be blocked');
const skill=data.skills.find(s=>s.id==='s026'),event={parts:{charge:.9},modifiers:[]},condition={effect:'최대 차지',scope:'self'};
assert.equal(Sim.conditionState(skill,event,condition,{},2).status,'yes');assert.equal(Sim.conditionState(skill,{parts:{charge:.1}},condition,{},2).status,'no');assert.equal(Sim.conditionState(skill,{parts:{charge:0},modifiers:['강압 · 최대 차지 즉시']},condition,{},2).status,'yes');
const bag={기세:[{appliedAt:1,duration:5,expiresAt:6,confirmed:true,source:'giver'}]};assert.equal(Sim.effectState(bag,'기세',0).reason,'not-applied');assert.equal(Sim.effectState(bag,'기세',5.99).status,'yes');assert.equal(Sim.effectState(bag,'기세',6).reason,'expired');
assert.equal(Sim.effectState({기세:[{appliedAt:1,duration:null,expiresAt:null,confirmed:true}]},'기세',10).reason,'duration-unknown');
assert.equal(Sim.effectState({기세:[{appliedAt:1,duration:5,expiresAt:6,confirmed:false}]},'기세',2).reason,'hit-unknown');
// A buff cast at start works even when the giver's geometry is missing.
const unknown=structuredClone(data);delete unknown.skills.find(s=>s.id==='s021').simulationGeometry;
const unknownRun=Sim.run(unknown,ids);assert(unknownRun.conditions.some(c=>c.id==='s015'&&c.status==='yes'));assert(unknownRun.conditions.some(c=>c.id==='s015'&&c.reason==='expired'));assert(!unknownRun.conditions.some(c=>c.id==='s015'&&c.reason==='hit-unknown'));
for(const p of Sim.profiles){const out=Sim.run(data,ids,p.id,60);assert.deepEqual(out.schedule.active,['강인']);assert(out.conditions.filter(c=>c.id==='s026').every(c=>c.status==='yes'),'Max charge must never look for an imaginary status effect');
 for(const id of ['s021','s068','s073','s078'])assert(out.rows.find(r=>r.id===id).hitChecks>0,id+' must get hit checks');
 assert.deepEqual(out.rows.find(r=>r.id==='s073').unknown,['피해 계수']);assert(out.frames.some(f=>f.player.x!==0||f.player.y!==0),'Dash position must be modeled');
 const r=Report.create(data,ids,out);assert.equal(r.calculation.status,'partial');assert(!r.findings.some(f=>f.code==='coverage'),'Incomplete geometry/damage cannot diagnose weak coverage unqualified');assert(r.conditionGroups.some(g=>g.reason==='expired'));assert(r.replay.effectApplications.length);
 assert.equal(out.frames.find(f=>f.time===20).player.x,0,'Reset player and enemy placement together');
}
const shield=data.skills.find(s=>s.id==='s073'),hits=H.schedule(shield,{id:shield.id,start:0,end:1.6,parts:{prep:0,charge:0,action:1.6}},10);assert.equal(hits.hits.length,1);assert.equal(Sim.coefficient(shield,1),null,'Known hit count must not invent damage');
const world=[{id:0,x:5,y:5},{id:1,x:5,y:6}],g={kind:'circle',range:2,radius:2,cap:5};assert.equal(Sim.pickTargets(g,world,world[0],0,{x:5,y:5}).length,2);
console.log('Simulation regressions: equipment blocking, charge/pressure, effect expiry/provenance, 4 missing skills, dash and partial reports passed');
