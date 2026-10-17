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
 commit(next,step,base){applied={next,base};ctx.build=next;D.baseSlots=base;},download:(name,body)=>{downloaded=JSON.parse(body);},
 DosulSequence:require('./dist/sequence.js'),DosulSimulation:require('./dist/simulation.js'),DosulOptimizer:FastO,
 localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},setTimeout:(fn)=>{fn();return 0;},clearTimeout(){},console,Event:class{},
 document:{querySelector:k=>k==='#optimizer'?host:el(k),addEventListener:(t,fn)=>docListeners.push(fn)}};
ctx.location={hostname:'example.site',reload(){}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/kkaebi-gg/hunting.js','utf8'),ctx);vm.runInContext(fs.readFileSync('dist/optimizer-ui.js','utf8'),ctx);

const input=(id,value)=>{const t=el('#'+id);t.value=String(value);hostListeners.input({target:t});hostListeners.change({target:t});};
const click=(selector,dataset={})=>hostListeners.click({target:{closest:s=>s===selector?{dataset}:null}});
assert.match(el('#opt-sources').innerHTML,/생명의 흐름/,'Current sustain sources are listed');
assert.match(el('#opt-sources').innerHTML,/1,460/,'Flat shields need no stats');
assert.equal(el('#opt-run').disabled,true,'Attack and max HP are required');assert.match(el('#opt-stats-note').textContent,/최대 체력·공격력/);
input('opt-attack',20497);input('opt-maxhp',100029);input('opt-regen',2744);
assert.match(el('#opt-current-total').textContent,/직접 피해 계수/);assert.equal(el('#opt-measure-row').hidden,false,'Measurement is the default');assert.equal(el('#opt-incoming-row').hidden,true);
assert.equal(el('#opt-run').disabled,true,'Measurement inputs are required');assert.match(el('#opt-need').textContent,/시작 HP/);
el('#opt-hp-start').value='';input('opt-hp-start',66606);input('opt-hp-end',100029);input('opt-seconds',265);assert.match(el('#opt-need').textContent,/최대 체력에 닿아/,'Capped HP cannot be calibrated');
input('opt-hp-end',89632);const override={value:'542',dataset:{optOverride:'s085:0'}};el('#x').dataset=override.dataset;hostListeners.input({target:override});hostListeners.change({target:override});
assert.match(el('#opt-need').textContent,/85,246.*32,928.*안전 여유 1,000.*53,318/,'Need = measured incoming - regen + safety margin');assert.match(el('#opt-need').textContent,/현재 빌드: 분당/);
assert.equal(JSON.parse(storage.get('dosul-optimizer-v1')).overrides['s085:0'],'542','Inputs persist');
click('#opt-run');
assert.equal(searches.length,1);assert.equal(searches[0].singleOnly,true,'An all single-target build defaults to single-target search');assert.equal(Math.round(searches[0].need),53318);assert.equal(searches[0].iterations,4000,'Fixed search depth');

// Hunting zones: measured in 독기 지대, hunting in 마을 폐허 → incoming scales by the spawn-weighted attack ratio (×1.654).
assert.match(el('#opt-zone-to').innerHTML,/마을 폐허 · 권장 565,000/);
const pick=(id,v)=>{const s=el('#'+id);s.value=v;hostListeners.change({target:s});};
pick('opt-zone-from','101011');pick('opt-zone-to','101014');
assert.match(el('#opt-need').textContent,/× 사냥터 공격력 1.65배 = .*(추정)/);assert.match(el('#opt-zone').textContent,/평균 공격력 13,763.*독기 지대 대비 공격력 1.65배/);
input('opt-power',282000);assert.match(el('#opt-zone').textContent,/내 전투력 50% · 부족/);
click('#opt-run');assert.equal(searches.length,2);assert(Math.abs(searches[1].incoming-85246.22*13763/8320.84)<5,'Search uses the target-zone incoming');
assert.equal(Math.round(searches[1].need),Math.round(searches[1].incoming-32928+1000));
assert.match(el('#opt-card').innerHTML,/찾지 못했습니다/,'A much harder zone can leave no build that survives');assert.equal(el('#opt-others').hidden,true);
// Typed incoming damage is already for the target zone: no scaling even with a measured zone saved.
hostListeners.change({target:{name:'opt-mode',value:'incoming',dataset:{}}});input('opt-incoming',50000);
assert.match(el('#opt-need').textContent,/받는 피해 50,000 .입력. − 자연/);assert.equal(el('#opt-measure-row').hidden,true);
hostListeners.change({target:{name:'opt-mode',value:'measure',dataset:{}}});
pick('opt-zone-to','');assert.doesNotMatch(el('#opt-need').textContent,/사냥터/,'No target zone, no scaling');pick('opt-zone-from','');
click('#opt-run');assert.equal(searches.length,3);
assert.deepEqual(Array.from(searches[0].families).sort(),['강인','기동','연타','절명','헌신'].sort(),'Defaults to the families already in the build');
assert.equal(el('#opt-results').hidden,false);assert.match(el('#opt-status').textContent,/완료/);
assert.match(el('#opt-card').innerHTML,/추천 빌드/);assert.match(el('#opt-card').innerHTML,/물약 없이 버팀/);assert.match(el('#opt-card').innerHTML,/스킬 파워/);assert.match(el('#opt-card').innerHTML,/data-opt-apply="0"/);
click('[data-opt-json]',{optJson:'0'});assert.equal(downloaded.schema,'dosul-build-v3');assert(downloaded.optimizer.margin>=0);assert(downloaded.optimizer.surplusPerMin>=1000);assert.equal(downloaded.optimizer.safetyMargin,1000);assert.equal(downloaded.skills.length,9);
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
