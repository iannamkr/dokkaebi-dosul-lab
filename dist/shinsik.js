(function(root){
'use strict';
const N=typeof module!=='undefined'?require('./numbers.js'):root.DosulNumbers;
// PvE reference rules, checked 2026-10-18 against kkaebigg.com/skills/<style>/
// and the bundled buff dictionary. These are reference values, not measured damage.
const H=typeof module!=='undefined'?require('./hit-timing.js'):root.DosulHits;
const slugs={절명:'jeolmyeong',연타:'yeonta',강타:'gangta',척살:'cheoksal',저격:'jeogyeok',주술:'jusul',파멸:'pamyeol',강인:'gangin',기동:'gidong',헌신:'heonsin',기만:'giman',제압:'jeap'};
const limitations={절명:['형상 획득·궁극기 감소는 공격 도술 적중 가정'],연타:['평타·미확인 지속 타격 제외'],강타:['사용 영력 10 적용: 자료 요약 5와 상충'],척살:['처치 영력은 공간 전투 실제 처치에 반영 · 이동 속도 효과 제외'],저격:['귀보 영력은 combatEvents에 귀보 시각 제공 시 반영'],주술:['강화 저주·폭발 피해 34/68/94%: 구성 피해 식별 전으로 제외'],파멸:['사용 영력 25 적용: 자료 요약 15와 상충'],강인:['피격 영력은 combatEvents의 관측 피격 시각에 반영 · 자동 피격 생성 없음','최대 체력 증가를 즉시 회복으로 계산하지 않음'],기동:['귀보 영력은 관측 이벤트로 반영 · 시전 가속률 미확인'],헌신:['하트 소비는 기록하지만 도술별 강화량 연결 미확인으로 제외'],기만:['허상 첫 최대 중첩에서 실제 대상 버프 1개 제거 · 재발동 주기 미확정'],제압:['푸른 사슬의 대상별 중첩·속박은 공간 전투에 반영']};
const round=n=>Math.round(n*100)/100;
function prepare(run,enabled=true,planned=false){
 const active=enabled?run.schedule.active:[],rage=active.includes('연타')?(planned?run.schedule.rage:run.rage):null;
 return {active,windows:run.schedule.windows||[],rage,procs:run.schedule.procs||[],horizon:run.horizon};
}
// End-exclusive windows. A proc at this cast's end cannot strengthen its own last hit.
function on(ctx,name,t,event){return ctx.windows.some(w=>w.name===name&&w.start<=t&&t<w.end&&(!event||w.start<=event.start));}
function previous(points,t){let lo=0,hi=points.length;while(lo<hi){const m=(lo+hi)>>1;if(points[m].time<t-1e-7)lo=m+1;else hi=m;}return points[lo-1];}
function rageAt(ctx,t){const p=previous(ctx.rage?.points||[],t);return p&&t-p.time<3-1e-7?p.stacks:0;}
function bonus(ctx,s,event,t){
 const has=f=>ctx.active.includes(f),v=event.resources||{};let n=0;
 if(has('연타'))n+=rageAt(ctx,t)*.004;
 if(has('기동')&&s.ultimate&&s.family==='기동'&&on(ctx,'연쇄',t,event))n+=.5;
 if(has('파멸')&&on(ctx,'요기범람',t,event))n+=.1;
 if(has('강타'))n+=(v.smash>=100?.1:v.smash>=66?.07:v.smash>=33?.03:0);
 if(has('절명')&&s.ultimate)n+=({3:.55,4:.75,5:1.25}[v.forms]||0);
 if(has('저격')){n+=(s.family==='저격'?.15:.015)*(v.arrows||0);if(on(ctx,'조준',t,event))n+=.1;}
 if(has('척살')){if(on(ctx,'척살 태세',t,event))n+=.1;const p=previous(ctx.procs.filter(p=>p.family==='척살'&&p.name.startsWith('척결 ')),t);if(p&&t-p.time<30)n+=Number(p.name.match(/\d+/)?.[0]||0)*.02;}
 if(has('제압')&&s.ultimate)n+=(v.locks||0)*.02;
 return n;
}
function castMultiplier(ctx,s,event){
 const hits=H.schedule(s,event,ctx.horizon).hits,dc=N.components(s),parts=dc;
 const coeff=i=>{for(const d of parts){if(i<=d.hits)return d.basic_coefficient||0;i-=d.hits;}return 0;};
 let base=0,extra=0;for(const h of hits){const c=coeff(h.hitIndex);base+=c;extra+=c*bonus(ctx,s,event,h.time);}return base?1+extra/base:1;
}
function defense(ctx,data,stats){
 const rows=[],shields=[],reductions=[],minutes=ctx.horizon/60,hp=Number(stats?.maxHp)||0;
 const skill=f=>data.skills.find(s=>s.family===f&&s.ultimate)||data.skills.find(s=>s.family===f);
 function add(f,label,kind,events,config){
  if(!events.length)return;const s=skill(f),key='shinsik:'+f+':'+kind,each=kind==='shield'?hp*config.hpPct/100+config.flat:null;
  rows.push({key,skillId:s.id,name:f+' 신식 · '+label,label,kind,shinsik:true,triggers:events.length,times:1,atkPct:0,hpPct:0,flat:0,life:config.life,dup:'Replace',each,full:each===null?null:round(each*events.length/minutes),perMin:each===null?null:round(each*events.length/minutes),...config});
  for(const e of events)if(kind==='shield')shields.push({t:e.start,key,amount:each,life:config.life,dup:'Replace'});else reductions.push({t:e.start,key,pct:(e.pct??config.reducePct/100),life:e.life??config.life});
 }
 if(ctx.active.includes('연타')){
  const ps=ctx.rage?.points||[],events=ps.map((p,i)=>({start:p.time,life:Math.max(0,Math.min(ctx.horizon,p.time+3,ps[i+1]?.time??Infinity)-p.time),pct:p.stacks*.004})).filter(e=>e.life>0);
  add('연타','격노','reduce',events,{life:3,reducePct:20});
 }
 if(ctx.active.includes('파멸'))add('파멸','요기범람','shield',ctx.windows.filter(w=>w.name==='요기범람'),{life:20,hpPct:3,flat:3650});
 if(ctx.active.includes('강인')){
  const events=ctx.windows.filter(w=>w.name==='강건');
  add('강인','강건','reduce',events,{life:10,reducePct:25});
  // Use base HP conservatively; never turn temporary max HP into free healing.
  add('강인','강건','shield',events,{life:10,hpPct:2.5,flat:1820});
 }
 return {rows,shields,reductions};
}
function analyze(run,data,enabled=true){
 const ctx=prepare(run,enabled),by=Object.fromEntries(data.skills.map(s=>[s.id,s])),ev=new Map(run.schedule.events.map(e=>[e.id+':'+e.cycle,e]));
 let base=0,extra=0;const byFamily={};
 // Spatial impacts retain their original coefficient; this separate ledger is used by ranking.
 for(const i of run.impacts){const e=i.castCycle?ev.get(i.id+':'+i.castCycle):run.schedule.events.find(e=>e.id===i.id&&i.time>=e.start-1e-7&&i.time<=e.end+1e-7);if(!e)continue;
  const s=by[i.id],hs=i.hitIndex?[]:H.schedule(s,e,run.horizon).hits,idx=i.hitIndex||hs.find(h=>Math.abs(h.time-i.time)<1e-6)?.hitIndex;if(!idx)continue;
  const dc=N.components(s);let k=idx,c=0;for(const d of dc){if(k<=d.hits){c=d.basic_coefficient||0;break;}k-=d.hits;}
  const b=c*i.targets.length,x=b*bonus(ctx,s,e,i.time);base+=b;extra+=x;byFamily[s.family]=(byFamily[s.family]||0)+x;
 }
 return {model:'shinsik-pve-v1',timeline:timeline(run.schedule),active:ctx.active,baseCoefficient:round(base),extraCoefficient:round(extra),effectiveCoefficient:round(base+extra),damageGainPct:base?round(extra/base*100):0,byFamily,
  rules:ctx.active.map(f=>({family:f,source:'https://kkaebigg.com/skills/'+slugs[f]+'/',checkedAt:'2026-10-18',limitations:limitations[f]})),
  assumptions:['PvE 참고 수치 · 신식 피해 증가 합산 가정','강화 여부는 적중 시점·만료 경계로 판정, 같은 시전 종료의 발동은 소급하지 않음','발동 시간표의 적중·처치·피격 한계는 유지']};
}
function timeline(schedule){
 return (schedule.active||[]).map(family=>{
  const windows=(schedule.windows||[]).filter(w=>w.family===family).map(w=>({...w,start:Math.max(0,w.start),end:Math.min(schedule.horizon,w.end)})).filter(w=>w.end>w.start).sort((a,b)=>a.start-b.start);
  let end=0,seconds=0;for(const w of windows){seconds+=Math.max(0,w.end-Math.max(end,w.start));end=Math.max(end,w.end);}
  const procs=(schedule.procs||[]).filter(p=>p.family===family&&p.time<schedule.horizon);
  return {family,first:procs[0]?.time??null,procs:procs.length,windows,seconds:round(seconds),uptimePct:schedule.horizon?round(seconds/schedule.horizon*100):0,hasWindow:windows.length>0,limitations:limitations[family]||[]};
 });
}
function eventCoefficient(s,event){return N.total(s,event);}
function preview(data,schedule){
 const by=Object.fromEntries(data.skills.map(s=>[s.id,s])),ctx=prepare({schedule,horizon:schedule.horizon},data.shinsikEffects!==false,true);let base=0,power=0;
 for(const e of schedule.events.filter(e=>e.completed)){const s=by[e.id],n=s.referenceNumbers||{};if(s.damage===false||n.nd)continue;const dc=n.cm?n.dc?.slice(-1)||[]:n.dc||[],c=eventCoefficient(s,e);base+=c;power+=c*castMultiplier(ctx,s,e);}
 return {timeline:timeline(schedule),base:round(base),power:round(power),extra:round(power-base),gainPct:base?round((power/base-1)*100):0};
}
const api={eventCoefficient,timeline,preview,prepare,bonus,castMultiplier,defense,analyze,limitations};if(typeof module!=='undefined')module.exports=api;else root.DosulShinsik=api;
})(typeof window==='undefined'?globalThis:window);
