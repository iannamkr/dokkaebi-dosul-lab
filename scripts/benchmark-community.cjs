#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.env.DOSUL_ROOT||path.resolve(__dirname,'..');
const D=require(path.join(root,'dist/data.json')),Q=require(path.join(root,'dist/sequence.js')),O=require(path.join(root,'dist/optimizer.js')),E=require(path.join(root,'dist/encounter.js'));
const args=process.argv.slice(2),arg=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const fixture=JSON.parse(fs.readFileSync(arg('--fixture',path.join(root,'benchmarks/community-20.json')),'utf8'));
const output=path.resolve(arg('--output','community-benchmark.json')),budget=Number(arg('--iterations','300')),controlCount=Number(arg('--controls','60'));
if(!Number.isSafeInteger(budget)||budget<1||!Number.isSafeInteger(controlCount)||controlCount<1)throw Error('Invalid budget');
const byName=new Map(D.skills.map(s=>[s.name,s])),byId=new Map(D.skills.map(s=>[s.id,s]));
const id=n=>{if(!byName.has(n))throw Error('Unknown skill '+n);return byName.get(n).id;};
let seed=20261018;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},pick=a=>a[Math.floor(random()*a.length)],shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const stats={attack:20532,maxHp:101115,regen:2751,regenPeriod:5};
// These are diagnostic scenarios, not claims about authors' character stats or real kill rates.
function score(ids,base,group){
 const layouts=['corridor','packed','ring','scattered'];
 const runs=[];for(const [pi,profile] of O.profiles.entries()){
 const points=group==='single'?[{x:1.5,y:0}]:Array.from({length:12},(_,i)=>pi===0?{x:1.5+i*.6,y:(i%3-1)*.5}:pi===1?{x:1.5+(i%4)*.8,y:(Math.floor(i/4)-1)*.8}:pi===2?{x:Math.cos(i*Math.PI/6)*5,y:Math.sin(i*Math.PI/6)*5}:{x:Math.cos(i*2.39996)*(2+i*.7),y:Math.sin(i*2.39996)*(2+i*.7)});
 const r=E.run({...D,baseSlots:base},ids,profile,180,{attack:stats.attack,hp:45000,points});
 if(r.validation.issues.length||r.schedule.missing.length)return {valid:false,issue:[...r.validation.issues,...r.schedule.missing].join(';')};
 runs.push({profile,layout:group==='single'?'single':layouts[pi],killsPerMin:r.encounter.killsPerMin,damage:r.encounter.damage,whiffPct:r.encounter.whiffPct,casts:r.schedule.casts,active:r.schedule.active,warnings:r.schedule.warnings,ultimateCasts:r.schedule.events.filter(e=>byId.get(e.id)?.ultimate).length});}
 return {valid:true,power:Math.min(...runs.map(r=>r.killsPerMin)),runs};
}
const refs=fixture.builds.filter(b=>b.votes>=20).map(b=>{
 const ids=b.names.map(id),base=Q.fit(D,ids),displayBase=b.baseNames.map(id),group=/단일|저격\+절명/.test(b.title)?'single':'area';
 const flags=[];if(/OFF/.test(b.description))flags.push('ultimate-disabled-not-represented');if(/체력\s*조건|풀피/.test(b.description))flags.push('hp-policy-not-represented');if(/첫 사이클.*직접|첫 궁/.test(b.description))flags.push('manual-opener-not-represented');if(b.id==='159')flags.push('description-order-overrides-card');if(/검증필요/.test(b.description))flags.push('author-unverified');if(/버그/.test(b.title))flags.push('bug-mentioned');
 const family=byId.get(ids.find(x=>byId.get(x).ultimate))?.family;
 return {...b,ids,base,group,family,flags,displayBaseIssues:Q.validate({...D,baseSlots:displayBase},ids).issues,baseAssumption:'fit 3 ultimate-family skills into five base slots; displayed sequence is not proof of equipment',evaluation:score(ids,base,group)};
});
console.error('References scored: '+refs.length);
const controls={};for(const group of ['area','single']){
 const families=[...new Set(refs.filter(r=>r.group===group).map(r=>r.family))],list=[];
 for(let i=0;i<controlCount;i++){const f=families[i%families.length],u=D.skills.find(s=>s.ultimate&&s.family===f),norm=D.skills.filter(s=>!s.ultimate&&typeof s.basic?.cooldown==='number');let ns=shuffle(norm.filter(s=>s.family===f)).slice(0,3);ns.push(...shuffle(norm.filter(s=>!ns.includes(s))).slice(0,8-ns.length));const ids=shuffle([...ns.map(s=>s.id),u.id]),base=Q.fit(D,ids);list.push({ids,base,evaluation:score(ids,base,group)});}
 controls[group]=list;console.error('Controls scored: '+group);
}
for(const r of refs){const cs=controls[r.group].filter(c=>c.evaluation.valid).map(c=>c.evaluation.power),p=r.evaluation.power;r.controlComparison=r.evaluation.valid?{count:cs.length,strictlyBeaten:cs.filter(x=>p>x).length,ties:cs.filter(x=>p===x).length,midrankPercentile:100*(cs.filter(x=>p>x).length+.5*cs.filter(x=>p===x).length)/cs.length}:null;
 // Same-set order counterfactuals test whether the evaluator can distinguish ordering at all.
 r.orderVariants=[...Array(8)].map(()=>{const ids=shuffle(r.ids);return {ids,evaluation:score(ids,r.base,r.group)};});
 r.orderRange={min:Math.min(r.evaluation.power,...r.orderVariants.map(v=>v.evaluation.power)),max:Math.max(r.evaluation.power,...r.orderVariants.map(v=>v.evaluation.power))};
 if(r.id==='159'){const names=['암습','사격','쇠뇌 사격','이중 사격','삼단 찌르기','연속 찌르기','내려찍기','생명의 흐름','생명의 축복'];r.descriptionOrder={names,evaluation:score(names.map(id),r.base,r.group)};}
}
// Independent neutral starts; community references are never seeded or used in the scoring function.
const searches=[];for(const s of [20261018,20261019]){
 const ids=['연쇄 번개','방패 치기','휩쓸어 베기','검기 폭발','대검 찍기','회전 난격','방패 내려찍기','방패 낙하','강인한 의지'].map(id);
 const search=O.createSearch(D,{ids,baseSlots:Q.fit(D,ids)},{stats,families:Object.keys(D.families),iterations:budget,seed:s,encounter:true});let progress;do{progress=search.step(500);}while(!progress.finished);
 const result=search.grouped(10),recommendations=[...result.similar,...result.different].map(c=>({ids:c.ids,power:c.verification.minPower}));
 searches.push({seed:s,progress,diagnostics:result.diagnostics,recommendations,probes:refs.map(r=>({id:r.id,...search.audit(r.ids,r.base),bestSetOverlap:Math.max(0,...recommendations.map(c=>c.ids.filter(x=>r.ids.includes(x)).length))}))});console.error('Search completed: '+s);
}
const report={schema:'dosul-community-benchmark-v1',source:fixture.source,capturedAt:fixture.capturedAt,threshold:20,settings:{stats,horizon:180,controls:controlCount,iterations:budget,seeds:[20261018,20261019]},limitations:['Authors stats, level and breakthrough unknown; this is model diagnostic, not real-world performance ranking.','Single scenario uses one respawning target; area uses four synthetic profile layouts. No PvP/loot competition model.','Base equipment fitted to engine rule, not verified from author equipment.','OFF, HP conditions and manual opener are recorded but not simulated.','Random controls test baseline discrimination, not global optimality.','Search audit uses existing area objective for all probes; single build search rankings are not comparable.','No training or parameter tuning on the reference corpus; held-out tuning has not begun.'],references:refs,controls,searches};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({output,count:refs.length,valid:refs.filter(r=>r.evaluation.valid).length,policyFlags:refs.filter(r=>r.flags.length).length,rows:refs.map(r=>({id:r.id,title:r.title,votes:r.votes,group:r.group,power:r.evaluation.power,percentile:r.controlComparison?.midrankPercentile,orderRange:r.orderRange,flags:r.flags})),searches:searches.map(s=>({seed:s.seed,evaluated:s.progress.evaluated,generatedSets:s.probes.filter(p=>p.sameSetEvaluated>0).length}))},null,2));
