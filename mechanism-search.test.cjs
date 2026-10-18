const assert=require('node:assert/strict'),D=require('./dist/data.json'),O=require('./dist/optimizer.js'),Q=require('./dist/sequence.js');
const ids=['s067','s068','s076','s021','s015','s027','s070','s073','s071'].filter(id=>D.skills.some(s=>s.id===id));
const ultimate=D.skills.find(s=>s.ultimate),own=D.skills.filter(s=>!s.ultimate&&s.family===ultimate.family).slice(0,3),other=D.skills.filter(s=>!s.ultimate&&!own.includes(s)).slice(0,5),start=[ultimate.id,...own.map(s=>s.id),...other.map(s=>s.id)];
const search=O.createSearch(D,{ids:start,baseSlots:Q.fit(D,start)},{stats:{attack:20000,maxHp:100000},families:Object.keys(D.families),iterations:120,polish:120,seed:123});while(!search.step(1000).finished);
const probe=search.audit(start),diag=probe.diagnostics;
for(const u of search.ultimates){const family=D.skills.find(s=>s.id===u).family;assert(diag.refinementByUltimate[family]>0,family+' refinement was starved');}
const before=diag.evaluated;const again=search.audit(start);assert.equal(again.diagnostics.evaluated,before);assert.deepEqual(probe.mechanism,again.mechanism);assert.equal(probe.mechanism.off.casts>0,true);
console.log('Mechanism search: every permitted ultimate receives refinement; ablation is deterministic and does not inject candidates.');
