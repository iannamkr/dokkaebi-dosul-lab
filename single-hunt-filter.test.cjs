const assert=require('node:assert/strict'),O=require('./dist/optimizer.js'),D=require('./dist/data.json'),S=require('./dist/simulation.js');
const id=n=>D.skills.find(s=>s.name===n).id;
const safe=id=>{const s=D.skills.find(x=>x.id===id),g=S.geometry(s);return s.damage===false||s.referenceNumbers?.nd||s.targeting?.kind==='single'&&g.kind==='single'&&g.cap===1};
const families=Object.keys(D.families),bad=['최후의 저항','검기 날리기','연쇄 타격'].map(id),good=['방패 치기','암습','주먹 지르기','삼단 찌르기','내려찍기','찌르기','생명의 흐름','휘둘러 내려치기','방패 밀기'].map(id);
const base=good.filter(i=>D.skills.find(s=>s.id===i).family==='절명'&&!D.skills.find(s=>s.id===i).ultimate);
for(const b of bad){assert(!O.pool(D,[b],{families,targetMode:'single'}).includes(b),'Existing area skills cannot bypass filter');const mixed=[...good];mixed[6]=b;const r=O.evaluate(D,mixed,base,{stats:{attack:22411,maxHp:104845},singleOnly:true,targetMode:'single',horizon:30});assert.equal(r.valid,false);}
assert(O.pool(D,[],{families,targetMode:'single'}).includes(id('생명의 흐름')));
assert.throws(()=>O.conditionSeed(D,{targetMode:'single',requiredSkills:bad},families),/범위 피해/);
assert.throws(()=>O.conditionSeed(D,{targetMode:'single',primaryFamily:'강타'},families),/선택 조건/);
const seed=O.conditionSeed(D,{targetMode:'single'},families,good);assert(seed.ids.every(safe));

// An area skill that the player explicitly turned OFF occupies a slot and counts toward
// the family/equipment rule, but never executes and therefore does not violate single hunt.
const will=id('강인한 의지'),shieldUlt=id('방패 낙하'),push=id('방패 밀기'),bash=id('방패 치기');
const offPolicy={disabled:[will,shieldUlt]};
const noUltimate=O.conditionSeed(D,{targetMode:'single',useUltimate:false,primaryFamily:'강인',executionPolicy:offPolicy},families,[will,push,bash]);
assert(noUltimate.ids.includes(will));
assert.equal(noUltimate.ids.filter(x=>D.skills.find(s=>s.id===x)?.family==='강인').length,3);
const screenshotPreferred=['내려찍기','찌르기','휘둘러 내려치기','강인한 의지','방패 밀기','방패 치기','도약 찌르기','생명의 축복','방패 낙하'].map(id);
const screenshotSeed=O.conditionSeed(D,{targetMode:'single',primaryFamilies:['연타','강인'],excludedFamilies:['척살','기만','제압'],executionPolicy:offPolicy},families,screenshotPreferred);
assert(screenshotSeed.ids.includes(will));
assert(screenshotSeed.ids.includes(shieldUlt));
assert.equal(screenshotSeed.ids.filter(x=>D.skills.find(s=>s.id===x)?.family==='강인'&&!D.skills.find(s=>s.id===x)?.ultimate).length,3);
assert(O.evaluate(D,screenshotSeed.ids,screenshotSeed.baseSlots,{targetMode:'single',singleOnly:true,executionPolicy:offPolicy,stats:{attack:23748,maxHp:106076},horizon:30}).valid);
const switchedSeed=O.conditionSeed(D,{targetMode:'single',primaryFamilies:['절명','연타'],excludedFamilies:['기만','제압'],executionPolicy:offPolicy},families,screenshotPreferred);
const switched=O.evaluate(D,switchedSeed.ids,switchedSeed.baseSlots,{targetMode:'single',singleOnly:true,executionPolicy:offPolicy,stats:{attack:23748,maxHp:106076},horizon:30});
assert(switched.valid,'A candidate may drop skills that had saved OFF settings');
assert.deepEqual(switched.executionPolicy.disabled,offPolicy.disabled.filter(x=>switchedSeed.ids.includes(x)),'Only mounted skills keep their OFF settings in a candidate');
assert.throws(()=>O.conditionSeed(D,{targetMode:'single',useUltimate:false,primaryFamily:'강인'},families,[will,push,bash]),/강인 일반 도술 3개/);
const search=O.createSearch(D,{ids:good,baseSlots:base},{targetMode:'single',families,stats:{attack:22411,maxHp:104845,regen:3061},iterations:120,seed:19,encounter:true,boundedSelection:true,totalEvaluationBudget:1200});
assert(search.pool.every(safe));assert(search.ultimates.every(safe));while(!search.step(1e6).finished);const g=search.grouped(10),all=[...g.similar,...g.different,...g.closest];assert(all.length>0);for(const c of all)assert(c.ids.every(safe),'Every final recommendation must be single-target-safe');
console.log('Single hunting: unsafe existing skills, area ultimates, required-skill conflicts, support skills, seeds and '+all.length+' verified recommendations passed.');
