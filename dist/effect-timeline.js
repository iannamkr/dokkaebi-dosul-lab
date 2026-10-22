(function(root){
'use strict';
function model(data,sim){const A=typeof module!=='undefined'?require('./timing-auto.js'):root.DosulAuto,rows=[],unknown=[];
for(const id of sim.ids||[]){const s=data.skills.find(s=>s.id===id);if(!s)continue;
for(const scope of ['self','enemy'])for(const effect of new Set((scope==='self'?s.buffs:s.debuffs)||[])){
const d=A.duration(s,effect),conditional=!!s.timingEffects?.[effect]?.conditional||(s.conditions||[]).some(c=>c.result===effect),uncertain=conditional||(scope==='enemy'&&s.hitTiming?.kind==='persistent');
if(d.value===null||uncertain){unknown.push({id,effect,scope,reason:conditional?'조건부 효과':uncertain?'부여 시점 미확인':'지속시간 미확인'});continue;}
const spans=sim.events.filter(e=>e.id===id&&(e.completed!==false||d.application==='start')).map(e=>{const start=d.application==='start'?e.start:e.end;return {start,end:start+d.value};});
if(spans.length)rows.push({id,name:s.name,effect,scope,duration:d.value,spans});}}
return {rows,unknown};}
function active(model,time){return model.rows.flatMap(r=>{const spans=r.spans.filter(s=>s.start<time&&s.end>time);return spans.length?[{...r,remaining:Math.max(...spans.map(s=>s.end))-time}]:[];});}
const api={model,active};if(typeof module!=='undefined')module.exports=api;else root.DosulEffectTimeline=api;
})(typeof window==='undefined'?globalThis:window);
