(function(root){
'use strict';
const number=(v,positive=false)=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=3600&&(!positive||n>0)?n:null;};
function duration(skill,effect){
 const parse=v=>typeof v==='number'?number(v,true):typeof v==='string'&&/^\s*\d+(\.\d+)?\s*초\s*$/.test(v)?number(parseFloat(v),true):null;
 const names=new Set([effect]);
 // A conditional result's lifetime belongs to its output, never its prerequisite.
 for(const c of skill.conditions||[])if(c.result===effect)names.add(`${c.effect} (${c.result})`);
 for(const detail of [skill.gameDetail,skill.referenceDetail]){
  const rows=[...(detail?.buffs||[]),...(detail?.debuffs||[])].filter(x=>names.has(x.name)&&parse(x.duration)!==null);
  const exact=rows.find(x=>x.name===effect),values=new Set(rows.map(x=>parse(x.duration)));
  const row=exact||(values.size===1?rows[0]:null);
  if(row)return {value:parse(row.duration),source:detail.source||'자료'};
 }
 const extra=skill.timingEffects?.[effect];
 if(parse(extra?.duration)!==null)return {value:parse(extra.duration),source:extra.source||'효과 자료'};
 return {value:null,source:null};
}
function assess(source,target,edge,input={}){
 const known=duration(source,edge.effect),d=number(input.duration,true)??known.value,a=number(input.sourceCooldown,true)??number(source.basic?.cooldown,true),b=number(input.targetCooldown,true)??number(target.basic?.cooldown,true),delay=number(input.delay);
 const first=d===null||delay===null?'unknown':Math.abs(delay-d)<1e-8||delay===0?'boundary':delay<d?'pass':'fail';
 const cycles=[];
 if(d!==null&&a!==null&&b!==null&&delay!==null)for(let i=0;i<5;i++){
  const hit=delay+i*b,application=Math.floor((hit+1e-9)/a)*a,age=hit-application;
  const boundary=Math.abs(age-d)<1e-8||Math.abs(age)<1e-8;
  cycles.push({index:i+1,hit,application,age,remaining:d-age,status:boundary?'boundary':age<d?'pass':'fail'});
 }
 return {duration:d,durationSource:number(input.duration,true)!==null?'사용자 입력':known.source,sourceCooldown:a,targetCooldown:b,delay,first,margin:d===null||delay===null?null:d-delay,cycles,passes:cycles.filter(x=>x.status==='pass').length,failures:cycles.filter(x=>x.status==='fail').length,boundaries:cycles.filter(x=>x.status==='boundary').length,period:a!==null&&b!==null?Math.max(a,b):null,sourceWait:a!==null&&b!==null?Math.max(0,b-a):null,targetWait:a!==null&&b!==null?Math.max(0,a-b):null};
}
const api={number,duration,assess};if(typeof module!=='undefined')module.exports=api;else root.DosulTiming=api;
})(typeof window==='undefined'?globalThis:window);
