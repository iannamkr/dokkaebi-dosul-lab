(function(){
'use strict';
const O=window.DosulOptimizer,KK=window.DosulKkaebigg,ZONES=window.DOSUL_HUNTING?.zones||[],host=document.querySelector('#optimizer');if(!host||!O)return;
const FAMILIES=['절명','연타','강타','척살','저격','주술','파멸','강인','기동','헌신','기만','제압'];
// One fixed search depth and safety margin: the screen only asks for what the player can measure.
const ITERATIONS=4000,GROUP_SIZE=10,MARGIN=1000,REGEN_PERIOD=5,SEARCH_PROFILE='185547',STORE='dosul-optimizer-v1';
const q=sel=>host.querySelector(sel),f=n=>n===null||n===undefined||!Number.isFinite(n)?'—':Math.round(n).toLocaleString('ko-KR'),signed=n=>(n>=0?'+':'')+f(n);
let settings={stats:{attack:'',maxHp:'',regen:''},mode:'measure',incoming:'',measure:{hpStart:'',hpEnd:'',seconds:''},overrides:{},families:null,zoneFrom:'',zoneTo:'',power:''};
try{const v=JSON.parse(localStorage.getItem(STORE)||'null');if(v&&typeof v==='object')settings={...settings,...v,stats:{...settings.stats,...v.stats},measure:{...settings.measure,...v.measure},overrides:{...v.overrides}};}catch{}
// Older saves: the "keep current sustain" mode, margin, depth and regen period are gone.
if(settings.mode!=='incoming')settings.mode='measure';delete settings.margin;delete settings.depth;delete settings.single;delete settings.stats.regenPeriod;
let context='',current=null,search=null,timer=0,lastResults=null,resultContext='';
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(settings));}catch{}};
const num=v=>v===''||v===null||v===undefined?NaN:Number(v);
const stats=()=>({attack:num(settings.stats.attack),maxHp:num(settings.stats.maxHp),regen:num(settings.stats.regen)||0,regenPeriod:REGEN_PERIOD});
const familiesOf=ids=>[...new Set(ids.map(id=>byId(id)?.family).filter(Boolean))];
const ruleText={Replace:'교체',Stack:'중첩',Impossible:'중복 불가',StackLifeReset:'중첩·시간 초기화',StackLifeExtension:'중첩·시간 연장'};

host.innerHTML=`<div class="opt-heading"><div><h1>빌드 최적화</h1><p>물약 없이 버틸 수 있는 범위에서 스킬 파워(직접 피해 계수)가 가장 큰 사용 순서·도술 구성·기본 장착을 찾습니다. 순서 구성의 현재 빌드가 출발점입니다.</p></div><div class="opt-actions"><button data-tab="explore">← 순서 수정</button></div></div>
<div id="opt-build" class="opt-build"></div><div id="opt-equipment" class="opt-caption"></div><div id="opt-validation" class="opt-validation" role="alert" hidden></div>
<div id="opt-empty" hidden><b>먼저 사용할 도술을 배치하세요.</b><p>순서 구성에서 만든 빌드를 출발점으로 사용합니다.</p><button data-tab="explore">도술 배치하기 →</button></div>
<div id="opt-work">
<div class="opt-grid">
<section class="opt-panel" aria-labelledby="opt-stats-title"><h2 id="opt-stats-title">1 · 내 캐릭터</h2>
<label>최대 체력<input id="opt-maxhp" type="number" min="0" inputmode="numeric"></label><label>공격력<input id="opt-attack" type="number" min="0" inputmode="numeric"></label>
<label>체력 자연 회복<input id="opt-regen" type="number" min="0" inputmode="numeric" placeholder="0"></label>
<p id="opt-stats-note" class="opt-caption"></p></section>
<section class="opt-panel" aria-labelledby="opt-need-title"><h2 id="opt-need-title">2 · 사냥 기준</h2>
<div class="opt-modes" role="radiogroup" aria-label="받는 피해를 정하는 방법">
<label><input type="radio" name="opt-mode" value="measure"> 사냥 실측 <small>현재 빌드로 몇 분 사냥한 HP 변화로 계산</small></label>
<label><input type="radio" name="opt-mode" value="incoming"> 몹 1마리에게 받는 분당 피해 직접 입력</label></div>
<div id="opt-measure-row" class="opt-inline">
<label>측정 사냥터<select id="opt-zone-from" aria-label="실측한 사냥터"></select></label>
<label>시작 HP<input id="opt-hp-start" type="number" min="0" inputmode="numeric"></label><label>끝 HP<input id="opt-hp-end" type="number" min="0" inputmode="numeric"></label><label>측정 시간 (초)<input id="opt-seconds" type="number" min="1" inputmode="numeric"></label>
<details class="opt-guide"><summary>측정 방법</summary><ul>
<li>물약 자동 사용을 끄고, 평소처럼(같은 빌드·같은 몰이 규모) 사냥합니다.</li>
<li>HP 50~70%에서 시작하고, 측정 중 최대치나 0에 닿지 않게 합니다. 최대치에 닿으면 넘친 회복을 알 수 없습니다.</li>
<li>측정 내내 전투를 이어 갑니다. 전투가 끊기면 자연 회복이 1초마다 들어와 결과가 달라집니다.</li>
<li>측정 중에는 빌드·장비를 바꾸지 않습니다. 3~5분이면 충분합니다.</li></ul></details></div>
<div id="opt-incoming-row" class="opt-inline"><label>분당 받는 피해 (1마리)<input id="opt-incoming" type="number" min="0" inputmode="numeric"></label></div>
<div class="opt-zone"><label>목표 사냥터<select id="opt-zone-to" aria-label="사냥할 사냥터"></select></label><label>내 전투력 <small>(선택)</small><input id="opt-power" type="number" min="0" inputmode="numeric"></label><p id="opt-zone" class="opt-caption"></p></div>
<p id="opt-need" class="opt-need" role="status"></p></section>
<section class="opt-panel" aria-labelledby="opt-scope-title"><h2 id="opt-scope-title">3 · 쓸 수 있는 도술</h2>
<p class="opt-caption">열린 신식 계열</p><div id="opt-families" class="opt-families"></div>
<p class="opt-caption">범위 공격 도술은 맞힌 몹이 모두 덤벼 받는 피해가 늘어납니다. 사냥터 몹 밀도로 동시에 붙는 몹 수를 계산해 반영합니다.</p>
<p id="opt-ultimate" class="opt-caption"></p></section>
</div>
<div class="opt-run"><button id="opt-run" class="primary">최적화 실행</button><button id="opt-cancel" hidden>중지</button><progress id="opt-progress" max="1" value="0" hidden></progress><span id="opt-status" role="status" aria-live="polite"></span></div>
<section id="opt-results" hidden aria-label="최적화 결과"><p id="opt-stale" class="opt-warning" hidden>빌드나 입력이 바뀌었습니다. 아래 결과는 이전 기준입니다.</p>
<div id="opt-card" class="opt-card"></div>
<p id="opt-found" class="opt-caption"></p>
<div class="opt-export"><button id="opt-export-md">분석용 내보내기 (.md)</button><button id="opt-export-copy">분석용 텍스트 복사</button><span id="opt-export-status" role="status" aria-live="polite"></span><small>현재 빌드·추천·비슷한 빌드·다른 도술 조합의 수치와 이유를 프롬프트에 붙여 넣기 좋은 Markdown과 JSON으로 담습니다.</small></div>
<details id="opt-similar" class="opt-more"><summary>비슷한 빌드 보기 <span id="opt-similar-count"></span></summary><div id="opt-similar-body" class="opt-alts"></div></details>
<details id="opt-different" class="opt-more"><summary>다른 도술 조합 보기 <span id="opt-different-count"></span></summary><div id="opt-different-body" class="opt-alts"></div></details></section>
<details id="opt-basis" class="opt-assumptions"><summary>계산 근거 보기</summary>
<div id="opt-data" class="opt-data"><span id="opt-data-text"></span><button id="opt-sync">깨비지지 동기화</button><span id="opt-sync-status" role="status" aria-live="polite"></span></div>
<div class="opt-section-title"><h2>현재 빌드의 회복·보호막</h2><span id="opt-current-total"></span></div>
<p class="opt-caption">도술 설명의 수치와 시뮬레이션 발동 횟수(영상 03 배치 · 180초)로 계산합니다. 게임에서 확인한 1회량이 다르면 실측 칸에 입력하세요. 보호막·피해 감소는 깨비지지 버프 사전의 지속시간·중복 규칙과 받는 피해로 실제 흡수·감소량을 계산합니다.</p>
<div class="opt-table-wrap"><table class="opt-table opt-sources"><thead><tr><th>도술</th><th>효과</th><th>발동</th><th>1회량</th><th>실측 1회량</th><th>지속 · 중복</th><th>180초 발동</th><th>분당 최대</th><th>분당 반영</th></tr></thead><tbody id="opt-sources"></tbody></table></div>
<ul id="opt-unquantified" class="opt-unquantified"></ul>
<h3>계산 기준과 한계</h3><ul>
<li>목표: 스킬 회복·보호막(분당) ≥ 받는 피해 − 자연 회복 + 안전 여유 ${f(MARGIN)}을 지키는 구성 중 목표 사냥터 분당 처치 수(스킬 파워)가 가장 큰 구성. 자연 회복은 전투 중 ${REGEN_PERIOD}초마다 들어온다고 봅니다.</li>
<li>선공 몹이 없으므로 맞힌 몹만 덤빕니다. 단일 도술은 한 마리씩, 범위 공격 도술은 범위 안 몹(사냥터 출현 좌표 밀도 × 범위 면적, 대상 수 상한)을 함께 끌어옵니다. 사용 순서대로 단일 피해는 한 마리에 집중하고 범위 피해는 붙은 몹 모두에게 들어가 몹이 죽는 속도를 계산하고, 그동안 살아 있는 몹 수의 평균만큼 받는 피해를 곱합니다.</li>
<li>보정값(2026-10-18 독기 지대 영상): 지도 1px ≈ ${O.mPerPx}m(불굴 5m 원과 화면 속 몹 수), 실제 피해 ≈ 계수 × 공격력 × ${O.damageRate}(대상 체력바로 잰 분당 약 9.8마리 처치). 몹 체력은 사냥터 평균입니다.</li>
<li>도술 수는 현재 빌드를 유지합니다. 궁극기는 지금 것과 체크한 계열의 궁극기를 모두 시도하고, 바꾸면 그 계열 도술 3개를 넣어 기본 장착 조건을 지킵니다. 선택한 계열의 일반 도술로 구성·사용 순서·기본 장착을 바꿉니다.</li>
<li>회복·보호막은 도술 설명의 공격력·최대 체력 비율과 고정값으로 계산합니다. 조건부 효과는 시뮬레이션에서 조건이 성립한 적중만 셉니다.</li>
<li>보호막은 지속시간이 지나면 사라지고, 같은 버프가 다시 걸리면 중복 규칙(교체·중첩)에 따라 남은 양이 버려집니다. 받는 피해가 일정하게 들어온다고 보고 받는 피해 감소 → 먼저 끝나는 보호막 순으로 막습니다.</li>
<li>받는 피해 감소는 버프 사전에서 지속시간이 하나로 확정될 때만 유지율로 계산합니다. 방어력 증가는 공식이 없어 제외합니다.</li>
<li>사냥 실측은 받는 피해 = 현재 빌드의 회복·보호막 흡수 + 자연 회복 − 순 체력 변화로 역산하며, 흡수량이 받는 피해에 따라 달라지므로 값이 수렴할 때까지 반복합니다. 방어력·회피는 실측값에 이미 들어 있습니다.</li>
<li>목표 사냥터가 측정 사냥터와 다르면 출현 지점 수로 가중한 몬스터 평균 공격력의 비율만큼 받는 피해를 늘리거나 줄입니다(추정). 동시에 붙는 몹 수와 공격 주기는 같다고 봅니다.</li>
<li>탐색은 ${f(ITERATIONS)}회 진행하고, 상위 후보를 4개 배치 × 60·120·180초로 다시 계산해 가장 나쁜 값으로 판정합니다.</li>
<li>출혈·조건부 피해·방어력 감소·궁극기 증폭, 몹이 다가오는 시간과 재출현 대기는 빠져 있습니다. 결과는 실제 사냥으로 확인하세요.</li></ul></details>
</div>`;

// Incoming damage is kept per monster: the measured build's own pull (zone density) is divided out, then the target
// zone's attack ratio and each candidate's pull scale it back up.
function evalCurrent(){
 const ctx={stats:stats(),overrides:settings.overrides,profile:SEARCH_PROFILE,horizon:180};
 const measuring=settings.mode==='measure',from=measuring?zoneById(settings.zoneFrom):null,to=zoneById(settings.zoneTo)||from;
 const base=O.evaluate(D,build,D.baseSlots,{...ctx,zone:from||to,keepRun:true});if(!base.valid)return {valid:false,issue:base.issue};
 let measured=null,perMob=null,how=null,error=null;
 if(!measuring){const v=num(settings.incoming);if(!to)error='목표 사냥터를 고르세요. 몹 밀도와 체력으로 동시에 붙는 몹 수를 계산합니다.';else if(v>0){perMob=v;how='입력';}else error='몹 1마리에게 받는 분당 피해를 입력하세요.';}
 else{
  const m=settings.measure;how='실측';
  if(!from)error='측정 사냥터를 고르세요. 몹 밀도와 체력으로 측정 중 동시에 붙은 몹 수를 계산합니다.';
  else if(num(m.hpEnd)>=stats().maxHp)error='끝 HP가 최대 체력에 닿아 넘친 회복을 알 수 없습니다. 최대치 전에 측정을 끝내세요.';
  else if(num(m.hpEnd)===0)error='끝 HP가 0이면 받는 피해를 알 수 없습니다. 0에 닿기 전에 측정을 끝내세요.';
  else{measured=O.calibrate({sustainAt:base.sustainAt,stats:stats(),hpStart:num(m.hpStart),hpEnd:num(m.hpEnd),seconds:num(m.seconds)});if(measured===null)error='시작 HP, 끝 HP, 측정 시간을 입력하세요.';else perMob=measured/Math.max(base.attackers,0.05);}
 }
 const scale=perMob&&from&&to&&from!==to?O.zoneScale(from,to):1,target=perMob?perMob*scale:null;
 const tctx={...ctx,zone:to,perMob:target,regenPerMin:O.regenPerMin(stats()),margin:MARGIN},r=target?O.evaluate(D,build,D.baseSlots,tctx):base;
 return {...r,verification:O.verify(D,build,D.baseSlots,target?tctx:{...ctx,zone:to}),ctx:target?tctx:null,measured,measuredAttackers:base.attackers,perMob:target,scale,how,zone:to,incomingError:error};
}
// value: whether the search can run; each build has its own need because its pull changes the damage it takes.
function needed(){
 if(!current?.valid)return {value:null,text:'현재 빌드를 계산할 수 없습니다: '+(current?.issue||'원인 미확인')};
 if(current.incomingError||!current.perMob)return {value:null,text:current.incomingError||'받는 피해를 계산할 수 없습니다.'};
 const v=current.verification,regen=O.regenPerMin(stats()),bare=v.need-MARGIN,have=v.minPerMin,left=have-bare;
 const src=current.how==='실측'?`실측 ${f(current.measured)} ÷ 평균 ${current.measuredAttackers.toFixed(2)}마리`:'입력',moved=current.scale!==1?` × 사냥터 공격력 ${current.scale.toFixed(2)}배 (추정)`:'';
 return {value:v.need,bare,have,text:`1마리당 받는 피해 분당 ${f(current.perMob)} (${src}${moved}) · ${current.zone.name}에서 현재 빌드는 평균 ${v.attackers.toFixed(2)}마리 → 받는 피해 ${f(v.incoming)} − 자연 회복 ${f(regen)} + 안전 여유 ${f(MARGIN)} = 회복·보호막 분당 ${f(v.need)} 필요`,
  status:`현재 빌드: 분당 처치 ${v.minPower.toFixed(1)}마리 · 회복·보호막 ${f(have)} · ${left>=0?'물약 없이 버팀 (+'+f(left)+')':'부족 ('+f(left)+')'}`};
}
function zoneById(id){return ZONES.find(z=>z.id===id)||null;}
function renderZone(){
 const opts=(sel,none)=>`<option value="">${none}</option>`+ZONES.map(z=>`<option value="${z.id}"${z.id===sel?' selected':''}>${esc(z.name)} · 권장 ${f(z.recommendedPower)}</option>`).join('');
 q('#opt-zone-from').innerHTML=opts(settings.zoneFrom,'선택 안 함');q('#opt-zone-to').innerHTML=opts(settings.zoneTo,settings.mode==='measure'?'측정한 곳과 같음':'선택 안 함');q('#opt-power').value=settings.power;
 q('#opt-zone-from').value=settings.zoneFrom;q('#opt-zone-to').value=settings.zoneTo;
 const measuring=settings.mode==='measure',from=measuring?O.zoneSummary(zoneById(settings.zoneFrom)):null,to=O.zoneSummary(zoneById(settings.zoneTo))||from;
 q('#opt-zone').classList.toggle('opt-warning',false);
 if(!ZONES.length){q('#opt-zone').textContent='사냥터 자료(kkaebi-gg/hunting.js)를 불러오지 못했습니다.';return;}
 if(!to){q('#opt-zone').textContent=measuring?'다른 사냥터에서 사냥할 계획이면 측정 사냥터와 목표 사냥터를 고르세요. 몬스터 공격력 비율로 받는 피해를 환산합니다.':'목표 사냥터를 고르면 몬스터 능력치와 권장 전투력을 보여 줍니다.';return;}
 const power=num(settings.power),ratio=power>0?power/to.recommendedPower:null;
 const parts=[`${to.name} · 권장 전투력 ${f(to.recommendedPower)}`+(ratio?` (내 전투력 ${Math.round(ratio*100)}%${ratio<1?' · 부족':''})`:''),`몬스터 ${to.monsters}종 Lv ${to.levels} · 평균 체력 ${f(to.hp)} · 평균 공격력 ${f(to.attack)}`];
 if(from&&from.id!==to.id)parts.push(`${from.name} 대비 공격력 ${(to.attack/from.attack).toFixed(2)}배로 받는 피해를 환산 (방어 공식 미공개라 추정)`);
 else if(measuring&&!from&&settings.zoneTo)parts.push('측정 사냥터를 고르면 받는 피해를 환산합니다');
 q('#opt-zone').textContent=parts.join(' · ');q('#opt-zone').classList.toggle('opt-warning',!!ratio&&ratio<1);
}
function missingStats(){
 const fams=settings.families||familiesOf(build),list=O.pool(D,build,{families:fams}).flatMap(id=>O.sources(byId(id)).sources).filter(s=>!(Number(settings.overrides[s.key])>0));
 const need=O.needsStats(list),st=stats(),miss=[];if(need.maxHp&&!(st.maxHp>0))miss.push('최대 체력');if(need.attack&&!(st.attack>0))miss.push('공격력');return miss;
}
function renderInputs(){
 q('#opt-attack').value=settings.stats.attack;q('#opt-maxhp').value=settings.stats.maxHp;q('#opt-regen').value=settings.stats.regen;
 host.querySelectorAll('[name="opt-mode"]').forEach(x=>x.checked=x.value===settings.mode);
 q('#opt-incoming').value=settings.incoming;q('#opt-hp-start').value=settings.measure.hpStart;q('#opt-hp-end').value=settings.measure.hpEnd;q('#opt-seconds').value=settings.measure.seconds;
 q('#opt-incoming-row').hidden=settings.mode!=='incoming';q('#opt-measure-row').hidden=settings.mode!=='measure';
 const fams=settings.families||familiesOf(build);
 q('#opt-families').innerHTML=FAMILIES.map(x=>`<label><input type="checkbox" data-opt-family="${x}" ${fams.includes(x)?'checked':''}>${styleBadge({family:x})}</label>`).join('');
}
function lifeText(r){
 if(r.life===null)return r.link?.ambiguous?'후보 '+r.link.lives.map(l=>Number.isFinite(l)?l+'초':'무한').join('/'):'사전 없음';
 return (Number.isFinite(r.life)?r.life+'초':r.kind==='heal'?'즉시':'해제 전까지')+(r.dup&&Number.isFinite(r.life)?' · '+(ruleText[r.dup]||r.dup):'');
}
function sourceRow(r){
 const kind={heal:'회복',shield:'보호막',reduce:'받는 피해 감소'}[r.kind];
 const formula=r.kind==='reduce'?`받는 피해 ${r.reducePct}%`:[r.atkPct?`공격력 ${r.atkPct}%`:'',r.hpPct?`최대 체력 ${r.hpPct}%`:'',r.flat?f(r.flat):''].filter(Boolean).join(' + ')+(r.times>1?` × ${r.times}회`:'');
 const input=r.kind==='reduce'?'—':`<input type="number" min="0" data-opt-override="${r.key}" value="${esc(settings.overrides[r.key]??'')}" placeholder="${f(r.each/r.times)}" aria-label="${esc(r.name)} 실측 1회량">`;
 const shown=r.perMin===null?'받는 피해 입력 시':f(r.perMin),wasted=r.full&&r.perMin!==null&&r.perMin<r.full-0.5?`<small>${Math.round((1-r.perMin/r.full)*100)}% 소멸·교체</small>`:'';
 return `<tr><td><span class="opt-skill-name">${icon(byId(r.skillId))}<b>${esc(r.name)}</b></span></td><td>${kind}</td><td>${r.condition?`${esc(r.condition.effect)} ${r.condition.scope==='enemy'?'대상':'보유'} 시 적중`:'시전마다'}</td><td>${esc(formula)}<small>${r.each!==null&&r.each!==undefined?f(r.each)+(r.overridden?' · 실측':''):''}</small></td><td>${input}</td><td>${esc(lifeText(r))}</td><td>${r.triggers}</td><td>${r.full===null?'—':f(r.full)}</td><td>${shown}${wasted}</td></tr>`;
}
// The planner keeps base slots valid on its own; a build that is still blocked (e.g. fewer than 3 family skills) is fixed in the planner.
function renderValidation(){
 const box=q('#opt-validation');if(current?.valid!==false){box.hidden=true;box.innerHTML='';return;}
 box.hidden=false;box.innerHTML='<strong>현재 빌드를 계산할 수 없습니다.</strong><p>'+esc(current.issue||'')+'</p><button data-tab="explore">순서 구성에서 고치기</button>';
}
function renderCurrent(){
 renderValidation();
 if(!current?.valid){q('#opt-sources').innerHTML=`<tr><td colspan="9" class="opt-warning">${esc(current?.issue||'계산 불가')}</td></tr>`;q('#opt-current-total').textContent='';q('#opt-unquantified').innerHTML='';return;}
 q('#opt-sources').innerHTML=current.rows.map(sourceRow).join('')||'<tr><td colspan="9">회복·보호막 도술이 없습니다.</td></tr>';
 const v=current.verification;q('#opt-current-total').textContent=`분당 반영 ${f(current.perMin)}${current.modeled?` (최대 ${f(current.full)})`:''} · 모든 배치·구간 최저 ${v.valid?f(v.minPerMin):'—'} · 직접 피해 계수 ${f(current.coefficient)}`;
 const seen=new Set();q('#opt-unquantified').innerHTML=current.unquantified.filter(u=>!seen.has(u.skillId+u.label)&&seen.add(u.skillId+u.label)).map(u=>`<li><b>${esc(byId(u.skillId).name)}</b> ${esc(u.label)} · ${esc(u.reason)} → 계산 제외</li>`).join('');
}
function renderData(){
 const meta=KK?.snapshot?.meta,rep=KK?.report;
 q('#opt-data-text').textContent=meta?`깨비지지 자료 · 원본 ${(meta.sources?.skills?.version||'').split('/')[1]||'—'} · 수집 ${new Date(meta.fetchedAt).toLocaleString('ko-KR')} · 엔진 반영 변경 ${rep?.changes?.length||0}건`:'깨비지지 고정본이 없습니다. 동기화하면 버프 지속시간·최신 수치를 반영합니다.';
}
function renderNeed(){
 const st=stats(),miss=missingStats(),n=needed();
 q('#opt-stats-note').textContent=miss.length?`${miss.join('·')}이 필요합니다. 회복·보호막 수치가 이 값에 비례합니다.`:`자연 회복 분당 ${f(O.regenPerMin(st))} (전투 중 ${REGEN_PERIOD}초마다)`;
 q('#opt-need').textContent=n.text+(n.status?' · '+n.status:'');q('#opt-need').classList.toggle('opt-warning',n.value===null||n.have<n.bare);
 const ult=build.map(byId).find(s=>s?.ultimate);q('#opt-ultimate').textContent=ult?`궁극기는 지금의 ${ult.name}과 체크한 계열의 궁극기를 모두 시도합니다. 궁극기를 바꾸면 그 계열 도술 3개를 넣고 기본 장착 조건을 맞춥니다.`:'궁극기가 없으면 일반 도술만 탐색합니다.';
 q('#opt-run').disabled=!!search||!current?.valid||n.value===null||miss.length>0;
 if(lastResults)q('#opt-stale').hidden=resultContext===key();
}
function key(){return JSON.stringify([build,D.baseSlots,settings]);}
function sync(force){
 const empty=!build.length;q('#opt-empty').hidden=!empty;q('#opt-work').hidden=empty;renderData();
 q('#opt-build').innerHTML=strip(build);
 q('#opt-equipment').textContent=build.length?'기본 장착: '+(D.baseSlots.map(id=>byId(id)?.name).join(' · ')||'없음'):'';
 if(empty)return;
 const k=key();if(!force&&k===context)return;context=k;
 current=evalCurrent();renderInputs();renderZone();renderCurrent();renderNeed();
}
function recalc(){current=evalCurrent();renderCurrent();renderNeed();}
function stop(message){clearTimeout(timer);search=null;q('#opt-cancel').hidden=true;q('#opt-progress').hidden=true;if(message)q('#opt-status').textContent=message;renderNeed();}
function run(){
 const n=needed();if(n.value===null)return;const fams=settings.families||familiesOf(build);
 search=O.createSearch(D,{ids:[...build],baseSlots:[...D.baseSlots]},{...current.ctx,families:fams,iterations:ITERATIONS,seed:20261018});
 resultContext=key();q('#opt-cancel').hidden=false;q('#opt-progress').hidden=false;q('#opt-run').disabled=true;q('#opt-status').textContent=`후보 도술 ${search.pool.length}개에서 탐색 중`;
 // A hidden page gets about one timer per second, so it works in longer slices to keep going in the background.
 const tick=()=>{if(!search)return;const p=search.step(document.hidden?800:40);q('#opt-progress').value=p.done/p.total;q('#opt-status').textContent=`${f(p.done)} / ${f(p.total)}회 · 버티는 구성 ${f(p.feasible)}개`;
  if(!p.finished){timer=setTimeout(tick,0);return;}
  q('#opt-status').textContent='상위 후보를 모든 배치·구간에서 다시 계산하는 중';timer=setTimeout(()=>{const s=search;if(!s)return;lastResults={...s.grouped(GROUP_SIZE),start:current};if(!lastResults.similar.length&&!lastResults.different.length&&lastResults.closest?.[0]){const c=lastResults.closest[0];lastResults.improve=O.improvements(D,c.ids,c.baseSlots,current.ctx,{zones:ZONES});}stop(`완료 · ${f(p.evaluated)}개 구성 계산`);renderResults();},0);};
 timer=setTimeout(tick,0);
}
const power=c=>{const base=lastResults.start.verification.minPower;return base?(c.verification.minPower/base-1)*100:0;};
const pct=x=>(x>=0?'+':'')+x.toFixed(1)+'%';
// Room against the real need (the safety margin is a search requirement, not damage taken).
const left=c=>c.verification.margin+MARGIN;
const kills=n=>n.toFixed(1)+'마리';
const same=(a,b)=>a.ids.join()===b.ids.join()&&a.baseSlots.join()===b.baseSlots.join();
// The recommendation is the best of both groups; the rest are listed by group (similar to the current build, or different).
const better=(a,b)=>!b||a.verification.minPower>b.verification.minPower||(a.verification.minPower===b.verification.minPower&&a.verification.margin>b.verification.margin);
function picks(){
 const {similar,different}=lastResults,rec=[similar[0],different[0]].filter(Boolean).reduce((b,c)=>better(c,b)?c:b,null);if(!rec)return [];
 const label=(c,group,n)=>(group==='similar'?'비슷 ':'다른 ')+n;
 return [{label:'추천',c:rec,group:similar.includes(rec)?'similar':'different'},
  ...similar.filter(c=>c!==rec).map((c,i)=>({label:label(c,'similar',i+1),c,group:'similar'})),
  ...different.filter(c=>c!==rec).map((c,i)=>({label:label(c,'different',i+1),c,group:'different'}))];
}
// One line on why the build is better: why each new skill is in, why the order moved, then sustain, pull and room.
// Reasons come from the data: effects a skill applies (buffs/debuffs) and effects other skills need (conditions),
// checked against trigger counts from the same simulation (target zone, 180 s) for the current and the new build.
const whyCache=new Map();
function detail(c){const k=c.ids.join()+'|'+c.baseSlots.join();if(!whyCache.has(k))whyCache.set(k,O.evaluate(D,c.ids,c.baseSlots,lastResults.start.ctx||{stats:stats(),overrides:settings.overrides,profile:SEARCH_PROFILE,horizon:180}));return whyCache.get(k);}
const gives=s=>[...(s.buffs||[]),...(s.debuffs||[])];
// Korean particles follow the last syllable: 을/를, 이/가, and 으로/로 (ㄹ-final words take 로).
function josa(word,withFinal,without){const c=String(word).replace(/\([^)]*\)$/,'').replace(/[^가-힣]+$/,'').slice(-1),code=c?c.charCodeAt(0)-0xAC00:-1,fin=code>=0&&code<11172?code%28:0;if(without==='로')return word+(fin&&fin!==8?'으로':'로');return word+(fin?withFinal:without);}
const kindName={heal:'회복',shield:'보호막',reduce:'피해 감소'};
function triggerCounts(r){const m={};for(const x of r?.rows||[]){const k=x.name+' '+kindName[x.kind];m[k]=(m[k]||0)+x.triggers;}return m;}
function whyAdded(sk,ids,rows){
 const others=ids.map(byId).filter(x=>x&&x!==sk);
 // 1. It applies an effect another skill in the build needs.
 for(const e of gives(sk)){const dep=others.find(o=>(o.conditions||[]).some(c=>c.effect===e));if(dep){const c=dep.conditions.find(c=>c.effect===e);return `${josa(e,'을','를')} 걸어 ${dep.name} ${c.result} 발동`;}}
 // 2. It uses an effect the build already applies.
 for(const c of sk.conditions||[]){const src=others.find(o=>gives(o).includes(c.effect));if(src)return `${src.name}의 ${josa(c.effect,'으로','로')} ${c.result}`;}
 // 3. It carries its own heal or shield.
 const own=rows.filter(r=>r.name===sk.name&&r.perMin>0).reduce((a,r)=>a+r.perMin,0);if(own>0)return `회복·보호막 분당 ${f(own)}`;
 // 4. It simply hits hard.
 const coef=O.castCoefficient(sk),cd=Number(sk.basic?.cooldown)||0;if(coef>0)return `피해 계수 ${Math.round(coef)}%·쿨 ${cd}초`;
 return '보조';
}
function whyOrder(c,cur,next){
 const was=build.filter(id=>c.ids.includes(id)),now=c.ids.filter(id=>build.includes(id));if(was.join()===now.join())return null;
 const at=(l,id)=>l.indexOf(id),before=(l,x,y)=>at(l,x)<at(l,y),t0=triggerCounts(cur),t1=triggerCounts(next);
 // 1. An effect provider moved ahead of the skill that needs it, and that skill now triggers more often.
 for(const p of now.map(byId))for(const e of gives(p))for(const d of now.map(byId)){
  if(d===p||!(d.conditions||[]).some(x=>x.effect===e)||before(was,p.id,d.id)||!before(now,p.id,d.id))continue;
  const label=Object.keys(t1).find(k=>k.startsWith(d.name+' '));
  if(label&&(t1[label]||0)>(t0[label]||0))return `${josa(p.name+'('+e+')','을','를')} ${d.name}보다 앞에 둬 ${label} ${t0[label]??0}→${t1[label]}회`;
 }
 // 2. Less time waiting for cooldowns over the same 180 s.
 const moved=now.map(id=>({id,shift:at(was,id)-at(now,id)})).filter(x=>x.shift).sort((a,b)=>Math.abs(b.shift)-Math.abs(a.shift)).slice(0,2);
 const list=moved.map(x=>`${byId(x.id).name} ${at(was,x.id)+1}→${at(now,x.id)+1}번째`).join('·');
 if(Number.isFinite(cur.idle)&&Number.isFinite(next.idle)&&cur.idle-next.idle>=0.5)return `${list}로 쿨타임 대기 ${cur.idle.toFixed(1)}→${next.idle.toFixed(1)}초${next.casts>cur.casts?`·시전 ${cur.casts}→${next.casts}회`:''} (180초 기준)`;
 // 3. Otherwise the moves and the sustain triggers they changed.
 const changed=Object.keys(t1).filter(k=>t0[k]!==undefined&&t0[k]!==t1[k]).slice(0,2).map(k=>`${k} ${t0[k]}→${t1[k]}회`);
 return list+(changed.length?' → '+changed.join(', '):' (발동·대기 변화 없음)');
}
function summary(c){
 const normal=l=>l.map(byId).filter(s=>s&&!s.ultimate),added=normal(c.ids.filter(id=>!build.includes(id))),removed=normal(build.filter(id=>!c.ids.includes(id))),names=l=>l.map(s=>s.name).join('·');
 const oldUlt=build.map(byId).find(s=>s?.ultimate),newUlt=c.ids.map(byId).find(s=>s?.ultimate),cur=lastResults.start,next=detail(c),parts=[];
 if(oldUlt&&newUlt&&oldUlt!==newUlt)parts.push(`궁극기 ${oldUlt.name} → ${newUlt.name}`);
 if(added.length)parts.push(`${names(removed)} 빼고 `+added.map(sk=>`${sk.name}(${whyAdded(sk,c.ids,next.rows||[])})`).join('·')+' 추가');
 const order=whyOrder(c,cur,next);if(order)parts.push('순서: '+order);
 if(!added.length&&!order&&!parts.length)parts.push('도술·순서 그대로, 기본 장착만 바꿈');
 const sustainOf=r=>{const m={};for(const x of r?.rows||[])if(x.perMin>0)m[x.name]=(m[x.name]||0)+x.perMin;return m;},was=sustainOf(cur);
 const lost=removed.filter(s=>was[s.name]);if(lost.length)parts.push(`${names(lost)}의 회복·보호막(분당 ${f(lost.reduce((a,s)=>a+was[s.name],0))})을 대신 채움`);
 if(c.verification.attackers>1.05)parts.push(`범위로 평균 ${c.verification.attackers.toFixed(1)}마리 몰이`);
 const l=left(c);parts.push(l<2000?'여유 빠듯':l>=5000?'여유 넉넉':'여유 보통');
 return parts.join(' · ');
}
const changeText=c=>c.changes?`도술 ${c.changes}개 교체`:'순서·장착만 변경';
// Every build on this screen uses the same tiles; skills missing from `compare` (the current build) are outlined as new.
function strip(ids,compare){return ids.map((id,i)=>`<span class="${[compare&&!compare.includes(id)?'opt-new':'',byId(id)?.ultimate?'opt-ult':''].join(' ').trim()}"><small>${String(i+1).padStart(2,'0')}</small>${icon(byId(id))}<b>${esc(byId(id).name)}</b>${styleBadge(byId(id))}</span>`).join('');}
const tiles=c=>strip(c.ids,build);
function card(c){
 const start={ids:build,baseSlots:D.baseSlots},unchanged=same(c,start),l=left(c);
 return `<div class="opt-card-head"><h2>추천 빌드</h2><span class="opt-verdict ${l>=0?'ok':'bad'}">${l>=0?'물약 없이 버팀':'부족'} · 분당 ${signed(l)}</span></div>
<div class="opt-metrics"><div><small>스킬 파워 · ${esc(lastResults.start.zone.name)} 분당 처치 (현재 대비)</small><b>${pct(power(c))}</b><span>분당 ${kills(lastResults.start.verification.minPower)} → ${kills(c.verification.minPower)}</span></div>
<div><small>분당 회복·보호막 (가장 나쁜 배치)</small><b>${f(c.verification.minPerMin)}</b><span>동시에 붙는 몹 평균 ${c.verification.attackers.toFixed(2)}마리 · 받는 피해 ${f(c.verification.incoming)} · 필요 ${f(c.verification.need-MARGIN)}</span></div></div>
${unchanged?'<p class="opt-caption">현재 빌드가 이미 이 조건에서 가장 강합니다.</p>':''}
<p class="opt-summary">${esc(summary(c))}</p>
<div class="opt-build opt-card-build">${tiles(c)}</div><p class="opt-caption">${changeText(c)} · 기본 장착: ${c.baseSlots.map(id=>esc(byId(id).name)).join(' · ')} · <span class="opt-new">초록 테두리</span>는 새로 들어온 도술, <span class="opt-ult-key">보라 칸</span>은 궁극기</p>
<div class="opt-card-actions"><button class="primary" data-opt-apply="0"${unchanged?' disabled':''}>이 빌드 적용</button><button data-opt-json="0">JSON 저장</button></div>`;
}
function row(label,c,i){
 return `<article class="opt-alt"><div class="opt-alt-head"><b>${label}</b><small>${changeText(c)}</small><span>스킬 파워 <strong>${pct(power(c))}</strong> <small>(분당 ${kills(c.verification.minPower)})</small></span><span>몹 평균 <strong>${c.verification.attackers.toFixed(2)}</strong>마리</span><span class="${left(c)<MARGIN?'opt-warning':''}">분당 여유 <strong>${signed(left(c))}</strong></span><span class="opt-alt-actions"><button data-opt-apply="${i}">적용</button><button data-opt-json="${i}">JSON</button></span></div>
<p class="opt-summary">${esc(summary(c))}</p><div class="opt-build">${tiles(c)}</div><p class="opt-caption">기본 장착: ${c.baseSlots.map(id=>esc(byId(id).name)).join(' · ')}</p></article>`;
}
// What to improve so the closest build survives: each lever on its own, as plain sentences shared by the screen and the export.
function improveLines(im){
 if(!im)return [];
 const out=[],pct=(a,b)=>Math.round((b/a-1)*100);
 out.push(im.incomingCut===null?'받는 피해: 95%를 줄여도 부족':`받는 피해 ${im.incomingCut}% 줄이기 — 1마리당 분당 ${f(im.perMob)} → ${f(im.perMob*(1-im.incomingCut/100))} (방어력·막기·회피·장비)`);
 out.push(`체력 자연 회복 ${f(im.regen.from)} → ${f(im.regen.to)} (+${f(im.regen.to-im.regen.from)})`);
 out.push(im.maxHp?`최대 체력 ${f(im.maxHp.from)} → ${f(im.maxHp.to)} (+${pct(im.maxHp.from,im.maxHp.to)}%, 최대 체력 비례 회복·보호막이 늘어남)`:'최대 체력만으로는 부족 (4배까지 계산)');
 out.push(im.attack?`공격력 ${f(im.attack.from)} → ${f(im.attack.to)} (+${pct(im.attack.from,im.attack.to)}%, 공격력 비례 회복·보호막이 늘어남)`:'공격력만으로는 부족 (4배까지 계산)');
 const zones=(im.zones||[]).slice(0,3);
 out.push(zones.length?'이 빌드로 버티는 사냥터(어려운 순): '+zones.map(z=>`${z.name}(권장 ${f(z.recommendedPower)} · 분당 처치 ${z.killsPerMin.toFixed(1)}마리)`).join(', '):'이 빌드로 버티는 사냥터가 없습니다');
 return out;
}
// Nothing survives: say how far the current build and the closest builds fall short, and show the closest one.
function noneCard(){
 const r=lastResults,v=r.start.verification,best=(r.closest||[])[0],zone=r.start.zone,power=num(settings.power);
 const ratio=zone?.recommendedPower&&power>0?` ${esc(zone.name)} 권장 전투력 ${f(zone.recommendedPower)} 대비 내 전투력 ${Math.round(power/zone.recommendedPower*100)}%입니다.`:'';
 const head=`<div class="opt-card-head"><h2>물약 없이 버티는 구성을 찾지 못했습니다</h2>${best?`<span class="opt-verdict bad">가장 근접해도 분당 ${f(-left(best))} 부족</span>`:''}</div>`;
 const why=`<p>현재 빌드는 회복·보호막 분당 ${f(v.minPerMin)}, 필요한 양은 분당 ${f(v.need-MARGIN)}입니다.${best?` 회복·보호막을 가장 많이 확보한 빌드도 분당 ${f(best.verification.minPerMin)}에 그칩니다.`:''}${ratio} 권장 전투력이 더 낮은 사냥터를 고르거나 능력치를 올린 뒤 다시 측정하세요.</p>`;
 const im=improveLines(r.improve),improve=im.length?`<h3 class="opt-closest-title">버티려면 (가장 근접한 빌드 기준 · 하나만 바꿀 때)</h3><ul class="opt-improve">${im.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
 if(!best)return head+why;
 return head+why+improve+`<h3 class="opt-closest-title">가장 근접한 빌드</h3><p class="opt-summary">${esc(summary(best))}</p><div class="opt-build opt-card-build">${tiles(best)}</div><p class="opt-caption">${changeText(best)} · 분당 처치 ${kills(best.verification.minPower)} · 몹 평균 ${best.verification.attackers.toFixed(2)}마리 · 기본 장착: ${best.baseSlots.map(id=>esc(byId(id).name)).join(' · ')}</p>`;
}
function renderResults(){
 q('#opt-results').hidden=false;q('#opt-stale').hidden=true;
 const list=picks(),rest=list.slice(1);
 q('#opt-card').innerHTML=list.length?card(list[0].c):noneCard();
 q('#opt-card').classList.toggle('opt-card-empty',!list.length);
 // Similar builds (few skills changed) and different combinations are separate sections, each ranked on its own.
 const r=lastResults;q('#opt-found').textContent=list.length?`버티는 구성 ${f(r.feasible)}개 · 도술 조합 ${f(r.sets)}가지 중 그룹별 상위 ${GROUP_SIZE}개를 보여 줍니다.`:'';
 for(const [group,range] of [['similar',`도술 0~${r.maxChanges}개 교체`],['different',`도술 ${r.maxChanges+1}개 이상 교체`]]){
  const items=list.map((x,i)=>({...x,i})).filter(x=>x.i>0&&x.group===group);q('#opt-'+group).hidden=!list.length;
  q(`#opt-${group}-count`).textContent=`· ${range} · ${items.length}개`;
  q(`#opt-${group}-body`).innerHTML=items.map(x=>row(x.label,x.c,x.i)).join('')||'<p class="opt-caption">이 그룹에서 물약 없이 버티는 구성을 찾지 못했습니다.</p>';
 }
}
// Analysis export: a Markdown report a person can read and paste into a prompt, with the same data as JSON at the end.
function skillText(id){const s=byId(id);return `${s.name} (${s.family}${s.ultimate?' 궁극기':''} · ${s.targeting?.kind==='single'?'단일':s.damage===false?'보조':'범위'} · 쿨 ${s.basic?.cooldown??'?'}초)`;}
function sustainRows(r){return (r?.rows||[]).map(x=>({skill:x.name,kind:kindName[x.kind],condition:x.condition?`${x.condition.effect} ${x.condition.scope==='enemy'?'대상':'보유'} 시`:'시전마다',each:x.each,triggers180s:x.triggers,perMinFull:x.full,perMinAbsorbed:x.perMin,life:Number.isFinite(x.life)?x.life:null,dup:x.dup||null}));}
function exportEntry(label,group,c,isCurrent){
 const v=isCurrent?lastResults.start.verification:c.verification,ev=isCurrent?lastResults.start:detail(c),ids=isCurrent?build:c.ids,base=isCurrent?D.baseSlots:c.baseSlots;
 return {label,group,summary:isCurrent?null:summary(c),changes:isCurrent?0:c.changes,
  order:ids.map(id=>({id,name:byId(id).name,family:byId(id).family,ultimate:!!byId(id).ultimate,targeting:byId(id).targeting?.kind||null,cooldown:byId(id).basic?.cooldown??null})),
  baseSlots:base.map(id=>byId(id).name),killsPerMin:v.minPower,powerChangePct:isCurrent?0:Math.round(power(c)*10)/10,attackers:v.attackers,incomingPerMin:v.incoming,
  sustainPerMin:v.minPerMin,needPerMin:v.need-MARGIN,surplusPerMin:v.margin+MARGIN,cooldownIdle180s:ev?.idle??null,casts180s:ev?.casts??null,sustain:sustainRows(ev)};
}
function exportData(){
 const r=lastResults,list=picks(),meta=KK?.snapshot?.meta;
 return {schema:'dosul-optimizer-analysis-v1',generatedAt:new Date().toISOString(),engine:DosulSimulation.model,kkaebigg:meta?{version:meta.sources?.skills?.version||null,fetchedAt:meta.fetchedAt}:null,
  goal:'물약 없이 버티는 범위(스킬 회복·보호막 ≥ 받는 피해 − 자연 회복 + 안전 여유)에서 목표 사냥터 분당 처치 수가 가장 큰 9칸 구성',
  model:{incoming:'1마리당 받는 피해 × 동시에 붙는 몹 평균(범위 공격은 사냥터 밀도 × 범위 면적만큼 몹을 끌어옴, 선공 없음)',mPerPx:O.mPerPx,damageRate:O.damageRate,safetyMargin:MARGIN,regenPeriodSeconds:REGEN_PERIOD,search:{iterations:ITERATIONS,feasible:r.feasible,skillSets:r.sets,groupSize:GROUP_SIZE,similarMaxChanges:r.maxChanges}},
  inputs:{stats:stats(),regenPerMin:O.regenPerMin(stats()),mode:settings.mode==='measure'?'사냥 실측':'직접 입력',measure:settings.mode==='measure'?{...settings.measure,zone:zoneById(settings.zoneFrom)?.name||null,measuredIncomingPerMin:r.start.measured,measuredAttackers:r.start.measuredAttackers}:null,
   incomingPerMonster:r.start.perMob,targetZone:r.start.zone?.name||null,attackScale:r.start.scale,families:settings.families||familiesOf(build),overrides:settings.overrides},
  current:exportEntry('현재 빌드','current',null,true),
  builds:list.map(x=>exportEntry(x.label,x.label==='추천'?'recommended':x.group,x.c,false)),
  closest:list.length?[]:(r.closest||[]).map((c,i)=>exportEntry(`근접 ${i+1}`,'closest',c,false)),improve:list.length?null:r.improve||null};
}
function exportMarkdown(){
 const d=exportData(),n=v=>v===null||v===undefined?'—':typeof v==='number'?f(v):v,lines=[];
 const block=e=>{
  lines.push(`### ${e.group==='current'?e.label:e.group==='recommended'?'추천 빌드':e.label}${e.group==='current'?'':` · 도술 ${e.changes}개 교체`}`);
  if(e.summary)lines.push(`- 요약: ${e.summary}`);
  lines.push(`- 분당 처치 ${e.killsPerMin.toFixed(2)}마리${e.group==='current'?'':` (현재 대비 ${e.powerChangePct>=0?'+':''}${e.powerChangePct}%)`} · 동시에 붙는 몹 평균 ${e.attackers.toFixed(2)}마리`);
  lines.push(`- 받는 피해 분당 ${n(e.incomingPerMin)} · 회복·보호막 분당 ${n(e.sustainPerMin)} (필요 ${n(e.needPerMin)}, 여유 ${e.surplusPerMin>=0?'+':''}${n(e.surplusPerMin)}) · 쿨타임 대기 ${e.cooldownIdle180s??'—'}초/180초 · 시전 ${e.casts180s??'—'}회`);
  lines.push(`- 사용 순서: ${e.order.map((o,i)=>`${i+1}. ${skillText(o.id)}`).join(' → ')}`);
  lines.push(`- 기본 장착: ${e.baseSlots.join(' · ')}`);
  if(e.sustain.length){lines.push('','| 도술 | 효과 | 발동 조건 | 1회량 | 180초 발동 | 분당 최대 | 분당 흡수 |','|---|---|---|---:|---:|---:|---:|');for(const x of e.sustain)lines.push(`| ${x.skill} | ${x.kind} | ${x.condition} | ${n(x.each)} | ${x.triggers180s} | ${n(x.perMinFull)} | ${n(x.perMinAbsorbed)} |`);}
  lines.push('');
 };
 const i=d.inputs;
 lines.push('# 도술 빌드 최적화 결과 (분석용)','',`생성 ${new Date(d.generatedAt).toLocaleString('ko-KR')} · 엔진 ${d.engine}${d.kkaebigg?` · 깨비지지 ${d.kkaebigg.version||''}`:''}`,'',
  '## 목표와 계산 방식','',`- 목표: ${d.goal}`,`- 받는 피해: ${d.model.incoming}`,
  `- 보정값: 지도 1px ≈ ${d.model.mPerPx}m, 실제 피해 ≈ 계수 × 공격력 × ${d.model.damageRate}, 안전 여유 분당 ${f(d.model.safetyMargin)}, 자연 회복 ${d.model.regenPeriodSeconds}초 주기`,
  `- 탐색: ${f(d.model.search.iterations)}회 기준, 버티는 구성 ${f(d.model.search.feasible)}개 · 도술 조합 ${f(d.model.search.skillSets)}가지 중 그룹별 상위 ${d.model.search.groupSize}개 (비슷한 빌드 = 도술 0~${d.model.search.similarMaxChanges}개 교체)`,
  '- 한계: 출혈·조건부 피해·방어력 감소·궁극기 증폭, 몹이 다가오는 시간과 재출현은 빠져 있고, 보호막 흡수량은 게임에서 검증 전입니다.','',
  '## 내 캐릭터와 사냥 기준','',`- 공격력 ${n(i.stats.attack)} · 최대 체력 ${n(i.stats.maxHp)} · 체력 자연 회복 ${n(i.stats.regen)} (분당 ${n(i.regenPerMin)})`,
  i.measure?`- 사냥 실측: ${i.measure.zone||'—'}에서 HP ${n(Number(i.measure.hpStart))} → ${n(Number(i.measure.hpEnd))}, ${i.measure.seconds}초 → 받는 피해 분당 ${n(i.measure.measuredIncomingPerMin)} (평균 ${Number(i.measure.measuredAttackers).toFixed(2)}마리)`:`- 받는 피해 직접 입력`,
  `- 1마리당 받는 피해 분당 ${n(i.incomingPerMonster)} · 목표 사냥터 ${i.targetZone||'—'}${i.attackScale!==1?` (공격력 ${Number(i.attackScale).toFixed(2)}배 환산)`:''}`,`- 쓸 수 있는 계열: ${i.families.join(', ')}`,'',
  '## 현재 빌드','');
 block(d.current);
 if(!d.builds.length)lines.push('## 결과: 물약 없이 버티는 구성 없음','',d.closest.length?`- 가장 근접한 빌드도 분당 ${n(-d.closest[0].surplusPerMin)} 부족합니다(회복·보호막 분당 ${n(d.closest[0].sustainPerMin)} / 필요 ${n(d.closest[0].needPerMin)}).`:'- 탐색한 구성 중 계산 가능한 것이 없습니다.','');
 if(d.improve){lines.push('## 버티려면 무엇을 개선해야 하나','',`가장 근접한 빌드(근접 1) 기준, 하나만 바꿀 때 필요한 값입니다. 가장 나쁜 배치(${d.improve.profile} · ${d.improve.horizon}초)에서 분당 ${n(d.improve.deficit)} 부족합니다.`,'',...improveLines(d.improve).map(x=>'- '+x),'');}
 if(d.closest.length){lines.push('## 가장 근접한 빌드 (버티지 못함)','');d.closest.forEach(block);}
 for(const [g,title] of [['recommended','추천 빌드'],['similar','비슷한 빌드'],['different','다른 도술 조합']]){const items=d.builds.filter(b=>b.group===g);if(!items.length)continue;lines.push(`## ${title}`,'');items.forEach(block);}
 lines.push('## 분석 요청 예시','','- 추천 빌드가 실제 사냥에서 물약 없이 버틸지, 가장 큰 위험 요소(검증 안 된 보호막, 범위 몰이 등)를 짚어 줘.',
  '- 비슷한 빌드와 다른 도술 조합 중 처치와 여유의 균형이 가장 좋은 빌드를 고르고 이유를 설명해 줘.','- 다음 실측에서 무엇을 재면 이 결과를 가장 많이 검증할 수 있는지 알려 줘.','',
  '## 원본 데이터 (JSON)','','도술별 회복·보호막 표는 위 Markdown에만 있습니다.','','```json',JSON.stringify({...d,current:{...d.current,sustain:undefined},builds:d.builds.map(b=>({...b,sustain:undefined}))}),'```','');
 return lines.join('\n');
}
async function exportResults(copy){
 const status=q('#opt-export-status'),text=exportMarkdown(),name=`도술-최적화-분석-${new Date().toISOString().slice(0,10)}.md`;
 if(!copy){download(name,text,'text/markdown;charset=utf-8');status.textContent=`${name} 저장`;return;}
 try{await navigator.clipboard.writeText(text);status.textContent=`분석용 텍스트를 복사했습니다 (${f(text.length)}자).`;}
 catch{status.textContent='이 화면에서는 클립보드 복사가 막혀 있습니다. .md 파일로 받아 붙여 넣으세요.';}
}
function buildJson(c){return {schema:'dosul-build-v3',name:'빌드 최적화 결과',baseSlots:c.baseSlots,skills:c.ids,skillNames:c.ids.map(id=>byId(id).name),validation:DosulSequence.validate({...D,baseSlots:c.baseSlots},c.ids),optimizer:{model:DosulSimulation.model,kkaebigg:KK?.snapshot?.meta?.sources||null,measuredIncoming:current.measured,measuredAttackers:current.measuredAttackers,incomingPerMonster:current.perMob,zones:{measured:settings.mode==='measure'?zoneById(settings.zoneFrom)?.name||null:null,target:current.zone?.name||null,attackScale:current.scale},hunt:{killsPerMin:c.verification.minPower,attackers:c.verification.attackers,incoming:c.verification.incoming,mPerPx:O.mPerPx,damageRate:O.damageRate},need:c.verification.need,safetyMargin:MARGIN,coefficient:c.verification.minCoefficient,powerChangePct:Math.round(power(c)*10)/10,sustainPerMin:c.verification.minPerMin,surplusPerMin:left(c),margin:c.verification.margin,stats:stats(),settings}};}
// The site sends no CORS headers, so the local server fetches kkaebigg.com; a reload applies the new snapshot.
async function syncKkaebigg(){
 const btn=q('#opt-sync'),status=q('#opt-sync-status');btn.disabled=true;status.textContent='깨비지지에서 받아오는 중…';
 try{
  const res=await fetch('api/kkaebigg/sync',{method:'POST'});
  if(res.status===404||res.status===405){status.textContent=/^(127\.0\.0\.1|localhost)$/.test(location.hostname)?'실행 중인 로컬 서버가 이전 버전입니다. 바탕화면 아이콘으로 다시 실행하거나 npm run dev를 재시작하세요.':'동기화는 로컬 실행(npm run dev 또는 바탕화면 아이콘)에서만 됩니다.';return;}
  const body=await res.json();if(!body.ok){status.textContent='동기화 실패: '+body.error+' · 기존 고정본을 유지합니다.';return;}
  const n=body.changes.skills.length,list=body.changes.skills.slice(0,5).map(s=>s.name+' '+s.change).join(', ');
  status.innerHTML=`완료 · 도술 변경 ${n}개${n?' ('+esc(list)+(n>5?' …':'')+')':''} · <button id="opt-reload">새로고침해서 적용</button>`;
 }catch(e){status.textContent='동기화 서버에 연결하지 못했습니다: '+e.message;}
 finally{btn.disabled=false;}
}

host.addEventListener('input',e=>{
 const t=e.target,map={'opt-attack':'attack','opt-maxhp':'maxHp','opt-regen':'regen'};
 if(map[t.id])settings.stats[map[t.id]]=t.value;else if(t.id==='opt-incoming')settings.incoming=t.value;else if(t.id==='opt-power'){settings.power=t.value;save();renderZone();return;}
 else if(t.id==='opt-hp-start')settings.measure.hpStart=t.value;else if(t.id==='opt-hp-end')settings.measure.hpEnd=t.value;else if(t.id==='opt-seconds')settings.measure.seconds=t.value;
 else if(t.dataset.optOverride){if(t.value==='')delete settings.overrides[t.dataset.optOverride];else settings.overrides[t.dataset.optOverride]=t.value;}
 else return;
 save();renderNeed();
});
host.addEventListener('change',e=>{
 const t=e.target;
 // Recalculating runs 13+ simulations and rebuilds the override inputs, so wait until the value is committed.
 if(['opt-attack','opt-maxhp','opt-regen','opt-incoming','opt-hp-start','opt-hp-end','opt-seconds'].includes(t.id)||t.dataset.optOverride){recalc();return;}
 if(t.name==='opt-mode'){settings.mode=t.value;save();renderInputs();renderZone();recalc();return;}
 if(t.id==='opt-zone-from'||t.id==='opt-zone-to'){settings[t.id==='opt-zone-from'?'zoneFrom':'zoneTo']=t.value;save();renderZone();recalc();return;}
 if(t.dataset.optFamily){settings.families=[...host.querySelectorAll('[data-opt-family]')].filter(x=>x.checked).map(x=>x.dataset.optFamily);}
 else return;
 save();renderNeed();
});
host.addEventListener('click',e=>{
 if(e.target.closest('#opt-sync'))syncKkaebigg();
 if(e.target.closest('#opt-reload'))location.reload();
 if(e.target.closest('#opt-run'))run();
 if(e.target.closest('#opt-cancel'))stop('중지했습니다.');
 if(lastResults&&e.target.closest('#opt-export-md'))exportResults(false);
 if(lastResults&&e.target.closest('#opt-export-copy'))exportResults(true);
 const apply=e.target.closest('[data-opt-apply]'),json=e.target.closest('[data-opt-json]');
 if(apply&&lastResults){const c=picks()[+apply.dataset.optApply].c;remember();commit([...c.ids],Math.min(c.ids.length,8),[...c.baseSlots]);toast('최적화 결과를 사용 순서와 기본 장착에 적용했습니다. 되돌리기 가능');}
 if(json&&lastResults){const c=picks()[+json.dataset.optJson].c;download('도술-최적화-빌드.json',JSON.stringify(buildJson(c),null,2));}
});
document.addEventListener('click',e=>{if(e.target.closest('[data-tab="optimizer"]'))sync();else if(e.target.closest('[data-tab]')&&search)stop('다른 화면으로 이동해 중지했습니다.');});
window.syncBuildOptimizer=()=>{if(host.classList.contains('active'))sync();else context='';};
// The current-build verification runs 12 simulations, so wait until the tab is opened.
if(host.classList.contains('active'))sync(true);
})();
