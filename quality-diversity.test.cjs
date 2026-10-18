const assert=require('node:assert/strict'),O=require('./dist/optimizer.js'),D=require('./dist/data.json'),Q=require('./dist/sequence.js');
const a=O.createBehaviorArchive(4),c=n=>({ids:[n],base:[n]}),r=(idle,reset=0,boost=0)=>({valid:true,behavior:{idle,reset,boost}});
assert.equal(a.offer(c('a'),r(0),100),1);a.offer(c('b'),r(.8),50);assert.equal(a.report().occupied,2,'Different execution behavior survives lower global score');a.offer(c('c'),r(0),90);assert.equal(a.entries()[0].candidate.ids[0],'a');a.offer(c('d'),r(0),110);assert.equal(a.entries()[0].candidate.ids[0],'d');
let first=a.select();a.feedback(first,0,10);let second=a.select();assert.notEqual(first.key,second.key);a.feedback(second,0,1);assert.equal(a.select().key,second.key,'Equal reward and uncertainty favors cheaper work');
a.offer(c('bad'),{valid:false},1000);assert.equal(a.report().occupied,2);assert.throws(()=>O.createBehaviorArchive(100));
const u=D.skills.find(s=>s.ultimate),own=D.skills.filter(s=>!s.ultimate&&s.family===u.family).slice(0,3),rest=D.skills.filter(s=>!s.ultimate&&!own.includes(s)).slice(0,5),ids=[u.id,...own.map(s=>s.id),...rest.map(s=>s.id)],current={ids,baseSlots:Q.fit(D,ids)};
const run=()=>{const search=O.createSearch(D,current,{stats:{attack:20000,maxHp:100000},families:Object.keys(D.families),iterations:300,seed:19,maxEvaluations:80});let p;do p=search.step(1000);while(!p.finished);assert(p.evaluated<=80);assert(p.budgetExhausted);return search.audit(ids);};
const x=run(),y=run();assert.deepEqual(x.diagnostics,y.diagnostics);assert(x.diagnostics.diversity.selections>0);assert(x.diagnostics.diversity.occupied<=216);
console.log('Quality diversity: behavior retention, local dominance, cost allocation, invalid rejection, reproducibility and hard evaluation cap passed.');

// QD proposals on an even boundary must not bypass the local-chain restart.
{const search=O.createSearch(D,current,{stats:{attack:20000,maxHp:100000},families:Object.keys(D.families),iterations:120,polish:120,seed:19});while(!search.step(1000).finished);const diag=search.audit(ids).diagnostics;assert.deepEqual(diag.chainStarts,[0,1,2,3,4]);assert(diag.refinementJobsStarted>search.ultimates.length,'Later seed jobs must receive refinement too');}
