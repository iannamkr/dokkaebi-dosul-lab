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
 DosulRecommendationView:{full:(skillIds,baseSlots,horizon)=>({ids:skillIds,baseSlots,horizon,links:{passed:2,conditional:1,failed:0,moments:[]}}),overlayTimeline:()=>'<section class="recommend-timeline-overlay"><div class="recommend-axis">시간</div><div class="recommend-row-label">평타</div></section>',bindCursor(){}},
 localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},setTimeout:(fn)=>{fn();return 0;},clearTimeout(){},console,Event:class{},
 document:{querySelector:k=>k==='#optimizer'?host:el(k),addEventListener:(t,fn)=>docListeners.push(fn)}};
storage.set('dosul-optimizer-v1',JSON.stringify({encounter:false}));
ctx.location={hostname:'example.site',reload(){}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/kkaebi-gg/hunting.js','utf8'),ctx);vm.runInContext(fs.readFileSync('dist/optimizer-ui.js','utf8'),ctx);

const input=(id,value)=>{const t=el('#'+id);t.value=String(value);hostListeners.input({target:t});hostListeners.change({target:t});};
const click=(selector,dataset={})=>hostListeners.click({target:{closest:s=>s===selector?{dataset}:null}});
assert.equal(el('#opt-run').disabled,true,'Attack and max HP are required');assert.match(el('#opt-stats-note').textContent,/최대 체력·공격력/);
input('opt-attack',20497);input('opt-maxhp',100029);input('opt-regen',2744);
const pasted=el('#opt-stat-paste');pasted.value='공격력 20,497\n공격 정확도 951\n치명타 적중 1,807\n치명타 피해 증가 20%\n방어력 19,583\n기본 공격 회피 2,053\n도술 막기 2,266\n치명타 저항 727\n도술 공격 피해 감소 2.19%\n체력\n100506\n체력 자연 회복\n2.744';hostListeners.input({target:pasted});
assert.equal(el('#opt-defense').value,'19583');assert.equal(el('#opt-critical-damage').value,'20');assert.equal(el('#opt-maxhp').value,'100506');assert.equal(el('#opt-regen').value,'2744');assert.match(el('#opt-stat-import-status').textContent,/11개 능력치/);
assert.equal(el('#opt-measure-row').hidden,false,'Measurement is the default');assert.equal(el('#opt-incoming-row').hidden,true);
assert.equal(el('#opt-run').disabled,true,'A measured zone is required');assert.match(el('#opt-need').textContent,/측정 사냥터를 고르세요/);
const pick=(id,v)=>{const s=el('#'+id);s.value=v;hostListeners.change({target:s});};
pick('opt-zone-from','101011');assert.match(el('#opt-need').textContent,/시작 HP/);
el('#opt-hp-start').value='';input('opt-hp-start',66606);input('opt-hp-end',Number(el('#opt-maxhp').value));input('opt-seconds',265);assert.match(el('#opt-need').textContent,/최대 체력에 닿아/,'Capped HP cannot be calibrated');
input('opt-hp-end',89632);const override={value:'542',dataset:{optOverride:'s085:0'}};el('#x').dataset=override.dataset;hostListeners.input({target:override});hostListeners.change({target:override});
// The fixed spatial model divides the measured total by its simulated average attackers.
const measurement=/1마리당 받는 피해 분당 ([\d,]+) \(실측 ([\d,]+) ÷ 평균 ([\d.]+)마리\)/.exec(el('#opt-need').textContent);
assert(measurement,'Measured incoming is derived per monster');const measuredPerMob=Number(measurement[1].replace(/,/g,''));assert(Number(measurement[3])>0);
const budget=/받는 피해 ([\d,]+) − 자연 회복 ([\d,]+) \+ 안전 여유 ([\d,]+) = 회복·보호막 분당 ([\d,]+) 필요/.exec(el('#opt-need').textContent);assert(budget);const money=budget.slice(1).map(x=>Number(x.replace(/,/g,'')));assert(Math.abs(money[0]-money[1]+money[2]-money[3])<=1,'Displayed sustain budget preserves arithmetic');
assert.match(el('#opt-need').textContent,/현재 빌드: 도술만 분당 처치 [\d.]+마리/);
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).overrides['s085:0'],'542','Inputs persist');
click('#opt-run');
assert.equal(searches.length,1);assert.equal(searches[0].zone.id,'101011');assert(Math.abs(searches[0].perMob-measuredPerMob)<1);assert.equal(searches[0].margin,1000);assert.equal(searches[0].iterations,4000,'Fixed search depth');

// Hunting zones: measured in 독기 지대, hunting in 마을 폐허 → damage per monster scales by the spawn-weighted attack ratio (×1.654).
assert.match(el('#opt-zone-to').innerHTML,/마을 폐허 · 권장 565,000/);assert.match(el('#opt-zone-to').innerHTML,/측정한 곳과 같음/);
pick('opt-zone-to','101014');
assert.match(el('#opt-need').textContent,/× 사냥터 공격력 1.65배 \(추정\)/);assert.match(el('#opt-need').textContent,/마을 폐허에서 현재 빌드는 평균/);assert.match(el('#opt-zone').textContent,/평균 공격력 13,763.*독기 지대 대비 공격력 1.65배/);
input('opt-power',282000);assert.match(el('#opt-zone').textContent,/내 전투력 50% · 부족/);
click('#opt-run');assert.equal(searches.length,2);assert.equal(searches[1].zone.id,'101014');assert(Math.abs(searches[1].perMob-measuredPerMob*1.65404)<5,'Search uses the target-zone damage per monster');
assert.match(el('#opt-result-comparison').innerHTML,/추천 빌드|가정한 조건에서 회복이 부족합니다/);
// Typed damage is per monster in the target zone: no scaling even with a measured zone saved.
hostListeners.change({target:{name:'opt-mode',value:'incoming',dataset:{}}});input('opt-incoming',50000);
assert.match(el('#opt-need').textContent,/1마리당 받는 피해 분당 50,000 \(입력\)/);assert.equal(el('#opt-measure-row').hidden,true);
// A zone nobody survives: the main comparison explains how far short the closest build is.
input('opt-incoming',400000);click('#opt-run');
assert.match(el('#opt-result-comparison').innerHTML,/가정한 조건에서 회복이 부족합니다/);assert.match(el('#opt-result-comparison').innerHTML,/가장 근접해도 분당 [\d,]+ 부족/);assert.match(el('#opt-result-comparison').innerHTML,/가장 근접한 빌드<\/h3><p class="opt-summary">/);
assert.match(el('#opt-result-comparison').innerHTML,/내 전투력 50%/,'The power ratio explains it');
assert.match(el('#opt-result-comparison').innerHTML,/버티려면 \(가장 근접한 빌드 기준 · 하나만 바꿀 때\)/);assert.match(el('#opt-result-comparison').innerHTML,/체력 자연 회복 2,744 → [\d,]+ \(\+[\d,]+\)/);assert.match(el('#opt-result-comparison').innerHTML,/받는 피해 [\d.]+% 줄이기|받는 피해: 95%를 줄여도 부족/);assert.match(el('#opt-result-comparison').innerHTML,/같은 가정에서 회복량이 충분한 사냥터/);
input('opt-incoming',50000);
pick('opt-zone-to','');assert.match(el('#opt-need').textContent,/목표 사냥터를 고르세요/,'Typed damage needs a target zone');
pick('opt-zone-to','101011');assert.doesNotMatch(el('#opt-need').textContent,/사냥터 공격력/,'Direct target-zone damage needs no scaling');
click('#opt-run');assert.equal(searches.length,4);
assert.deepEqual(Array.from(searches[0].families).sort(),['강인','기동','연타','절명','헌신'].sort(),'Defaults to the families already in the build');
assert.equal(el('#opt-results').hidden,false);assert.match(el('#opt-status').textContent,/완료/);
assert.match(el('#opt-direction-cards').innerHTML,/빠른 사냥/);assert.match(el('#opt-direction-cards').innerHTML,/안정 사냥/);assert.match(el('#opt-direction-cards').innerHTML,/연계 중심/);assert.match(el('#opt-result-comparison').innerHTML,/현재 빌드와 추천 빌드 비교/);assert.match(el('#opt-result-comparison').innerHTML,/data-opt-apply="0"/);
assert.match(el('#opt-direction-cards').innerHTML,/확정 2회 · 조건부 1회/,'Cards use the same 180-second link evaluation as the timeline');
assert.match(el('#opt-result-timeline').innerHTML,/스킬 타임라인/);assert.match(el('#opt-result-timeline').innerHTML,/recommend-timeline-overlay/);assert.match(el('#opt-result-timeline').innerHTML,/100% · 60초/);
assert.match(el('#opt-found').textContent,/궁극기 .*개 · 보조 도술 조합 .*개 · 검증된 빌드 .*개/);
click('[data-opt-apply]',{optApply:'0'});assert.equal(applied.next.length,9);assert.equal(applied.base.length,5);assert.match(toasts.at(-1),/되돌리기/);
ctx.syncBuildOptimizer();assert.equal(el('#opt-stale').hidden,false,'Results are marked stale after the build changes');
ctx.build=[];ctx.syncBuildOptimizer();assert.equal(el('#opt-empty').hidden,false);assert.equal(el('#opt-work').hidden,true);
// Blocked build (the planner normally prevents this): the reason is shown with a way back to the planner.
ctx.build=[...ids];D.baseSlots=['s071','s069','s075','s012','s085'];ctx.syncBuildOptimizer();
assert.equal(el('#opt-validation').hidden,false);assert.match(el('#opt-validation').innerHTML,/암습.*기본 장착/);assert.match(el('#opt-need').textContent,/계산할 수 없습니다: 암습/);
assert.match(el('#opt-validation').innerHTML,/data-tab="explore"/);assert.equal(el('#opt-run').disabled,true);
D.baseSlots=['s003','s007','s008','s071','s069'];ctx.syncBuildOptimizer();assert.equal(el('#opt-validation').hidden,true,'Valid build computes again');
console.log('Optimizer UI: stats gate, measured need, persistence, run, compact results, apply and stale results passed.');

assert.match(el('#opt-world').textContent,/도술만 분당 처치/);assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).encounter,true,'Spatial encounter model is always enabled');

ctx.build=[];ctx.syncBuildOptimizer();const mode=el('#opt-start-mode');mode.value='conditions';hostListeners.change({target:mode});assert.equal(el('#opt-work').hidden,false);assert.equal(el('#opt-validation').hidden,true,'No primary family is a valid engine-decides state');assert.match(el('#opt-required-families').innerHTML,/엔진이 결정/);assert.equal(ctx.build.length,0);
hostListeners.change({target:{dataset:{requiredFamily:'강타'},checked:true}});assert.match(el('#opt-equipment').textContent,/비교용/);assert.match(el('#opt-skill-picker').innerHTML,/회전 난격/);assert(el('#opt-skill-picker').innerHTML.includes('도약 찌르기'),'Supporting skills remain available across families');
hostListeners.change({target:{dataset:{requiredFamily:'연타'},checked:true}});let twoPrimary=JSON.parse(storage.get('dosul-optimizer-v1'));assert.deepEqual(twoPrimary.primaryFamilies,['강타','연타']);assert.equal(el('#opt-primary-family-count').textContent,'','Hidden selection summary stays empty');assert.match(el('#opt-required-families').innerHTML,/data-required-family="절명"[^>]*disabled/);
const requiredId=D.skills.find(s=>s.name==='회전 난격').id;click('[data-toggle-required]',{toggleRequired:requiredId});assert.match(el('#opt-skill-picker').innerHTML,/aria-pressed="true"/);assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).requiredSkills[0],requiredId);assert.equal(ctx.build.length,0);
click('[data-toggle-required]',{toggleRequired:requiredId});assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).requiredSkills.length,0,'Second click deselects');click('[data-toggle-required]',{toggleRequired:requiredId});
const expected=O.conditionSeed(D,{primaryFamilies:['강타','연타'],requiredSkills:[requiredId]},Object.keys(D.families));click('[data-opt-edit]');assert.deepEqual([...applied.next],expected.ids,'Editing transfers exactly the preview order');assert.deepEqual([...applied.base],expected.baseSlots);assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).startMode,'current');
mode.value='conditions';hostListeners.change({target:mode});hostListeners.change({target:{dataset:{requiredFamily:'연타'},checked:false}});assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).requiredSkills.length,1,'Changing primary family preserves optional supporting skills');
console.log('Condition UI: up to two primary families, unrestricted support cards, optional toggles and exact preview-to-planner transfer passed.');

// New-build recommendations must work without guessed incoming damage or a target zone.
input('opt-incoming','');pick('opt-zone-to','');
assert.equal(el('#opt-run').disabled,false);
assert.match(el('#opt-need').textContent,/생존 미평가/);
click('#opt-run');
assert.match(el('#opt-direction-cards').innerHTML,/빠른 사냥/);
assert.match(el('#opt-direction-cards').innerHTML,/생존 여유<\/dt><dd>미평가/);
assert.doesNotMatch(el('#opt-result-comparison').innerHTML,/회복·보호막 ≥ 받는 피해/);
assert.equal(searches.at(-1).perMob,undefined);
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
assert.equal(searches.length,beforeWorkers,'No main-thread engine search');assert.equal(firstWorker.message.options.totalEvaluationBudget,4000);assert.equal(firstWorker.message.options.boundedSelection,true);assert.equal(firstWorker.message.options.families.length,Object.keys(D.families).length);assert.deepEqual(Array.from(firstWorker.message.options.conditions.primaryFamilies),['강타']);
firstWorker.onmessage({data:{type:'progress',progress:{evaluated:12,generation:{generated:100,target:120},scorecard:{step:2,phase:'원인 맞춤 보완',generated:100,evaluated:12,feasible:3,score:68.4,target:75,status:'보완 필요',cause:'평타 대기 비율이 높습니다.',remedy:'짧은 재사용 대기시간 도술을 우선 생성합니다.'}},elapsedMs:1000,preview:[{ids:expected.ids}]}});
assert.equal(el('#opt-live').hidden,false);assert.match(el('#opt-live-builds').innerHTML,/후보 1/);
assert.match(el('#opt-generation-summary').textContent,/합법 시드 100개.*무작위 최소 120개.*68.4\/75점.*보완 필요/);assert.match(el('#opt-generation-rows').innerHTML,/원인 맞춤 보완.*평타 대기 비율.*짧은 재사용 대기시간/s);
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
assert.match(el('#opt-direction-cards').innerHTML,/빠른 사냥/);
assert.match(el('#opt-direction-cards').innerHTML,/안정 사냥/);
assert.match(el('#opt-direction-cards').innerHTML,/연계 중심/);
assert.match(el('#opt-result-comparison').innerHTML,/현재 빌드와 추천 빌드 비교/);
assert.match(el('#opt-found').textContent,/검증된 빌드/);
console.log('Grouped UI: compact three-direction results and comparison passed.');

mode.value='conditions';hostListeners.change({target:mode});
const excludedId=D.skills.find(s=>s.family==='기만'&&!s.ultimate).id;
click('[data-toggle-required]',{toggleRequired:excludedId});
hostListeners.change({target:{dataset:{excludedFamily:'기만'},checked:true}});
let savedSettings=JSON.parse(storage.get('dosul-optimizer-v1'));
assert(savedSettings.excludedFamilies.includes('기만'));assert(!savedSettings.requiredSkills.includes(excludedId));
assert(!el('#opt-skill-picker').innerHTML.includes('data-toggle-required="'+excludedId+'"'));
click('#opt-run');assert(!workers.at(-1).message.options.families.includes('기만'));
hostListeners.change({target:{dataset:{requiredFamily:'기만'},checked:true}});
assert(workers.at(-1).terminated);assert(!JSON.parse(storage.get('dosul-optimizer-v1')).excludedFamilies.includes('기만'));
assert.match(el('#opt-excluded-families').innerHTML,/data-excluded-family="기만"[^>]*disabled/);
console.log('Excluded family UI: persistence, fixed-skill cleanup, worker filtering, cancellation and primary conflict handling passed.');


click('[data-opt-target-mode]',{optTargetMode:'single'});
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).targetMode,'single');
assert.equal(el('#opt-results').hidden,true);
assert.equal(el('#opt-run').disabled,true,'A primary family with an area ultimate cannot satisfy single hunting');
hostListeners.change({target:{dataset:{primaryAuto:''},checked:true}});hostListeners.change({target:{dataset:{requiredFamily:'절명'},checked:true}});
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

pick('opt-start-mode','conditions');pick('opt-target-mode','single');hostListeners.change({target:{dataset:{primaryAuto:''},checked:true}});hostListeners.change({target:{dataset:{requiredFamily:'연타'},checked:true}});
assert.equal(el('#opt-run').disabled,true);
hostListeners.change({target:{id:'opt-use-ultimate',checked:false,dataset:{}}});
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).useUltimate,false);
assert.equal(el('#opt-run').disabled,false,'Single-target yeonta works with ultimate disabled');
click('#opt-run');assert.equal(workers.at(-1).message.options.conditions.useUltimate,false);
assert(!el('#opt-skill-picker').innerHTML.includes('data-toggle-required="s018"'),'Ultimate is unavailable when disabled');
console.log('Optional ultimate UI: persisted setting, single-target yeonta and worker options passed.');
input('opt-hit-damage',3378);
assert.equal(Number(el('#opt-incoming').value),135120);assert(el('#opt-incoming').readOnly);
assert.match(el('#opt-hit-rate').textContent,/135,120/);
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).incoming,135120);
click('#opt-run');assert.equal(workers.at(-1).message.options.perMob,135120,'Converted damage reaches the search engine');
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).hitInterval,1.5,'Attack interval stays fixed at 1.5 seconds');
input('opt-hit-damage','');assert.equal(el('#opt-incoming').readOnly,true);
console.log('Per-hit incoming UI: fixed 1.5-second conversion, read-only display, persistence and worker input passed.');
input('opt-basic-attack-damage',1234);input('opt-basic-attack-interval',1.2);input('opt-basic-attack-range',2.4);
assert.match(el('#opt-world').textContent,/예상 분당 처치/,'A complete measured basic-attack profile changes the throughput label');
click('#opt-run');const basicWorker=workers.at(-1);assert.equal(basicWorker.message.options.stats.basicAttackDamage,1234);assert.equal(basicWorker.message.options.stats.basicAttackInterval,1.2);assert.equal(basicWorker.message.options.stats.basicAttackRange,2.4);
console.log('Measured basic attacks: complete user inputs reach the worker and are labeled as total throughput.');
