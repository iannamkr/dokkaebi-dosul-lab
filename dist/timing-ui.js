'use strict';
let timingTarget=null,timingEdgeIndex=0,timingContext='',timingHorizon=60,timingSegment=0,timingCache=new Map();
const seconds=n=>n===null||n===undefined?'미확인':`${Math.round(n*100)/100}초`;
function timingEdges(x){return x.connections.filter(e=>e.type==='explicit'||e.type==='general').sort((a,b)=>(a.type==='explicit'?0:1)-(b.type==='explicit'?0:1));}
function timingPlan(id){if(!id||build.includes(id))return {ids:build,preview:false};const placed=Q.place(D,build,step,id,insertMode?'insert':'replace');return placed.error?{ids:build,preview:false}:{ids:placed.ids,baseSlots:placed.baseSlots,preview:true};}
function timingSimulation(ids,enabled=true,baseSlots=Q.base(D,ids)){const key=JSON.stringify([ids,baseSlots,timingHorizon,enabled,D.executionPolicy]);if(!timingCache.has(key)){if(timingCache.size>160)timingCache.clear();timingCache.set(key,DosulCombat.run({...D,baseSlots},ids,timingHorizon,enabled));}return timingCache.get(key);}
function timingResult(e){const plan=timingPlan(e.target);return DosulAuto.assess(D,timingSimulation(plan.ids,true,plan.baseSlots),e);}
function timingFirst(r){if(r.sourceTimingUnknown)return '장판 부여 시점 미확인 · 시간 판정 보류';return r.first==='blocked'?('선행 조건 없음 · '+r.missingRequirements.join(', ')):r.first==='pass'?`첫 적중 · ${seconds(r.margin)} 여유`:r.first==='conditional'?'시간 충족 · 추가 선행 조건 필요':r.first==='fail'?`첫 적중 · ${seconds(-r.margin)} 초과`:r.first==='absent'?'첫 적중 전에 선행 효과 없음':r.first==='boundary'?'효과 종료 경계 · 판정 유보':!r.cycles.length?'관찰 구간 내 적중 없음':r.duration!==null?`${seconds(r.duration)} 유지 · 적중 시점 미확인`:'효과 지속시간 자료 없음';}
function timingCount(r){return r.sourceTimingUnknown||!r.cycles.length||r.duration===null?'시간 판정 보류':`${r.cycles.length}타 중 시간 내 (추정) ${r.passes+r.conditional}타${r.conditional?' (추가 조건 있음)':''}`;}
function timingSummary(x){
 const edges=x.connections.filter(e=>e.type!=='conflict'),m=DosulAuto.motion(x.skill);
 if(!edges.length)return '<div class="timing-strip"><span>기본 동작 '+seconds(m?.total)+' · 명시된 시간 연계 없음</span></div>';
 return '<div class="candidate-time-links" aria-label="모든 선행 효과의 지속시간 판정"><small>후보 첫 사용 · 예상 적중 기준</small>'+edges.map(e=>{
  const r=e.timing||DosulLinkTiming.summarize(timingResult(e)),status=r.status;
  const labels={pass:'유효',partial:'일부 타격만 유효',fail:'만료',absent:'선행 효과 없음',boundary:'종료 경계 · 판정 보류',conditional:'시간 충족 · 추가 조건 확인',blocked:'선행 조건 불충족',unknown:'판정 불가'};
  const margin=r.margin===null||r.margin===undefined?'':r.margin<0?' · '+seconds(-r.margin)+' 초과':' · 첫 타격 '+seconds(r.margin)+' 여유';
  const info=status==='pass'||status==='partial'?r.valid+'/'+r.total+'타 시간 내'+margin:status==='fail'?margin.replace(/^ · /,''):status==='unknown'?(r.duration==null?'지속시간 자료 없음':'적중·부여 시점 미확인'):'';
  return '<div class="timing-strip timing-'+status+'"><span><b>'+esc(byId(e.source).name+' · '+e.effect)+' <span class="link-status">'+labels[status]+'</span></b><small>지속 '+seconds(r.duration)+(info?' · '+esc(info):'')+(r.eligible?'':' · 점수 제외')+'</small></span></div>';
 }).join('')+'</div>';
}
function timingCandidate(id){const skill=byId(id);if(!skill)return null;const pos=build.includes(id)?build.indexOf(id):step,connections=Q.links(D,E,build,pos,id).filter(e=>types().includes(e.type)&&($('#link-scope').value!=='previous'||e.source===build[pos-1]));return {skill,connections};}
function focusTiming(id){timingTarget=id;timingEdgeIndex=0;}
function syncTiming(){const context=JSON.stringify([build,step,insertMode,$('#link-scope').value,types(),$('#candidate-search').value,$('#candidate-family').value,targetFilter,candidatePage]);if(context!==timingContext){timingContext=context;timingEdgeIndex=0;timingTarget=shown.some(x=>x.skill.id===selected)?selected:build.includes(selected)?selected:null;}renderTimingPanel();for(const card of document.querySelectorAll('.candidate-node'))card.classList.toggle('timing-selected',card.id==='to-'+timingTarget);}
function timingStatus(h){return ({blocked:'선행 조건 없음',pass:'시간 내',fail:'시간 초과',absent:'선행 효과 없음',boundary:'경계',conditional:'추가 조건'})[h?.status]||'미확인';}
// Fixed HTML row dimensions keep text readable; only time tracks stretch with viewport width.
function segmentChart(sim,edge,result){
 const from=timingSegment*20,to=Math.min(from+20,sim.horizon),span=to-from,pct=t=>100*(t-from)/span;
 const bar=(start,end,cls,title)=>{const a=Math.max(from,start),b=Math.min(to,end);return b>a?`<span class="time-bar ${cls}" style="left:${pct(a)}%;width:${pct(b)-pct(a)}%" title="${esc(title)}"></span>`:'';};
 const point=(time,cls,title)=>time>=from&&time<to?`<span class="time-point ${cls}" style="left:${pct(time)}%" title="${esc(title)}"></span>`:'';
 const row=(label,track,cls='')=>`<div class="time-row ${cls}"><div class="time-name">${label}</div><div class="time-track">${track}</div></div>`;
 let html=`<div class="compact-gantt" role="group" aria-label="${from}초부터 ${to}초까지 실행 시간표">${row('사용 순서',Array.from({length:5},(_,i)=>`<span class="time-tick tick-${i}" style="left:${i*25}%">${from+i*span/4}초</span>`).join(''),'time-axis')}`;
 html+=row('모든 도술 쿨타임',sim.idle.map(e=>bar(e.start,e.end,'idle-bar',`모든 도술 쿨타임 ${seconds(e.start)} → ${seconds(e.end)} · 평타 미계산`)).join(''),'time-idle');
 for(const [slot,id] of sim.ids.entries()){
  const s=byId(id);let track='';
  for(const ev of sim.events.filter(e=>e.id===id)){
   track+=bar(ev.start,ev.cooldownEnd,'cd-bar',`${s.name} 재사용 ${seconds(ev.start)} → ${seconds(ev.cooldownEnd)}${ev.modifiers.length?' · '+ev.modifiers.join(' / '):''}`);
   let at=ev.start;for(const [key,label] of [['prep','시전 준비'],['charge','차지'],['action','모션']]){track+=bar(at,at+ev.parts[key],key+'-bar',`${s.name} ${ev.cycle}번째 사용 · ${label} ${seconds(ev.parts[key])} · ${seconds(at)} → ${seconds(at+ev.parts[key])}`);at+=ev.parts[key];}
   for(const h of (sim.hits||[]).filter(h=>h.id===id&&h.index===ev.cycle)){const hit=id===edge?.target?result.cycles.find(x=>x.index===h.index&&x.hitIndex===h.hitIndex):null;track+=point(h.time,'hit-'+(hit?.status||'neutral'),`${s.name} ${h.hitIndex}타 · 간격 추정 ${seconds(h.time)}${hit?' · '+timingStatus(hit):''}`);}
   if(id===edge?.source&&!result.sourceTimingUnknown&&result.duration!==null&&(ev.completed||result.application==='start')){const at=result.application==='start'?ev.start:ev.end;track+=bar(at,at+result.duration,'effect-bar',`${edge.effect} ${seconds(at)} → ${seconds(at+result.duration)}`);}
  }
  html+=row(`<small>${String(slot+1).padStart(2,'0')}</small><span>${esc(s.name)}</span>${s.ultimate?'<em>궁극</em>':''}`,track);
 }
 for(const family of sim.active){let track=sim.windows.filter(w=>w.family===family).map(w=>bar(w.start,w.end,'shinsik-bar',`${family} · ${w.name} ${seconds(w.start)} → ${seconds(w.end)}`)).join('');track+=sim.procs.filter(p=>p.family===family).map(p=>point(p.time,'shinsik-point',`${seconds(p.time)} ${p.name} · ${p.description}`)).join('');html+=row(`<span>${esc(family)} 신식</span>`,track,'time-shinsik');}
 return html+'</div>';
}
function renderTimingPanel(){
 const host=$('#timing-inline');if(!host)return;host.hidden=!build.length;if(!build.length){host.innerHTML='';$('#timing-peek').textContent='';return;}
 const plan=timingPlan(timingTarget),sim=timingSimulation(plan.ids,true,plan.baseSlots),baseline=sim.active.length?timingSimulation(plan.ids,false,plan.baseSlots):sim;let x=timingCandidate(timingTarget),edges=x?timingEdges(x):[];
 if(!edges.length&&!plan.preview){for(let i=plan.ids.length-1;i>0;i--){const candidate=timingCandidate(plan.ids[i]);if(timingEdges(candidate).length){x=candidate;edges=timingEdges(candidate);break;}}}
 timingEdgeIndex=Math.min(timingEdgeIndex,Math.max(0,edges.length-1));timingSegment=Math.min(timingSegment,timingHorizon/20-1);
 const edge=edges[timingEdgeIndex],result=edge?DosulAuto.assess(D,sim,edge):null,issues=Q.validate(D,plan.ids).issues,from=timingSegment*20,to=from+20,segmentProcs=sim.procs.filter(p=>p.time>=from&&p.time<to);
 $('#timing-peek').textContent=`↓ 실행 시간표 · ${timingHorizon}초 관찰 · 신식 ${sim.active.length}개 자동 적용${plan.preview?' · 후보 미리보기':''}`;
 const strength=typeof DosulShinsik!=='undefined'?DosulShinsik.preview(D,sim):null;
 const heading=plan.preview?`후보 미리보기 · ${step+1}단계 ${byId(timingTarget).name}`:'현재 조합';
 host.innerHTML=`<div class="auto-timing-head"><div><h2>실행 시간표 <span>신식 반영 · 예상</span></h2><p>${esc(heading)} · 사용 가능한 도술을 앞 슬롯부터 우선 사용</p></div><label>관찰 시간 <select id="timing-horizon" aria-label="관찰 시간">${[60,120,180].map(n=>`<option value="${n}" ${n===timingHorizon?'selected':''}>${n}초</option>`).join('')}</select></label>${plan.preview?'<button id="timing-current">현재 조합 보기</button>':''}<a href="#explore" class="timing-back">↑ 스킬 구성</a></div>
 <div class="shinsik-applied"><strong>신식 자동 적용</strong>${sim.active.length?sim.active.map(f=>`<span class="shinsik-chip" title="${esc(DosulCombat.rules[f].note)}">${esc(f)} · ${esc(DosulCombat.rules[f].name)}</span>`).join(''):'<span>기본 장착 5칸 중 같은 계열 3개일 때 적용됩니다.</span>'}<small>장착 조건 충족 시 개방된 것으로 가정</small></div>
 ${strength?`<div class="shinsik-applied"><strong>신식 포함 예정 피해계수 ${strength.power.toFixed(0)} · 강화분 +${strength.gainPct}%</strong><small>단일 대상 예정 적중 기준 · 평타·실전 DPS 제외</small>${strength.timeline.map(t=>`<span>${esc(t.family)} · 첫 발동 ${seconds(t.first)} · ${t.hasWindow?'유지 '+seconds(t.seconds)+' ('+t.uptimePct+'%)':'지속 구간 없음 · 소비/즉시 발동은 상세 확인'}</span>`).join('')}</div>`:''}
 <div class="auto-timing-metrics"><div><span>관찰 시간</span><b>${timingHorizon}초</b></div><div><span>완료한 도술</span><b>${sim.total===null?'—':sim.casts+'회'}</b></div><div><span>도술 동작 합계</span><b>${sim.total===null?'—':seconds(sim.busy)}</b></div><div><span>모든 도술 쿨타임</span><b class="wait-number">${sim.total===null?'—':seconds(sim.wait)} <small>${sim.total===null?'':Math.round(sim.wait/sim.horizon*100)+'%'}</small></b></div></div>
 ${sim.rage?`<div class="rage-metrics"><strong>격노 · 대상 1명 기준 추정</strong><span>유지 ${Math.round(sim.rage.uptimePercent*10)/10}%</span><span>3초 적중 공백 ${sim.rage.resets}회</span><span>최대 ${sim.rage.max}/50</span><span title="타격을 모션 초반·균등·후반에 배분한 세 가정. 실제 결과의 보장 범위가 아닙니다.">타격 시점 가정별 공백 ${Math.min(...sim.rage.sensitivity.map(x=>x.resets))}–${Math.max(...sim.rage.sensitivity.map(x=>x.resets))}회</span><span>첫 50중첩 ${sim.rage.first50===null?'구간 내 미도달':seconds(sim.rage.first50)}</span></div>`:''}
 <p class="combat-comparison">${sim.active.length&&sim.total!==null?`같은 ${timingHorizon}초에서 신식 미적용 → 적용: 완료 도술 <b>${baseline.casts} → ${sim.casts}회</b> · 모든 도술 쿨타임 <b>${seconds(baseline.wait)} → ${seconds(sim.wait)}</b>. `:''}빈 시간에 평타·이동 등이 가능하며, 평타와 실전 피해량은 계산하지 않습니다. 예정 피해계수는 별도 참고값입니다.</p>
 ${issues.length?`<p class="timing-warning">미완성 조합 · ${esc(issues.join(' '))} 장착 조건을 충족하지 못한 신식은 적용하지 않습니다.</p>`:''}${sim.warnings.map(w=>`<p class="timing-warning">${esc(w)}</p>`).join('')}
 <div class="auto-link-summary">${edge?`<label>효과 유지 확인 <select id="timing-edge" aria-label="차트에서 비교할 선행 연계">${edges.map((e,i)=>`<option value="${i}" ${i===timingEdgeIndex?'selected':''}>${esc(byId(e.source).name)} · ${esc(e.effect)} → ${esc(byId(e.target).name)}</option>`).join('')}</select></label><b class="timing-${result.first}">${esc(timingFirst(result))}</b><span>${timingCount(result)}</span>`:'선택한 연계가 없어 시전·재사용·신식만 표시합니다.'}</div>
 <div class="time-segments" role="group" aria-label="20초 구간 선택">${Array.from({length:timingHorizon/20},(_,i)=>`<button data-segment="${i}" aria-pressed="${i===timingSegment}" class="${i===timingSegment?'active':''}">${i*20}–${i*20+20}초</button>`).join('')}<small>20초 단위 · 모든 구간 동일 축척</small></div>
 <div class="auto-chart-legend"><span><i style="background:#5b8ba8"></i>준비</span><span><i style="background:#9470ad"></i>차지</span><span><i style="background:#206f58"></i>동작</span><span><i class="cooldown-key"></i>개별 쿨타임</span><span><i class="wait-key"></i>모든 도술 쿨타임</span><span><i style="background:#a4cf9a"></i>연계 효과</span><span><i style="background:#d3c3ea"></i>신식 유지</span><span>◆ 적중: <b class="pass">초록 충족</b> / <b class="fail">빨강 불충족</b> / 황색 조건·경계</span></div>
 ${sim.missing.length?`<p class="timing-warning">자료 부족으로 계산 보류: ${esc(sim.missing.join(', '))}</p>`:segmentChart(sim,edge,result)}
 <details class="segment-events"><summary>${from}–${to}초 신식 발동 ${segmentProcs.length}회 · 상세 보기</summary><div>${segmentProcs.length?segmentProcs.map(p=>`<p><time>${seconds(p.time)}</time><b>${esc(p.family)} · ${esc(p.name)}</b><span>${esc(p.description)}${p.changes.length?' · '+p.changes.length+'개 도술 재사용 변경':''}</span></p>`).join(''):'이 구간에는 신식 발동이 없습니다.'}</div></details>
 <p class="auto-model-note">장착 조합에 맞춰 자동 갱신됩니다. 다단히트는 모션 안에 나누어 추정합니다. 실제 타격 프레임·적 수·명중 여부가 달라지면 결과도 달라집니다. 미확인 장판과 지속피해는 격노에 합산하지 않습니다. 공백 범위는 세 타격 시점 가정의 차이이며 실제 결과의 보장 범위가 아닙니다. 적중 공백은 마지막 타격 후 3초 이상인 구간이며 관찰 종료 전 소멸도 포함합니다. 각 막대에 포인터를 올리면 시간을 볼 수 있습니다.</p>
 <details class="auto-assumptions"><summary>신식별 적용 내용 · 계산 기준과 자료</summary>${strength?strength.timeline.map(t=>`<p>${esc(t.family)} 미반영·가정: ${esc(t.limitations.join(" / "))}</p>`).join(''):''}${sim.active.map(f=>`<p><a href="https://kkaebigg.com/skills/${DosulCombat.rules[f].slug}/" target="_blank" rel="noopener">${esc(f)} 신식</a> — ${esc(DosulCombat.rules[f].note)}</p>`).join('')}<p>기본 장착 5칸 중 같은 계열 3개 이상이면 해당 신식이 개방된 것으로 가정합니다. 실제 캐릭터의 개방 상태를 불러온 것은 아닙니다. 모든 도술은 저장 횟수가 가득 찬 상태, 게이지·중첩은 0으로 시작합니다. 저장 횟수는 순차 충전하며 일반 도술 초기화 시 모두 회복하는 참고 모델입니다. 한 번에 하나를 사용하며 쿨타임인 도술은 건너뛰고 가장 앞의 사용 가능한 슬롯을 선택하는 우선순위 모델입니다. 뒤 슬롯의 사용 횟수가 줄어들 수 있습니다.</p><p>시전 준비 + 최대 차지 + 모션을 동작 시간으로 합산하며 재사용은 시전 시작부터 계산합니다. 격노는 개별 타격 시점에 갱신하며 다른 신식의 사용 획득은 모션 종료 시 반영합니다. 부여 효과는 ‘시전 시’이면 시작, 그 외에는 종료 시점으로 추정합니다. 구간 끝에서 동작 중인 도술은 완료 횟수에는 제외하되 구간 안의 개별 타격은 반영합니다. 효과 종료와 적중이 같으면 경계로 표시합니다.</p><p>파멸은 사용당 25, 200에서 20초 요기범람을 적용하며 유지 중 영력 획득은 멈춥니다. 준비 속도 +50%는 준비 시간 ÷1.5로 계산합니다. 주술은 초당 영력 5 감소, 구슬 30/60/90, 사용 후 쿨타임 감소를 모델링합니다. 기만은 사용 후 눈물 획득·소비 순서로 계산합니다. 이런 획득·소비 시점은 참고 자료의 모델이며 정확한 타격 프레임 검증값은 아닙니다.</p><p>귀보·피격·처치 등 외부 행동으로 얻는 자원, 이동·투사체, 장비·증강·돌파는 제외합니다. 기동의 미확인 가속 수치는 임의 적용하지 않습니다. 피해량·회복량만 바뀌는 신식은 발동과 유지 구간을 표시하며 DPS를 계산하지 않습니다. 버그는 계산에서 무시합니다.</p><p>자료: <a href="https://kkaebigg.com/skills/" target="_blank" rel="noopener">깨비지지 도술·신식</a> · <a href="https://kkaebigg.com/buffs/" target="_blank" rel="noopener">효과 사전</a> · 2026-10-17 교차 확인한 비공식 참고 모델. 첨부 인게임 수치를 우선합니다.</p></details>`;
 $('#timing-horizon').onchange=ev=>{timingHorizon=Number(ev.target.value);timingSegment=0;renderGraph();};
 for(const button of host.querySelectorAll?.('[data-segment]')||[])button.onclick=()=>{timingSegment=Number(button.dataset.segment);renderTimingPanel();};
 if(edge)$('#timing-edge').onchange=ev=>{timingEdgeIndex=Number(ev.target.value);renderTimingPanel();};
 if(plan.preview)$('#timing-current').onclick=()=>{timingTarget=null;timingEdgeIndex=0;syncTiming();};
}
function previewTiming(ev){const card=ev.target.closest('.candidate-node');if(!card)return;const id=card.id.slice(3);if(timingTarget===id)return;focusTiming(id);syncTiming();}
document.addEventListener('pointerover',previewTiming);
document.addEventListener('focusin',previewTiming);

