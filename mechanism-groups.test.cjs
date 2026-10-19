const assert=require('node:assert/strict'),O=require('./dist/optimizer.js'),D=require('./dist/data.json');
const c=(id,power,idle,reset=0,boost=0)=>({id,power,behavior:{idle,reset,boost}});
const list=[c('a',100,.1),c('b',99,.1),c('c',98,.1),c('d',80,.5),c('e',70,.9)];
assert.deepEqual(O.groupRoundRobin(list,3).map(x=>x.id),['a','d','e']);
assert.deepEqual(O.groupRoundRobin(list,5,2).map(x=>x.id),['a','d','e','b']);
assert.equal(O.mechanismGroup(c('x',1,1,1,1)).id,'2-2-2');
assert.equal(O.mechanismGroup(c('x',1,.1)).id,O.mechanismGroup(c('y',1000,.1)).id);
const start=O.conditionSeed(D,{requiredFamilies:['연타','강인']},['연타','강인']);
const search=O.createSearch(D,start,{stats:{attack:20532,maxHp:101115,regen:2751},families:['연타','강인'],boundedSelection:true,mechanismGroups:true,totalEvaluationBudget:450,iterations:1000,seed:19});
while(!search.step(1000).finished){}const result=search.grouped(10);
assert(result.mechanismGroups.length);assert(result.diagnostics.selection.totalEvaluations<=450);
const all=result.mechanismGroups.flatMap(g=>g.candidates);assert.equal(all.length,result.similar.length+result.different.length);
for(const g of result.mechanismGroups){assert(g.candidates.length<=3);assert(g.candidates.every(c=>c.verification.valid&&O.mechanismGroup(c).id===g.id));for(let i=1;i<g.candidates.length;i++)assert(g.candidates[i-1].verification.minPower>=g.candidates[i].verification.minPower);}
console.log('Mechanism grouping: group coverage before ranking, per-group cap, verified results, stable descriptors and total budget passed',result.mechanismGroups.length,all.length,result.diagnostics.selection.totalEvaluations);

const varied=[c('a',100,.11),c('b',99,.12),c('c',80,.25),c('d',70,.8)];
assert.deepEqual(O.detailedRoundRobin(varied,3).map(x=>x.id),['a','d','c']);
assert.notEqual(O.mechanismSubgroup(varied[0]).id,O.mechanismSubgroup(varied[2]).id);
assert.equal(O.mechanismGroup(varied[0]).id,O.mechanismGroup(varied[2]).id);
const expanded=O.createSearch(D,start,{stats:{attack:20532,maxHp:101115,regen:2751},families:Object.keys(D.families),boundedSelection:true,mechanismGroups:true,detailedGroups:true,totalEvaluationBudget:1100,iterations:1000,seed:19});
while(!expanded.step(1000).finished){}const details=expanded.grouped(1);
assert(details.diagnostics.selection.totalEvaluations<=1100);
const rows=details.mechanismGroups.flatMap(g=>g.candidates);
assert(rows.length>3,'More candidates survive the old three-per-group limit');
assert(rows.length<=36);assert.equal(rows.length,details.similar.length+details.different.length,'Legacy display limit must not truncate detailed groups');
for(const g of details.mechanismGroups){assert.equal(g.candidates.length,g.subgroups.reduce((n,s)=>n+s.candidates.length,0));for(const sub of g.subgroups){assert(sub.candidates.length<=6);assert(sub.candidates.every(c=>c.verification.valid&&O.mechanismSubgroup(c).id===sub.id));}}
console.log('Detailed groups: hierarchical coverage, subgroup caps, no display truncation and total budget passed',rows.length,details.diagnostics.selection.totalEvaluations);
