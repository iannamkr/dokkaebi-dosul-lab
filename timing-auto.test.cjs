const assert=require('node:assert/strict'),A=require('./dist/timing-auto.js'),D=require('./dist/data.json');
const skill=(id,m,cd,extra={})=>({id,name:id,basic:{cooldown:cd},referenceNumbers:{m,...extra},timingEffects:{mark:{duration:5,application:'end',source:'test'}}});
const d={skills:[skill('a',1000,10),skill('b',500,22)]},edge={source:'a',target:'b',effect:'mark'};
const s=A.simulate(d,['a','b'],5),r=A.assess(d,s,edge);
assert.equal(s.events.length,10);assert.equal(s.total,89.5);assert.equal(s.busy,7.5);assert.equal(s.wait,82);
assert.equal(r.delay,.5);assert.equal(r.margin,4.5);assert.equal(r.passes,1);assert.equal(r.failures,4);
for(let i=1;i<s.events.length;i++)assert.ok(s.events[i].start>=s.events[i-1].end);
for(const event of s.events){const prev=s.events.find(e=>e.id===event.id&&e.cycle===event.cycle-1);if(prev)assert.ok(event.start>=prev.cooldownEnd);}
assert.deepEqual(A.motion(skill('c',700,10,{cm:300,pm:.5})),{prep:.5,charge:.3,action:.7,total:1.5});
assert.equal(A.simulate({skills:[skill('x',null,10)]},['x']).total,null);
assert.equal(A.simulate(d,[],5).total,0);
const boundaryData={skills:[skill('a',1000,10),skill('b',5000,22)]};assert.equal(A.assess(boundaryData,A.simulate(boundaryData,['a','b'],1),edge).first,'boundary');
const conditional=A.assess(d,s,{...edge,requires:['other']});assert.equal(conditional.first,'blocked');assert.equal(conditional.passes,0);
assert.equal(A.assess(d,s,{...edge,effect:'missing'}).first,'unknown');
const by=name=>D.skills.find(s=>s.name===name),ids=['회전 난격','연쇄 번개'].map(n=>by(n).id),real=A.simulate(D,ids,5),realResult=A.assess(D,real,{source:ids[0],target:ids[1],effect:'파쇄'});
assert.equal(realResult.delay,.5);assert.equal(realResult.duration,5);assert.equal(realResult.passes,1);assert.equal(A.motion(by('크게 베기')).total,1);
assert.equal(A.duration(by('대검 찍기'),'기세').value,5);
assert.equal(A.duration(by('주먹 지르기'),'정밀').value,null,'Conditional result duration must not become prerequisite duration');
for(const skill of D.skills){if(skill.name==='은신')continue;assert.ok(A.motion(skill));const sim=A.simulate(D,[skill.id],10);assert.equal(sim.events.length,10);assert.equal(sim.missing.length,0);}
console.log('Automatic timing: ordered repeats, no overlap, cooldown readiness, wait totals, charge/prep, real effects, unknowns and boundary cases passed.');

