const assert=require('node:assert/strict'),D=require('./dist/data.json'),G=require('./dist/graph.js'),Q=require('./dist/sequence.js');
const id=name=>D.skills.find(s=>s.name===name).id,E=G.buildGraph(D),anchor=id('연속 찌르기'),build=[anchor];
const before=Q.directionalCandidates(D,E,build,anchor,'before',['explicit']);
assert.ok(before.some(x=>x.skill.name==='대검 찍기'));
for(const x of before){assert.ok(x.positive.every(e=>e.source===x.skill.id&&e.target===anchor&&e.timing.eligible));assert.equal(x.plan.ids.indexOf(x.skill.id)+1,x.plan.ids.indexOf(anchor));assert.deepEqual(Q.validate({...D,baseSlots:x.plan.baseSlots},x.plan.ids).issues,[]);}
const after=Q.directionalCandidates(D,E,build,anchor,'after',['explicit']);
assert.ok(after.some(x=>x.skill.name==='휘둘러치기'));assert.ok(!before.some(x=>x.skill.name==='휘둘러치기'));
for(const x of after){assert.ok(x.positive.every(e=>e.source===anchor&&e.target===x.skill.id));assert.equal(x.plan.ids.indexOf(anchor)+1,x.plan.ids.indexOf(x.skill.id));}
assert.deepEqual(build,[anchor]);assert.deepEqual(Q.directionalCandidates(D,E,[],anchor,'before'),[]);
const present=[anchor,id('대검 찍기')],moved=Q.directionalCandidates(D,E,present,anchor,'before',['explicit']).find(x=>x.skill.name==='대검 찍기');assert.ok(moved.existing);assert.deepEqual(moved.plan.ids,[id('대검 찍기'),anchor]);
const full=D.skills.filter(s=>!s.ultimate).slice(0,8).map(s=>s.id),fullBefore=Q.directionalCandidates(D,E,full,full[0],'before');assert.ok(fullBefore.every(x=>x.existing&&x.plan.ids.length===8));
const disabled={...D,executionPolicy:{disabled:[anchor]}};assert.equal(Q.directionalCandidates(disabled,E,build,anchor,'before',['explicit']).length,0);
const unknown={...D,skills:D.skills.map(s=>({...s,timingEffects:Object.fromEntries(Object.keys(s.timingEffects||{}).map(k=>[k,{duration:null}]))}))};assert.equal(Q.directionalCandidates(unknown,E,build,anchor,'before',['explicit']).length,0);
console.log('Directional candidates: incoming/outgoing provenance, evaluated timing, unknown/disabled exclusion, insertion, existing moves, quota and input preservation passed.');
