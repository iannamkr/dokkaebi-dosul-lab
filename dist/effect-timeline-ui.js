'use strict';
let effectTime=0,effectPage=0;
function renderEffectTimeline(){
const host=document.querySelector('#effect-timeline');if(!host)return;host.hidden=!build.length;if(!build.length)return;
const plan=timingPlan(timingTarget),sim=timingSimulation(plan.ids,true,plan.baseSlots),model=DosulEffectTimeline.model(D,sim);
if(sim.missing?.length){host.innerHTML='<b>스킬 타임라인 · 시전 시간 자료 부족</b>';return;}
const from=effectPage*20,to=from+20,pct=t=>(t-from)*5;effectTime=Math.max(from,Math.min(to,effectTime));
const bar=(a,b,label,cls)=>{const start=Math.max(a,from),end=Math.min(b,to);return end>start?`<span class="effect-span ${cls}" style="left:${pct(start)}%;width:${pct(end)-pct(start)}%" title="${esc(label)}">${cls==='cast'?'':esc(label)}</span>`:'';};
const row=(name,body,skill=null)=>`<div class="effect-row"><span class="effect-row-label">${skill?`<img src="${esc(skill.icon)}" alt="" width="24" height="24"><span><b>${esc(skill.name)}</b></span><small>${window.DosulEffectIcons?.src(name)?`<img class="game-status-icon" src="${esc(window.DosulEffectIcons.src(name))}" alt="${esc(name)}" title="${esc(name)}" width="16" height="16">`:""}</small>`:esc(name)}</span><div class="effect-track">${body}</div></div>`;
const current=DosulEffectTimeline.active(model,effectTime);
host.innerHTML=`<div class="effect-toolbar"><b>스킬 타임라인 <small>예상 · 동일 대상</small></b><div>${[0,1,2].map(n=>`<button data-effect-page="${n}" aria-pressed="${n===effectPage}">${n*20}–${n*20+20}초</button>`).join('')}</div></div><div class="effect-chart"><div class="effect-canvas"><div class="effect-row"><span>시간</span><div class="effect-axis">${[0,5,10,15,20].map(n=>`<span style="left:${n*5}%">${from+n}초</span>`).join('')}</div></div><strong class="effect-group">시전</strong>${[...new Set(plan.ids)].map(id=>row('',sim.events.filter(e=>e.id===id).map(e=>bar(e.start,e.end,`${byId(id).name} · ${seconds(e.start)}–${seconds(e.end)}`,'cast')).join(''),byId(id))).join('')}${['self','enemy'].map(scope=>`<strong class="effect-group">${scope==='self'?'캐릭터 강화':'적 약화'}</strong>`+model.rows.filter(r=>r.scope===scope).map(r=>row(r.effect,r.spans.map(s=>bar(s.start,s.end,`${r.effect} ${seconds(s.start)}–${seconds(s.end)}`,scope)).join(''),byId(r.id))).join('')).join('')}</div></div>${model.unknown.length?`<details><summary>시간 판정 보류 ${model.unknown.length}개</summary>${model.unknown.map(r=>`${esc(byId(r.id).name)} · ${esc(r.effect)}: ${r.reason}`).join('<br>')}</details>`:''}`;
host.querySelectorAll('[data-effect-page]').forEach(b=>b.onclick=()=>{effectPage=+b.dataset.effectPage;effectTime=effectPage*20;renderEffectTimeline();if(window.renderEffectBlocks)window.renderEffectBlocks();});
}
const originalSyncTiming=syncTiming;
syncTiming=function(){originalSyncTiming();renderEffectTimeline();if(window.renderEffectBlocks)window.renderEffectBlocks();};
renderEffectTimeline();
