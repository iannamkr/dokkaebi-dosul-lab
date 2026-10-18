(function(root){
'use strict';
// HP trace is observed/external input. Never pretend it is a closed-loop survival simulation.
function prepare(raw,ids,horizon){
 const p=raw||{},errors=[],known=new Set(ids),opener=p.opener||[],thresholds=p.hpBelow||{},trace=p.hpTrace||[];
 if(!Array.isArray(p.disabled||[])||!Array.isArray(opener)||!Array.isArray(trace))return {errors:['실행 정책 배열 형식 오류']};
 const disabled=new Set(p.disabled||[]);
 for(const id of [...disabled,...opener,...Object.keys(thresholds)])if(!known.has(id))errors.push('실행 정책의 미장착 도술: '+id);
 for(const [id,n] of Object.entries(thresholds))if(!Number.isFinite(n)||n<0||n>100)errors.push('HP 조건은 0–100: '+id);
 let last=-1;for(const x of trace){if(!Number.isFinite(x.time)||x.time<0||x.time<=last||!Number.isFinite(x.percent)||x.percent<0||x.percent>100)errors.push('HP 기록은 시간순 0–100%여야 합니다.');last=x.time;}
 if(Object.keys(thresholds).length&&(!trace.length||trace[0].time!==0||trace.at(-1).time<horizon))errors.push('HP 조건 계산에는 0초부터 종료 시점까지의 HP 기록이 필요합니다.');
 let cursor=0;const decisions=[];
 const hp=t=>{let value=null;for(const x of trace){if(x.time>t)break;value=x.percent;}return value;};
 const allowed=(id,t)=>!disabled.has(id)&&(thresholds[id]===undefined||hp(t)<=thresholds[id]);
 return {errors,decisions,summary:{disabled:[...disabled],opener:[...opener],hpBelow:{...thresholds},hpMode:Object.keys(thresholds).length?'external-trace':'none'},
 choose(skills,charges,t){if(cursor<opener.length){const id=opener[cursor];return charges[id]>0?skills.findIndex(s=>s.id===id):-1;}return skills.findIndex(s=>charges[s.id]>0&&allowed(s.id,t));},
 next(skills,ready,t){if(cursor<opener.length)return ready[opener[cursor]];const times=skills.filter(s=>!disabled.has(s.id)).map(s=>ready[s.id]).filter(x=>x>t);if(Object.keys(thresholds).length)times.push(...trace.filter(x=>x.time>t).map(x=>x.time));return Math.min(horizon,...times);},
 record(id,t){const manual=cursor<opener.length;if(manual)cursor++;const d={id,time:t,phase:manual?'opener':'automatic',hpPercent:Object.keys(thresholds).length?hp(t):null};decisions.push(d);return d;}};
}
const api={prepare};if(typeof module!=='undefined')module.exports=api;else root.DosulExecutionPolicy=api;
})(typeof window==='undefined'?globalThis:window);
