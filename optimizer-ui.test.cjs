const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const D=structuredClone(require('./dist/data.json'));D.baseSlots=['s003','s007','s008','s071','s069'];
const ids=['s071','s069','s003','s008','s075','s007','s012','s085','s010'],els=new Map(),storage=new Map(),hostListeners={},docListeners=[];
function el(k){if(!els.has(k))els.set(k,{id:k.replace(/^#/,''),hidden:false,innerHTML:'',textContent:'',value:'',checked:false,disabled:false,dataset:{},classList:{list:new Set(),toggle(c,on){on?this.list.add(c):this.list.delete(c);},contains(c){return this.list.has(c);}}});return els.get(k);}
const host=Object.assign(el('#optimizer'),{querySelector:el,querySelectorAll:()=>[],addEventListener:(type,fn)=>{hostListeners[type]=fn;}});
host.classList.list.add('active');
const O=require('./dist/optimizer.js'),searches=[];
// The UI's 1,500+ iterations take seconds; cap the search so the test exercises the flow, not the optimum.
const FastO={...O,createSearch:(data,cur,opts)=>{searches.push(opts);return O.createSearch(data,cur,{...opts,iterations:60});}};
let applied=null,downloaded=null,toasts=[];
const ctx={D,build:[...ids],byId:id=>D.skills.find(s=>s.id===id),esc:s=>String(s??''),icon:()=>'',styleBadge:s=>s.family,toast:t=>toasts.push(t),remember(){},
 commit(next,step,base){applied={next,base};ctx.build=next;D.baseSlots=base;},download:(name,body,type)=>{downloaded=/json/.test(type||'application/json')?JSON.parse(body):{name,text:body,type};},
 DosulSequence:require('./dist/sequence.js'),DosulSimulation:require('./dist/simulation.js'),DosulOptimizer:FastO,
 localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},setTimeout:(fn)=>{fn();return 0;},clearTimeout(){},console,Event:class{},
 document:{querySelector:k=>k==='#optimizer'?host:el(k),addEventListener:(t,fn)=>docListeners.push(fn)}};
storage.set('dosul-optimizer-v1',JSON.stringify({encounter:false}));
ctx.location={hostname:'example.site',reload(){}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/kkaebi-gg/hunting.js','utf8'),ctx);vm.runInContext(fs.readFileSync('dist/optimizer-ui.js','utf8'),ctx);

const input=(id,value)=>{const t=el('#'+id);t.value=String(value);hostListeners.input({target:t});hostListeners.change({target:t});};
const click=(selector,dataset={})=>hostListeners.click({target:{closest:s=>s===selector?{dataset}:null}});
assert.match(el('#opt-sources').innerHTML,/생명의 흐름/,'Current sustain sources are listed');
assert.match(el('#opt-sources').innerHTML,/1,460/,'Flat shields need no stats');
assert.equal(el('#opt-run').disabled,true,'Attack and max HP are required');assert.match(el('#opt-stats-note').textContent,/최대 체력·공격력/);
input('opt-attack',20497);input('opt-maxhp',100029);input('opt-regen',2744);
assert.match(el('#opt-current-total').textContent,/직접 피해 계수/);assert.equal(el('#opt-measure-row').hidden,false,'Measurement is the default');assert.equal(el('#opt-incoming-row').hidden,true);
assert.equal(el('#opt-run').disabled,true,'A measured zone is required');assert.match(el('#opt-need').textContent,/측정 사냥터를 고르세요/);
const pick=(id,v)=>{const s=el('#'+id);s.value=v;hostListeners.change({target:s});};
pick('opt-zone-from','101011');assert.match(el('#opt-need').textContent,/시작 HP/);
el('#opt-hp-start').value='';input('opt-hp-start',66606);input('opt-hp-end',100029);input('opt-seconds',265);assert.match(el('#opt-need').textContent,/최대 체력에 닿아/,'Capped HP cannot be calibrated');
input('opt-hp-end',89632);const override={value:'542',dataset:{optOverride:'s085:0'}};el('#x').dataset=override.dataset;hostListeners.input({target:override});hostListeners.change({target:override});
// A single-target build always fights exactly one monster, so the measurement is already per monster.
const measurement=/1마리당 받는 피해 분당 ([\d,]+) \(실측 ([\d,]+) ÷ 평균 1.00마리\)/.exec(el('#opt-need').textContent);
assert(measurement,'Measured incoming is shown per monster');const measuredPerMob=Number(measurement[1].replace(/,/g,''));assert.equal(measurement[1],measurement[2]);
const budget=/받는 피해 ([\d,]+) − 자연 회복 ([\d,]+) \+ 안전 여유 ([\d,]+) = 회복·보호막 분당 ([\d,]+) 필요/.exec(el('#opt-need').textContent);assert(budget);const money=budget.slice(1).map(x=>Number(x.replace(/,/g,'')));assert(Math.abs(money[0]-money[1]+money[2]-money[3])<=1,'Displayed sustain budget preserves arithmetic');
assert.match(el('#opt-need').textContent,/현재 빌드: 분당 처치 [\d.]+마리/);
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).overrides['s085:0'],'542','Inputs persist');
click('#opt-run');
assert.equal(searches.length,1);assert.equal(searches[0].zone.id,'101011');assert(Math.abs(searches[0].perMob-measuredPerMob)<1);assert.equal(searches[0].margin,1000);assert.equal(searches[0].iterations,4000,'Fixed search depth');

// Hunting zones: measured in 독기 지대, hunting in 마을 폐허 → damage per monster scales by the spawn-weighted attack ratio (×1.654).
assert.match(el('#opt-zone-to').innerHTML,/마을 폐허 · 권장 565,000/);assert.match(el('#opt-zone-to').innerHTML,/측정한 곳과 같음/);
pick('opt-zone-to','101014');
assert.match(el('#opt-need').textContent,/× 사냥터 공격력 1.65배 \(추정\)/);assert.match(el('#opt-need').textContent,/마을 폐허에서 현재 빌드는 평균/);assert.match(el('#opt-zone').textContent,/평균 공격력 13,763.*독기 지대 대비 공격력 1.65배/);
input('opt-power',282000);assert.match(el('#opt-zone').textContent,/내 전투력 50% · 부족/);
click('#opt-run');assert.equal(searches.length,2);assert.equal(searches[1].zone.id,'101014');assert(Math.abs(searches[1].perMob-measuredPerMob*1.65404)<5,'Search uses the target-zone damage per monster');
assert.match(el('#opt-card').innerHTML,/추천 빌드|가정한 조건에서 회복이 부족합니다/);
// Typed damage is per monster in the target zone: no scaling even with a measured zone saved.
hostListeners.change({target:{name:'opt-mode',value:'incoming',dataset:{}}});input('opt-incoming',50000);
assert.match(el('#opt-need').textContent,/1마리당 받는 피해 분당 50,000 \(입력\)/);assert.equal(el('#opt-measure-row').hidden,true);
// A zone nobody survives: the card says how far short it is and shows the closest build; the export says so too.
input('opt-incoming',400000);click('#opt-run');
assert.match(el('#opt-card').innerHTML,/가정한 조건에서 회복이 부족합니다/);assert.match(el('#opt-card').innerHTML,/가장 근접해도 분당 [\d,]+ 부족/);assert.match(el('#opt-card').innerHTML,/가장 근접한 빌드<\/h3><p class="opt-summary">/);
assert.match(el('#opt-card').innerHTML,/내 전투력 50%/,'The power ratio explains it');
assert.match(el('#opt-card').innerHTML,/버티려면 \(가장 근접한 빌드 기준 · 하나만 바꿀 때\)/);assert.match(el('#opt-card').innerHTML,/체력 자연 회복 2,744 → [\d,]+ \(\+[\d,]+\)/);assert.match(el('#opt-card').innerHTML,/받는 피해 [\d.]+% 줄이기|받는 피해: 95%를 줄여도 부족/);assert.match(el('#opt-card').innerHTML,/같은 가정에서 회복량이 충분한 사냥터/);assert.equal(el('#opt-similar').hidden,true);
click('#opt-export-md');assert.match(downloaded.text,/## 결과: 가정한 조건에서 회복·보호막이 부족한 구성만 발견\n\n- 가장 근접한 빌드도 분당 [\d,]+ 부족/);assert.match(downloaded.text,/## 가장 근접한 빌드 \(계산상 회복 부족\)\n\n### 근접 1/);
assert(!downloaded.text.includes('## 추천 빌드'));assert.match(downloaded.text,/## 버티려면 무엇을 개선해야 하나\n\n가장 근접한 빌드\(근접 1\) 기준[^\n]*\n\n- 받는 피해/);const none=JSON.parse(downloaded.text.split('```json\n')[1].split('\n```')[0]);assert.equal(none.builds.length,0);assert(none.closest.length>=1&&none.closest[0].surplusPerMin<0);
input('opt-incoming',50000);
pick('opt-zone-to','');assert.match(el('#opt-need').textContent,/목표 사냥터를 고르세요/,'Typed damage needs a target zone');
hostListeners.change({target:{name:'opt-mode',value:'measure',dataset:{}}});assert.doesNotMatch(el('#opt-need').textContent,/사냥터 공격력/,'Same zone, no scaling');
click('#opt-run');assert.equal(searches.length,4);
assert.deepEqual(Array.from(searches[0].families).sort(),['강인','기동','연타','절명','헌신'].sort(),'Defaults to the families already in the build');
assert.equal(el('#opt-results').hidden,false);assert.match(el('#opt-status').textContent,/완료/);
assert.match(el('#opt-card').innerHTML,/추천 빌드/);assert.match(el('#opt-card').innerHTML,/class="[^"]*opt-ult[^"]*"><small>\d+<\/small>[^<]*<b>암습<\/b>/,'The ultimate tile is marked');assert.match(el('#opt-build').innerHTML,/opt-ult/,'The current build strip marks its ultimate too');assert.match(el('#opt-card').innerHTML,/회복·보호막 ≥ 받는 피해 \(예상\)/);assert.match(el('#opt-card').innerHTML,/예상 분당 처치 수/);assert.match(el('#opt-card').innerHTML,/data-opt-apply="0"/);
assert.match(el('#opt-card').innerHTML,/class="opt-summary">[^<]*구성입니다\./,'The recommendation describes its build in complete sentences');assert.match(el('#opt-similar-count').textContent,/도술 0~3개 교체 · \d+개/);assert.match(el('#opt-different-count').textContent,/도술 4개 이상 교체 · \d+개/);assert.match(el('#opt-found').textContent,/버티는 구성 .*개 · 도술 조합 .*가지/);assert.equal(el('#opt-similar').hidden,false);for(const m of (el('#opt-similar-body').innerHTML+el('#opt-different-body').innerHTML+el('#opt-card').innerHTML).matchAll(/class="opt-summary">([^<]*)</g))if(/ 추가/.test(m[1]))assert.match(m[1],/빼고 [^(]+\([^)]+\).* 추가/,'Every added skill says why: '+m[1]);assert.equal(el('#opt-different').hidden,false);
click('[data-opt-json]',{optJson:'0'});assert.equal(downloaded.schema,'dosul-build-v3');assert(downloaded.optimizer.margin>=0);assert(downloaded.optimizer.surplusPerMin>=1000);assert.equal(downloaded.optimizer.safetyMargin,1000);assert.equal(downloaded.skills.length,9);
// Analysis export: readable Markdown with every group, then the same data as JSON.
click('#opt-export-md');assert.match(downloaded.name,/^도술-최적화-분석-\d{4}-\d{2}-\d{2}\.md$/);assert.match(downloaded.type,/markdown/);
for(const h of ['# 도술 빌드 최적화 결과 (분석용)','## 목표와 계산 방식','## 내 캐릭터와 사냥 기준','## 현재 빌드','## 추천 빌드','## 분석 요청 예시','## 원본 데이터 (JSON)'])assert(downloaded.text.includes(h),h);
assert.match(downloaded.text,/- 요약: .+/);assert.match(downloaded.text,/\| 도술 \| 효과 \| 발동 조건 \|/);assert.match(downloaded.text,/사용 순서: 1\. .+ → 2\. /);
const exported=JSON.parse(downloaded.text.split('```json\n')[1].split('\n```')[0]);assert.equal(exported.schema,'dosul-optimizer-analysis-v1');assert.equal(exported.shinsikModel,'shinsik-pve-v1');assert(exported.current.shinsik.extraCoefficient>0);assert.match(el('#opt-shinsik').innerHTML,/공간 적중 기준 피해 증가/);
for(const b of exported.builds){const changes=b.order.filter(s=>!exported.current.order.some(x=>x.id===s.id)).length;assert.equal(b.changes,changes);assert(!b.summary.includes(' 빼고 '));assert.match(b.summary,/구성입니다\./);if(changes)assert(b.summary.includes('도술 '+changes+'개를 교체했습니다.'));}
assert.equal(exported.builds[0].group,'recommended');assert.equal(exported.builds[0].order.length,9);assert.equal(exported.current.label,'현재 빌드');assert.equal(exported.inputs.stats.attack,20497);
assert(exported.builds.every(b=>b.summary&&b.killsPerMin>0&&b.needPerMin>0),'Every exported build has its reason and numbers');
click('#opt-export-copy');click('[data-opt-json]',{optJson:'0'});
click('[data-opt-apply]',{optApply:'0'});assert.deepEqual(Array.from(applied.next),downloaded.skills);assert.deepEqual(Array.from(applied.base),downloaded.baseSlots);assert.match(toasts.at(-1),/되돌리기/);
ctx.syncBuildOptimizer();assert.equal(el('#opt-stale').hidden,false,'Results are marked stale after the build changes');
ctx.build=[];ctx.syncBuildOptimizer();assert.equal(el('#opt-empty').hidden,false);assert.equal(el('#opt-work').hidden,true);
// Blocked build (the planner normally prevents this): the reason is shown with a way back to the planner.
ctx.build=[...ids];D.baseSlots=['s071','s069','s075','s012','s085'];ctx.syncBuildOptimizer();
assert.equal(el('#opt-validation').hidden,false);assert.match(el('#opt-validation').innerHTML,/암습.*기본 장착/);assert.match(el('#opt-need').textContent,/계산할 수 없습니다: 암습/);
assert.match(el('#opt-validation').innerHTML,/data-tab="explore"/);assert.equal(el('#opt-run').disabled,true);
D.baseSlots=['s003','s007','s008','s071','s069'];ctx.syncBuildOptimizer();assert.equal(el('#opt-validation').hidden,true,'Valid build computes again');
assert.match(el('#opt-data-text').textContent,/고정본이 없습니다/,'Missing snapshot is explained');
const fetches=[];let reply={status:200,json:async()=>({ok:true,changes:{skills:[{name:'방패 밀기',change:'수치'}]}})};ctx.fetch=async(url,init)=>{fetches.push([url,init.method]);return reply;};
(async()=>{click('#opt-sync');await new Promise(r=>setImmediate(r));
 assert.deepEqual(fetches[0],['api/kkaebigg/sync','POST']);assert.match(el('#opt-sync-status').innerHTML,/방패 밀기 수치/);assert.match(el('#opt-sync-status').innerHTML,/opt-reload/);
 reply={status:405,json:async()=>({})};click('#opt-sync');await new Promise(r=>setImmediate(r));assert.match(el('#opt-sync-status').textContent,/로컬 실행/,'Static hosting explains where sync works');
 reply={status:502,json:async()=>({ok:false,error:'응답 500'})};click('#opt-sync');await new Promise(r=>setImmediate(r));assert.match(el('#opt-sync-status').textContent,/기존 고정본을 유지/);
 console.log('Optimizer UI sync: request, change summary, static-hosting and failure messages passed.');})().catch(e=>{console.error(e);process.exitCode=1;});
console.log('Optimizer UI: stats gate, measured need, persistence, run, JSON export, apply and stale results passed.');

const modelInput=el('#opt-model');modelInput.value='spatial';hostListeners.change({target:modelInput});assert.match(el('#opt-world').textContent,/예상: 분당 처치/);assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).encounter,true);

ctx.build=[];ctx.syncBuildOptimizer();const mode=el('#opt-start-mode');mode.value='conditions';hostListeners.change({target:mode});assert.equal(el('#opt-work').hidden,false);assert.equal(el('#opt-validation').hidden,true,'No primary family is a valid engine-decides state');assert.match(el('#opt-required-families').innerHTML,/엔진이 결정/);assert.equal(ctx.build.length,0);
let selectedFamilies=['강타','연타'];host.querySelectorAll=sel=>sel==='[data-required-family]:checked'?selectedFamilies.map(f=>({dataset:{requiredFamily:f}})):[];
hostListeners.change({target:{dataset:{requiredFamily:'강타'}}});assert.match(el('#opt-equipment').textContent,/비교용/);assert.match(el('#opt-skill-picker').innerHTML,/회전 난격/);assert(el('#opt-skill-picker').innerHTML.includes('도약 찌르기'),'Supporting skills remain available across families');
const requiredId=D.skills.find(s=>s.name==='회전 난격').id;click('[data-toggle-required]',{toggleRequired:requiredId});assert.match(el('#opt-skill-picker').innerHTML,/aria-pressed="true"/);assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).requiredSkills[0],requiredId);assert.equal(ctx.build.length,0);
click('[data-toggle-required]',{toggleRequired:requiredId});assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).requiredSkills.length,0,'Second click deselects');click('[data-toggle-required]',{toggleRequired:requiredId});
const expected=O.conditionSeed(D,{primaryFamily:'강타',requiredSkills:[requiredId]},Object.keys(D.families));click('[data-opt-edit]');assert.deepEqual([...applied.next],expected.ids,'Editing transfers exactly the preview order');assert.deepEqual([...applied.base],expected.baseSlots);assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).startMode,'current');
mode.value='conditions';hostListeners.change({target:mode});selectedFamilies=['강타'];hostListeners.change({target:{dataset:{requiredFamily:'연타'}}});assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).requiredSkills.length,1,'Changing primary family preserves optional supporting skills');
console.log('Condition UI: primary family and unrestricted support cards, optional toggles, deselection cleanup and exact preview-to-planner transfer passed.');

// New-build recommendations must work without guessed incoming damage or a target zone.
input('opt-incoming','');pick('opt-zone-to','');
assert.equal(el('#opt-run').disabled,false);
assert.match(el('#opt-need').textContent,/생존 미평가/);
click('#opt-run');
assert.match(el('#opt-card').innerHTML,/추천 빌드/);
assert.match(el('#opt-card').innerHTML,/생존 미평가/);
assert.doesNotMatch(el('#opt-card').innerHTML,/회복·보호막 ≥ 받는 피해/);
assert.equal(searches.at(-1).perMob,undefined);
click('[data-opt-json]',{optJson:'0'});
assert.equal(downloaded.optimizer.need,null);
assert.equal(downloaded.optimizer.margin,null);
assert.equal(downloaded.optimizer.surplusPerMin,null);
click('#opt-export-md');
const unassessed=JSON.parse(downloaded.text.split('```json\n')[1].split('\n```')[0]);
assert.equal(unassessed.survivalAssessed,false);
assert.equal(unassessed.current.order.length,9);
assert(unassessed.builds.every(b=>b.needPerMin===null&&b.surplusPerMin===null));
assert.match(downloaded.text,/생존 미평가/);
hostListeners.change({target:{name:'opt-mode',value:'incoming',dataset:{}}});
pick('opt-zone-to','101011');input('opt-incoming',50000);
assert.doesNotMatch(el('#opt-need').textContent,/生存性|생존 미평가/);
assert.equal(el('#opt-run').disabled,false);
input('opt-incoming',0);assert.equal(el('#opt-run').disabled,true,'Explicit invalid damage is not treated as missing');
console.log('Optional incoming damage: recommendations, honest survival labels, JSON/Markdown export and explicit-input validation passed.');

assert.match(el('#opt-preview-title').textContent,/자동 생성 시작안 · 최적화 전/);
assert.equal(el('#opt-current-scope').hidden,true);
assert.equal(el('#opt-damage-modes').hidden,true);
mode.value='current';hostListeners.change({target:mode});
assert.equal(el('#opt-preview-title').textContent,'현재 빌드');
assert.equal(el('#opt-current-scope').hidden,false);
assert.equal(el('#opt-damage-modes').hidden,false);
console.log('Workflow layout: explicit preview labels and mode-specific controls passed.');

// Browser worker lifecycle: no main-thread search, cancellation, stale messages and errors.
const workers=[];ctx.Worker=class{constructor(url){this.url=url;workers.push(this);}postMessage(message){this.message=message;}terminate(){this.terminated=true;}};
mode.value='conditions';hostListeners.change({target:mode});input('opt-incoming','');
const beforeWorkers=searches.length;click('#opt-run');const firstWorker=workers.at(-1);
assert.equal(searches.length,beforeWorkers,'No main-thread engine search');assert.equal(firstWorker.message.options.totalEvaluationBudget,4000);assert.equal(firstWorker.message.options.boundedSelection,true);assert.equal(firstWorker.message.options.families.length,Object.keys(D.families).length);assert.equal(firstWorker.message.options.conditions.primaryFamily,'연타');
firstWorker.onmessage({data:{type:'progress',progress:{evaluated:12},elapsedMs:1000,preview:[{ids:expected.ids}]}});
assert.equal(el('#opt-live').hidden,false);assert.match(el('#opt-live-builds').innerHTML,/후보 1/);
click('#opt-cancel');assert(firstWorker.terminated);const stopped=el('#opt-status').textContent;
firstWorker.onmessage({data:{type:'validating',elapsedMs:2000}});assert.equal(el('#opt-status').textContent,stopped);
click('#opt-run');const secondWorker=workers.at(-1);assert.notEqual(secondWorker,firstWorker);
secondWorker.onmessage({data:{type:'error',message:'test failure'}});assert(secondWorker.terminated);assert.match(el('#opt-status').textContent,/test failure/);assert.equal(el('#opt-run').disabled,false);
console.log('Worker UI: background dispatch, interim display, stop, stale-message rejection and restart passed.');

click('#opt-run');const groupedWorker=workers.at(-1),payload=groupedWorker.message;
assert.equal(payload.options.mechanismGroups,true);
const groupedSearch=O.createSearch(payload.data,payload.start,{...payload.options,encounter:false,totalEvaluationBudget:900});
while(!groupedSearch.step(1000).finished){}const groupedResult=groupedSearch.grouped(10);
assert(groupedResult.mechanismGroups.length);assert(groupedResult.mechanismGroups.every(g=>g.subgroups?.length));
groupedWorker.onmessage({data:{type:'complete',result:groupedResult,elapsedMs:1000}});
assert.equal(el('#opt-card').hidden,true);assert.equal(el('#opt-similar').hidden,true);
assert.match(el('#opt-mechanism-groups').innerHTML,/조합 내 1위/);
const visualHtml=el('#opt-mechanism-groups').innerHTML;
assert.match(visualHtml,/aria-label="추천 카테고리"/);
assert.match(visualHtml,/data-opt-group="0" aria-pressed="true"/);
if((visualHtml.match(/data-opt-group=/g)||[]).length>1){
 click('[data-opt-group]',{optGroup:'1'});
 assert.match(el('#opt-mechanism-groups').innerHTML,/data-opt-group="1" aria-pressed="true"/);
 assert.match(el('#opt-mechanism-groups').innerHTML,/id="opt-group-panel-0" hidden/);
 click('[data-opt-group]',{optGroup:'0'});
}

assert.match(visualHtml,/class="opt-result-badges"/);
assert.match(visualHtml,/<details class="opt-change-details"><summary>변경 상세<\/summary>/);
assert.doesNotMatch(visualHtml,/class="opt-summary"/,'Long explanations stay out of the result list');
assert.match(visualHtml,/전체 도술 쿨타임 대기 · 180초 기준/);
const visualFirst=groupedResult.mechanismGroups[0].subgroups[0].candidates[0];
const visualEvaluation=O.evaluate(D,visualFirst.ids,visualFirst.baseSlots,payload.options);
assert(visualHtml.includes(visualEvaluation.idle.toFixed(1)+'초'),'Wait chart uses actual candidate evaluation');
click('#opt-export-md');
const visualExport=JSON.parse(downloaded.text.split('```json\n')[1].split('\n```')[0]);
assert(visualExport.current.evaluationBasis.horizon>0,'Export states the actual verification horizon');
for(const entry of [...visualExport.builds,...visualExport.closest]){
 assert(entry.evaluationBasis.scenarioConfig&&typeof entry.evaluationBasis.scenarioConfig==='object','Export preserves replayable scenario settings');
 const sum=entry.sustain.reduce((total,row)=>total+(row.perMinAbsorbed||0),0);
 assert(Math.abs(sum-entry.sustainPerMin)<.1,'Export source rows reconcile with its sustain total');
 if(entry.needPerMin!==null)assert(Math.abs(entry.sustainPerMin-entry.needPerMin-entry.surplusPerMin)<.1,'Export surplus reconciles with its displayed need');
}


click('#opt-export-md');for(const g of visualExport.mechanismGroups)assert(downloaded.text.includes('## '+g.label));
assert.doesNotMatch(visualHtml,/대기 혼합|재사용 변경|증폭 낮음|세부 유형|스킬 파워/);
assert.equal(visualExport.builds.length,new Set(groupedResult.mechanismGroups.flatMap(g=>g.candidates.map(c=>c.ids.join('|')+';'+c.baseSlots.join('|')))).size,'Presentation grouping retains every unique candidate');
for(const g of visualExport.mechanismGroups){const members=visualExport.builds.filter(b=>b.group===g.id);assert.equal(members.length,g.count);for(const b of members){const ult=b.order.find(s=>s.ultimate);assert(g.label.includes(ult.name));assert(g.label.includes(ult.family));}}
const groupIndex=groupedResult.mechanismGroups[0].candidates.length-1;
click('[data-opt-json]',{optJson:String(groupIndex)});const chosen=downloaded.skills;
click('[data-opt-apply]',{optApply:String(groupIndex)});assert.deepEqual(Array.from(applied.next),chosen);
console.log('Grouped UI: representatives, group export and exact selected build apply passed.');

mode.value='conditions';hostListeners.change({target:mode});
const excludedId=D.skills.find(s=>s.family==='기만'&&!s.ultimate).id;
click('[data-toggle-required]',{toggleRequired:excludedId});
hostListeners.change({target:{dataset:{excludedFamily:'기만'},checked:true}});
let savedSettings=JSON.parse(storage.get('dosul-optimizer-v1'));
assert(savedSettings.excludedFamilies.includes('기만'));assert(!savedSettings.requiredSkills.includes(excludedId));
assert(!el('#opt-skill-picker').innerHTML.includes('data-toggle-required="'+excludedId+'"'));
click('#opt-run');assert(!workers.at(-1).message.options.families.includes('기만'));
hostListeners.change({target:{dataset:{requiredFamily:'기만'}}});
assert(workers.at(-1).terminated);assert(!JSON.parse(storage.get('dosul-optimizer-v1')).excludedFamilies.includes('기만'));
assert.match(el('#opt-excluded-families').innerHTML,/data-excluded-family="기만"[^>]*disabled/);
console.log('Excluded family UI: persistence, fixed-skill cleanup, worker filtering, cancellation and primary conflict handling passed.');


pick('opt-target-mode','single');
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).targetMode,'single');
assert.equal(el('#opt-results').hidden,true);
assert.equal(el('#opt-run').disabled,true,'A primary family with an area ultimate cannot satisfy single hunting');
hostListeners.change({target:{dataset:{requiredFamily:'절명'}}});
assert.equal(el('#opt-run').disabled,true,'Fixed 회전 난격 remains incompatible with single hunting');
click('[data-toggle-required]',{toggleRequired:requiredId});
assert.equal(el('#opt-run').disabled,false);
click('#opt-run');assert.equal(workers.at(-1).message.options.targetMode,'single');
assert.equal(workers.at(-1).message.options.conditions.targetMode,'single','Worker seed carries the same single-hunt constraint');
pick('opt-target-mode','area');
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).targetMode,'area');
assert(workers.at(-1).terminated);
console.log('Target mode: persistence, worker options, cancellation and stale results passed.');

hostListeners.change({target:{name:'opt-mode',value:'measure',dataset:{}}});
pick('opt-start-mode','current');pick('opt-zone-from','101011');
input('opt-hp-start',Number(el('#opt-maxhp').value)+1);
assert.equal(el('#opt-run').disabled,true);assert.match(el('#opt-need').textContent,/최대 체력을 초과/);
hostListeners.change({target:{id:'opt-hp-capped',checked:true,dataset:{}}});
assert.match(el('#opt-need').textContent,/역산 불가/);
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).measure.hpCapped,true);
console.log('Measurement UI: invalid HP rejected; capped observation retained without inventing incoming damage.');

pick('opt-start-mode','conditions');pick('opt-target-mode','single');hostListeners.change({target:{dataset:{requiredFamily:'연타'}}});
assert.equal(el('#opt-run').disabled,true);
hostListeners.change({target:{id:'opt-use-ultimate',checked:false,dataset:{}}});
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).useUltimate,false);
assert.equal(el('#opt-run').disabled,false,'Single-target yeonta works with ultimate disabled');
click('#opt-run');assert.equal(workers.at(-1).message.options.conditions.useUltimate,false);
assert(!el('#opt-skill-picker').innerHTML.includes('data-toggle-required="s018"'),'Ultimate is unavailable when disabled');
console.log('Optional ultimate UI: persisted setting, single-target yeonta and worker options passed.');
input('opt-hit-damage',3378);input('opt-hit-interval',1.5);
assert.equal(Number(el('#opt-incoming').value),135120);assert(el('#opt-incoming').readOnly);
assert.match(el('#opt-hit-rate').textContent,/135,120/);
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).incoming,135120);
click('#opt-run');assert.equal(workers.at(-1).message.options.perMob,135120,'Converted damage reaches the search engine');
input('opt-hit-interval',0);assert.equal(el('#opt-run').disabled,true,'Invalid interval cannot silently become unassessed');
input('opt-hit-interval',2);assert.equal(Number(el('#opt-incoming').value),101340);
input('opt-hit-damage','');assert.equal(el('#opt-incoming').readOnly,false);
console.log('Per-hit incoming UI: automatic display, persisted settings, worker input and invalid interval passed.');
