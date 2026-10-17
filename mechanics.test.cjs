const fs=require('fs'),assert=require('node:assert/strict'),M=require('./dist/mechanics.js'),C=require('./dist/combat.js'),Q=require('./dist/sequence.js'),D=require('./dist/data.json');
const id=n=>D.skills.find(s=>s.name===n).id,source=require('./dist/builds/00-reference.json'),ids=source.skills,data={...D,baseSlots:source.baseSlots};
const a=M.analyze(data,ids);assert.equal(a.first,5.75);assert.equal(a.casts,54);assert.equal(a.ultBuffed,1);assert.equal(a.extra,10);assert.equal(a.sim.events.filter(e=>e.id===id('화염구')&&e.end<=a.first).length,2);
assert.deepEqual(C.active(data,ids),['파멸']);assert.deepEqual(C.active(data,ids.slice().reverse()),['파멸'],'Changing priority cannot change equipped style');
const noStyle={...D,baseSlots:['검기 폭발','얼음화살','폭발하는 화살','밀쳐내는 화살','연쇄 번개'].map(id)};assert.deepEqual(C.active(noStyle,ids),[]);assert.equal(M.analyze(noStyle,ids).valid,false);
const front=M.analyze(data,[id('대폭발'),...ids.filter(i=>i!==id('대폭발'))]);assert.equal(front.ultBuffed,0);assert(front.first>a.first);
const replaced=Q.place(data,ids,1,id('낙뢰'));assert(replaced.baseSlots.includes(id('낙뢰')));assert(!replaced.baseSlots.includes(id('검기 폭발')));assert.equal(M.analyze({...D,baseSlots:replaced.baseSlots},replaced.ids).first,4.45);
const synthetic={skills:[{id:'a',name:'a',family:'절명',basic:{cooldown:10},referenceNumbers:{m:500},usage:{charges:2}}]},sim=C.run(synthetic,['a'],20);assert.deepEqual(sim.events.map(e=>e.start),[0,.5,10],'Sequential recharge must not refresh both charges at 10 seconds');
for(const horizon of [20,60,120,180]){const r=C.run(data,ids,horizon);assert(Math.abs(r.busy+r.wait-horizon)<1e-6);assert(r.events.every((e,i)=>!i||e.start>=r.events[i-1].end));assert(r.procs.every(p=>p.changes.every(c=>c.id!==id('대폭발'))));}
const partial={skills:[{id:'a',name:'a',family:'강타',basic:{cooldown:10}}]};assert.equal(M.analyze(partial,['a']).valid,false);assert.equal(M.analyze(partial,['a']).casts,null);
for(const mode of ['fast','stock','reset','reduce','condition']){const subset=D.skills.filter(s=>M.matches(s,mode));assert(subset.length>0);if(mode==='stock')assert(subset.every(s=>s.usage.charges>1));if(mode==='fast')assert(subset.every(s=>M.facts(s).motion<=.6));}
const options=[{skill:D.skills.find(s=>s.name==='검기 폭발'),score:10,mechanics:a},{skill:D.skills.find(s=>s.name==='낙뢰'),score:0,mechanics:M.analyze({...D,baseSlots:replaced.baseSlots},replaced.ids)}];assert.equal(M.sort(options,'activation')[0].skill.name,'낙뢰');assert.equal(M.sort(options,'effect')[0].skill.name,'검기 폭발');
console.log('Mechanics: explicit equipment, charges, reset timing, ultimate ordering, reference fixture, missing data, all filters and sorting passed.');
for(const file of fs.readdirSync('./dist/builds')){const v=JSON.parse(fs.readFileSync('./dist/builds/'+file,'utf8')),restored=Q.restore(D,v),data={...D,baseSlots:restored.baseSlots},a=M.analyze(data,restored.ids);assert(Q.validate(data,restored.ids).complete);assert.equal(a.casts,v.comparison.metrics.casts);assert.equal(a.first,v.comparison.metrics.firstActivationSeconds);assert.equal(a.buffed,v.comparison.metrics.attacksDuringShinsik);assert.equal(a.ultBuffed,v.comparison.metrics.ultimateDuringShinsik);assert.deepEqual(restored.baseSlots,v.baseSlots);}
assert.throws(()=>Q.restore(D,{schema:'dosul-build-v3',skills:ids,baseSlots:[id('대폭발')]}));assert.throws(()=>Q.restore(D,{schema:'dosul-build-v3',skills:ids,baseSlots:[ids[0],ids[0]]}));assert.throws(()=>Q.restore(D,{schema:'dosul-build-v3',skills:[...ids,ids[0]]}));
assert.equal(Q.restore(data,{schema:'dosul-build-v2',skills:ids}).baseSlots.length,5);
console.log('Import: all four deliverables match the engine; old format migration and invalid equipment rejection passed.');


