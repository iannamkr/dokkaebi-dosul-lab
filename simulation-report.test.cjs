const assert=require('node:assert/strict'),Sim=require('./dist/simulation.js'),Report=require('./dist/simulation-report.js'),raw=require('./dist/data.json');
const names=['연쇄 번개','방패 치기','휩쓸어 베기','검기 폭발','대검 찍기','회전 난격','방패 내려찍기','방패 낙하','강인한 의지'];
const ids=names.map(name=>{const s=raw.skills.find(s=>s.name.replace(/\s/g,'')===name.replace(/\s/g,''));assert(s,name);return s.id;});
const d=structuredClone(raw);d.baseSlots=['s071','s068','s067','s060','s015'];
for(const profile of Sim.profiles){
 const result=Sim.run(d,ids,profile.id,60),r=Report.create(d,ids,result,{completed:true,clock:60,createdAt:'2026-10-17T00:00:00.000Z'});
 assert.equal(r.calculation.status,'partial','Missing shield damage must not be advertised as a complete calculation');assert.equal(r.playback.reachedEnd,true);assert.equal(r.build.order.length,9);assert.equal(r.perSkill.length,9);assert.equal(r.segments.length,3);
 assert.equal(r.metrics.kills,null);assert.equal(r.metrics.dps,null);assert.equal(r.metrics.survival,null);
 assert.equal(r.segments.reduce((n,s)=>n+s.hitChecks,0),result.impacts.length,'Each boundary hit counted once');
 assert.equal(r.segments.reduce((n,s)=>n+s.conditionFail,0),result.metrics.conditionFail);
 assert(Math.abs(r.segments.reduce((n,s)=>n+s.noSkillSeconds,0)-result.schedule.wait)<.03);
 const replay=Sim.run(r.dataSnapshot,r.build.ids,r.scenario.profileId,r.scenario.horizonSeconds);
 assert.deepEqual(replay.metrics,result.metrics,'Report must reproduce metrics from embedded input snapshot');
 assert.deepEqual(replay.conditions,result.conditions);assert.deepEqual(replay.schedule.events,result.schedule.events);
 const restored=JSON.parse(JSON.stringify(r));assert.deepEqual(restored,r);assert.match(Report.text(r),/처치량·DPS·생존: 계산 안 함/);
 d.skills[0].name+='changed';assert.equal(r.dataSnapshot.skills.find(s=>s.id===ids[0]).name,result.rows[0].name,'Report snapshot stays immutable');
}
const result=Sim.run(d,ids,'185547',60),report=Report.create(d,ids,result,{baseline:{ids,baseSlots:d.baseSlots},comparison:result});
assert.equal(report.comparison.deltas.coverage,0);assert.equal(report.playback.reachedEnd,false);
const support=report.perSkill.find(s=>s.geometry.kind==='support');if(support)assert.equal(support.coefficientDelivery,null,'Support must not be labelled zero damage');
const missing=structuredClone(d);delete missing.skills.find(s=>s.id===ids[0]).basic.cooldown;
const blocked=Report.create(missing,ids,Sim.run(missing,ids));assert.equal(blocked.calculation.status,'blocked');assert.equal(blocked.metrics,null);assert.equal(blocked.segments.length,0);
const empty=Report.create(d,[],Sim.run(d,[]));assert.equal(empty.calculation.status,'blocked');
console.log('Report: four environments, reproducible snapshots, segment boundaries, uncertainty, comparison and blocked/empty runs passed');
