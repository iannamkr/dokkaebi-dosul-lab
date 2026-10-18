'use strict';
const assert=require('node:assert/strict'),K=require('./dist/kkaebigg.js'),F=require('./dist/shinsik.js');
const raw=require('./dist/kkaebigg/skills.json'),data=require('./dist/data.json');
const d=structuredClone(data);d.skills[0].basic.cooldown=999;d.skills[0].referenceNumbers.removed=123;
K.apply(d,{skills:raw});assert.equal(d.skills[0].basic.cooldown,7);assert.equal('removed' in d.skills[0].referenceNumbers,false);
assert.deepEqual(d.skills[0].referenceProgression.effects,raw.skills[0].ef);
const ctx={active:['제압'],windows:[],procs:[]},event={resources:{locks:3}};
assert.equal(F.bonus(ctx,{ultimate:false},event,0),0);assert.equal(F.bonus(ctx,{ultimate:true},event,0),.06);
for(const k of raw.skills){const s=d.skills.find(s=>s.name===k.n);assert.ok(s);assert.deepEqual(s.referenceNumbers,k.num);assert.equal(s.basic.cooldown,Math.round(k.num.cd*100)/100);}
console.log('source audit: 105 numeric records, cooldown repair, removed fields, progression preservation and ultimate-only bonus passed');
