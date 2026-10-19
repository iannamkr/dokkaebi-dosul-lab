const assert=require('node:assert/strict'),C=require('./dist/combat'),D=require('./dist/data.json');
const s=D.skills.find(s=>s.name==='방패 치기'),d={...D,baseSlots:[s.id],combatInitialState:{skills:{[s.id]:{charges:0,cooldownRemaining:4.6}}}};
const r=C.run(d,[s.id],20);assert.equal(r.events[0].start,4.6);assert.equal(r.events[1].start,10.6);
assert.equal(C.run({...D,baseSlots:[s.id]},[s.id],20).events[0].start,0);
assert.throws(()=>C.run({...d,combatInitialState:{skills:{[s.id]:{charges:2,cooldownRemaining:4}}}},[s.id],20));
console.log('Observed combat state: residual cooldown applied, recharge retained, default unchanged, invalid charges rejected.');
