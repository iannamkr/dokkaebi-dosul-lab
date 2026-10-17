(function(root){
'use strict';
const round=n=>Math.round(n*1e6)/1e6,valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
function motion(skill){const n=skill.referenceNumbers||{};if(!valid(n.m))return null;const prep=valid(n.pm)?n.pm:0,charge=valid(n.cm)?n.cm/1000:0,action=n.m/1000;return {prep,charge,action,total:round(prep+charge+action)};}
function duration(skill,effect){const base=typeof module!=='undefined'?require('./timing.js'):root.DosulTiming,d=base.duration(skill,effect),extra=skill.timingEffects?.[effect];return {value:d.value??extra?.duration??null,source:d.source||extra?.source||null,application:extra?.application||'end'};}
// Ordered baseline: never overlap actions or silently skip a skill on cooldown.
function simulate(data,ids,repeats=5){
 repeats=Math.max(1,Math.min(10,Math.floor(Number(repeats)||5)));const by=new Map(data.skills.map(s=>[s.id,s])),skills=ids.map(id=>by.get(id)),events=[],cycles=[],missing=[];
 if(!ids.length)return {events,cycles,missing,total:0,busy:0,wait:0,repeats,ids};
 for(const s of skills){if(!s){missing.push('존재하지 않는 도술');continue;}if(!motion(s))missing.push(s.name+' · 모션 시간');if(!valid(s.basic?.cooldown))missing.push(s.name+' · 재사용 대기시간');}
 if(new Set(ids).size!==ids.length)missing.push('중복 도술');
 if(missing.length)return {events,cycles,missing,total:null,busy:null,wait:null,repeats,ids};
 const ready=new Map(ids.map(id=>[id,0]));let now=0,busy=0,wait=0;
 for(let cycle=1;cycle<=repeats;cycle++){
  const from=now;let cycleWait=0;
  skills.forEach((s,slot)=>{const parts=motion(s),queued=now,start=round(Math.max(now,ready.get(s.id))),end=round(start+parts.total),pause=round(start-queued),cooldownEnd=round(start+s.basic.cooldown);
   events.push({id:s.id,cycle,slot,queued,start,end,wait:pause,cooldownEnd,parts});ready.set(s.id,cooldownEnd);now=end;busy+=parts.total;wait+=pause;cycleWait+=pause;
  });
  cycles.push({index:cycle,start:from,end:now,duration:round(now-from),wait:round(cycleWait)});
 }
 return {events,cycles,missing,total:now,busy:round(busy),wait:round(wait),repeats,ids};
}
function assess(data,simulation,edge){
 const source=data.skills.find(s=>s.id===edge.source),target=data.skills.find(s=>s.id===edge.target),known=duration(source,edge.effect),H=typeof module!=='undefined'?require('./hit-timing.js'):root.DosulHits;
 const sourceTimingUnknown=edge.scope==='enemy'&&source.hitTiming?.kind==='persistent';
 const applications=simulation.events.filter(e=>e.id===edge.source&&(e.completed!==false||known.application==='start')).map(e=>known.application==='start'?e.start:e.end);
 const timeline=H.timeline(data,simulation.events,simulation.horizon??Infinity),targetHits=timeline.hits.filter(h=>h.id===edge.target);
 const requirements=edge.requires||[],missingRequirements=requirements.filter(effect=>!data.skills.some(s=>(simulation.ids||simulation.events.map(e=>e.id)).includes(s.id)&&(edge.requirementScope==='enemy'?s.debuffs||[]:edge.requirementScope==='self'?s.buffs||[]:[...(s.buffs||[]),...(s.debuffs||[])]).includes(effect)));
 const hits=targetHits.map(h=>{const hit=h.time,application=applications.filter(t=>t<=hit+1e-8).at(-1)??null,age=application===null?null:round(hit-application),remaining=age===null||known.value===null?null:round(known.value-age);let status=missingRequirements.length?'blocked':(known.value===null||sourceTimingUnknown)?'unknown':application===null?'absent':Math.abs(remaining)<1e-8||age===0?'boundary':remaining>0?'pass':'fail';if(status==='pass'&&(edge.conditional||requirements.length))status='conditional';return {...h,hit,application,age,remaining,status};});
 const first=hits[0];return {duration:known.value,durationSource:known.source,sourceTimingUnknown,application:known.application,sourceCooldown:source.basic?.cooldown??null,targetCooldown:target.basic?.cooldown??null,delay:first?.age??null,first:first?.status||'unknown',margin:first?.remaining??null,cycles:hits,passes:hits.filter(h=>h.status==='pass').length,failures:hits.filter(h=>h.status==='fail').length,boundaries:hits.filter(h=>h.status==='boundary').length,conditional:hits.filter(h=>h.status==='conditional').length,blocked:hits.filter(h=>h.status==='blocked').length,missingRequirements,applications,estimated:hits.some(h=>h.confidence!=='verified'),unknownHits:timeline.unknown,casts:new Set(hits.map(h=>h.index)).size};
}

const api={motion,duration,simulate,assess};if(typeof module!=='undefined')module.exports=api;else root.DosulAuto=api;
})(typeof window==='undefined'?globalThis:window);
