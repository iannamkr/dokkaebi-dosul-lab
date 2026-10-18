(function(root){
'use strict';
const round=n=>Math.round(n*1e6)/1e6;
// Hit count is not a tick interval. Missing persistent timing never becomes an instant burst.
function schedule(skill,event,horizon=Infinity,phase='uniform'){
 const n=skill.referenceNumbers||{},timing=skill.hitTiming||{};
 if(n.nd||skill.damage===false)return {hits:[],unknown:false};
 let offsets=event.hitIndices?undefined:timing.offsets,confidence=timing.confidence||'estimated';
 if(!offsets){
  if(!event.hitIndices&&(timing.kind==='persistent'||timing.kind==='unknown'))return {hits:[],unknown:true,reason:timing.note||'타격 간격 미확인'};
  const dc=n.dc||[],count=event.hitIndices?.length|| (Number.isInteger(timing.count)&&timing.count>0?timing.count:n.cm?(dc.at(-1)?.hits||0):dc.reduce((sum,d)=>sum+(d.hits||0),0));
  if(!count&&skill.damage===true)return {hits:[],unknown:true,reason:'타격 횟수 미확인'};
  const total=count||1,parts=event.parts||{prep:0,charge:0,action:event.end-(event.start??event.end)},begin=parts.prep+parts.charge;
  offsets=Array.from({length:total},(_,i)=>{const ratio=total===1?1:phase==='early'?i/(total-1):phase==='late'?.25+.75*(i+1)/total:(i+1)/total;return begin+parts.action*ratio;});
 }
 return {unknown:false,hits:offsets.map((offset,i)=>({id:event.id,slot:event.slot,index:event.cycle,hitIndex:event.hitIndices?.[i]??i+1,time:round((event.start??event.end)+offset),confidence})).filter(h=>h.time<=horizon+1e-7)};
}
function timeline(data,events,horizon=Infinity,phase='uniform'){
 const hits=[],unknown=new Set();for(const ev of events){const s=data.skills.find(s=>s.id===ev.id);if(!s)continue;const result=schedule(s,ev,horizon,phase);hits.push(...result.hits);if(result.unknown)unknown.add(s.name+' · '+result.reason);}
 hits.sort((a,b)=>a.time-b.time||a.slot-b.slot||a.hitIndex-b.hitIndex);return {hits,unknown:[...unknown]};
}
function rage(hits,horizon){
 let stacks=0,last=null,first50=null,resets=0,max=0;const windows=[],points=[],gaps=[];
 for(const hit of hits){const gap=last===null?null:round(hit.time-last);if(gap!==null&&gap>=3-1e-7){resets++;gaps.push({start:last,end:hit.time,duration:gap});stacks=0;}
  stacks=Math.min(50,stacks+1);max=Math.max(max,stacks);if(stacks===50&&first50===null)first50=hit.time;
  const previous=windows.at(-1);if(previous&&previous.end>hit.time+1e-7)previous.end=Math.min(horizon,hit.time+3);else windows.push({family:'연타',name:'격노 · 타격 간격 추정',start:hit.time,end:Math.min(horizon,hit.time+3)});
  points.push({...hit,stacks});last=hit.time;
 }
 if(last!==null&&horizon-last>=3-1e-7){resets++;gaps.push({start:last,end:horizon,duration:round(horizon-last),trailing:true});}
 const uptime=round(windows.reduce((n,w)=>n+w.end-w.start,0));
 return {windows,points,resets,first50,max,uptime,uptimePercent:round(100*uptime/horizon),gaps,confidence:'estimated',assumption:'대상 1명에 모든 모델 타격 적중 · 평타/지속피해/미확인 장판 제외'};
}
const api={schedule,timeline,rage};if(typeof module!=='undefined')module.exports=api;else root.DosulHits=api;
})(typeof window==='undefined'?globalThis:window);
