const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),D=require(path.join(root,'dist/data.json')),C=require(path.join(root,'dist/combat')),H=require(path.join(root,'dist/hit-timing'));
const names=['방패 치기','도약 찌르기','주먹 지르기','내려찍기','휘둘러 내려치기','찌르기','집중 연타','생명의 흐름'];
const ids=names.map(n=>D.skills.find(s=>s.name===n).id),remaining=[4.6,3,2.9,5.8,2.4,6.7,2.5,9.5];
// Hand-transcribed HUD at video 1.5s. No source cooldowns or motion values are changed.
const initial={skills:Object.fromEntries(ids.map((id,i)=>[id,{charges:0,cooldownRemaining:remaining[i]}]))};
const run=C.run({...D,baseSlots:[ids[2],ids[4],ids[6],ids[0],ids[1]],combatInitialState:initial},ids,70.5);
// At 4.5s the video visibly has zero stacks. This boundary is conditioning evidence,
// NOT an independently passed prediction. Validate only later observations.
const start=4.5,hits=run.hits.map(h=>({...h,time:h.time+1.5})).filter(h=>h.time>start).map(h=>({...h,time:h.time-start}));
const rage=H.rage(hits,72-start),predicted=rage.resetTimes.map(t=>+(t+start).toFixed(3));
const observed=[[28,32],[60,64]];
const checks=observed.map(([lo,hi])=>({observedInterval:[lo,hi],predictedInside:predicted.filter(t=>t>=lo&&t<=hi),matched:predicted.some(t=>t>=lo&&t<=hi)}));
const report={video:'화면 녹화 중 2026-10-19 014959.mp4',duration:72,names,initialSnapshot:{time:1.5,remaining,charges:'0 each; obscured two-charge indicators require confirmation'},conditioning:{time:start,stacks:0,excludedFromValidation:true},assumptions:['No source cooldown or motion retuning','All model skill hits land on one target','Actual animation and automatic input delays are not yet measured','Only two later reset windows are independently compared; extra resets are not classified'],predictedResetTimes:predicted,checks,matched:checks.filter(x=>x.matched).length,total:checks.length,metrics:rage,status:checks.every(x=>x.matched)?'partial-observation-match':'video-mismatch',casts:run.events.map(e=>({name:D.skills.find(s=>s.id===e.id).name,start:+(e.start+1.5).toFixed(3),end:+(e.end+1.5).toFixed(3)}))};
const dest=process.argv[2];if(dest)fs.writeFileSync(dest,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,metrics:{maxStackPercent:rage.maxStackPercent,meanReductionPct:rage.meanReductionPct},casts:undefined},null,2));
