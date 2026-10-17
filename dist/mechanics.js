(function(root){
'use strict';
const server=typeof module!=='undefined',C=server?require('./combat.js'):root.DosulCombat,A=server?require('./timing-auto.js'):root.DosulAuto,Q=server?require('./sequence.js'):root.DosulSequence;
const resetFamilies=['파멸','강타','기동'],reduceFamilies=['주술','기만','절명','제압'];
function facts(s){const m=A.motion(s);return {motion:m?.total??null,charges:s.usage?.charges??1,cooldown:s.basic?.cooldown??null,trigger:s.conditions?.length?'효과 조건':s.damage?'시전·적중':'시전',reset:resetFamilies.includes(s.family),reduce:reduceFamilies.includes(s.family)};}
function matches(s,mode){const f=facts(s);return !mode||mode==='all'||(mode==='reset'&&f.reset)||(mode==='reduce'&&f.reduce)||(mode==='stock'&&f.charges>1)||(mode==='fast'&&f.motion!==null&&f.motion<=.6)||(mode==='condition'&&s.conditions?.length>0);}
function analyze(data,ids,horizon=60){
 const sim=C.run(data,ids,horizon),off=C.run(data,ids,horizon,false),counts=Q.baseCounts(data,ids),first=sim.windows.length?Math.min(...sim.windows.map(w=>w.start)):sim.procs[0]?.time??null;
 const complete=sim.events.filter(e=>e.completed),by=new Map(data.skills.map(s=>[s.id,s])),countsOf=events=>Object.fromEntries(ids.map(id=>[id,events.filter(e=>e.id===id&&e.completed).length]));
 const during=complete.filter(e=>by.get(e.id)?.damage&&sim.windows.some(w=>e.start>=w.start-1e-7&&e.end<w.end-1e-7)),ults=complete.filter(e=>by.get(e.id)?.ultimate),ultDuring=ults.filter(e=>during.includes(e)),perSkill=countsOf(complete),without=countsOf(off.events);
 const resets=sim.procs.filter(p=>p.name.includes('발동')&&p.changes.some(c=>Math.abs(c.after-p.time)<1e-6));
 const valid=sim.total!==null&&Q.validate(data,ids).issues.length===0;
 return {sim,valid,first:valid?first:null,casts:valid?sim.casts:null,extra:valid?sim.casts-off.casts:null,buffed:valid?during.length:null,ultBuffed:valid?ultDuring.length:null,ultCasts:ults.length,perSkill,without,counts,resets,progress:Math.max(0,...Object.values(counts))/3,starved:ids.filter(id=>!perSkill[id]),missing:sim.missing,issues:Q.validate(data,ids).issues};
}
function sort(list,mode){const finite=(n,fallback)=>n===null||n===undefined?fallback:n;return list.slice().sort((a,b)=>{
 const x=a.mechanics,y=b.mechanics;if(!x||!y||mode==='effect'||!mode)return b.score-a.score;
 if(x.valid!==y.valid)return x.valid?-1:1;
 if(mode==='activation')return finite(x.first,Infinity)-finite(y.first,Infinity)||y.progress-x.progress||finite(facts(a.skill).motion,Infinity)-finite(facts(b.skill).motion,Infinity)||b.score-a.score;
 if(mode==='repeat')return finite(y.casts,-Infinity)-finite(x.casts,-Infinity)||finite(y.extra,-Infinity)-finite(x.extra,-Infinity)||b.score-a.score;
 if(mode==='window')return finite(y.ultBuffed,-Infinity)-finite(x.ultBuffed,-Infinity)||finite(y.buffed,-Infinity)-finite(x.buffed,-Infinity)||b.score-a.score;
 return 0;
 });}
const api={facts,matches,analyze,sort,resetFamilies,reduceFamilies};if(server)module.exports=api;else root.DosulMechanics=api;
})(typeof window==='undefined'?globalThis:window);
