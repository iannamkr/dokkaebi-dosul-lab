const assert=require('node:assert/strict'),D=require('./dist/data.json'),O=require('./dist/optimizer.js'),Q=require('./dist/sequence.js');
const u=D.skills.find(s=>s.ultimate),normal=D.skills.filter(s=>!s.ultimate),own=normal.filter(s=>s.family===u.family).slice(0,3),ids=[u.id,...own.map(s=>s.id),...normal.filter(s=>!own.includes(s)).slice(0,5).map(s=>s.id)],current={ids,baseSlots:Q.fit(D,ids)};
const options={stats:{attack:20000,maxHp:100000},families:Object.keys(D.families),iterations:600,spatialSelection:true,totalEvaluationBudget:140,screenLimit:6,finalistLimit:2,seed:19};
const search=O.createSearch(D,current,options);let p;do p=search.step(1000);while(!p.finished);const r=search.results(3);assert(r.best.length);assert(r.cost.totalEvaluations<=140);assert.equal(r.cost.searchEvaluations,p.evaluated);assert(r.cost.spatialEvaluations<=62);assert(r.cost.screened<=6);
for(let i=1;i<r.best.length;i++)assert(r.best[i-1].verification.minPower>=r.best[i].verification.minPower);
for(const c of r.best){assert(c.verification.runs.every(x=>Number.isFinite(x.power)));assert(c.verification.worst.encounter);}
assert.deepEqual(search.results(3),r,'Repeated reads do not spend evaluation budget');const grouped=search.grouped();assert.deepEqual(grouped.diagnostics.selection,r.cost);assert.throws(()=>O.createSearch(D,current,{...options,totalEvaluationBudget:62}));
console.log('Spatial selection: actual spatial verification, final ranking, combined hard budget, repeat-read cache and grouped UI path passed.');
