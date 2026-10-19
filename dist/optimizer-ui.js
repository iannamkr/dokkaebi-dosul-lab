(function(){
'use strict';
const O=window.DosulOptimizer,KK=window.DosulKkaebigg,ZONES=window.DOSUL_HUNTING?.zones||[],host=document.querySelector('#optimizer');if(!host||!O)return;
const FAMILIES=['절명','연타','강타','척살','저격','주술','파멸','강인','기동','헌신','기만','제압'];
// One fixed search depth and safety margin: the screen only asks for what the player can measure.
const ITERATIONS=4000,GROUP_SIZE=10,MARGIN=1000,REGEN_PERIOD=5,SEARCH_PROFILE='185547',STORE='dosul-optimizer-v1';
const q=sel=>host.querySelector(sel),f=n=>n===null||n===undefined||!Number.isFinite(n)?'—':Math.round(n).toLocaleString('ko-KR'),signed=n=>n==null?'—':(n>=0?'+':'')+f(n);
let settings={hitDamage:'',hitInterval:1.5,useUltimate:true,targetMode:'area',startMode:'current',primaryFamily:'',primaryFamilies:[],excludedFamilies:[],requiredSkills:[],requiredFamilies:[],requiredShinsik:[],stats:{attack:'',maxHp:'',regen:'',accuracy:'',criticalHit:'',criticalDamage:'',defense:'',basicEvasion:'',skillBlock:'',criticalResistance:'',skillDamageReduction:'',normalDamageUp:'',normalDamageDown:'',bossDamageUp:'',bossDamageDown:''},mode:'measure',incoming:'',measure:{hpStart:'',hpEnd:'',seconds:'',hpCapped:false},overrides:{},families:null,encounter:true,zoneFrom:'',zoneTo:'',power:''};
try{const v=JSON.parse(localStorage.getItem(STORE)||'null');if(v&&typeof v==='object')settings={...settings,...v,stats:{...settings.stats,...v.stats},measure:{...settings.measure,...v.measure},overrides:{...v.overrides}};}catch{}
settings.targetMode=settings.targetMode==='single'?'single':'area';delete settings.combatMode;
settings.hitInterval=1.5;
settings.encounter=true;
// Older saves: the "keep current sustain" mode, margin, depth and regen period are gone.
settings.primaryFamilies=[...new Set((settings.primaryFamilies?.length?settings.primaryFamilies:[settings.primaryFamily||settings.requiredFamilies?.[0]]).filter(f=>FAMILIES.includes(f)))].slice(0,2);
settings.primaryFamily=settings.primaryFamilies[0]||'';
settings.excludedFamilies=(settings.excludedFamilies||[]).filter(f=>!settings.primaryFamilies.includes(f));
if(settings.startMode==='conditions')settings.mode='incoming';else if(settings.mode!=='incoming')settings.mode='measure';delete settings.margin;delete settings.depth;delete settings.single;delete settings.stats.regenPeriod;
let activeResultGroup=0,activeResultPick=0,freeTimelineZoom=1;
let context='',current=null,search=null,timer=0,lastResults=null,resultContext='',searchWorker=null;
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(settings));}catch{}};
const num=v=>v===''||v===null||v===undefined?NaN:Number(v);
const stats=()=>({attack:num(settings.stats.attack),maxHp:num(settings.stats.maxHp),regen:num(settings.stats.regen)||0,regenPeriod:REGEN_PERIOD});
const familiesOf=ids=>[...new Set(ids.map(id=>byId(id)?.family).filter(Boolean))];

host.innerHTML=`<div class="opt-heading"><h1>자유 추천</h1><span class="opt-caption">핵심 유지 → 사냥 조건 → 추천 비교</span></div>
<section class="opt-free-step opt-core-step" aria-labelledby="opt-core-title"><header class="opt-step-heading"><div><small>STEP 01</small><h2 id="opt-core-title">유지할 핵심</h2><p>반드시 남길 도술만 잠그세요. 잠그지 않은 도술과 순서·배치는 엔진이 자유롭게 바꿉니다.</p></div><span id="opt-required-count" role="status"></span></header>
<section class="opt-target-picker" aria-labelledby="opt-target-title"><div class="opt-target-heading"><b id="opt-target-title">빌드 대상</b><small>먼저 사냥 방식을 선택하세요.</small></div><div class="opt-target-options" role="radiogroup" aria-labelledby="opt-target-title"><button type="button" data-opt-target-mode="single" aria-pressed="false"><span class="opt-target-symbol" aria-hidden="true">●</span><span><b>단일 사냥</b><small>한 마리 집중 · 자동 ON은 단일 도술만</small></span></button><button type="button" data-opt-target-mode="area" aria-pressed="false"><span class="opt-target-symbol" aria-hidden="true">◎</span><span><b>범위 사냥</b><small>여러 마리 상대 · 모든 도술 사용</small></span></button></div></section><select id="opt-target-mode" hidden aria-hidden="true"><option value="single">단일 사냥</option><option value="area">범위 사냥</option></select>
<div id="opt-core-build" class="opt-core-build" aria-label="현재 빌드 핵심 고정"></div>
<div class="opt-core-controls"><label><span>신식</span><select id="opt-required-shinsik"><option value="">엔진이 결정</option></select></label><label><span>궁극기</span><select id="opt-ultimate-policy"><option value="auto">엔진이 결정</option><option value="keep">현재 궁극기 유지</option><option value="off">사용하지 않음</option></select></label></div>
<select id="opt-start-mode" hidden aria-hidden="true"><option value="current">현재 빌드 개선</option><option value="conditions">선택 조건으로 새 빌드 만들기</option></select><input type="checkbox" id="opt-use-ultimate" hidden>
<details class="opt-advanced opt-build-advanced"><summary>고급 빌드 조건</summary><div id="opt-conditions" hidden><p>주력 계열 <small>최대 2개 · 미선택 시 엔진이 결정</small></p><div class="opt-family-choice"><div id="opt-required-families" class="opt-families"></div><span id="opt-primary-family-count" class="opt-selection-count" role="status" hidden></span></div><p>제외할 계열</p><div id="opt-excluded-families" class="opt-families"></div><p id="opt-support-scope" class="opt-caption" hidden></p><div class="opt-picker-heading" hidden><b>추가로 고정할 도술</b></div><div id="opt-skill-picker" hidden></div><div id="opt-required-chips" class="opt-families" hidden></div></div></details></section>
<section id="opt-current-scope" class="opt-panel opt-current-scope" hidden aria-labelledby="opt-scope-title"><h2 id="opt-scope-title">탐색 계열</h2><div id="opt-families" class="opt-families"></div><p id="opt-ultimate" class="opt-caption"></p></section><details id="opt-preview" class="opt-preview" hidden><summary id="opt-preview-title">현재 빌드</summary><div id="opt-build" class="opt-build"></div><div id="opt-equipment" class="opt-caption"></div><button data-opt-edit data-tab="explore">이 구성 편집</button></details><div id="opt-validation" class="opt-validation" role="alert" hidden></div>
<div id="opt-empty" hidden><b>먼저 사용할 도술을 배치하세요.</b><button data-tab="explore">도술 배치하기 →</button></div>
<div id="opt-work">
<section class="opt-free-step opt-hunt-step" aria-labelledby="opt-hunt-title"><header class="opt-step-heading"><div><small>STEP 02</small><h2 id="opt-hunt-title">사냥 조건</h2><p>캐릭터 정보와 사냥터를 확인하면 도술별 자동 사용 체력 조건을 함께 계산합니다.</p></div><span class="opt-step-purpose">체력 조건 자동 계산</span></header>
<div class="opt-condition-flow-heading"><b>설정 순서</b><span>필수 정보 2개를 확인하면 계산 준비가 끝납니다.</span></div>
<div class="opt-condition-summary"><button type="button" class="opt-summary-tile" data-open-opt-advanced><span class="opt-summary-icon" aria-hidden="true">1</span><span><small>캐릭터 정보</small><b id="opt-character-summary">정보 입력 필요</b><em>이미지 첨부·능력치 확인</em></span></button><label class="opt-summary-tile opt-zone-tile"><span class="opt-summary-icon" aria-hidden="true">2</span><span><small>사냥터 선택</small><select id="opt-zone-to" aria-label="사냥할 사냥터"></select></span></label><div class="opt-summary-tile opt-summary-result"><span class="opt-summary-icon" aria-hidden="true">3</span><span><small>적용 기준</small><b id="opt-auto-summary">현재 설정 유지</b><em>자동 조작 ON/OFF·체력 조건 보존</em></span></div></div>
<details id="opt-advanced-evaluation" class="opt-advanced opt-evaluation-advanced"><summary>세부 정보 확인·수정</summary><div class="opt-grid">
<section class="opt-panel opt-character-panel" aria-labelledby="opt-stats-title"><div class="opt-panel-heading"><span aria-hidden="true">1</span><div><h2 id="opt-stats-title">캐릭터 정보</h2><p>이미지를 첨부하고 자동 입력된 능력치를 확인하세요.</p></div></div>
<div class="opt-stat-import"><div><b>인게임 정보 이미지 첨부</b></div><label class="opt-image-upload" for="opt-stat-images"><span>이미지 선택</span><input id="opt-stat-images" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><div id="opt-stat-image-list" class="opt-stat-image-list" aria-live="polite"></div><progress id="opt-ocr-progress" max="1" value="0" hidden></progress><span id="opt-stat-import-status" role="status"></span></div>
<fieldset class="opt-stat-group opt-stat-required"><legend>계산에 직접 사용</legend><label><span>공격력</span><input id="opt-attack" type="number" min="0" inputmode="numeric"></label><label><span>최대 체력</span><input id="opt-maxhp" type="number" min="0" inputmode="numeric"></label><label><span>체력 자연 회복</span><input id="opt-regen" type="number" min="0" inputmode="numeric" placeholder="0"></label></fieldset>
<fieldset class="opt-stat-group"><legend>공격 보정 · 기록</legend><label><span>공격 정확도</span><input id="opt-accuracy" type="number" min="0" inputmode="numeric"></label><label><span>치명타 적중</span><input id="opt-critical-hit" type="number" min="0" inputmode="numeric"></label><label><span>치명타 피해 증가 (%)</span><input id="opt-critical-damage" type="number" min="0" step="0.01" inputmode="decimal"></label><label><span>일반 요귀 피해 증가 (%)</span><input id="opt-normal-damage-up" type="number" min="0" step="0.01" inputmode="decimal"></label><label><span>보스 피해 증가 (%)</span><input id="opt-boss-damage-up" type="number" min="0" step="0.01" inputmode="decimal"></label></fieldset>
<fieldset class="opt-stat-group"><legend>방어 보정 · 기록</legend><label><span>방어력</span><input id="opt-defense" type="number" min="0" inputmode="numeric"></label><label><span>기본 공격 회피</span><input id="opt-basic-evasion" type="number" min="0" inputmode="numeric"></label><label><span>도술 막기</span><input id="opt-skill-block" type="number" min="0" inputmode="numeric"></label><label><span>치명타 저항</span><input id="opt-critical-resistance" type="number" min="0" inputmode="numeric"></label><label><span>도술 공격 피해 감소 (%)</span><input id="opt-skill-damage-reduction" type="number" min="0" step="0.01" inputmode="decimal"></label><label><span>일반 요귀 피해 감소 (%)</span><input id="opt-normal-damage-down" type="number" min="0" step="0.01" inputmode="decimal"></label><label><span>보스 피해 감소 (%)</span><input id="opt-boss-damage-down" type="number" min="0" step="0.01" inputmode="decimal"></label></fieldset>
<p id="opt-stats-note" class="opt-caption"></p></section>
<section class="opt-panel opt-hunting-panel" aria-labelledby="opt-need-title"><div class="opt-panel-heading"><span aria-hidden="true">2</span><div><h2 id="opt-need-title">사냥 환경</h2><p>받는 피해 기준을 확인하세요.</p></div></div>
<div id="opt-damage-modes" class="opt-modes" role="radiogroup" aria-label="받는 피해를 정하는 방법">
<label><input type="radio" name="opt-mode" value="measure"> 사냥 실측 </label>
<label><input type="radio" name="opt-mode" value="incoming"> 받는 피해 입력</label></div>
<div id="opt-measure-row" class="opt-inline">
<label>측정 사냥터<select id="opt-zone-from" aria-label="실측한 사냥터"></select></label>
<label>시작 HP<input id="opt-hp-start" type="number" min="0" inputmode="numeric"></label><label>끝 HP<input id="opt-hp-end" type="number" min="0" inputmode="numeric"></label><label>측정 시간 (초)<input id="opt-seconds" type="number" min="1" inputmode="numeric"></label>
<label class="opt-cap-check"><input id="opt-hp-capped" type="checkbox">측정 중 최대 체력에 도달함</label><details class="opt-guide"><summary>측정 방법</summary><ul>
<li>물약 자동 사용을 끄고, 평소처럼(같은 빌드·같은 몰이 규모) 사냥합니다.</li>
<li>HP 50~70%에서 시작하고, 측정 중 최대치나 0에 닿지 않게 합니다. 최대치에 닿으면 넘친 회복을 알 수 없습니다.</li>
<li>측정 내내 전투를 이어 갑니다. 전투가 끊기면 자연 회복이 1초마다 들어와 결과가 달라집니다.</li>
<li>측정 중에는 빌드·장비를 바꾸지 않습니다. 3~5분이면 충분합니다.</li></ul></details></div>
<div id="opt-incoming-row" class="opt-inline"><label>1회 받는 피해 · 1마리<input id="opt-hit-damage" type="number" min="0" inputmode="numeric"></label><label>받는 피해 / 분 · 1마리<input id="opt-incoming" type="number" min="0" inputmode="numeric" readonly aria-readonly="true"></label><span id="opt-hit-rate" class="opt-caption"></span></div>
<div class="opt-zone"><label><span>내 전투력 <small>(선택)</small></span><input id="opt-power" type="number" min="0" inputmode="numeric"></label><p id="opt-zone" class="opt-caption"></p></div>
<p id="opt-world" hidden></p><p id="opt-need" hidden role="status"></p></section>
</div></details>
<div class="opt-run"><button id="opt-run" class="primary">새 빌드 추천</button><button id="opt-cancel" hidden>중지</button><progress id="opt-progress" max="1" value="0" hidden></progress><span id="opt-status" role="status" aria-live="polite"></span></div></section>
<section id="opt-live" hidden aria-live="polite"><h2>탐색 중 후보 <small>최종 검증 전</small></h2><div id="opt-live-builds"></div></section><section id="opt-results" hidden aria-label="최적화 결과"><p id="opt-stale" class="opt-warning" hidden>빌드나 입력이 바뀌었습니다. 아래 결과는 이전 기준입니다.</p>
<header class="opt-step-heading"><div><small>STEP 03</small><h2>추천 결과</h2><p>목표가 다른 세 가지 빌드를 비교한 뒤 하나를 선택해 적용하세요.</p></div><span id="opt-found" class="opt-caption"></span></header><div id="opt-direction-cards" class="opt-direction-cards"></div><div id="opt-result-comparison" class="opt-result-comparison"></div><section id="opt-result-timeline" class="opt-free-timeline" aria-label="자유 추천 스킬 타임라인"></section></section>
</div>`;

// Incoming damage is kept per monster: the measured build's own pull (zone density) is divided out, then the target
// zone's attack ratio and each candidate's pull scale it back up.
function searchFamilies(){return (settings.startMode==='conditions'?FAMILIES:settings.families||familiesOf(build)).filter(f=>!(settings.excludedFamilies||[]).includes(f));}
function conditions(){return {useUltimate:settings.useUltimate!==false,targetMode:settings.targetMode,requiredSkills:settings.requiredSkills||[],primaryFamilies:settings.primaryFamilies||[],primaryFamily:settings.primaryFamilies?.[0]||'',excludedFamilies:settings.excludedFamilies||[],requiredShinsik:settings.requiredShinsik||[],executionPolicy:D.executionPolicy||{}};}
function startState(){return settings.startMode==='conditions'?O.conditionSeed(D,conditions(),searchFamilies(),build):{ids:[...build],baseSlots:[...D.baseSlots]};}
const lockIcon=locked=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1.2A1.8 1.8 0 0 1 20 11.8v7.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 19.2v-7.4A1.8 1.8 0 0 1 5.8 10H7Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg><span>${locked?'고정':'자유'}</span>`;
function renderFreeSummary(){
 const st=stats(),ready=st.attack>0&&st.maxHp>0,policy=window.DosulAutoControl?.snapshot?.()||D.executionPolicy||{},disabled=(policy.disabled||[]).filter(id=>build.includes(id)).length,hp=Object.keys(policy.hpBelow||{}).filter(id=>build.includes(id)).length;
 q('#opt-character-summary').textContent=ready?`공격력 ${f(st.attack)} · 체력 ${f(st.maxHp)}`:'정보 입력 필요';
 q('#opt-auto-summary').textContent=disabled||hp?`자동 OFF ${disabled}개 · 체력 조건 ${hp}개`:'모든 도술 자동 ON';
 window.updateFreeRecommendStatus?.();
}
function renderConditions(){
 q('#opt-preview-title').textContent=settings.startMode==='conditions'?'자동 생성 시작안 · 최적화 전':'현재 빌드';q('#opt-current-scope').hidden=settings.startMode==='conditions';q('#opt-damage-modes').hidden=settings.startMode==='conditions';q('#opt-start-mode').value=settings.startMode;q('#opt-conditions').hidden=settings.startMode!=='conditions';
 q('#opt-use-ultimate').checked=settings.useUltimate!==false;
 const primary=settings.primaryFamilies||[],limitReached=primary.length>=2;
 q('#opt-required-families').innerHTML=`<label><input type="checkbox" data-primary-auto ${primary.length?'':'checked'}>엔진이 결정</label>`+FAMILIES.map(f=>`<label><input type="checkbox" data-required-family="${f}" ${primary.includes(f)?'checked':''} ${limitReached&&!primary.includes(f)?'disabled':''}>${f}</label>`).join('');
 q('#opt-primary-family-count').textContent='';
 q('#opt-excluded-families').innerHTML=FAMILIES.map(f=>`<label><input type="checkbox" data-excluded-family="${f}" ${(settings.excludedFamilies||[]).includes(f)?'checked':''} ${primary.includes(f)?'disabled':''}>${f}</label>`).join('');
 q('#opt-support-scope').textContent='';
 const chosen=searchFamilies(),fixed=settings.requiredSkills||[];
 q('#opt-required-count').textContent=`핵심 ${fixed.length}개 고정`;
 q('#opt-core-build').innerHTML=build.length?build.map((id,i)=>{const s=byId(id),locked=fixed.includes(id),off=D.executionPolicy?.disabled?.includes(id);return `<button type="button" class="opt-core-skill ${locked?'is-locked':''} ${off?'is-auto-off':''} ${s?.ultimate?'is-ultimate':''}" data-toggle-required="${esc(id)}" aria-pressed="${locked}" aria-label="${esc(s.name)} ${locked?'고정 해제':'핵심으로 고정'}"><small>${s.ultimate?'궁극기':String(i+1).padStart(2,'0')}</small><span class="opt-core-lock">${lockIcon(locked)}</span>${icon(s)}<b>${esc(s.name)}</b>${styleBadge(s)}${off?'<em>자동 OFF</em>':''}</button>`;}).join(''):'<p class="opt-core-empty">현재 빌드가 비어 있습니다. 핵심을 고정하지 않아도 새 빌드를 탐색할 수 있습니다.</p>';
 q('#opt-skill-picker').innerHTML=chosen.length?chosen.map(f=>`<section class="opt-skill-family"><h3>${esc(f)}</h3><div class="opt-skill-grid">${D.skills.filter(s=>s.family===f&&!s.ultimate).map(s=>`<button type="button" class="opt-skill-choice" data-toggle-required="${s.id}" aria-pressed="${fixed.includes(s.id)}" title="${esc(s.name)} 필수 포함 전환">${icon(s)}<span><b>${esc(s.name)}</b><small>${esc(s.targeting?.kind==='single'?'단일':s.targeting?.kind==='self'?'자신':'범위·기타')}</small></span><span class="opt-choice-mark" aria-hidden="true">${fixed.includes(s.id)?'✓':'+'}</span></button>`).join('')}</div></section>`).join(''):'<p class="opt-caption">사용 가능한 계열이 없습니다.</p>';
 q('#opt-required-chips').innerHTML='';
 q('#opt-required-shinsik').innerHTML='<option value="">엔진이 결정</option>'+chosen.map(f=>`<option value="${f}">${esc(window.DosulCombat?.rules?.[f]?.name||f)} · ${f}</option>`).join('');q('#opt-required-shinsik').value=settings.requiredShinsik?.[0]||'';
 const currentUlt=build.map(byId).find(s=>s?.ultimate),ultimatePolicy=q('#opt-ultimate-policy');ultimatePolicy.querySelector?.('option[value="keep"]')?.toggleAttribute?.('disabled',!currentUlt);ultimatePolicy.value=settings.useUltimate===false?'off':currentUlt&&fixed.includes(currentUlt.id)?'keep':'auto';
 renderFreeSummary();
}
function evalCurrent(){
 let initial;try{initial=startState();}catch(e){return {valid:false,issue:e.message};}
 const evalIds=initial.ids,evalBase=initial.baseSlots;

 const ctx={targetMode:settings.targetMode,encounter:settings.encounter===true,executionPolicy:D.executionPolicy||{},stats:stats(),overrides:settings.overrides,profile:SEARCH_PROFILE,horizon:180};
 const generating=settings.startMode==='conditions',measuring=!generating&&settings.mode==='measure',from=measuring?zoneById(settings.zoneFrom):null,to=zoneById(settings.zoneTo)||from;
 const base=O.evaluate(D,evalIds,evalBase,{...ctx,zone:from||to,keepRun:true});if(!base.valid)return {valid:false,issue:base.issue};
 let measured=null,perMob=null,how=null,error=null;
 if(!measuring&&settings.hitDamage!==''&&O.incomingFromHit(settings.hitDamage,settings.hitInterval)===null){error='1회 피해와 0보다 큰 공격 간격을 입력하세요.';}
 else if(generating&&(settings.mode==='measure'||settings.incoming===''||settings.incoming==null)){how='미평가';}
 else if(!measuring){const v=num(settings.incoming);if(!to)error='목표 사냥터를 고르세요. 몹 밀도와 체력으로 동시에 붙는 몹 수를 계산합니다.';else if(v>0){perMob=v;how='입력';}else error='몹 1마리에게 받는 분당 피해를 입력하세요.';}
 else{
  const m=settings.measure;how='HP 변화로 추정';
  if(m.hpCapped){how='최대 체력 도달 · 피해 역산 불가';}
  else if(!from)error='측정 사냥터를 고르세요. 몹 밀도와 체력으로 측정 중 동시에 붙은 몹 수를 계산합니다.';
  else if(!Number.isFinite(num(m.hpStart))||!Number.isFinite(num(m.hpEnd))||!(num(m.seconds)>0))error='시작 HP, 끝 HP, 측정 시간을 입력하세요.';
  else if(num(m.hpStart)>stats().maxHp||num(m.hpEnd)>stats().maxHp)error='측정 HP가 현재 최대 체력을 초과합니다. 측정 당시 능력치와 HP를 확인하세요.';
  else if(num(m.hpStart)<0||num(m.hpEnd)<0)error='HP는 0보다 커야 합니다.';
  else if(num(m.hpEnd)>=stats().maxHp)error='끝 HP가 최대 체력에 닿아 넘친 회복을 알 수 없습니다. 최대치 전에 측정을 끝내세요.';
  else if(num(m.hpEnd)===0)error='끝 HP가 0이면 받는 피해를 알 수 없습니다. 0에 닿기 전에 측정을 끝내세요.';
  else{measured=O.calibrate({sustainAt:base.sustainAt,stats:stats(),hpStart:num(m.hpStart),hpEnd:num(m.hpEnd),seconds:num(m.seconds)});if(measured===null)error='HP 변화와 회복량으로 받는 피해를 계산할 수 없습니다. 측정값을 확인하거나 받는 피해를 직접 입력하세요.';else perMob=measured/Math.max(base.attackers,0.05);}
 }
 const scale=perMob&&from&&to&&from!==to?O.zoneScale(from,to):1,target=perMob?perMob*scale:null;
 const tctx={...ctx,zone:to,perMob:target,regenPerMin:O.regenPerMin(stats()),margin:MARGIN},r=target?O.evaluate(D,evalIds,evalBase,tctx):base;
 return {...r,startIds:[...evalIds],startBase:[...evalBase],verification:O.verify(D,evalIds,evalBase,target?tctx:{...ctx,zone:to}),ctx:target?tctx:(generating||measuring&&settings.measure.hpCapped)?{...ctx,zone:to}:null,unassessed:(generating||measuring&&settings.measure.hpCapped)&&!target&&!error,measured,measuredAttackers:base.attackers,perMob:target,scale,how,zone:to,incomingError:error};
}
// value: whether the search can run; each build has its own need because its pull changes the damage it takes.
function needed(){
 if(!current?.valid)return {value:null,text:'현재 빌드를 계산할 수 없습니다: '+(current?.issue||'원인 미확인')};
 if(current.unassessed)return {value:null,unassessed:true,text:settings.measure.hpCapped&&settings.startMode!=='conditions'?'최대 체력 도달 · 받는 피해 역산 불가 · 공격 성능만 비교':'생존 미평가 · 받는 피해 미입력'};
 if(current.incomingError||!current.perMob)return {value:null,text:current.incomingError||'받는 피해를 계산할 수 없습니다.'};
 const v=current.verification,regen=O.regenPerMin(stats()),bare=v.need-MARGIN,have=v.minPerMin,left=have-bare;
 const src=current.how==='HP 변화로 추정'?`실측 ${f(current.measured)} ÷ 평균 ${current.measuredAttackers.toFixed(2)}마리`:'입력',moved=current.scale!==1?` × 사냥터 공격력 ${current.scale.toFixed(2)}배 (추정)`:'';
 return {value:v.need,bare,have,text:`1마리당 받는 피해 분당 ${f(current.perMob)} (${src}${moved}) · ${current.zone.name}에서 현재 빌드는 평균 ${v.attackers.toFixed(2)}마리 → 받는 피해 ${f(v.incoming)} − 자연 회복 ${f(regen)} + 안전 여유 ${f(MARGIN)} = 회복·보호막 분당 ${f(v.need)} 필요`,
  status:`현재 빌드: 분당 처치 ${v.minPower.toFixed(1)}마리 · 회복·보호막 ${f(have)} · ${left>=0?'회복·보호막 ≥ 받는 피해 (예상) (+'+f(left)+')':'부족 ('+f(left)+')'}`};
}
function zoneById(id){return ZONES.find(z=>z.id===id)||null;}
function renderZone(){
 const opts=(sel,none)=>`<option value="">${none}</option>`+ZONES.map(z=>`<option value="${z.id}"${z.id===sel?' selected':''}>${esc(z.name)} · 권장 ${f(z.recommendedPower)}</option>`).join('');
 q('#opt-zone-from').innerHTML=opts(settings.zoneFrom,'선택 안 함');q('#opt-zone-to').innerHTML=opts(settings.zoneTo,settings.mode==='measure'?'측정한 곳과 같음':'선택 안 함');q('#opt-power').value=settings.power;
 q('#opt-zone-from').value=settings.zoneFrom;q('#opt-zone-to').value=settings.zoneTo;
 const measuring=settings.mode==='measure',from=measuring?O.zoneSummary(zoneById(settings.zoneFrom)):null,to=O.zoneSummary(zoneById(settings.zoneTo))||from;
 q('#opt-zone').classList.toggle('opt-warning',false);
 if(!ZONES.length){q('#opt-zone').textContent='사냥터 자료(kkaebi-gg/hunting.js)를 불러오지 못했습니다.';return;}
 if(!to){q('#opt-zone').textContent='';return;}
 const power=num(settings.power),ratio=power>0?power/to.recommendedPower:null;
 const parts=[`${to.name} · 권장 전투력 ${f(to.recommendedPower)}`+(ratio?` (내 전투력 ${Math.round(ratio*100)}%${ratio<1?' · 부족':''})`:''),`몬스터 ${to.monsters}종 Lv ${to.levels} · 평균 체력 ${f(to.hp)} · 평균 공격력 ${f(to.attack)}`];
 if(from&&from.id!==to.id)parts.push(`${from.name} 대비 공격력 ${(to.attack/from.attack).toFixed(2)}배로 받는 피해를 환산 (방어 공식 미공개라 추정)`);
 else if(measuring&&!from&&settings.zoneTo)parts.push('측정 사냥터를 고르면 받는 피해를 환산합니다');
 q('#opt-zone').textContent=parts.join(' · ');q('#opt-zone').classList.toggle('opt-warning',!!ratio&&ratio<1);
}
function missingStats(){
 const fams=searchFamilies(),list=O.pool(D,build,{families:fams}).flatMap(id=>O.sources(byId(id)).sources).filter(s=>!(Number(settings.overrides[s.key])>0));
 const need=O.needsStats(list),st=stats(),miss=[];if(need.maxHp&&!(st.maxHp>0))miss.push('최대 체력');if(need.attack&&!(st.attack>0))miss.push('공격력');return miss;
}
function renderHitRate(){
 q('#opt-hit-damage').value=settings.hitDamage;
 q('#opt-incoming').value=settings.incoming;q('#opt-incoming').readOnly=true;
 q('#opt-hit-rate').textContent=settings.hitDamage!==''?(O.incomingFromHit(settings.hitDamage,settings.hitInterval)===null?'1회 피해와 0보다 큰 공격 간격을 입력하세요.':`${f(Number(settings.hitDamage))} × 60 ÷ ${settings.hitInterval}초 = ${f(Number(settings.incoming))}/분 · 회피 미반영`):'영상 기준 약 1.5초 · 회피 미반영 · 1회 피해 미입력 시 분당 직접 입력';
}
function renderInputs(){
 renderHitRate();
 q('#opt-hp-capped').checked=!!settings.measure.hpCapped;
 q('#opt-target-mode').value=settings.targetMode;
 host.querySelectorAll('[data-opt-target-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.optTargetMode===settings.targetMode)));
 const statInputs={attack:'opt-attack',maxHp:'opt-maxhp',regen:'opt-regen',accuracy:'opt-accuracy',criticalHit:'opt-critical-hit',criticalDamage:'opt-critical-damage',defense:'opt-defense',basicEvasion:'opt-basic-evasion',skillBlock:'opt-skill-block',criticalResistance:'opt-critical-resistance',skillDamageReduction:'opt-skill-damage-reduction',normalDamageUp:'opt-normal-damage-up',normalDamageDown:'opt-normal-damage-down',bossDamageUp:'opt-boss-damage-up',bossDamageDown:'opt-boss-damage-down'};
 for(const [key,id] of Object.entries(statInputs))q('#'+id).value=settings.stats[key]??'';
 host.querySelectorAll('[name="opt-mode"]').forEach(x=>x.checked=x.value===settings.mode);
 q('#opt-incoming').value=settings.incoming;q('#opt-hp-start').value=settings.measure.hpStart;q('#opt-hp-end').value=settings.measure.hpEnd;q('#opt-seconds').value=settings.measure.seconds;
 q('#opt-incoming-row').hidden=settings.mode!=='incoming';q('#opt-measure-row').hidden=settings.mode!=='measure';
 const fams=searchFamilies();
 q('#opt-families').innerHTML=FAMILIES.map(x=>`<label><input type="checkbox" data-opt-family="${x}" ${fams.includes(x)?'checked':''}>${styleBadge({family:x})}</label>`).join('');
 renderFreeSummary();
}
// The planner keeps base slots valid on its own; a build that is still blocked (e.g. fewer than 3 family skills) is fixed in the planner.
function renderValidation(){
 const box=q('#opt-validation');if(current?.valid!==false){box.hidden=true;box.innerHTML='';return;}
 box.hidden=false;box.innerHTML='<strong>'+'입력을 확인해 주세요.'+'</strong><p>'+esc(current.issue||'')+'</p>'+(settings.startMode==='conditions'?'':'<button data-opt-edit data-tab="explore">순서 구성에서 고치기</button>');
}
function worldText(r){const x=r?.encounter;if(!x)return '이동·몬스터 재등장 미반영 · 평균 적중 수로 계산';return `예상: 분당 처치 ${x.killsPerMin} · 몬스터가 모인 반경 ${x.clusterRadiusMean}m · 2m 내 밀집 ${x.compactPct}% · 따라오는 몬스터와 최대 거리 ${x.maxTrail}m · 적중당 ${x.targetsPerHit}명 · 빗나감 ${x.whiffPct}% · 남은 체력을 초과한 피해 ${x.overkillPct}% · 평균 처치 ${x.meanTimeToKill??'—'}초 · 걸어서 이동 ${x.walkMetres}m / 도술 이동 ${x.skillMoveMetres}m · 복귀 ${x.returns}회 · 몬스터 재등장 ${x.respawns}회. 가정: 이동 ${x.assumptions.playerSpeed}m/s, 몹 추적 ${x.assumptions.monsterSpeed}m/s, 몬스터 재등장 ${x.assumptions.respawn}초, 복귀 반경 ${x.assumptions.homeRadius}m. ${x.limitations.join(' / ')}`;}
function shinsikText(r){const x=r?.shinsik;if(!x)return '';return `신식 ${x.active.join(' · ')||'미개방'} · ${(x.timeline||[]).map(t=>t.family+' 첫 발동 '+(t.first===null?'없음':t.first+'초')+(t.hasWindow?' / 유지 '+t.uptimePct+'%':' / 지속 구간 없음')).join(' · ')} · 공간 적중 기준 피해 증가 ${x.damageGainPct}% (추가 계수 ${f(x.extraCoefficient)}) · 방어 기여 분당 ${f((r.rows||[]).filter(x=>x.shinsik).reduce((a,x)=>a+(x.perMin||0),0))}`;}
function renderCurrent(){
 renderValidation();
 q('#opt-world').textContent=current?.valid?worldText(current)+(current.verification?.sensitivity?` 민감도 검증 처치 범위 ${current.verification.sensitivity.minimum}–${current.verification.sensitivity.maximum}/분 (추적 0.9/2m/s, 몬스터 재등장 4/12초 가정)`:''):worldText(current);
}
function renderNeed(){
 const st=stats(),miss=missingStats(),n=needed();
 q('#opt-stats-note').textContent=miss.length?`${miss.join('·')} 입력 필요`:`자연 회복 분당 ${f(O.regenPerMin(st))} (전투 중 ${REGEN_PERIOD}초마다)`;
 q('#opt-need').textContent=n.text+(n.status?' · '+n.status:'');q('#opt-need').classList.toggle('opt-warning',(n.value===null&&!n.unassessed)||n.have<n.bare);
 const ult=build.map(byId).find(s=>s?.ultimate);q('#opt-ultimate').textContent=ult?`현재 궁극기 · ${ult.name}`:'궁극기 미배치';
 q('#opt-run').disabled=!!search||!current?.valid||(n.value===null&&!n.unassessed)||miss.length>0;
 if(lastResults)q('#opt-stale').hidden=resultContext===key();
 renderFreeSummary();
}
const STAT_FIELDS={'공격력':['attack','opt-attack'],'최대 체력':['maxHp','opt-maxhp'],'체력':['maxHp','opt-maxhp'],'체력 자연 회복':['regen','opt-regen'],'공격 정확도':['accuracy','opt-accuracy'],'치명타 적중':['criticalHit','opt-critical-hit'],'치명타 피해 증가':['criticalDamage','opt-critical-damage'],'방어력':['defense','opt-defense'],'기본 공격 회피':['basicEvasion','opt-basic-evasion'],'도술 막기':['skillBlock','opt-skill-block'],'치명타 저항':['criticalResistance','opt-critical-resistance'],'도술 공격 피해 감소':['skillDamageReduction','opt-skill-damage-reduction'],'일반 요괴 피해 증가':['normalDamageUp','opt-normal-damage-up'],'일반 요귀 피해 증가':['normalDamageUp','opt-normal-damage-up'],'일반 요괴 피해 감소':['normalDamageDown','opt-normal-damage-down'],'일반 요귀 피해 감소':['normalDamageDown','opt-normal-damage-down'],'보스 피해 증가':['bossDamageUp','opt-boss-damage-up'],'보스 피해 감소':['bossDamageDown','opt-boss-damage-down']};
const INTEGER_STATS=new Set(['attack','maxHp','regen','accuracy','criticalHit','defense','basicEvasion','skillBlock','criticalResistance']);
function importStats(text){
 const found=new Set(),fields=Object.entries(STAT_FIELDS).sort((a,b)=>b[0].length-a[0].length),lines=String(text||'').split(/\r?\n/);
 const apply=(entry,raw)=>{const match=String(raw).match(/-?[\d,.]+/);if(!match)return;const [key,id]=entry[1];let value=match[0];if(INTEGER_STATS.has(key)&&/^-?\d{1,3}(?:\.\d{3})+$/.test(value))value=value.replace(/\./g,'');else value=value.replace(/,/g,'');settings.stats[key]=value;q('#'+id).value=value;found.add(key);};
 for(const line of lines){const compact=line.trim().replace(/\s/g,'');if(!compact)continue;const entry=fields.find(([label])=>{const token=label.replace(/\s/g,''),rest=compact.slice(token.length);return compact.startsWith(token)&&/^[:：]?-?[\d,.]/.test(rest);});if(entry)apply(entry,compact.slice(entry[0].replace(/\s/g,'').length));}
 const nonempty=lines.map(line=>line.trim()).filter(Boolean);
 for(let i=0;i<nonempty.length;i++){const labelLine=nonempty[i].replace(/\s/g,''),entry=fields.find(([label])=>labelLine===label.replace(/\s/g,''));if(!entry||found.has(entry[1][0]))continue;for(let j=i+1;j<Math.min(nonempty.length,i+4);j++){const candidate=nonempty[j].replace(/\s/g,'');if(/^-?[\d,.]+%?$/.test(candidate)){apply(entry,candidate);break;}if(/[가-힣A-Za-z]/.test(candidate))break;}}
 const count=found.size;q('#opt-stat-import-status').textContent=count?`${count}개 능력치를 자동 입력했습니다.`:'인식할 수 있는 능력치가 없습니다. 선명한 상세 화면인지 확인하세요.';save();renderFreeSummary();recalc();return count;
}
let ocrWorker=null,ocrRun=0;
function loadOcr(){if(window.Tesseract)return Promise.resolve(window.Tesseract);return new Promise((resolve,reject)=>{const old=document.querySelector('script[data-stat-ocr]');if(old){old.addEventListener('load',()=>resolve(window.Tesseract),{once:true});old.addEventListener('error',()=>reject(Error('OCR 모듈을 불러오지 못했습니다.')),{once:true});return;}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.async=true;s.dataset.statOcr='';s.onload=()=>resolve(window.Tesseract);s.onerror=()=>reject(Error('OCR 모듈을 불러오지 못했습니다.'));document.head.appendChild(s);});}
async function prepareOcrImage(file){const bitmap=await createImageBitmap(file),scale=Math.max(1,Math.min(2.5,1200/bitmap.width)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();const image=ctx.getImageData(0,0,canvas.width,canvas.height),d=image.data;let sum=0;for(let i=0;i<d.length;i+=4)sum+=(d[i]*.299+d[i+1]*.587+d[i+2]*.114);const dark=sum/(d.length/4)<128;for(let i=0;i<d.length;i+=4){let v=d[i]*.299+d[i+1]*.587+d[i+2]*.114;if(dark)v=255-v;v=Math.max(0,Math.min(255,(v-128)*1.35+128));d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}ctx.putImageData(image,0,0);return canvas;}
function needsOcrRetry(text){const lines=String(text||'');return (/체력\s*자연\s*회복/.test(lines)&&!/^\s*체력\s+[\d,.]+/m.test(lines))||(/도술\s*막기/.test(lines)&&!/^\s*방어력\s+[\d,.]+/m.test(lines))||(/공격\s*정확도/.test(lines)&&!/^\s*공격력\s+[\d,.]+/m.test(lines));}
async function recognizeStatImages(files){const token=++ocrRun,status=q('#opt-stat-import-status'),progress=q('#opt-ocr-progress'),list=q('#opt-stat-image-list'),items=[...files].filter(f=>f.type.startsWith('image/'));list.innerHTML=items.map(f=>`<span title="${esc(f.name)}">${esc(f.name)}</span>`).join('');if(!items.length){status.textContent='PNG·JPG·WebP 이미지를 선택하세요.';return;}progress.hidden=false;progress.value=0;status.textContent=`OCR 준비 중 · ${items.length}장`;try{const T=await loadOcr();if(token!==ocrRun)return;ocrWorker=await T.createWorker('kor+eng',1,{logger:m=>{if(token!==ocrRun)return;const base=Number(progress.dataset.done||0),p=Number(m.progress)||0;progress.value=Math.min(1,(base+p)/items.length);status.textContent=m.status==='recognizing text'?`글자 추출 중 · ${Math.round(progress.value*100)}%`:`OCR 준비 중 · ${items.length}장`;}});await ocrWorker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'6'});let text='';for(let i=0;i<items.length;i++){progress.dataset.done=i;const image=await prepareOcrImage(items[i]),result=await ocrWorker.recognize(image);let pageText=result.data?.text||'';if(needsOcrRetry(pageText)){status.textContent=`누락 항목 보강 중 · ${i+1}/${items.length}`;await ocrWorker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'11'});const retry=await ocrWorker.recognize(items[i]);pageText+='\n'+(retry.data?.text||'');await ocrWorker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'6'});}text+=(i?'\n':'')+pageText;progress.value=(i+1)/items.length;}await ocrWorker.terminate();ocrWorker=null;if(token!==ocrRun)return;const count=importStats(text);status.textContent=count?`${items.length}장 분석 완료 · ${count}개 능력치를 입력했습니다.`:'이미지에서 능력치를 찾지 못했습니다. 상세 탭을 선명하게 캡처해 주세요.';}catch(error){status.textContent=`이미지 분석 실패 · ${error.message}`;try{await ocrWorker?.terminate();}catch{}ocrWorker=null;}finally{progress.hidden=true;delete progress.dataset.done;}}
function key(){return JSON.stringify([build,D.baseSlots,settings,D.executionPolicy||{}]);}
function sync(force){
 renderConditions();const empty=!build.length&&settings.startMode!=='conditions';q('#opt-empty').hidden=!empty;q('#opt-work').hidden=empty;
 let preview;try{preview=startState();}catch{preview={ids:[],baseSlots:[]};}q('#opt-build').innerHTML=strip(preview.ids);
 q('#opt-equipment').textContent=preview.ids.length?(settings.startMode==='conditions'?'조건으로 생성한 비교용 시작 구성 · ':'')+'기본 장착: '+(preview.baseSlots.map(id=>byId(id)?.name).join(' · ')||'없음'):'';
 if(empty)return;
 const k=key();if(!force&&k===context)return;context=k;
 current=evalCurrent();renderInputs();renderZone();renderCurrent();renderNeed();
}
function recalc(){current=evalCurrent();renderCurrent();renderNeed();}
function stop(message){searchWorker?.terminate();searchWorker=null;clearTimeout(timer);search=null;q('#opt-live').hidden=true;q('#opt-cancel').hidden=true;q('#opt-progress').hidden=true;if(message)q('#opt-status').textContent=message;renderNeed();}
function run(){
 const n=needed();if(n.value===null&&!n.unassessed)return;const fams=searchFamilies();
 if(typeof Worker!=='undefined'){
  let start;try{start=startState();}catch(error){q('#opt-status').textContent=error.message;return;}
  const snapshotKey=key(),baseline=current,options={...current.ctx,snapshot:KK?.snapshot||current.ctx?.snapshot,families:fams,useUltimate:settings.useUltimate!==false,conditions:settings.startMode==='conditions'?conditions():undefined,iterations:ITERATIONS,totalEvaluationBudget:4000,boundedSelection:true,mechanismGroups:true,detailedGroups:true,seed:20261018};
  try{
   const worker=new Worker('optimizer-worker.js?v=20261020-1');searchWorker=worker;search={};resultContext=snapshotKey;
   q('#opt-live').hidden=true;q('#opt-live-builds').innerHTML='';q('#opt-cancel').hidden=false;q('#opt-progress').hidden=false;q('#opt-run').disabled=true;q('#opt-status').textContent='백그라운드 탐색 중 · 계산 한도 4,000회';
   if(lastResults)q('#opt-stale').hidden=false;
   worker.onmessage=({data:m})=>{
    if(searchWorker!==worker)return;if(snapshotKey!==key()){stop('조건 변경 · 다시 탐색하세요');return;}
    const elapsed=Math.round(m.elapsedMs/1000);
    if(m.type==='progress'){
     q('#opt-progress').value=Math.min(.95,m.progress.evaluated/4000);
     q('#opt-status').textContent=`탐색 ${f(m.progress.evaluated)}회 / 최대 4,000회 · ${elapsed}초`;
     if(m.preview?.length){q('#opt-live').hidden=false;q('#opt-live-builds').innerHTML=m.preview.map((c,i)=>`<div><b>후보 ${i+1}</b><div class="opt-build">${strip(c.ids)}</div></div>`).join('');}
    }else if(m.type==='validating'){q('#opt-status').textContent=`상위 후보 검증 중 · ${elapsed}초`;
    }else if(m.type==='complete'){
     lastResults={...m.result,start:baseline};q('#opt-live').hidden=true;stop(`완료 · ${elapsed}초 · ${f(m.result.diagnostics?.selection?.totalEvaluations)}회 계산`);renderResults();
    }else if(m.type==='error'){stop('탐색 오류: '+m.message);}
   };
   worker.onerror=()=>{if(searchWorker===worker)stop('백그라운드 탐색을 실행하지 못했습니다. 새로고침 후 다시 시도하세요.');};
   worker.postMessage({data:D,start,options,limit:GROUP_SIZE,zones:ZONES,includeImprovements:true});return;
  }catch(error){stop('탐색 오류: '+error.message);return;}
 }

 try{search=O.createSearch(D,startState(),{...current.ctx,families:fams,useUltimate:settings.useUltimate!==false,conditions:settings.startMode==='conditions'?conditions():undefined,iterations:ITERATIONS,seed:20261018});}catch(e){q('#opt-status').textContent=e.message;return;}
 resultContext=key();q('#opt-cancel').hidden=false;q('#opt-progress').hidden=false;q('#opt-run').disabled=true;q('#opt-status').textContent=`후보 도술 ${search.pool.length}개에서 탐색 중`;
 // A hidden page gets about one timer per second, so it works in longer slices to keep going in the background.
 const tick=()=>{if(!search)return;const p=search.step(document.hidden?800:40);q('#opt-progress').value=p.done/p.total;q('#opt-status').textContent=`${f(p.done)} / ${f(p.total)}회 · ${current?.unassessed?'계산 가능한 구성':'버티는 구성'} ${f(p.feasible)}개`;
  if(!p.finished){timer=setTimeout(tick,0);return;}
  q('#opt-status').textContent='상위 후보를 모든 배치·구간에서 다시 계산하는 중';timer=setTimeout(()=>{const s=search;if(!s)return;lastResults={...s.grouped(GROUP_SIZE),start:current};if(!lastResults.similar.length&&!lastResults.different.length&&lastResults.closest?.[0]){const c=lastResults.closest[0];lastResults.improve=O.improvements(D,c.ids,c.baseSlots,current.ctx,{zones:ZONES});}stop(`완료 · ${f(p.evaluated)}개 구성 계산`);renderResults();},0);};
 timer=setTimeout(tick,0);
}
const power=c=>{const base=lastResults.start.verification.minPower;return base?(c.verification.minPower/base-1)*100:0;};
const pct=x=>(x>=0?'+':'')+x.toFixed(1)+'%';
// Room against the real need (the safety margin is a search requirement, not damage taken).
const left=c=>c.verification.margin===null?null:c.verification.margin+MARGIN;
const kills=n=>n.toFixed(1)+'마리';
const same=(a,b)=>a.ids.join()===b.ids.join()&&a.baseSlots.join()===b.baseSlots.join();
// The recommendation is the best of both groups; the rest are listed by group (similar to the current build, or different).
const better=(a,b)=>!b||a.verification.minPower>b.verification.minPower||(a.verification.minPower===b.verification.minPower&&a.verification.margin>b.verification.margin);
// Presentation groups use equipped skills, independently of search archive bins.
function displayGroups(){
 const raw=lastResults?.mechanismGroups||[],groups=new Map(),seen=new Set();
 for(const c of raw.flatMap(g=>g.candidates)){
  const signature=c.ids.join('|')+';'+c.baseSlots.join('|');if(seen.has(signature))continue;seen.add(signature);
  const skills=c.ids.map(byId),ult=skills.find(s=>s?.ultimate),key=ult?.id||'normal';
  if(!groups.has(key))groups.set(key,{id:key,label:ult?`${ult.name} · ${ult.family}`:'궁극기 미장착',candidates:[],subgroups:[]});
  groups.get(key).candidates.push(c);
 }
 for(const g of groups.values()){
  g.candidates.sort((a,b)=>b.verification.minPower-a.verification.minPower);
  const subs=new Map();
  for(const c of g.candidates){
   const ult=c.ids.map(byId).find(s=>s?.ultimate),counts=new Map();
   for(const id of c.ids){const sk=byId(id);if(sk&&!sk.ultimate&&sk.family!==ult?.family)counts.set(sk.family,(counts.get(sk.family)||0)+1);}
   const support=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).map(([family,n])=>`${family} ${n}개`);
   const label=support.length?'보조 도술 · '+support.join(' · '):'같은 계열 도술만 사용';
   if(!subs.has(label))subs.set(label,{id:g.id+':'+subs.size,label,candidates:[]});subs.get(label).candidates.push(c);
  }
  g.subgroups=[...subs.values()];
 }
 return [...groups.values()].sort((a,b)=>b.candidates[0].verification.minPower-a.candidates[0].verification.minPower);
}
function picks(){
 if(lastResults.mechanismGroups?.length)return displayGroups().flatMap(g=>g.candidates.map((c,i)=>({label:g.label+' · '+(i+1),c,group:g.id})));
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
 const cur=lastResults.start,next=detail(c),baseline=cur.startIds||build;
 const ultimate=c.ids.map(byId).find(s=>s?.ultimate),parts=[];
 const count=c.ids.filter(id=>!baseline.includes(id)).length;
 const reference=settings.startMode==='conditions'?'자동 생성 시작안':'현재 빌드';
 if(ultimate){const n=c.ids.map(byId).filter(s=>s&&!s.ultimate&&s.family===ultimate.family).length;parts.push(`${ultimate.family} 일반 도술 ${n}개와 궁극기 ${josa('‘'+ultimate.name+'’','을','를')} 사용하는 구성입니다.`);}
 parts.push(count?`${reference}에서 도술 ${count}개를 교체했습니다.`:`${reference}의 도술을 유지하고 사용 순서와 기본 장착을 비교했습니다.`);
 // Describe only conditional sustain actually triggered in this simulation.
 const link=(next.rows||[]).filter(r=>r.condition&&r.triggers>0&&r.perMin>0).sort((a,b)=>b.perMin-a.perMin)[0];
 if(link){const name=byId(link.skillId)?.name||link.name,kind=kindName[link.kind]||'효과';parts.push(`‘${link.condition.effect}’ 조건을 활용한 ‘${name}’의 ${kind} 효과가 180초 동안 ${link.triggers}회 발동했습니다.`);}
 if(Number.isFinite(cur.idle)&&Number.isFinite(next.idle)&&Math.abs(cur.idle-next.idle)>=.5){parts.push(`같은 180초 계산에서 모든 도술이 재사용 대기 중인 시간은 ${cur.idle.toFixed(1)}초에서 ${next.idle.toFixed(1)}초로 ${next.idle<cur.idle?'줄었습니다':'늘었습니다'}.`);}
 const l=left(c);parts.push(l===null?'받는 피해가 입력되지 않아 생존 가능 여부는 평가하지 않았습니다.':l>=0?`계산상 자연 회복을 포함한 회복·보호막이 받는 피해를 분당 ${f(l)}만큼 웃돕니다.`:`계산상 자연 회복을 포함한 회복·보호막이 받는 피해보다 분당 ${f(-l)}만큼 부족합니다.`);
 return parts.join(' ');
}
const changeText=c=>{const n=c.ids.filter(id=>!(lastResults.start.startIds||build).includes(id)).length;return n?`도술 ${n}개 교체`:'도술 유지';};
// Every build on this screen uses the same tiles; skills missing from `compare` (the current build) are outlined as new.
function strip(ids,compare){return ids.map((id,i)=>`<span class="${[compare&&!compare.includes(id)?'opt-new':'',byId(id)?.ultimate?'opt-ult':''].join(' ').trim()}"><small>${String(i+1).padStart(2,'0')}</small>${icon(byId(id))}<b>${esc(byId(id).name)}</b>${styleBadge(byId(id))}</span>`).join('');}
const tiles=c=>strip(c.ids,lastResults.start.startIds||build);
function card(c){
 const start={ids:build,baseSlots:D.baseSlots},unchanged=same(c,start),l=left(c);
 return `<div class="opt-card-head"><h2>추천 빌드</h2><span class="opt-verdict ${l===null?'':l>=0?'ok':'bad'}">${l===null?'생존 미평가':(l>=0?'회복·보호막 ≥ 받는 피해 (예상)':'부족')+' · 분당 '+signed(l)}</span></div>
<div class="opt-metrics"><div><small>예상 분당 처치 수 · ${esc(lastResults.start.zone?.name||'기본 환경')} 분당 처치 (현재 대비)</small><b>${pct(power(c))}</b><span>분당 ${kills(lastResults.start.verification.minPower)} → ${kills(c.verification.minPower)}</span></div>
<div><small>분당 회복·보호막 (가장 나쁜 배치)</small><b>${f(c.verification.minPerMin)}</b><span>동시에 붙는 몹 평균 ${c.verification.attackers.toFixed(2)}마리 · 받는 피해 ${f(c.verification.incoming)} · 필요 ${f(c.verification.need===null?null:c.verification.need-MARGIN)}</span></div></div>
${unchanged?'<p class="opt-caption">현재 빌드가 이미 이 조건에서 가장 강합니다.</p>':''}
<p class="opt-summary">${esc(summary(c))}</p><p class="opt-caption">${esc(shinsikText(c.verification.worst))}</p>
<div class="opt-build opt-card-build">${tiles(c)}</div><p class="opt-caption">${changeText(c)} · 기본 장착: ${c.baseSlots.map(id=>esc(byId(id).name)).join(' · ')} · <span class="opt-new">초록 테두리</span> · 새 도술, <span class="opt-ult-key">보라</span> · 궁극기</p>
<div class="opt-card-actions"><button class="primary" data-opt-apply="0"${unchanged?' disabled':''}>이 빌드 적용</button><button data-opt-json="0">JSON 저장</button></div>`;
}
function resultVisual(c){
 const cur=lastResults.start,next=detail(c),ult=c.ids.map(byId).find(s=>s?.ultimate);
 const family=ult?`${ult.family} ${c.ids.map(byId).filter(s=>s&&!s.ultimate&&s.family===ult.family).length} + ${ult.name}`:'일반 도술 구성';
 const valid=Number.isFinite(cur.idle)&&Number.isFinite(next.idle),delta=valid?next.idle-cur.idle:0;
 const tone=delta<-.05?'better':delta>.05?'worse':'neutral';
 const bar=(name,value)=>`<div class="opt-wait-row"><span>${name}</span><span class="opt-wait-track"><i style="width:${Math.max(0,Math.min(100,value/180*100))}%"></i></span><b>${value.toFixed(1)}초</b></div>`;
 return `<div class="opt-result-badges"><b>${esc(family)}</b><span>예상 분당 처치 수 <strong>${pct(power(c))}</strong></span><span class="${tone}">대기 ${valid?(delta>0?'+':'')+delta.toFixed(1)+'초':'미확인'}</span><span>${changeText(c)}</span><span title="${left(c)===null?'받는 피해 미입력':'회복·보호막에서 받는 피해를 뺀 분당 회복·보호막 − 받는 피해'}">${left(c)===null?'생존 미평가':'분당 회복·보호막 − 받는 피해 '+signed(left(c))}</span></div>
 <div class="opt-build opt-card-build">${tiles(c)}</div>
 ${valid?`<div class="opt-wait-comparison ${tone}" aria-label="전체 도술 재사용 대기 비교"><small>전체 도술 쿨타임 대기 · 180초 기준</small>${bar(settings.startMode==='conditions'?'시작안':'현재 빌드',cur.idle)}${bar('추천안',next.idle)}</div>`:''}
 <details class="opt-change-details"><summary>변경 상세</summary><p>${esc(summary(c))}</p><p>${esc(shinsikText(c.verification.worst))}</p><p>예상 처치 분당 ${kills(cur.verification.minPower)} → ${kills(c.verification.minPower)} · 몹 평균 ${c.verification.attackers.toFixed(2)}마리</p><p>기본 장착: ${c.baseSlots.map(id=>esc(byId(id).name)).join(' · ')}</p></details>`;
}
function row(label,c,i){
 return `<article class="opt-alt"><div class="opt-alt-head"><b>${esc(label)}</b><span class="opt-alt-actions"><button data-opt-apply="${i}">적용</button><button data-opt-json="${i}">JSON</button></span></div>${resultVisual(c)}</article>`;
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
 out.push(zones.length?'같은 가정에서 회복량이 충분한 사냥터(어려운 순): '+zones.map(z=>`${z.name}(권장 ${f(z.recommendedPower)} · 분당 처치 ${z.killsPerMin.toFixed(1)}마리)`).join(', '):'같은 가정에서 회복량이 충분한 사냥터가 없습니다');
 return out;
}
// Nothing survives: say how far the current build and the closest builds fall short, and show the closest one.
function noneCard(){
 if(lastResults.start.unassessed)return '<h2>조건에 맞는 추천을 찾지 못했습니다.</h2><p>생존성은 평가하지 않았습니다. 선택 조건이나 사용 가능한 도술을 확인하세요.</p>';
 const r=lastResults,v=r.start.verification,best=(r.closest||[])[0],zone=r.start.zone,power=num(settings.power);
 const ratio=zone?.recommendedPower&&power>0?` ${esc(zone.name)} 권장 전투력 ${f(zone.recommendedPower)} 대비 내 전투력 ${Math.round(power/zone.recommendedPower*100)}%입니다.`:'';
 const head=`<div class="opt-card-head"><h2>가정한 조건에서 회복이 부족합니다</h2>${best?`<span class="opt-verdict bad">가장 근접해도 분당 ${f(-left(best))} 부족</span>`:''}</div>`;
 const why=`<p>현재 빌드는 회복·보호막 분당 ${f(v.minPerMin)}, 필요한 양은 분당 ${f(v.need-MARGIN)}입니다.${best?` 회복·보호막을 가장 많이 확보한 빌드도 분당 ${f(best.verification.minPerMin)}에 그칩니다.`:''}${ratio} 실제 사냥 유지 여부가 아니라 가정한 조건에서의 비교 결과입니다.</p>`;
 const im=improveLines(r.improve),improve=im.length?`<h3 class="opt-closest-title">버티려면 (가장 근접한 빌드 기준 · 하나만 바꿀 때)</h3><ul class="opt-improve">${im.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
 if(!best)return head+why;
 return head+why+improve+`<h3 class="opt-closest-title">가장 근접한 빌드</h3><p class="opt-summary">${esc(summary(best))}</p><div class="opt-build opt-card-build">${tiles(best)}</div><p class="opt-caption">${changeText(best)} · 분당 처치 ${kills(best.verification.minPower)} · 몹 평균 ${best.verification.attackers.toFixed(2)}마리 · 기본 장착: ${best.baseSlots.map(id=>esc(byId(id).name)).join(' · ')}</p>`;
}
function linkStats(c,currentBuild=false){
 const ids=currentBuild?(lastResults.start.startIds||build):c.ids,base=currentBuild?(lastResults.start.startBase||D.baseSlots):c.baseSlots;
 try{
  if(typeof DosulLinkTiming!=='undefined'&&typeof E!=='undefined'&&Array.isArray(E.connections)){const rows=DosulLinkTiming.evaluate({...D,executionPolicy:D.executionPolicy||{}},ids,base,E.connections),passed=rows.reduce((n,x)=>n+(x.timing?.valid||0),0),total=rows.reduce((n,x)=>n+(x.timing?.total||0),0);return {passed,total};}
 }catch{}
 const evaluated=currentBuild?lastResults.start:detail(c),rows=(evaluated.rows||[]).filter(x=>x.condition);return {passed:rows.reduce((n,x)=>n+(x.triggers||0),0),total:rows.reduce((n,x)=>n+(x.triggers||0),0)};
}
function freeDirections(list){
 if(!list.length)return [];
 const scored=list.map((x,i)=>({...x,i,detail:detail(x.c),room:left(x.c),links:linkStats(x.c)})),used=new Set(),pick=sort=>{const ranked=[...scored].sort(sort),found=ranked.find(x=>!used.has(x.i))||ranked[0];used.add(found.i);return found;};
 const fast=pick((a,b)=>b.c.verification.minPower-a.c.verification.minPower||b.detail.casts-a.detail.casts),stable=pick((a,b)=>(b.room??-Infinity)-(a.room??-Infinity)||b.c.verification.minPerMin-a.c.verification.minPerMin),linked=pick((a,b)=>b.links.passed-a.links.passed||a.detail.idle-b.detail.idle);
 return [{id:'fast',title:'빠른 사냥',eyebrow:'처치 속도 우선',entry:fast,reason:`예상 분당 처치 수를 ${kills(lastResults.start.verification.minPower)}에서 ${kills(fast.c.verification.minPower)}로 높이는 구성을 우선했습니다.`},{id:'stable',title:'안정 사냥',eyebrow:'회복 여유 우선',entry:stable,reason:stable.room===null?'받는 피해가 없어 생존 여유는 평가하지 않고 회복·보호막 생성량이 큰 구성을 골랐습니다.':`자연 회복을 포함한 회복·보호막 여유를 분당 ${signed(stable.room)} 확보하는 구성을 우선했습니다.`},{id:'links',title:'연계 중심',eyebrow:'조건 적중 우선',entry:linked,reason:linked.links.passed>0?`60초 반복 흐름에서 조건 연계 적중 ${linked.links.passed}회를 확인한 구성을 우선했습니다.`:'현재 조건에서 확인된 연계 적중 후보가 없어, 평타 대기가 가장 짧은 대안을 표시했습니다.'}];
}
function compactStrip(ids){return ids.map((id,i)=>{const s=byId(id);return `<span class="${s?.ultimate?'is-ultimate':''}"><small>${s?.ultimate?'궁극기':String(i+1).padStart(2,'0')}</small>${icon(s)}<b>${esc(s.name)}</b></span>`;}).join('');}
function renderFreeTimeline(c){
 const panel=q('#opt-result-timeline'),view=window.DosulRecommendationView;if(!panel)return;
 if(!c||!view?.full||!view?.overlayTimeline){panel.innerHTML=c?'<p class="opt-caption">스킬 타임라인을 준비하지 못했습니다.</p>':'';return;}
 try{
  const baseIds=lastResults.start.startIds||build,baseSlots=lastResults.start.startBase||D.baseSlots,currentFlow=view.full(baseIds,baseSlots,180),nextFlow=view.full(c.ids,c.baseSlots,180),end=Math.max(20,Math.min(180,60/freeTimelineZoom));
  panel.innerHTML=`<div class="opt-free-timeline-heading"><div><small>선택한 추천 기준</small><h3>스킬 타임라인</h3></div><div class="recommend-toolbar"><div class="recommend-overlay-legend"><span class="current">현재 빌드</span><span class="next">추천 빌드</span></div><div class="recommend-zoom" role="group" aria-label="자유 추천 시간축 확대 축소"><button type="button" data-opt-free-timeline-zoom="out" aria-label="시간축 축소">−</button><input id="opt-free-timeline-range" type="range" min="34" max="300" step="10" value="${Math.round(freeTimelineZoom*100)}" aria-label="자유 추천 시간축 배율"><button type="button" data-opt-free-timeline-zoom="in" aria-label="시간축 확대">＋</button><output>${Math.round(freeTimelineZoom*100)}% · ${Math.round(end*10)/10}초</output></div></div></div><div class="recommend-timelines">${view.overlayTimeline(currentFlow,nextFlow,end)}</div>`;
  const timelines=panel.querySelector?.('.recommend-timelines');view.bindCursor?.(timelines,end);
 }catch(error){panel.innerHTML=`<p class="opt-caption">스킬 타임라인을 표시할 수 없습니다: ${esc(error.message)}</p>`;}
}
function renderFreeResults(list){
 const directions=freeDirections(list),available=new Set(directions.map(x=>x.entry.i));if(!available.has(activeResultPick))activeResultPick=directions[0]?.entry.i??0;
 q('#opt-direction-cards').innerHTML=directions.length?directions.map(x=>{const c=x.entry.c,d=x.entry.detail,selected=x.entry.i===activeResultPick,l=x.entry.links,wait=Number.isFinite(d.idle)?d.idle:null;return `<article class="opt-direction-card ${selected?'is-selected':''}" data-direction="${x.id}"><header><span><small>${esc(x.eyebrow)}</small><h3>${esc(x.title)}</h3></span><button type="button" data-opt-select-result="${x.entry.i}" aria-pressed="${selected}">${selected?'선택됨':'이 결과 보기'}</button></header><div class="opt-direction-strip">${compactStrip(c.ids)}</div><dl><div><dt>분당 처치</dt><dd>${kills(c.verification.minPower)} <em>${pct(power(c))}</em></dd></div><div><dt>평타 대기</dt><dd>${wait===null?'—':wait.toFixed(1)+'초'}</dd></div><div><dt>연계 적중</dt><dd>${l.passed}회</dd></div><div><dt>생존 여유</dt><dd>${x.entry.room===null?'미평가':'분당 '+signed(x.entry.room)}</dd></div></dl><p>${esc(x.reason)}</p></article>`;}).join(''):'<div class="opt-no-direction">조건을 만족하는 추천 빌드를 찾지 못했습니다.</div>';
 const selected=list[activeResultPick]||list[0];if(!selected){q('#opt-result-comparison').innerHTML=noneCard();renderFreeTimeline(null);return;}
 const c=selected.c,baseIds=lastResults.start.startIds||build,baseLinks=linkStats(null,true),nextLinks=linkStats(c),selectedDirection=directions.find(x=>x.entry.i===activeResultPick);
 const linkDelta=nextLinks.passed-baseLinks.passed,linkChange=linkDelta>0?`${linkDelta}회 늘어납니다`:linkDelta<0?`${Math.abs(linkDelta)}회 줄어듭니다`:'같습니다';
 q('#opt-result-comparison').innerHTML=`<div class="opt-comparison-heading"><div><small>${esc(selectedDirection?.title||'추천')} 선택</small><h3>현재 빌드와 추천 빌드 비교</h3></div><div class="opt-comparison-actions"><button type="button" data-opt-next-direction>다른 추천</button><button type="button" class="primary" data-opt-apply="${activeResultPick}">추천 적용</button></div></div><div class="opt-comparison-builds"><section><h4>현재 빌드</h4><div class="opt-direction-strip">${compactStrip(baseIds)}</div></section><span aria-hidden="true">→</span><section class="recommended"><h4>추천 빌드</h4><div class="opt-direction-strip">${compactStrip(c.ids)}</div></section></div><p class="opt-comparison-summary">${esc(summary(c))} 조건 연계 적중은 ${baseLinks.passed}회에서 ${nextLinks.passed}회로 ${linkChange}.</p>`;
 renderFreeTimeline(c);
}
function renderResults(){
 q('#opt-results').hidden=false;q('#opt-stale').hidden=true;
 const list=picks();
 renderFreeResults(list);
 const groups=displayGroups(),subgroups=groups.reduce((n,g)=>n+(g.subgroups?.length||1),0);
 q('#opt-found').textContent=list.length?`궁극기 ${groups.length||1}개 · 보조 도술 조합 ${subgroups||1}개 · 검증된 빌드 ${list.length}개`:'';
}
// Analysis export: a Markdown report a person can read and paste into a prompt, with the same data as JSON at the end.
function skillText(id){const s=byId(id);return `${s.name} (${s.family}${s.ultimate?' 궁극기':''} · ${s.targeting?.kind==='single'?'단일':s.damage===false?'보조':'범위'} · 쿨 ${s.basic?.cooldown??'?'}초)`;}
function sustainRows(r){return (r?.rows||[]).map(x=>({skill:x.name,shinsik:!!x.shinsik,kind:kindName[x.kind],condition:x.condition?`${x.condition.effect} ${x.condition.scope==='enemy'?'대상':'보유'} 시`:'시전마다',each:x.each,triggers180s:x.triggers,perMinFull:x.full,perMinAbsorbed:x.perMin,life:Number.isFinite(x.life)?x.life:null,dup:x.dup||null}));}
function exportEntry(label,group,c,isCurrent){
 const v=isCurrent?lastResults.start.verification:c.verification,ev=v.worst||(isCurrent?lastResults.start:detail(c)),ids=isCurrent?lastResults.start.startIds:c.ids,base=isCurrent?lastResults.start.startBase:c.baseSlots;
 return {label,group,evaluationBasis:{profile:ev.profile,horizon:ev.horizon||180,scenario:ev.scenario||null,scenarioConfig:ev.scenarioConfig||{}},subgroup:isCurrent?null:displayGroups().flatMap(g=>g.subgroups).find(s=>s.candidates.includes(c))?.label,behavior:isCurrent?null:c.behavior,summary:isCurrent?null:summary(c),changes:isCurrent?0:c.changes,
  order:ids.map(id=>({id,name:byId(id).name,family:byId(id).family,ultimate:!!byId(id).ultimate,targeting:byId(id).targeting?.kind||null,cooldown:byId(id).basic?.cooldown??null})),
  baseSlots:base.map(id=>byId(id).name),killsPerMin:v.minPower,sensitivity:v.sensitivity||null,powerChangePct:isCurrent?0:Math.round(power(c)*10)/10,attackers:v.attackers,incomingPerMin:v.incoming,
  sustainPerMin:v.minPerMin,needPerMin:v.need===null?null:v.need-MARGIN,surplusPerMin:v.margin===null?null:v.margin+MARGIN,cooldownIdle180s:ev?.idle??null,casts180s:ev?.casts??null,sustain:sustainRows(ev),encounter:ev?.encounter||null,shinsik:ev?.shinsik||null};
}
function exportData(){
 const r=lastResults,list=picks(),meta=KK?.snapshot?.meta;
 return {schema:'dosul-optimizer-analysis-v1',generatedAt:new Date().toISOString(),engine:DosulSimulation.model,shinsikModel:'shinsik-pve-v1',kkaebigg:meta?{version:meta.sources?.skills?.version||null,fetchedAt:meta.fetchedAt}:null,
  survivalAssessed:!r.start.unassessed,
  goal:r.start.unassessed?'선택 조건에 맞는 구성의 공격 성능과 회복·보호막 생성량 비교 (생존 미평가)':'물약 없이 버티는 범위(스킬 회복·보호막 ≥ 받는 피해 − 자연 회복 + 안전 여유)에서 목표 사냥터 분당 처치 수가 가장 큰 9칸 구성',
  model:{encounter:settings.encounter===true,diagnostics:r.diagnostics||null,incoming:'1마리당 받는 피해 × 동시에 붙는 몹 평균(범위 공격은 사냥터 밀도 × 범위 면적만큼 몹을 끌어옴, 선공 없음)',mPerPx:O.mPerPx,damageRate:O.damageRate,safetyMargin:MARGIN,regenPeriodSeconds:REGEN_PERIOD,search:{iterations:ITERATIONS,feasible:r.feasible,skillSets:r.sets,groupSize:GROUP_SIZE,similarMaxChanges:r.maxChanges}},
  inputs:{incomingConversion:settings.hitDamage!==''?{damagePerHit:Number(settings.hitDamage),intervalSeconds:Number(settings.hitInterval),perMinute:O.incomingFromHit(settings.hitDamage,settings.hitInterval),evasionIncluded:false,reference:'2026-10-19 005352 영상 · 약 1.5초'}:null,targetMode:settings.targetMode,observation:settings.startMode!=='conditions'&&settings.mode==='measure'?{hpCapped:!!settings.measure.hpCapped,damageInference:r.start.unassessed?'unavailable':'estimated'}:null,stats:stats(),regenPerMin:O.regenPerMin(stats()),mode:r.start.unassessed?'생존 미평가':settings.mode==='measure'?'사냥 실측':'직접 입력',measure:settings.startMode!=='conditions'&&settings.mode==='measure'?{...settings.measure,zone:zoneById(settings.zoneFrom)?.name||null,measuredIncomingPerMin:r.start.measured,measuredAttackers:r.start.measuredAttackers}:null,
   incomingPerMonster:r.start.perMob,targetZone:r.start.zone?.name||null,attackScale:r.start.scale,families:searchFamilies(),conditions:settings.startMode==='conditions'?conditions():null,overrides:settings.overrides},
  mechanismGroups:displayGroups().map(g=>({id:g.id,label:g.label,count:g.candidates.length,subgroups:g.subgroups?.map(s=>({id:s.id,label:s.label,count:s.candidates.length}))||[]}))||[],
  current:exportEntry('현재 빌드','current',null,true),
  builds:list.map(x=>exportEntry(x.label,x.label==='추천'?'recommended':x.group,x.c,false)),
  closest:list.length?[]:(r.closest||[]).map((c,i)=>exportEntry(`근접 ${i+1}`,'closest',c,false)),improve:list.length?null:r.improve||null};
}
function exportMarkdown(){
 const d=exportData(),n=v=>v===null||v===undefined?'—':typeof v==='number'?f(v):v,lines=[];
 const block=e=>{
  lines.push(`### ${e.group==='current'?e.label:e.group==='recommended'?'추천 빌드':e.label}${e.group==='current'?'':` · 도술 ${e.changes}개 교체`}`);
  if(!d.survivalAssessed)lines.push('- 생존 미평가');
  if(e.summary)lines.push(`- 요약: ${e.summary}`);
  if(e.encounter)lines.push(`- 이동·몬스터 재등장 실험: 적중당 ${e.encounter.targetsPerHit}명 · 남은 체력을 초과한 피해 ${e.encounter.overkillPct}% · 걸어서 이동 ${e.encounter.walkMetres}m · 도술 이동 ${e.encounter.skillMoveMetres}m · 복귀 ${e.encounter.returns}회`, `- 실험 가정: ${JSON.stringify(e.encounter.assumptions)}`, `- 한계: ${e.encounter.limitations.join(' / ')}`);
  if(e.shinsik){lines.push(`- 신식: ${e.shinsik.active.join(" · ")} · 공간 적중 기준 추가 피해계수 ${e.shinsik.extraCoefficient} (+${e.shinsik.damageGainPct}%)`);for(const r of e.shinsik.rules)lines.push(`- ${r.family} 미반영/가정: ${r.limitations.join(" / ")} · 출처 ${r.source}`);}
  lines.push(`- 분당 처치 ${e.killsPerMin.toFixed(2)}마리${e.group==='current'?'':` (현재 대비 ${e.powerChangePct>=0?'+':''}${e.powerChangePct}%)`} · 동시에 붙는 몹 평균 ${e.attackers.toFixed(2)}마리`);
  lines.push(`- 계산 조건: ${e.evaluationBasis.profile||'기본'} · ${e.evaluationBasis.horizon}초${e.evaluationBasis.scenario?' · '+e.evaluationBasis.scenario:''} (실제 생존 판정 아님)`);
  lines.push(`- 받는 피해 분당 ${n(e.incomingPerMin)} · 회복·보호막 분당 ${n(e.sustainPerMin)} (필요 ${n(e.needPerMin)}, 여유 ${e.surplusPerMin!==null&&e.surplusPerMin>=0?'+':''}${n(e.surplusPerMin)}) · 쿨타임 대기 ${e.cooldownIdle180s??'—'}초/${e.evaluationBasis.horizon}초 · 시전 ${e.casts180s??'—'}회`);
  lines.push(`- 사용 순서: ${e.order.map((o,i)=>`${i+1}. ${skillText(o.id)}`).join(' → ')}`);
  lines.push(`- 기본 장착: ${e.baseSlots.join(' · ')}`);
  if(e.sustain.length){lines.push('',`| 도술 | 효과 | 발동 조건 | 1회량 | ${e.evaluationBasis.horizon}초 발동 | 분당 최대 | 분당 흡수 |`,'|---|---|---|---:|---:|---:|---:|');for(const x of e.sustain)lines.push(`| ${x.skill} | ${x.kind} | ${x.condition} | ${n(x.each)} | ${x.triggers180s} | ${n(x.perMinFull)} | ${n(x.perMinAbsorbed)} |`);}
  lines.push('');
 };
 const i=d.inputs;
 lines.push('# 도술 빌드 최적화 결과 (분석용)','',`생성 ${new Date(d.generatedAt).toLocaleString('ko-KR')} · 엔진 ${d.engine}${d.kkaebigg?` · 깨비지지 ${d.kkaebigg.version||''}`:''}`,'',
  '## 목표와 계산 방식','',`- 목표: ${d.goal}`,`- 받는 피해: ${d.model.incoming}`,
  `- 보정값: 지도 1px ≈ ${d.model.mPerPx}m, 방어 적용 전 피해 = 계수 × 공격력 (실측 보정 없음), 안전 여유 분당 ${f(d.model.safetyMargin)}, 자연 회복 ${d.model.regenPeriodSeconds}초 주기`,
  `- 탐색: ${f(d.model.search.iterations)}회 기준, ${current?.unassessed?'계산 가능한 구성':'버티는 구성'} ${f(d.model.search.feasible)}개 · 도술 조합 ${f(d.model.search.skillSets)}가지 중 그룹별 상위 ${d.model.search.groupSize}개 (비슷한 빌드 = 도술 0~${d.model.search.similarMaxChanges}개 교체)`,
  '- 한계: 피해·회복·보호막은 가정에 따른 계산입니다. 최대 체력에서 버려진 회복과 실제 사망 여부는 계산하지 않으며, 실제 사냥 결과를 대신하지 않습니다.','',
  '## 내 캐릭터와 사냥 기준','',`- 공격력 ${n(i.stats.attack)} · 최대 체력 ${n(i.stats.maxHp)} · 체력 자연 회복 ${n(i.stats.regen)} (분당 ${n(i.regenPerMin)})`,
  i.measure?.hpCapped?'- 사냥 관찰: 측정 중 최대 체력 도달 · 초과 회복을 알 수 없어 받는 피해와 생존 가능 여부를 역산하지 않음':i.measure?`- HP 변화로 추정: ${i.measure.zone||'—'}에서 HP ${n(Number(i.measure.hpStart))} → ${n(Number(i.measure.hpEnd))}, ${i.measure.seconds}초 → 받는 피해 분당 ${n(i.measure.measuredIncomingPerMin)} (평균 ${Number(i.measure.measuredAttackers).toFixed(2)}마리)`:`- 받는 피해 직접 입력`,
  `- 1마리당 받는 피해 분당 ${n(i.incomingPerMonster)} · 목표 사냥터 ${i.targetZone||'—'}${i.attackScale!==1?` (공격력 ${Number(i.attackScale).toFixed(2)}배 환산)`:''}`,`- 쓸 수 있는 계열: ${i.families.join(', ')}`,'',
  '## 현재 빌드','');
 block(d.current);
 if(!d.builds.length)lines.push('## 결과: 가정한 조건에서 회복·보호막이 부족한 구성만 발견','',d.closest.length?`- 가장 근접한 빌드도 분당 ${n(-d.closest[0].surplusPerMin)} 부족합니다(회복·보호막 분당 ${n(d.closest[0].sustainPerMin)} / 필요 ${n(d.closest[0].needPerMin)}).`:'- 탐색한 구성 중 계산 가능한 것이 없습니다.','');
 if(d.improve){lines.push('## 버티려면 무엇을 개선해야 하나','',`가장 근접한 빌드(근접 1) 기준, 하나만 바꿀 때 필요한 값입니다. 가장 나쁜 배치(${d.improve.profile} · ${d.improve.horizon}초)에서 분당 ${n(d.improve.deficit)} 부족합니다.`,'',...improveLines(d.improve).map(x=>'- '+x),'');}
 if(d.closest.length){lines.push('## 가장 근접한 빌드 (계산상 회복 부족)','');d.closest.forEach(block);}
 for(const [g,title] of (lastResults.mechanismGroups?.length?displayGroups().map(g=>[g.id,g.label]):[['recommended','추천 빌드'],['similar','비슷한 빌드'],['different','다른 도술 조합']])){const items=d.builds.filter(b=>b.group===g);if(!items.length)continue;lines.push(`## ${title}`,'');items.forEach(block);}
 lines.push('## 분석 요청 예시','','- 추천 빌드가 실제 사냥에서 물약 없이 버틸지, 가장 큰 위험 요소(검증 안 된 보호막, 범위 몰이 등)를 짚어 줘.',
  '- 비슷한 빌드와 다른 도술 조합 중 처치와 여유의 균형이 가장 좋은 빌드를 고르고 이유를 설명해 줘.','- 다음 실측에서 무엇을 재면 이 결과를 가장 많이 검증할 수 있는지 알려 줘.','',
  '## 원본 데이터 (JSON)','','도술별 회복·보호막과 계산 조건을 포함합니다.','','```json',JSON.stringify(d),'```','');
 return lines.join('\n');
}
async function exportResults(copy){
 const status=q('#opt-export-status'),text=exportMarkdown(),name=`도술-최적화-분석-${new Date().toISOString().slice(0,10)}.md`;
 if(!copy){download(name,text,'text/markdown;charset=utf-8');status.textContent=`${name} 저장`;return;}
 try{await navigator.clipboard.writeText(text);status.textContent=`분석용 텍스트를 복사했습니다 (${f(text.length)}자).`;}
 catch{status.textContent='이 화면에서는 클립보드 복사가 막혀 있습니다. .md 파일로 받아 붙여 넣으세요.';}
}
function buildJson(c){return {schema:'dosul-build-v3',name:'빌드 최적화 결과',baseSlots:c.baseSlots,skills:c.ids,skillNames:c.ids.map(id=>byId(id).name),validation:DosulSequence.validate({...D,baseSlots:c.baseSlots},c.ids),optimizer:{model:DosulSimulation.model,shinsik:c.verification.worst.shinsik,kkaebigg:KK?.snapshot?.meta?.sources||null,measuredIncoming:current.measured,measuredAttackers:current.measuredAttackers,incomingPerMonster:current.perMob,zones:{measured:settings.mode==='measure'?zoneById(settings.zoneFrom)?.name||null:null,target:current.zone?.name||null,attackScale:current.scale},hunt:{killsPerMin:c.verification.minPower,attackers:c.verification.attackers,incoming:c.verification.incoming,mPerPx:O.mPerPx,damageRate:O.damageRate},need:c.verification.need,safetyMargin:MARGIN,coefficient:c.verification.minCoefficient,powerChangePct:Math.round(power(c)*10)/10,sustainPerMin:c.verification.minPerMin,surplusPerMin:left(c),margin:c.verification.margin,stats:stats(),settings}};}
host.addEventListener('input',e=>{
 const t=e.target,map={'opt-attack':'attack','opt-maxhp':'maxHp','opt-regen':'regen','opt-accuracy':'accuracy','opt-critical-hit':'criticalHit','opt-critical-damage':'criticalDamage','opt-defense':'defense','opt-basic-evasion':'basicEvasion','opt-skill-block':'skillBlock','opt-critical-resistance':'criticalResistance','opt-skill-damage-reduction':'skillDamageReduction','opt-normal-damage-up':'normalDamageUp','opt-normal-damage-down':'normalDamageDown','opt-boss-damage-up':'bossDamageUp','opt-boss-damage-down':'bossDamageDown'};
 if(t.id==='opt-free-timeline-range'&&lastResults){freeTimelineZoom=Math.max(.34,Math.min(3,+t.value/100));renderFreeResults(picks());return;}
 if(t.id==='opt-stat-paste'){importStats(t.value);return;}
 if(map[t.id])settings.stats[map[t.id]]=t.value;else if(t.id==='opt-incoming'){settings.incoming=t.value;settings.hitDamage='';renderHitRate();}else if(t.id==='opt-hit-damage'){settings.hitDamage=t.value;settings.hitInterval=1.5;settings.incoming=O.incomingFromHit(settings.hitDamage,settings.hitInterval)??'';renderHitRate();}else if(t.id==='opt-power'){settings.power=t.value;save();renderZone();return;}
 else if(t.id==='opt-hp-start')settings.measure.hpStart=t.value;else if(t.id==='opt-hp-end')settings.measure.hpEnd=t.value;else if(t.id==='opt-seconds')settings.measure.seconds=t.value;
 else if(t.dataset.optOverride){if(t.value==='')delete settings.overrides[t.dataset.optOverride];else settings.overrides[t.dataset.optOverride]=t.value;}
 else return;
 save();renderNeed();
});
host.addEventListener('change',e=>{
 const t=e.target;
 if(t.id==='opt-stat-images'){recognizeStatImages(t.files);return;}
 if(t.id==='opt-ultimate-policy'){if(search)stop('궁극기 조건 변경');const currentUlt=build.map(byId).find(s=>s?.ultimate);settings.useUltimate=t.value!=='off';settings.requiredSkills=(settings.requiredSkills||[]).filter(id=>!byId(id)?.ultimate);if(t.value==='keep'&&currentUlt)settings.requiredSkills.push(currentUlt.id);lastResults=null;q('#opt-results').hidden=true;q('#opt-live').hidden=true;save();context='';sync(true);return;}
 if(t.id==='opt-use-ultimate'){if(search)stop('궁극기 조건 변경');settings.useUltimate=t.checked;if(!t.checked)settings.requiredSkills=(settings.requiredSkills||[]).filter(id=>!byId(id)?.ultimate);lastResults=null;q('#opt-results').hidden=true;q('#opt-live').hidden=true;save();context='';sync(true);return;}
 if(t.id==='opt-hp-capped'){if(search)stop('측정 조건 변경');settings.measure.hpCapped=t.checked;lastResults=null;q('#opt-results').hidden=true;save();sync(true);return;}
 if(t.id==='opt-target-mode'){if(search)stop('공격 대상 변경');lastResults=null;q('#opt-results').hidden=true;q('#opt-live').hidden=true;settings.targetMode=t.value==='single'?'single':'area';save();context='';sync(true);return;}
 if(t.id==='opt-start-mode'||t.dataset.primaryAuto!==undefined||t.dataset.requiredFamily||t.dataset.excludedFamily||t.id==='opt-required-skill'||t.id==='opt-required-shinsik'){
  if(search)stop('조건이 바뀌어 탐색을 중지했습니다.');
  if(t.id==='opt-start-mode'){settings.startMode=t.value;if(t.value==='conditions')settings.mode='incoming';}
  if(t.dataset.primaryAuto!==undefined){settings.primaryFamilies=[];settings.primaryFamily='';settings.requiredFamilies=[];}
  if(t.dataset.requiredFamily){const f=t.dataset.requiredFamily,current=settings.primaryFamilies||[];settings.primaryFamilies=t.checked?[...new Set([...current,f])].slice(0,2):current.filter(x=>x!==f);settings.primaryFamily=settings.primaryFamilies[0]||'';settings.excludedFamilies=(settings.excludedFamilies||[]).filter(x=>!settings.primaryFamilies.includes(x));settings.requiredFamilies=[];settings.requiredSkills=(settings.requiredSkills||[]).filter(id=>!byId(id)?.ultimate||!settings.primaryFamilies.length||settings.primaryFamilies.includes(byId(id).family));settings.requiredShinsik=(settings.requiredShinsik||[]).filter(x=>!settings.primaryFamilies.length||settings.primaryFamilies.includes(x));}
  if(t.dataset.excludedFamily){const f=t.dataset.excludedFamily;if((settings.primaryFamilies||[]).includes(f))return;settings.excludedFamilies=[...new Set([...(settings.excludedFamilies||[]).filter(x=>x!==f),...(t.checked?[f]:[])])];settings.requiredSkills=(settings.requiredSkills||[]).filter(id=>!settings.excludedFamilies.includes(byId(id)?.family));settings.requiredShinsik=(settings.requiredShinsik||[]).filter(f=>!settings.excludedFamilies.includes(f));}
  if(t.id==='opt-required-skill'&&t.value)settings.requiredSkills=[...new Set([...(settings.requiredSkills||[]),t.value])];
  if(t.id==='opt-required-shinsik')settings.requiredShinsik=t.value?[t.value]:[];
  save();sync(true);return;
 }
 // Recalculating runs 13+ simulations and rebuilds the override inputs, so wait until the value is committed.
 if(['opt-hit-damage','opt-attack','opt-maxhp','opt-regen','opt-incoming','opt-hp-start','opt-hp-end','opt-seconds'].includes(t.id)||t.dataset.optOverride){recalc();return;}
 if(t.name==='opt-mode'){settings.mode=t.value;save();renderInputs();renderZone();recalc();return;}
 if(t.id==='opt-zone-from'||t.id==='opt-zone-to'){settings[t.id==='opt-zone-from'?'zoneFrom':'zoneTo']=t.value;save();renderZone();recalc();return;}
 if(t.dataset.optFamily){settings.families=[...host.querySelectorAll('[data-opt-family]')].filter(x=>x.checked).map(x=>x.dataset.optFamily);}
 else return;
 save();if(settings.startMode==='conditions')recalc();else renderNeed();
});
host.addEventListener('click',e=>{
 const timelineZoom=e.target.closest('[data-opt-free-timeline-zoom]');if(timelineZoom&&lastResults){freeTimelineZoom=Math.max(.34,Math.min(3,freeTimelineZoom+(timelineZoom.dataset.optFreeTimelineZoom==='in'?.2:-.2)));renderFreeResults(picks());return;}
 const targetButton=e.target.closest('[data-opt-target-mode]');if(targetButton){if(search)stop('빌드 대상 변경');lastResults=null;q('#opt-results').hidden=true;q('#opt-live').hidden=true;settings.targetMode=targetButton.dataset.optTargetMode==='single'?'single':'area';save();context='';sync(true);return;}
 const openAdvanced=e.target.closest('[data-open-opt-advanced]');if(openAdvanced){const details=q('#opt-advanced-evaluation');details.open=true;details.scrollIntoView?.({block:'nearest',behavior:'smooth'});return;}
 const selectResult=e.target.closest('[data-opt-select-result]');if(selectResult&&lastResults){activeResultPick=Number(selectResult.dataset.optSelectResult);renderFreeResults(picks());return;}
 if(e.target.closest('[data-opt-next-direction]')&&lastResults){const choices=freeDirections(picks()),at=choices.findIndex(x=>x.entry.i===activeResultPick),next=choices[(at+1+choices.length)%choices.length];if(next){activeResultPick=next.entry.i;renderFreeResults(picks());}return;}
 const groupButton=e.target.closest('[data-opt-group]');if(groupButton){activeResultGroup=Number(groupButton.dataset.optGroup);renderResults();return;}
 const toggle=e.target.closest('[data-toggle-required]');if(toggle){if(search)stop('조건 변경');const id=toggle.dataset.toggleRequired,old=settings.requiredSkills||[];settings.requiredSkills=old.includes(id)?old.filter(x=>x!==id):[...old,id];save();sync(true);return;}
 if(e.target.closest('[data-opt-edit]')){try{const initial=startState();if(search)stop('순서 편집');if(settings.startMode==='conditions'){remember();commit([...initial.ids],0,[...initial.baseSlots]);settings.startMode='current';save();context='';toast('표시된 구성을 순서 구성에 적용했습니다. 되돌릴 수 있습니다.');}}catch(error){e.stopPropagation?.();toast(error.message);}return;}

 const remove=e.target.closest('[data-remove-required]');if(remove){if(search)stop('조건 변경');settings.requiredSkills=settings.requiredSkills.filter(id=>id!==remove.dataset.removeRequired);save();sync(true);return;}
 if(e.target.closest('#opt-run'))run();
 if(e.target.closest('#opt-cancel'))stop('중지했습니다.');
 if(lastResults&&e.target.closest('#opt-export-md'))exportResults(false);
 if(lastResults&&e.target.closest('#opt-export-copy'))exportResults(true);
 const apply=e.target.closest('[data-opt-apply]'),json=e.target.closest('[data-opt-json]');
 if(apply&&lastResults){const c=picks()[+apply.dataset.optApply].c;remember();commit([...c.ids],Math.min(c.ids.length,8),[...c.baseSlots]);toast('최적화 결과를 사용 순서와 기본 장착에 적용했습니다. 되돌리기 가능');}
 if(json&&lastResults){const c=picks()[+json.dataset.optJson].c;download('도술-최적화-빌드.json',JSON.stringify(buildJson(c),null,2));}
});
host.addEventListener('wheel',e=>{if(!e.ctrlKey||!e.target.closest?.('#opt-result-timeline .recommend-timelines')||!lastResults)return;e.preventDefault();freeTimelineZoom=Math.max(.34,Math.min(3,freeTimelineZoom+(e.deltaY<0?.1:-.1)));renderFreeResults(picks());},{passive:false});
document.addEventListener('click',e=>{if(e.target.closest('[data-tab="optimizer"]'))sync();else if(e.target.closest('[data-tab]')&&search)stop('다른 화면으로 이동해 중지했습니다.');});
window.syncBuildOptimizer=()=>{if(host.classList.contains('active'))sync();else context='';};
// The current-build verification runs 12 simulations, so wait until the tab is opened.
if(host.classList.contains('active'))sync(true);
})();
