const assert=require('node:assert/strict'),N=require('./dist/numbers'),O=require('./dist/optimizer'),E=require('./dist/encounter'),D=require('./dist/data.json');
assert.equal(O.regenPerMin({regen:3061}),36732);assert.equal(O.regenPerMin({regen:3061,inCombat:false}),183660);
assert.deepEqual([N.damageRange(100).min,N.damageRange(100).max],[80,100]);assert.equal(N.damageRange(100,{kind:'other'}).min,50);assert.equal(N.damageRange(100).expected,null);
assert(Math.abs(N.damageFactor({critical:true,criticalMultiplier:1})-1.1)<1e-12);assert.equal(N.damageFactor({blocked:true,blockReduction:0}),.8);assert(Math.abs(N.damageFactor({blocked:true,blockReduction:1})-.1)<1e-12);assert.equal(N.penetration(1),.9999);assert.equal(N.damageFactor({pvp:true}),.7);
assert.throws(()=>N.damageFactor({variation:.79}));assert.throws(()=>N.damageFactor({blocked:true}));assert.throws(()=>N.damageFactor({variation:NaN}));
const data=structuredClone(D),s=data.skills.find(s=>s.name==='방패 치기');s.basic.cooldown=2;s.referenceNumbers={m:400,dc:[{basic_coefficient:100,hits:1}],nd:false};const opt={attack:100,hp:1e9,points:[{x:1,y:0}],scenario:{playerSpeed:0,monsterSpeed:0}};
const a=E.run(data,[s.id],'185547',20,opt),b=E.run({...data,combatModifiers:{pvp:true}},[s.id],'185547',20,opt);
assert.equal(a.encounter.damage,100*a.rows.reduce((sum,row)=>sum+row.targetHits,0));assert(Math.abs(b.encounter.damage/a.encounter.damage-.7)<.00001);assert.equal(a.combatFormula.empiricalCorrection,false);assert.equal(a.combatFormula.defenceApplied,false);assert.throws(()=>E.run(data,[s.id],'185547',20,{...opt,damageRate:.14}),/보정계수/);
console.log('Combat guide: bounds, explicit modifiers, regeneration and actual encounter damage path passed');

