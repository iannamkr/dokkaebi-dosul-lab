const assert=require('node:assert/strict'),O=require('./dist/optimizer.js'),D=require('./dist/data.json');
const by=id=>D.skills.find(s=>s.id===id),ids=['s010','s003','s012','s007','s002','s011','s013','s016','s069'],families=Object.keys(D.families).filter(f=>f!=='절명');
assert(O.pool(D,ids,{families}).every(id=>by(id).family!=='절명'));
for(const current of [{ids,baseSlots:['s003','s002','s007']},{ids:ids.filter(id=>!by(id).ultimate),baseSlots:['s003','s002','s007']}]){
const search=O.createSearch(D,current,{families,stats:{attack:22411,maxHp:104845,regen:3061},iterations:60,seed:19,encounter:true,boundedSelection:true,totalEvaluationBudget:1200});
assert(search.pool.every(id=>by(id).family!=='절명'));assert(search.ultimates.every(id=>by(id).family!=='절명'));
while(!search.step(1e6).finished);const r=search.grouped(10),all=[...r.similar,...r.different,...r.closest];assert(all.length);for(const c of all)assert(c.ids.every(id=>by(id).family!=='절명'));
}
console.log('Excluded existing family: normal skills, ultimate, seed and final candidates excluded with and without ultimate.');
