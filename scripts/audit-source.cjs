const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
function audit(data,source,buffs){
 const rows=source.skills.map(k=>{const s=data.skills.find(s=>s.name===k.n),issues=[];if(!s)return {name:k.n,issues:['missing']};
 if(s.family!==source.styles[k.st].n)issues.push('family');if(s.ultimate!==!!k.u)issues.push('ultimate');
 for(const key of new Set([...Object.keys(k.num),...Object.keys(s.referenceNumbers||{})]))if(JSON.stringify(k.num[key])!==JSON.stringify(s.referenceNumbers[key]))issues.push('number:'+key);
 if(Math.abs(s.basic.cooldown-k.num.cd)>0.00001)issues.push('cooldown');
 for(const h of k.hit.filter(h=>h.n&&['강화','약화'].includes(h.t))){const e=(h.t==='강화'?s.referenceDetail.buffs:s.referenceDetail.debuffs).find(e=>e.name===h.n);if(!e||e.description!==h.l.join(' '))issues.push('effect:'+h.n);}
 const durations=Object.entries(s.timingEffects||{}).map(([effect,t])=>{const variants=buffs.groups.flatMap(g=>g.v).filter(v=>(t.buffIds||[]).includes(v.id));return {effect,seconds:t.duration,status:variants.length?(variants.some(v=>Math.abs(v.life/1000-t.duration)<1e-6)?'match':'mismatch'):'unresolved'};});
 return {id:s.id,name:s.name,family:s.family,numericFields:Object.keys(k.num).length,effects:k.hit.filter(h=>h.n).length,issues,durations,progressionEffects:(k.ef||[]).length,progressionExecution:'not-connected'};});
 return {checkedAt:new Date().toISOString(),source:'https://kkaebigg.com/data/skills.json',sha256:crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex'),coverage:{skills:rows.length,families:source.styles.length,effectDescriptions:rows.reduce((n,s)=>n+s.effects,0),durationEntries:rows.reduce((n,s)=>n+s.durations.length,0)},rows};
}
module.exports={audit};if(require.main===module){const input=path.resolve(process.argv[2]||path.join(root,'dist/kkaebigg')),output=process.argv[3];const result=audit(require(path.join(root,'dist/data.json')),JSON.parse(fs.readFileSync(path.join(input,'skills.json'))),JSON.parse(fs.readFileSync(path.join(input,'buffs.json'))));const json=JSON.stringify(result,null,2);if(output)fs.writeFileSync(output,json);else console.log(json);}
