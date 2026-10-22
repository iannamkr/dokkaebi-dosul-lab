const assert=require('node:assert/strict');
const D=require('./dist/data.json'),O=require('./dist/optimizer.js');
const ids=['s071','s069','s003','s008','s075','s007','s012','s085','s010'];
const baseSlots=['s003','s007','s008','s071','s069'];
const search=O.createSearch(D,{ids,baseSlots},{
 stats:{attack:20532,maxHp:101115,regen:0},
 families:Object.keys(D.families),
 perMob:1e9,
 regenPerMin:0,
 margin:1000,
 iterations:1,
 polish:0,
 encounter:false,
 seedSetCount:100,
 seedSetMax:110,
 selfScoreTarget:100,
 totalEvaluationBudget:500,
 seed:20261022
});
const cards=[];
for(let guard=0;guard<2000;guard++){
 const progress=search.step(1);cards.push(progress.scorecard);
 if(progress.finished)break;
}
const audit=search.audit(ids,baseSlots),generation=audit.diagnostics.generation;
assert(generation.generated>=100,'At least 100 distinct legal random seeds are evaluated');
assert(generation.generated===110,'An insufficient score triggers adaptive generation up to the configured limit');
assert(cards.some(c=>c.phase==='원인 맞춤 보완'),'A scored repair step is exposed after the random baseline');
assert(cards.every(c=>Number.isFinite(c.score)&&c.score>=0&&c.score<=100&&c.cause&&c.remedy),'Every step reports score, cause and repair action');
assert(cards.some(c=>c.status==='보완 필요'&&c.score<c.target),'Insufficient steps are reported honestly');
assert(generation.steps.length>0&&generation.attempts>=generation.generated,'Diagnostics retain the self-review history and generation attempts');

const passing=O.createSearch(D,{ids,baseSlots},{
 stats:{attack:20532,maxHp:101115,regen:0},families:Object.keys(D.families),
 iterations:1,polish:0,encounter:false,seedSetCount:100,seedSetMax:150,
 selfScoreTarget:75,totalEvaluationBudget:500,seed:20261022
});
let passingProgress;
for(let guard=0;guard<2000;guard++){
 passingProgress=passing.step(2);
 if(passingProgress.finished)break;
}
const passingGeneration=passing.audit(ids,baseSlots).diagnostics.generation;
assert.equal(passingGeneration.generated,100,'A sufficient score stops cause-directed generation after the random minimum');
assert.equal(passingProgress.scorecard.status,'통과');
assert(passingProgress.scorecard.score>=passingProgress.scorecard.target);
console.log('Adaptive search: 100+ random seeds, scored cause analysis and next-step repair generation passed.');
