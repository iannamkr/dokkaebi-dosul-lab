(function(){
'use strict';
const O=window.DosulOptimizer,KK=window.DosulKkaebigg,host=document.querySelector('#optimizer');if(!host||!O)return;
const FAMILIES=['절명','연타','강타','척살','저격','주술','파멸','강인','기동','헌신','기만','제압'];
const DEPTHS={fast:1500,normal:4000,deep:10000},SEARCH_PROFILE='185547',STORE='dosul-optimizer-v1';
const q=sel=>host.querySelector(sel),f=n=>n===null||n===undefined||!Number.isFinite(n)?'—':Math.round(n).toLocaleString('ko-KR'),signed=n=>(n>=0?'+':'')+f(n);
let settings={stats:{attack:'',maxHp:'',regen:'',regenPeriod:5},mode:'current',incoming:'',measure:{hpStart:'',hpEnd:'',seconds:''},margin:0,overrides:{},families:null,single:null,depth:'normal'};
try{const v=JSON.parse(localStorage.getItem(STORE)||'null');if(v&&typeof v==='object')settings={...settings,...v,stats:{...settings.stats,...v.stats},measure:{...settings.measure,...v.measure},overrides:{...v.overrides}};}catch{}
let context='',current=null,search=null,timer=0,lastResults=null,resultContext='';
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(settings));}catch{}};
const num=v=>v===''||v===null||v===undefined?NaN:Number(v);
const stats=()=>({attack:num(settings.stats.attack),maxHp:num(settings.stats.maxHp),regen:num(settings.stats.regen)||0,regenPeriod:num(settings.stats.regenPeriod)||5});
const familiesOf=ids=>[...new Set(ids.map(id=>byId(id)?.family).filter(Boolean))];
const damaging=ids=>ids.map(byId).filter(s=>s&&s.damage!==false);
const ruleText={Replace:'교체',Stack:'중첩',Impossible:'중복 불가',StackLifeReset:'중첩·시간 초기화',StackLifeExtension:'중첩·시간 연장'};

host.innerHTML=`<div class="sim-heading"><div><h1>빌드 최적화 <span>현재 빌드 기준 · 비교 모델</span></h1><p>순서 구성의 빌드를 출발점으로 사용 순서·도술 구성·기본 장착을 다시 찾습니다. 회복·보호막을 기준 이상으로 지키면서 직접 피해 계수가 가장 큰 구성을 고릅니다.</p></div><div class="sim-actions"><button data-tab="explore">← 순서 수정</button></div></div>
<div id="opt-data" class="opt-data"><span id="opt-data-text"></span><button id="opt-sync">깨비지지 동기화</button><span id="opt-sync-status" role="status" aria-live="polite"></span></div>
<div id="opt-build" class="sim-build"></div><div id="opt-equipment" class="sim-caption"></div>
<div id="opt-empty" hidden><b>먼저 사용할 도술을 배치하세요.</b><p>순서 구성에서 만든 빌드를 출발점으로 사용합니다.</p><button data-tab="explore">도술 배치하기 →</button></div>
<div id="opt-work">
<div class="opt-grid">
<section class="opt-panel" aria-labelledby="opt-stats-title"><h2 id="opt-stats-title">1 · 캐릭터 수치</h2>
<label>공격력<input id="opt-attack" type="number" min="0" inputmode="numeric"></label><label>최대 체력<input id="opt-maxhp" type="number" min="0" inputmode="numeric"></label>
<label>체력 자연 회복<input id="opt-regen" type="number" min="0" inputmode="numeric" placeholder="0"></label><label>회복 주기 (초)<input id="opt-regen-period" type="number" min="1" step="0.1"></label>
<p id="opt-stats-note" class="sim-caption"></p></section>
<section class="opt-panel" aria-labelledby="opt-need-title"><h2 id="opt-need-title">2 · 버텨야 할 기준</h2>
<div class="opt-modes" role="radiogroup" aria-label="생존 기준">
<label><input type="radio" name="opt-mode" value="current"> 현재 빌드의 회복·보호막 이상 유지</label>
<label><input type="radio" name="opt-mode" value="incoming"> 분당 받는 피해 직접 입력</label>
<label><input type="radio" name="opt-mode" value="measure"> 사냥 실측으로 계산 <small>(현재 빌드로 측정)</small></label></div>
<div id="opt-incoming-row" class="opt-inline"><label>분당 받는 피해<input id="opt-incoming" type="number" min="0" inputmode="numeric"></label></div>
<div id="opt-measure-row" class="opt-inline"><label>시작 HP<input id="opt-hp-start" type="number" min="0"></label><label>끝 HP<input id="opt-hp-end" type="number" min="0"></label><label>측정 시간 (초)<input id="opt-seconds" type="number" min="1"></label></div>
<label class="opt-inline">추가 여유 (분당)<input id="opt-margin" type="number" step="100"></label>
<p id="opt-need" class="opt-need" role="status"></p></section>
<section class="opt-panel" aria-labelledby="opt-scope-title"><h2 id="opt-scope-title">3 · 탐색 범위</h2>
<p class="sim-caption">사용할 수 있는 계열 (열린 신식)</p><div id="opt-families" class="opt-families"></div>
<label class="opt-check"><input id="opt-single" type="checkbox"> 단일 대상 도술만 <small>범위 공격은 여러 몹을 끌어와 받는 피해 기준이 달라집니다. 공격하지 않는 회복은 허용합니다.</small></label>
<label class="opt-inline">탐색 강도<select id="opt-depth"><option value="fast">빠르게 · 1,500회</option><option value="normal">보통 · 4,000회</option><option value="deep">깊게 · 10,000회</option></select></label>
<p id="opt-ultimate" class="sim-caption"></p></section>
</div>
<div class="sim-section-title"><h2>현재 빌드의 회복·보호막</h2><span id="opt-current-total"></span></div>
<p class="sim-caption">도술 설명의 수치와 시뮬레이션 발동 횟수(영상 03 배치 · 180초)로 계산합니다. 게임에서 확인한 1회량이 다르면 실측 칸에 입력하세요. 보호막·피해 감소는 깨비지지 버프 사전의 지속시간·중복 규칙과 받는 피해로 실제 흡수·감소량을 계산합니다. 받는 피해를 모르면(현재 빌드 기준) 보호막은 최대치로 셉니다.</p>
<div class="sim-table-wrap"><table class="sim-table opt-sources"><thead><tr><th>도술</th><th>효과</th><th>발동</th><th>1회량</th><th>실측 1회량</th><th>지속 · 중복</th><th>180초 발동</th><th>분당 최대</th><th>분당 반영</th></tr></thead><tbody id="opt-sources"></tbody></table></div>
<ul id="opt-unquantified" class="opt-unquantified"></ul>
<div class="opt-run"><button id="opt-run" class="primary">최적화 실행</button><button id="opt-cancel" hidden>중지</button><progress id="opt-progress" max="1" value="0" hidden></progress><span id="opt-status" role="status" aria-live="polite"></span></div>
<section id="opt-results" hidden aria-label="최적화 결과"><div class="sim-section-title"><h2>최적화 결과</h2><span id="opt-results-meta"></span></div><p id="opt-stale" class="sim-warning" hidden>빌드나 입력이 바뀌었습니다. 아래 결과는 이전 기준입니다.</p>
<div class="sim-table-wrap"><table class="sim-table opt-results"><thead><tr><th>구분</th><th>사용 순서</th><th>기본 장착</th><th>직접 피해 계수</th><th>분당 회복·보호막 (최저)</th><th>기준 대비 여유</th><th></th></tr></thead><tbody id="opt-results-body"></tbody></table></div></section>
<details class="sim-assumptions"><summary>계산 기준과 한계</summary><ul>
<li>궁극기와 도술 수는 현재 빌드를 유지하고, 선택한 계열의 일반 도술로 구성·사용 순서·기본 장착을 바꿉니다.</li>
<li>회복·보호막은 도술 설명의 공격력·최대 체력 비율과 고정값으로 계산합니다. 조건부 효과는 시뮬레이션에서 조건이 성립한 적중만 셉니다.</li>
<li>보호막은 지속시간이 지나면 사라지고, 같은 버프가 다시 걸리면 중복 규칙(교체·중첩)에 따라 남은 양이 버려집니다. 받는 피해가 일정하게 들어온다고 보고 받는 피해 감소 → 먼저 끝나는 보호막 순으로 막습니다.</li>
<li>받는 피해 감소는 버프 사전에서 지속시간이 하나로 확정될 때만 유지율로 계산합니다. 같은 이름의 후보가 여러 지속시간이면 계산하지 않고 목록으로 표시합니다. 방어력 증가는 공식이 없어 제외합니다.</li>
<li>사냥 실측 계산은 받는 피해 = 현재 빌드의 회복·보호막 흡수 + 자연 회복 − 순 체력 변화이며, 흡수량이 받는 피해에 따라 달라지므로 값이 수렴할 때까지 반복합니다. 측정 중 체력이 최대치에 닿으면 넘친 회복이 빠져 부정확합니다.</li>
<li>몬스터 공격력은 어느 자료에도 없어 받는 피해는 입력이나 실측으로만 정합니다.</li>
<li>탐색은 영상 03 배치·180초에서 진행하고, 상위 후보를 4개 배치 × 60·120·180초로 다시 계산해 가장 나쁜 값으로 판정합니다.</li>
<li>직접 피해 계수는 실전 DPS가 아닙니다. 출혈·조건부 피해·방어력 감소·궁극기 증폭은 빠져 있습니다. 결과는 실제 사냥으로 확인하세요.</li></ul></details>
</div>`;

// Evaluate once keeping the run, derive incoming damage (a fixed point for measurements), then evaluate with it.
function evalCurrent(){
 const ctx={stats:stats(),overrides:settings.overrides,singleOnly:false,profile:SEARCH_PROFILE,horizon:180};
 const base=O.evaluate(D,build,D.baseSlots,{...ctx,keepRun:true});if(!base.valid)return {valid:false,issue:base.issue};
 let incoming=null,how=null,error=null;
 if(settings.mode==='incoming'){const v=num(settings.incoming);if(v>0){incoming=v;how='입력';}else error='분당 받는 피해를 입력하세요.';}
 else if(settings.mode==='measure'){
  const m=settings.measure;how='실측 역산';
  if(num(m.hpEnd)>=stats().maxHp)error='끝 HP가 최대 체력에 닿아 넘친 회복을 알 수 없습니다. 최대치 전에 측정을 끝내세요.';
  else{incoming=O.calibrate({sustainAt:base.sustainAt,stats:stats(),hpStart:num(m.hpStart),hpEnd:num(m.hpEnd),seconds:num(m.seconds)});if(incoming===null)error='시작 HP, 끝 HP, 측정 시간을 입력하세요.';}
 }
 const r=incoming?O.evaluate(D,build,D.baseSlots,{...ctx,incoming}):base;
 return {...r,verification:O.verify(D,build,D.baseSlots,{...ctx,incoming,need:null}),incoming,how,incomingError:error};
}
function needed(){
 if(!current?.valid)return {value:null,text:'현재 빌드를 계산할 수 없습니다.'};
 const margin=Number(settings.margin)||0,regen=O.regenPerMin(stats());
 if(settings.mode==='current'){const base=current.verification.valid?current.verification.minPerMin:current.perMin;return {value:base+margin,text:`현재 빌드 최저 ${f(base)} ${margin?signed(margin)+' ':''}→ 분당 ${f(base+margin)} 이상 (보호막 최대치 기준)`};}
 if(current.incomingError||!current.incoming)return {value:null,text:current.incomingError||'받는 피해를 계산할 수 없습니다.'};
 const value=current.incoming-regen+margin;
 return {value,text:`받는 피해 ${f(current.incoming)} (${current.how}) − 자연 회복 ${f(regen)} ${margin?signed(margin)+' ':''}→ 스킬 회복·보호막 분당 ${f(value)} 이상`};
}
function missingStats(){
 const fams=settings.families||familiesOf(build),list=O.pool(D,build,{families:fams,singleOnly:!!settings.single}).flatMap(id=>O.sources(byId(id)).sources).filter(s=>!(Number(settings.overrides[s.key])>0));
 const need=O.needsStats(list),st=stats(),miss=[];if(need.attack&&!(st.attack>0))miss.push('공격력');if(need.maxHp&&!(st.maxHp>0))miss.push('최대 체력');return miss;
}
function renderInputs(){
 q('#opt-attack').value=settings.stats.attack;q('#opt-maxhp').value=settings.stats.maxHp;q('#opt-regen').value=settings.stats.regen;q('#opt-regen-period').value=settings.stats.regenPeriod;
 host.querySelectorAll('[name="opt-mode"]').forEach(x=>x.checked=x.value===settings.mode);
 q('#opt-incoming').value=settings.incoming;q('#opt-hp-start').value=settings.measure.hpStart;q('#opt-hp-end').value=settings.measure.hpEnd;q('#opt-seconds').value=settings.measure.seconds;q('#opt-margin').value=settings.margin;
 q('#opt-incoming-row').hidden=settings.mode!=='incoming';q('#opt-measure-row').hidden=settings.mode!=='measure';
 const fams=settings.families||familiesOf(build);
 q('#opt-families').innerHTML=FAMILIES.map(x=>`<label><input type="checkbox" data-opt-family="${x}" ${fams.includes(x)?'checked':''}>${styleBadge({family:x})}</label>`).join('');
 q('#opt-single').checked=settings.single??damaging(build).every(s=>s.targeting?.kind==='single');q('#opt-depth').value=settings.depth;
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
 return `<tr><td><span class="sim-skill-name">${icon(byId(r.skillId))}<b>${esc(r.name)}</b></span></td><td>${kind}</td><td>${r.condition?`${esc(r.condition.effect)} ${r.condition.scope==='enemy'?'대상':'보유'} 시 적중`:'시전마다'}</td><td>${esc(formula)}<small>${r.each!==null&&r.each!==undefined?f(r.each)+(r.overridden?' · 실측':''):''}</small></td><td>${input}</td><td>${esc(lifeText(r))}</td><td>${r.triggers}</td><td>${r.full===null?'—':f(r.full)}</td><td>${shown}${wasted}</td></tr>`;
}
function renderCurrent(){
 if(!current?.valid){q('#opt-sources').innerHTML=`<tr><td colspan="9" class="sim-warning">${esc(current?.issue||'계산 불가')}</td></tr>`;q('#opt-current-total').textContent='';q('#opt-unquantified').innerHTML='';return;}
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
 q('#opt-stats-note').textContent=miss.length?`${miss.join('·')}이 필요합니다. 회복·보호막 수치가 이 값에 비례합니다.`:`자연 회복 분당 ${f(O.regenPerMin(st))}`;
 q('#opt-need').textContent=n.text;q('#opt-need').classList.toggle('sim-warning',n.value===null);
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
 current=evalCurrent();renderInputs();renderCurrent();renderNeed();
}
function recalc(){current=evalCurrent();renderCurrent();renderNeed();}
function stop(message){clearTimeout(timer);search=null;q('#opt-cancel').hidden=true;q('#opt-progress').hidden=true;if(message)q('#opt-status').textContent=message;renderNeed();}
function run(){
 const n=needed();if(n.value===null)return;const fams=settings.families||familiesOf(build),iterations=DEPTHS[settings.depth]||DEPTHS.normal;
 search=O.createSearch(D,{ids:[...build],baseSlots:[...D.baseSlots]},{stats:stats(),overrides:settings.overrides,families:fams,singleOnly:q('#opt-single').checked,need:n.value,incoming:current.incoming,iterations,profile:SEARCH_PROFILE,seed:20261018});
 resultContext=key();q('#opt-cancel').hidden=false;q('#opt-progress').hidden=false;q('#opt-run').disabled=true;q('#opt-status').textContent=`후보 도술 ${search.pool.length}개에서 탐색 중`;
 const tick=()=>{if(!search)return;const p=search.step(40);q('#opt-progress').value=p.done/p.total;q('#opt-status').textContent=`${f(p.done)} / ${f(p.total)}회 · 조건 충족 구성 ${f(p.feasible)}개`;
  if(!p.finished){timer=setTimeout(tick,0);return;}
  q('#opt-status').textContent='상위 후보를 모든 배치·구간에서 다시 계산하는 중';timer=setTimeout(()=>{const s=search;if(!s)return;lastResults={...s.results(5),need:n.value,start:current};stop(`완료 · ${f(p.evaluated)}개 구성 계산`);renderResults();},0);};
 timer=setTimeout(tick,0);
}
function row(label,c,i){
 const base=current.coefficient,delta=base?(c.verification.minCoefficient/base-1)*100:0,changed=c.ids.filter(id=>!build.includes(id));
 return `<tr><td><b>${label}</b></td><td class="opt-order">${c.ids.map((id,n)=>`<span class="${changed.includes(id)?'opt-new':''}">${n+1}. ${esc(byId(id).name)}</span>`).join('')}</td><td>${c.baseSlots.map(id=>esc(byId(id).name)).join(' · ')}</td><td>${f(c.verification.minCoefficient)}<small>${delta>=0?'+':''}${delta.toFixed(1)}%</small></td><td>${f(c.verification.minPerMin)}</td><td class="${c.verification.margin<1000?'sim-warning':''}">${signed(c.verification.margin)}</td><td><button data-opt-apply="${i}">적용</button><button data-opt-json="${i}">JSON</button></td></tr>`;
}
function picks(){const list=lastResults.best.map((c,i)=>({label:i?`후보 ${i+1}`:'피해 최대',c}));const s=lastResults.safest;if(s&&!lastResults.best.some(c=>c.ids.join()===s.ids.join()&&c.baseSlots.join()===s.baseSlots.join()))list.splice(1,0,{label:'여유 우선',c:s});return list;}
function renderResults(){
 q('#opt-results').hidden=false;q('#opt-stale').hidden=true;
 const list=picks();q('#opt-results-meta').textContent=`기준 분당 ${f(lastResults.need)} · 현재 빌드 직접 피해 계수 ${f(current.coefficient)}`;
 q('#opt-results-body').innerHTML=list.length?list.map((x,i)=>row(x.label,x.c,i)).join(''):'<tr><td colspan="7">기준을 만족하는 구성을 찾지 못했습니다. 계열을 더 열거나 여유를 낮추거나 탐색 강도를 높이세요.</td></tr>';
}
function buildJson(c){return {schema:'dosul-build-v3',name:'빌드 최적화 결과',baseSlots:c.baseSlots,skills:c.ids,skillNames:c.ids.map(id=>byId(id).name),validation:DosulSequence.validate({...D,baseSlots:c.baseSlots},c.ids),optimizer:{model:DosulSimulation.model,kkaebigg:KK?.snapshot?.meta?.sources||null,incoming:current.incoming,need:lastResults.need,coefficient:c.verification.minCoefficient,sustainPerMin:c.verification.minPerMin,margin:c.verification.margin,stats:stats(),settings}};}
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
 const t=e.target,map={'opt-attack':'attack','opt-maxhp':'maxHp','opt-regen':'regen','opt-regen-period':'regenPeriod'};
 if(map[t.id])settings.stats[map[t.id]]=t.value;else if(t.id==='opt-incoming')settings.incoming=t.value;else if(t.id==='opt-margin')settings.margin=t.value;
 else if(t.id==='opt-hp-start')settings.measure.hpStart=t.value;else if(t.id==='opt-hp-end')settings.measure.hpEnd=t.value;else if(t.id==='opt-seconds')settings.measure.seconds=t.value;
 else if(t.dataset.optOverride){if(t.value==='')delete settings.overrides[t.dataset.optOverride];else settings.overrides[t.dataset.optOverride]=t.value;}
 else return;
 save();renderNeed();
});
host.addEventListener('change',e=>{
 const t=e.target;
 // Recalculating runs 13+ simulations and rebuilds the override inputs, so wait until the value is committed.
 if(['opt-attack','opt-maxhp','opt-regen','opt-regen-period','opt-incoming','opt-hp-start','opt-hp-end','opt-seconds'].includes(t.id)||t.dataset.optOverride){recalc();return;}
 if(t.name==='opt-mode'){settings.mode=t.value;save();renderInputs();recalc();return;}
 if(t.dataset.optFamily){settings.families=[...host.querySelectorAll('[data-opt-family]')].filter(x=>x.checked).map(x=>x.dataset.optFamily);}
 else if(t.id==='opt-single')settings.single=t.checked;else if(t.id==='opt-depth')settings.depth=t.value;else return;
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
