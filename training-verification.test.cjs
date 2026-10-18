const assert=require('node:assert/strict'),D=require('./dist/data.json'),C=require('./dist/combat.js');
const id=n=>D.skills.find(s=>s.name===n).id;
for(const [names,family] of [[['쌍검 가르기','도약 찌르기','휩쓸어 베기','연속 쇄도'],'기동'],[['요기 폭발','화염구','얼음화살','대폭발'],'파멸'],[['연속 찌르기','삼단 찌르기','내려찍기','암습'],'절명']]){
 const ids=names.map(id),r=C.run({...D,baseSlots:ids.slice(0,3)},ids,30);
 assert.equal(r.verification.status,'unvalidated');assert(r.verification.issues.some(x=>x.startsWith(family+':')));
 if(family==='기동')assert(r.verification.issues.some(x=>x.startsWith('연속 쇄도:')));
}
assert(D.skills.filter(s=>s.usage?.recasts).every(s=>s.usage.recastSource&&s.usage.recastEvidence));
console.log('Training verification: unresolved source semantics never silently certified.');
