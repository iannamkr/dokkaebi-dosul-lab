const assert=require('node:assert/strict'),D=require('./dist/data.json'),O=require('./dist/optimizer.js'),Q=require('./dist/sequence.js');
const families=Object.keys(D.families),by=id=>D.skills.find(s=>s.id===id);
for(const family of families){
 const seed=O.conditionSeed(D,{primaryFamily:family},families);
 assert.equal(seed.ids.filter(id=>by(id).ultimate).length,1);
 assert.equal(by(seed.ids.find(id=>by(id).ultimate)).family,family);
 assert(seed.ids.filter(id=>!by(id).ultimate&&by(id).family===family).length>=3);
 assert(Q.validate({...D,baseSlots:seed.baseSlots},seed.ids).complete);
}
const support=D.skills.find(s=>s.name==='강인한 의지').id,conditions={primaryFamily:'연타',requiredSkills:[support]};
const seed=O.conditionSeed(D,conditions,families);
const search=O.createSearch(D,seed,{conditions,families,stats:{attack:20532,maxHp:101115,regen:2751},boundedSelection:true,mechanismGroups:true,totalEvaluationBudget:450,iterations:600,seed:19});
assert(search.pool.some(id=>by(id).family==='파멸'));
assert(search.ultimates.every(id=>by(id).family==='연타'));
while(!search.step(1000).finished){}const result=search.grouped();
const candidates=[...result.similar,...result.different];assert(candidates.length);
for(const c of candidates){assert(c.ids.includes(support));assert.equal(by(c.ids.find(id=>by(id).ultimate)).family,'연타');assert(c.ids.filter(id=>!by(id).ultimate&&by(id).family==='연타').length>=3);assert(Q.validate({...D,baseSlots:c.baseSlots},c.ids).complete);}
const otherUlt=D.skills.find(s=>s.ultimate&&s.family==='강타').id;
assert.throws(()=>O.conditionSeed(D,{primaryFamily:'연타',requiredSkills:[otherUlt]},families));
assert.throws(()=>O.conditionSeed(D,{primaryFamily:'없는계열'},families));
console.log('Primary family: all 12 family seeds, ultimate lock, 3+ normal skills, open supporting pool, optional skill, equipment and final candidates passed.');

const excluded=['파멸','기만','척살'],restricted={primaryFamily:'연타',excludedFamilies:excluded};
const allowedSeed=O.conditionSeed(D,restricted);
assert(allowedSeed.ids.every(id=>!excluded.includes(by(id).family)));
const filtered=O.createSearch(D,seed,{conditions:restricted,families,stats:{attack:20532,maxHp:101115,regen:2751},boundedSelection:true,totalEvaluationBudget:160,iterations:200,seed:19});
assert(filtered.pool.every(id=>!excluded.includes(by(id).family)));
while(!filtered.step(1000).finished){}const filteredResults=filtered.grouped();
assert(filteredResults.similar.length+filteredResults.different.length);
for(const c of [...filteredResults.similar,...filteredResults.different])assert(c.ids.every(id=>!excluded.includes(by(id).family)));
assert.throws(()=>O.conditionSeed(D,{primaryFamily:'연타',excludedFamilies:['연타']}));
assert.throws(()=>O.conditionSeed(D,{primaryFamily:'연타',excludedFamilies:['강인'],requiredSkills:[support]}));
console.log('Excluded families: seed, search pool, final candidates and conflicting constraints passed.');
