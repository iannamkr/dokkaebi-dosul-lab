#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),D=require(path.join(root,'dist/data.json')),O=require(path.join(root,'dist/optimizer.js')),Q=require(path.join(root,'dist/sequence.js'));
const args=process.argv.slice(2),arg=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const id=n=>{const s=D.skills.find(x=>x.name===n);if(!s)throw Error(n);return s.id;};
// Reference fixture is a probe only. It is never passed to createSearch or used to seed/rank candidates.
const target=['연속 쇄도','쌍검 가르기','영혼 소용돌이','방패 치기','휩쓸어 베기','도약 찌르기','반동 사격','대검 찍기','부적 던지기'].map(id);
const start=['연쇄 번개','방패 치기','휩쓸어 베기','검기 폭발','대검 찍기','회전 난격','방패 내려찍기','방패 낙하','강인한 의지'].map(id);
const options={stats:{attack:20532,maxHp:101115,regen:2751,regenPeriod:5},families:Object.keys(D.families),iterations:Number(arg('--iterations',4000)),seed:Number(arg('--seed',20261018)),encounter:!args.includes('--legacy')};
if(!Number.isSafeInteger(options.iterations)||options.iterations<1)throw Error('iterations must be positive integer');
const search=O.createSearch(D,{ids:start,baseSlots:Q.fit(D,start)},options);let p,last=Date.now();
do{p=search.step(1000);if(Date.now()-last>15000){process.stderr.write(JSON.stringify(p)+'\n');last=Date.now();}}while(!p.finished);
const result=search.grouped(10),all=[...result.similar,...result.different],sameSet=ids=>[...ids].sort().join()===[...target].sort().join();
const compact=c=>({names:c.ids.map(i=>D.skills.find(s=>s.id===i).name),ultimate:D.skills.find(s=>s.ultimate&&c.ids.includes(s.id))?.name,sameSet:sameSet(c.ids),exactOrder:c.ids.join()===target.join(),power:c.verification.minPower,sensitivity:c.verification.sensitivity,overlap:c.ids.filter(id=>target.includes(id)).length});
const report={schema:'dosul-discovery-audit-v1',options,limitations:['Synthetic local arena; no measured incoming damage or zone: survival is not verified.','Probe does not seed search; identical deck is not a required recommendation.','Speed is video-informed approximation, respawn is sensitivity assumption.'],target:target.map(i=>D.skills.find(s=>s.id===i).name),probe:search.audit(target),reference:O.verify(D,target,Q.fit(D,target),options),progress:p,recommendedExactOrder:all.some(c=>c.ids.join()===target.join()),recommendedSameSet:all.some(c=>sameSet(c.ids)),recommendedGidong:all.filter(c=>c.ids.includes(id('연속 쇄도'))).length,similar:result.similar.map(compact),different:result.different.map(compact)};
const output=path.resolve(arg('--output','discovery-audit.json'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({output,evaluated:p.evaluated,probe:report.probe.reason,referencePower:report.reference.minPower,recommendedExactOrder:report.recommendedExactOrder,recommendedSameSet:report.recommendedSameSet,recommendedGidong:report.recommendedGidong}));
