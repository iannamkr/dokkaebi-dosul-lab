const assert=require('node:assert/strict'),Q=require('./dist/sequence.js'),G=require('./dist/graph.js'),T=require('./dist/timing.js'),A=require('./dist/timing-auto.js');
const skill=(id,seconds,extra={})=>({id,name:id,family:'test',ultimate:false,buffs:[],debuffs:[],conditions:[],damage:true,basic:{cooldown:100},referenceNumbers:{m:seconds*1000,dc:[{hits:1}]},...extra});
function fixture(duration=5,wait=6){return {skills:[skill('source',1,{debuffs:['파쇄'],gameDetail:{source:'tooltip',debuffs:[{name:'파쇄',duration:duration+'초'}]}}),skill('wait',wait),skill('target',1,{conditions:[{effect:'파쇄',result:'추가 피해',scope:'enemy'}]})]};}
function candidate(d,ids=['source','wait'],mode='replace',step=ids.length,scope='all'){return Q.candidates(d,G.buildGraph(d),ids,step,['explicit'],mode,scope).find(x=>x.skill.id==='target');}
let d=fixture(),x=candidate(d);
assert.equal(x.connections[0].timing.status,'fail');assert.equal(x.connections[0].timing.margin,-2);assert.equal(x.score,0);assert.equal(x.positive.length,0);
d=fixture(5,1);x=candidate(d);assert.equal(x.connections[0].timing.status,'pass');assert.equal(x.score,10);
assert.equal(candidate(d,undefined,'replace',2,'previous').connections.length,0);
// Inserting before a long action must recompute the candidate's first-use time.
d=fixture();x=candidate(d,['source','wait'],'insert',1);assert.equal(x.connections[0].timing.status,'pass');
// Expiry at the exact hit time is not counted as guaranteed synergy.
d=fixture(5,4);x=candidate(d);assert.equal(x.connections[0].timing.status,'boundary');assert.equal(x.score,0);
// Multi-hit: only the first two hits land before expiry.
d=fixture(2.5,1);d.skills[2].referenceNumbers={m:3000,dc:[{hits:3}]};x=candidate(d,['source']);
assert.equal(x.connections[0].timing.status,'partial');assert.equal(x.connections[0].timing.valid,2);assert.equal(x.connections[0].timing.total,3);assert.ok(Math.abs(x.score-10*2/3)<1e-9);
// A source genuinely recast before the candidate refreshes the lifetime.
d=fixture();d.skills[0].basic.cooldown=3;x=candidate(d);assert.equal(x.connections[0].timing.status,'pass');assert.equal(x.connections[0].timing.application,8);
// Recasts AFTER the candidate cannot rescue its first-use recommendation.
d=fixture();d.skills[0].basic.cooldown=12;x=candidate(d);assert.equal(x.connections[0].timing.status,'fail');assert.equal(x.score,0);
// Unknown duration and unknown persistent-hit timing must remain unscored.
d=fixture();delete d.skills[0].gameDetail;x=candidate(d);assert.equal(x.connections[0].timing.status,'unknown');assert.equal(x.score,0);
d=fixture();d.skills[0].hitTiming={kind:'persistent'};x=candidate(d);assert.equal(x.connections[0].timing.status,'unknown');assert.equal(x.score,0);
// Multiple effects are assessed separately; one valid edge cannot hide an expired one.
d=fixture();d.skills[0].debuffs.push('충격');d.skills[0].gameDetail.debuffs.push({name:'충격',duration:10});d.skills[2].conditions.push({effect:'충격',result:'추가 피해',scope:'enemy'});x=candidate(d);
assert.deepEqual(x.connections.map(e=>e.timing.status),['fail','pass']);assert.equal(x.positive.length,1);assert.equal(x.score,10);
// Conditional output duration never becomes the duration of its prerequisite.
const real=require('./dist/data.json'),punch=real.skills.find(s=>s.name==='주먹 지르기');
assert.equal(T.duration(punch,'받는 피해 감소').value,10);assert.equal(T.duration(punch,'정밀').value,null);
assert.equal(A.duration(punch,'충격').value,5);
const shield=real.skills.find(s=>s.name==='방패 치기');assert.equal(T.duration(shield,'수호').value,5);
console.log('Temporal candidates: expiry, first use, per-hit weighting, refresh, boundaries, unknowns, insertion, scope and conditional durations passed.');
