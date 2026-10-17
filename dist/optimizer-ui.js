(function(){
'use strict';
const O=window.DosulOptimizer,KK=window.DosulKkaebigg,ZONES=window.DOSUL_HUNTING?.zones||[],host=document.querySelector('#optimizer');if(!host||!O)return;
const FAMILIES=['절명','연타','강타','척살','저격','주술','파멸','강인','기동','헌신','기만','제압'];
// One fixed search depth and safety margin: the screen only asks for what the player can measure.
const ITERATIONS=4000,MARGIN=1000,REGEN_PERIOD=5,SEARCH_PROFILE='185547',STORE='dosul-optimizer-v1';
const q=sel=>host.querySelector(sel),f=n=>n===null||n===undefined||!Number.isFinite(n)?'—':Math.round(n).toLocaleString('ko-KR'),signed=n=>(n>=0?'+':'')+f(n);
let settings={stats:{attack:'',maxHp:'',regen:''},mode:'measure',incoming:'',measure:{hpStart:'',hpEnd:'',seconds:''},overrides:{},families:null,single:null,zoneFrom:'',zoneTo:'',power:''};
try{const v=JSON.parse(localStorage.getItem(STORE)||'null');if(v&&typeof v==='object')settings={...settings,...v,stats:{...settings.stats,...v.stats},measure:{...settings.measure,...v.measure},overrides:{...v.overrides}};}catch{}
// Older saves: the "keep current sustain" mode, margin, depth and regen period are gone.
if(settings.mode!=='incoming')settings.mode='measure';delete settings.margin;delete settings.depth;delete settings.stats.regenPeriod;
let context='',current=null,search=null,timer=0,lastResults=null,resultContext='';
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(settings));}catch{}};
const num=v=>v===''||v===null||v===undefined?NaN:Number(v);
const stats=()=>({attack:num(settings.stats.attack),maxHp:num(settings.stats.maxHp),regen:num(settings.stats.regen)||0,regenPeriod:REGEN_PERIOD});
const familiesOf=ids=>[...new Set(ids.map(id=>byId(id)?.family).filter(Boolean))];
const damaging=ids=>ids.map(byId).filter(s=>s&&s.damage!==false);
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
<label><input type="radio" name="opt-mode" value="incoming"> 분당 받는 피해 직접 입력</label></div>
<div id="opt-measure-row" class="opt-inline">
<label>측정 사냥터<select id="opt-zone-from" aria-label="실측한 사냥터"></select></label>
<label>시작 HP<input id="opt-hp-start" type="number" min="0" inputmode="numeric"></label><label>끝 HP<input id="opt-hp-end" type="number" min="0" inputmode="numeric"></label><label>측정 시간 (초)<input id="opt-seconds" type="number" min="1" inputmode="numeric"></label>
<details class="opt-guide"><summary>측정 방법</summary><ul>
<li>물약 자동 사용을 끄고, 평소처럼(같은 빌드·같은 몰이 규모) 사냥합니다.</li>
<li>HP 50~70%에서 시작하고, 측정 중 최대치나 0에 닿지 않게 합니다. 최대치에 닿으면 넘친 회복을 알 수 없습니다.</li>
<li>측정 내내 전투를 이어 갑니다. 전투가 끊기면 자연 회복이 1초마다 들어와 결과가 달라집니다.</li>
<li>측정 중에는 빌드·장비를 바꾸지 않습니다. 3~5분이면 충분합니다.</li></ul></details></div>
<div id="opt-incoming-row" class="opt-inline"><label>분당 받는 피해<input id="opt-incoming" type="number" min="0" inputmode="numeric"></label></div>
<div class="opt-zone"><label>목표 사냥터<select id="opt-zone-to" aria-label="사냥할 사냥터"></select></label><label>내 전투력 <small>(선택)</small><input id="opt-power" type="number" min="0" inputmode="numeric"></label><p id="opt-zone" class="opt-caption"></p></div>
<p id="opt-need" class="opt-need" role="status"></p></section>
<section class="opt-panel" aria-labelledby="opt-scope-title"><h2 id="opt-scope-title">3 · 쓸 수 있는 도술</h2>
<p class="opt-caption">열린 신식 계열</p><div id="opt-families" class="opt-families"></div>
<label class="opt-check"><input id="opt-single" type="checkbox"> 단일 대상 도술만 <small>범위 공격은 여러 몹을 끌어와 받는 피해가 달라집니다. 공격하지 않는 회복은 허용합니다.</small></label>
<p id="opt-ultimate" class="opt-caption"></p></section>
</div>
<div class="opt-run"><button id="opt-run" class="primary">최적화 실행</button><button id="opt-cancel" hidden>중지</button><progress id="opt-progress" max="1" value="0" hidden></progress><span id="opt-status" role="status" aria-live="polite"></span></div>
<section id="opt-results" hidden aria-label="최적화 결과"><p id="opt-stale" class="opt-warning" hidden>빌드나 입력이 바뀌었습니다. 아래 결과는 이전 기준입니다.</p>
<div id="opt-card" class="opt-card"></div>
<details id="opt-others" class="opt-more"><summary>다른 후보 보기 <span id="opt-others-count"></span></summary>
<div class="opt-table-wrap"><table class="opt-table opt-results"><thead><tr><th>구분</th><th>사용 순서</th><th>기본 장착</th><th>스킬 파워</th><th>분당 여유</th><th></th></tr></thead><tbody id="opt-results-body"></tbody></table></div></details></section>
<details id="opt-basis" class="opt-assumptions"><summary>계산 근거 보기</summary>
<div id="opt-data" class="opt-data"><span id="opt-data-text"></span><button id="opt-sync">깨비지지 동기화</button><span id="opt-sync-status" role="status" aria-live="polite"></span></div>
<div class="opt-section-title"><h2>현재 빌드의 회복·보호막</h2><span id="opt-current-total"></span></div>
<p class="opt-caption">도술 설명의 수치와 시뮬레이션 발동 횟수(영상 03 배치 · 180초)로 계산합니다. 게임에서 확인한 1회량이 다르면 실측 칸에 입력하세요. 보호막·피해 감소는 깨비지지 버프 사전의 지속시간·중복 규칙과 받는 피해로 실제 흡수·감소량을 계산합니다.</p>
<div class="opt-table-wrap"><table class="opt-table opt-sources"><thead><tr><th>도술</th><th>효과</th><th>발동</th><th>1회량</th><th>실측 1회량</th><th>지속 · 중복</th><th>180초 발동</th><th>분당 최대</th><th>분당 반영</th></tr></thead><tbody id="opt-sources"></tbody></table></div>
<ul id="opt-unquantified" class="opt-unquantified"></ul>
<h3>계산 기준과 한계</h3><ul>
<li>목표: 스킬 회복·보호막(분당) ≥ 받는 피해 − 자연 회복 + 안전 여유 ${f(MARGIN)}을 지키는 구성 중 직접 피해 계수가 가장 큰 구성. 자연 회복은 전투 중 ${REGEN_PERIOD}초마다 들어온다고 봅니다.</li>
<li>궁극기와 도술 수는 현재 빌드를 유지하고, 선택한 계열의 일반 도술로 구성·사용 순서·기본 장착을 바꿉니다. 궁극기의 기본 장착 조건은 항상 지킵니다.</li>
<li>회복·보호막은 도술 설명의 공격력·최대 체력 비율과 고정값으로 계산합니다. 조건부 효과는 시뮬레이션에서 조건이 성립한 적중만 셉니다.</li>
<li>보호막은 지속시간이 지나면 사라지고, 같은 버프가 다시 걸리면 중복 규칙(교체·중첩)에 따라 남은 양이 버려집니다. 받는 피해가 일정하게 들어온다고 보고 받는 피해 감소 → 먼저 끝나는 보호막 순으로 막습니다.</li>
<li>받는 피해 감소는 버프 사전에서 지속시간이 하나로 확정될 때만 유지율로 계산합니다. 방어력 증가는 공식이 없어 제외합니다.</li>
<li>사냥 실측은 받는 피해 = 현재 빌드의 회복·보호막 흡수 + 자연 회복 − 순 체력 변화로 역산하며, 흡수량이 받는 피해에 따라 달라지므로 값이 수렴할 때까지 반복합니다. 방어력·회피는 실측값에 이미 들어 있습니다.</li>
<li>목표 사냥터가 측정 사냥터와 다르면 출현 지점 수로 가중한 몬스터 평균 공격력의 비율만큼 받는 피해를 늘리거나 줄입니다(추정). 동시에 붙는 몹 수와 공격 주기는 같다고 봅니다.</li>
<li>탐색은 영상 03 배치·180초에서 ${f(ITERATIONS)}회 진행하고, 상위 후보를 4개 배치 × 60·120·180초로 다시 계산해 가장 나쁜 값으로 판정합니다.</li>
<li>스킬 파워(직접 피해 계수)는 실전 DPS가 아닙니다. 출혈·조건부 피해·방어력 감소·궁극기 증폭은 빠져 있습니다. 결과는 실제 사냥으로 확인하세요.</li></ul></details>
</div>`;

// Evaluate once keeping the run, derive incoming damage (a fixed point for measurements), then evaluate with it.
function evalCurrent(){
 const ctx={stats:stats(),overrides:settings.overrides,singleOnly:false,profile:SEARCH_PROFILE,horizon:180};
 const base=O.evaluate(D,build,D.baseSlots,{...ctx,keepRun:true});if(!base.valid)return {valid:false,issue:base.issue};
 let incoming=null,how=null,error=null;
 if(settings.mode==='incoming'){const v=num(settings.incoming);if(v>0){incoming=v;how='입력';}else error='분당 받는 피해를 입력하세요.';}
 else{
  const m=settings.measure;how='실측';
  if(num(m.hpEnd)>=stats().maxHp)error='끝 HP가 최대 체력에 닿아 넘친 회복을 알 수 없습니다. 최대치 전에 측정을 끝내세요.';
  else if(num(m.hpEnd)===0)error='끝 HP가 0이면 받는 피해를 알 수 없습니다. 0에 닿기 전에 측정을 끝내세요.';
  else{incoming=O.calibrate({sustainAt:base.sustainAt,stats:stats(),hpStart:num(m.hpStart),hpEnd:num(m.hpEnd),seconds:num(m.seconds)});if(incoming===null)error='시작 HP, 끝 HP, 측정 시간을 입력하세요.';}
 }
 const from=settings.mode==='measure'?zoneById(settings.zoneFrom):null,to=zoneById(settings.zoneTo);
 const scale=incoming&&from&&to&&from!==to?O.zoneScale(from,to):1,target=incoming?incoming*scale:null;
 const r=target?O.evaluate(D,build,D.baseSlots,{...ctx,incoming:target}):base;
 return {...r,verification:O.verify(D,build,D.baseSlots,{...ctx,incoming:target,need:null}),incoming,target,scale,how,incomingError:error};
}
// value: what skills must restore per minute (with the safety margin); bare: the same without it.
function needed(){
 if(!current?.valid)return {value:null,text:'현재 빌드를 계산할 수 없습니다: '+(current?.issue||'원인 미확인')};
 if(current.incomingError||!current.incoming)return {value:null,text:current.incomingError||'받는 피해를 계산할 수 없습니다.'};
 const regen=O.regenPerMin(stats()),bare=current.target-regen,value=bare+MARGIN,moved=current.scale!==1?` × 사냥터 공격력 ${current.scale.toFixed(2)}배 = ${f(current.target)} (추정)`:'';
 const have=current.verification.valid?current.verification.minPerMin:current.perMin,left=have-bare;
 return {value,bare,have,text:`받는 피해 ${f(current.incoming)} (${current.how})${moved} − 자연 회복 ${f(regen)} + 안전 여유 ${f(MARGIN)} → 스킬 회복·보호막 분당 ${f(value)} 이상`,status:`현재 빌드: 분당 ${f(have)} · ${left>=0?'물약 없이 버팀 (+'+f(left)+')':'부족 ('+f(left)+')'}`};
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
 const fams=settings.families||familiesOf(build),list=O.pool(D,build,{families:fams,singleOnly:!!settings.single}).flatMap(id=>O.sources(byId(id)).sources).filter(s=>!(Number(settings.overrides[s.key])>0));
 const need=O.needsStats(list),st=stats(),miss=[];if(need.maxHp&&!(st.maxHp>0))miss.push('최대 체력');if(need.attack&&!(st.attack>0))miss.push('공격력');return miss;
}
function renderInputs(){
 q('#opt-attack').value=settings.stats.attack;q('#opt-maxhp').value=settings.stats.maxHp;q('#opt-regen').value=settings.stats.regen;
 host.querySelectorAll('[name="opt-mode"]').forEach(x=>x.checked=x.value===settings.mode);
 q('#opt-incoming').value=settings.incoming;q('#opt-hp-start').value=settings.measure.hpStart;q('#opt-hp-end').value=settings.measure.hpEnd;q('#opt-seconds').value=settings.measure.seconds;
 q('#opt-incoming-row').hidden=settings.mode!=='incoming';q('#opt-measure-row').hidden=settings.mode!=='measure';
 const fams=settings.families||familiesOf(build);
 q('#opt-families').innerHTML=FAMILIES.map(x=>`<label><input type="checkbox" data-opt-family="${x}" ${fams.includes(x)?'checked':''}>${styleBadge({family:x})}</label>`).join('');
 q('#opt-single').checked=settings.single??damaging(build).every(s=>s.targeting?.kind==='single');
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
 const ult=build.map(byId).find(s=>s?.ultimate);q('#opt-ultimate').textContent=ult?`궁극기 ${ult.name}은 유지하고, ${ult.family} 기본 장착 조건을 지키는 구성만 찾습니다.`:'궁극기가 없으면 일반 도술만 탐색합니다.';
 q('#opt-run').disabled=!!search||!current?.valid||n.value===null||miss.length>0;
 if(lastResults)q('#opt-stale').hidden=resultContext===key();
}
function key(){return JSON.stringify([build,D.baseSlots,settings]);}
function sync(force){
 const empty=!build.length;q('#opt-empty').hidden=!empty;q('#opt-work').hidden=empty;renderData();
 q('#opt-build').innerHTML=build.map((id,i)=>`<span><small>${String(i+1).padStart(2,'0')}</small>${icon(byId(id))}<b>${esc(byId(id).name)}</b>${styleBadge(byId(id))}</span>`).join('');
 q('#opt-equipment').textContent=build.length?'기본 장착: '+(D.baseSlots.map(id=>byId(id)?.name).join(' · ')||'없음'):'';
 if(empty)return;
 const k=key();if(!force&&k===context)return;context=k;
 current=evalCurrent();renderInputs();renderZone();renderCurrent();renderNeed();
}
function recalc(){current=evalCurrent();renderCurrent();renderNeed();}
function stop(message){clearTimeout(timer);search=null;q('#opt-cancel').hidden=true;q('#opt-progress').hidden=true;if(message)q('#opt-status').textContent=message;renderNeed();}
function run(){
 const n=needed();if(n.value===null)return;const fams=settings.families||familiesOf(build);
 search=O.createSearch(D,{ids:[...build],baseSlots:[...D.baseSlots]},{stats:stats(),overrides:settings.overrides,families:fams,singleOnly:q('#opt-single').checked,need:n.value,incoming:current.target,iterations:ITERATIONS,profile:SEARCH_PROFILE,seed:20261018});
 resultContext=key();q('#opt-cancel').hidden=false;q('#opt-progress').hidden=false;q('#opt-run').disabled=true;q('#opt-status').textContent=`후보 도술 ${search.pool.length}개에서 탐색 중`;
 const tick=()=>{if(!search)return;const p=search.step(40);q('#opt-progress').value=p.done/p.total;q('#opt-status').textContent=`${f(p.done)} / ${f(p.total)}회 · 버티는 구성 ${f(p.feasible)}개`;
  if(!p.finished){timer=setTimeout(tick,0);return;}
  q('#opt-status').textContent='상위 후보를 모든 배치·구간에서 다시 계산하는 중';timer=setTimeout(()=>{const s=search;if(!s)return;lastResults={...s.results(5),need:n.value,bare:n.bare,start:current};stop(`완료 · ${f(p.evaluated)}개 구성 계산`);renderResults();},0);};
 timer=setTimeout(tick,0);
}
const power=c=>{const base=lastResults.start.coefficient;return base?(c.verification.minCoefficient/base-1)*100:0;};
const pct=x=>(x>=0?'+':'')+x.toFixed(1)+'%';
const left=c=>c.verification.minPerMin-lastResults.bare;
const same=(a,b)=>a.ids.join()===b.ids.join()&&a.baseSlots.join()===b.baseSlots.join();
// The first pick is the recommendation; the roomiest near-best build and the runners-up are alternatives.
function picks(){const list=lastResults.best.map((c,i)=>({label:i?`후보 ${i+1}`:'추천',c}));const s=lastResults.safest;if(s&&!lastResults.best.some(c=>same(c,s)))list.splice(1,0,{label:'여유 우선',c:s});return list;}
function order(c){const changed=c.ids.filter(id=>!build.includes(id));return c.ids.map((id,n)=>`<span class="${changed.includes(id)?'opt-new':''}">${n+1}. ${esc(byId(id).name)}</span>`).join('');}
function card(c){
 const start={ids:build,baseSlots:D.baseSlots},unchanged=same(c,start),l=left(c);
 return `<div class="opt-card-head"><h2>추천 빌드</h2><span class="opt-verdict ${l>=0?'ok':'bad'}">${l>=0?'물약 없이 버팀':'부족'} · 분당 ${signed(l)}</span></div>
<div class="opt-metrics"><div><small>스킬 파워 (현재 대비)</small><b>${pct(power(c))}</b><span>직접 피해 계수 ${f(lastResults.start.coefficient)} → ${f(c.verification.minCoefficient)}</span></div>
<div><small>분당 회복·보호막 (가장 나쁜 배치)</small><b>${f(c.verification.minPerMin)}</b><span>필요 ${f(lastResults.bare)} · 안전 여유 ${f(MARGIN)} 포함 ${f(lastResults.need)}</span></div></div>
${unchanged?'<p class="opt-caption">현재 빌드가 이미 이 조건에서 가장 강합니다.</p>':''}
<div class="opt-order">${order(c)}</div><p class="opt-caption">기본 장착: ${c.baseSlots.map(id=>esc(byId(id).name)).join(' · ')} · <span class="opt-new">초록색</span>은 새로 들어온 도술</p>
<div class="opt-card-actions"><button class="primary" data-opt-apply="0"${unchanged?' disabled':''}>이 빌드 적용</button><button data-opt-json="0">JSON 저장</button></div>`;
}
function row(label,c,i){
 return `<tr><td><b>${label}</b></td><td class="opt-order">${order(c)}</td><td>${c.baseSlots.map(id=>esc(byId(id).name)).join(' · ')}</td><td>${pct(power(c))}<small>${f(c.verification.minCoefficient)}</small></td><td class="${left(c)<MARGIN?'opt-warning':''}">${signed(left(c))}</td><td><button data-opt-apply="${i}">적용</button><button data-opt-json="${i}">JSON</button></td></tr>`;
}
function renderResults(){
 q('#opt-results').hidden=false;q('#opt-stale').hidden=true;
 const list=picks(),rest=list.slice(1);
 q('#opt-card').innerHTML=list.length?card(list[0].c):`<div class="opt-card-head"><h2>물약 없이 버티는 구성을 찾지 못했습니다</h2></div><p>현재 빌드는 분당 ${f(lastResults.start.verification.valid?lastResults.start.verification.minPerMin:lastResults.start.perMin)}, 필요한 양은 분당 ${f(lastResults.bare)}입니다. 쓸 수 있는 계열을 더 열거나, 단일 대상만 조건을 풀거나, 더 쉬운 사냥터를 고르세요.</p>`;
 q('#opt-card').classList.toggle('opt-card-empty',!list.length);
 q('#opt-others').hidden=!rest.length;q('#opt-others-count').textContent=rest.length?`(${rest.length})`:'';
 q('#opt-results-body').innerHTML=rest.map((x,i)=>row(x.label,x.c,i+1)).join('');
}
function buildJson(c){return {schema:'dosul-build-v3',name:'빌드 최적화 결과',baseSlots:c.baseSlots,skills:c.ids,skillNames:c.ids.map(id=>byId(id).name),validation:DosulSequence.validate({...D,baseSlots:c.baseSlots},c.ids),optimizer:{model:DosulSimulation.model,kkaebigg:KK?.snapshot?.meta?.sources||null,incoming:current.incoming,targetIncoming:current.target,zones:{measured:settings.mode==='measure'?zoneById(settings.zoneFrom)?.name||null:null,target:zoneById(settings.zoneTo)?.name||null,attackScale:current.scale},need:lastResults.need,safetyMargin:MARGIN,coefficient:c.verification.minCoefficient,powerChangePct:Math.round(power(c)*10)/10,sustainPerMin:c.verification.minPerMin,surplusPerMin:left(c),margin:c.verification.margin,stats:stats(),settings}};}
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
 else if(t.id==='opt-single')settings.single=t.checked;else return;
 save();renderNeed();
});
host.addEventListener('click',e=>{
 if(e.target.closest('#opt-sync'))syncKkaebigg();
 if(e.target.closest('#opt-reload'))location.reload();
 if(e.target.closest('#opt-run'))run();
 if(e.target.closest('#opt-cancel'))stop('중지했습니다.');
 const apply=e.target.closest('[data-opt-apply]'),json=e.target.closest('[data-opt-json]');
 if(apply&&lastResults){const c=picks()[+apply.dataset.optApply].c;remember();commit([...c.ids],Math.min(c.ids.length,8),[...c.baseSlots]);toast('최적화 결과를 사용 순서와 기본 장착에 적용했습니다. 되돌리기 가능');}
 if(json&&lastResults){const c=picks()[+json.dataset.optJson].c;download('도술-최적화-빌드.json',JSON.stringify(buildJson(c),null,2));}
});
document.addEventListener('click',e=>{if(e.target.closest('[data-tab="optimizer"]'))sync();else if(e.target.closest('[data-tab]')&&search)stop('다른 화면으로 이동해 중지했습니다.');});
window.syncBuildOptimizer=()=>{if(host.classList.contains('active'))sync();else context='';};
// The current-build verification runs 12 simulations, so wait until the tab is opened.
if(host.classList.contains('active'))sync(true);
})();
