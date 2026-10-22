const assert=require('node:assert/strict'),O=require('./dist/optimizer.js'),D=require('./dist/data.json'),Q=require('./dist/sequence.js');
const conditions={primaryFamily:'연타',targetMode:'single',useUltimate:false},families=Object.keys(D.families),by=id=>D.skills.find(s=>s.id===id);
const check=c=>{assert.equal(c.ids.length,8);assert(c.ids.every(id=>!by(id).ultimate));assert(c.ids.filter(id=>by(id).family==='연타').length>=3);assert(c.baseSlots.filter(id=>by(id).family==='연타').length>=3);assert.deepEqual(Q.validate({...D,baseSlots:c.baseSlots},c.ids).issues,[]);};
const seed=O.conditionSeed(D,conditions,families);check(seed);
assert.throws(()=>O.conditionSeed(D,{...conditions,useUltimate:true},families),/선택 조건/);
const s=O.createSearch(D,seed,{conditions,families,targetMode:'single',stats:{attack:22411,maxHp:104845,regen:3061},iterations:100,encounter:true,boundedSelection:true,totalEvaluationBudget:1200,seedSetCount:100,seedSetMax:100,selfScoreTarget:0});while(!s.step(1e6).finished);const r=s.grouped(10),list=[...r.similar,...r.different,...r.closest];assert(list.length>0);list.forEach(check);for(const c of list)assert.deepEqual(Q.restore(D,{schema:'dosul-build-v3',skills:c.ids,baseSlots:c.baseSlots}).ids,c.ids);
console.log('Ultimate disabled: eight normals, primary family and awakening preserved, '+list.length+' verified recommendations and JSON import passed.');

// Current-build mode must obey the same ultimate/family constraints as new-build mode.
const actualIds=['방패 치기','암습','주먹 지르기','삼단 찌르기','내려찍기','찌르기','생명의 흐름','휘둘러 내려치기','방패 밀기'].map(n=>D.skills.find(s=>s.name===n).id);
const allowed=['연타','강인','헌신'];
const currentSearch=O.createSearch(D,{ids:actualIds,baseSlots:[actualIds[0],...actualIds.slice(2,6)]},{families:allowed,targetMode:'single',useUltimate:false,stats:{attack:22411,maxHp:104845,regen:3061},iterations:100,encounter:true,boundedSelection:true,totalEvaluationBudget:1200,seedSetCount:100,seedSetMax:100,selfScoreTarget:0});
while(!currentSearch.step(1e6).finished);
const currentGroups=currentSearch.grouped(10),currentResults=[...currentGroups.similar,...currentGroups.different,...currentGroups.closest];
assert(currentResults.length>0);
for(const c of currentResults){assert.equal(c.ids.length,8);assert(c.ids.every(id=>!by(id).ultimate&&allowed.includes(by(id).family)));}
console.log('Current-build regression: excluded existing family and ultimate absent in '+currentResults.length+' completed recommendations.');
