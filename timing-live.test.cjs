const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const els=new Map();function el(k){if(!els.has(k))els.set(k,{innerHTML:'',textContent:'',value:k==='#candidate-mode'?'all':k==='#link-scope'?'previous':'',checked:false,clientHeight:500,classList:{add(){},remove(){},toggle(){}},addEventListener(){},getBoundingClientRect(){return{};}});return els.get(k);}
const c={console,window:{},document:{querySelector:el,querySelectorAll(){return[];},addEventListener(){}},localStorage:{getItem(){return null;},setItem(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},ResizeObserver:class{observe(){}}};c.window=c;vm.createContext(c);
for(const f of ['data','graph','sequence','targets','timing','hit-timing','timing-auto','combat','link-timing','mechanics','mechanics-ui','planner','timing-ui','game-ui'])vm.runInContext(fs.readFileSync('dist/'+f+'.js','utf8'),c,{filename:f});
const run=s=>vm.runInContext(s,c);
run("build=['s015'];step=1;selected='s015';render()");assert.match(el('#timing-inline').innerHTML,/현재 조합/);assert.equal(run('timingHorizon'),60);
run("select('s060')");assert.equal(run('timingTarget'),'s060');assert.match(el('#timing-inline').innerHTML,/후보 미리보기/);assert.match(el('#timing-inline').innerHTML,/4.5초 여유/);
assert.equal((el('#timing-inline').innerHTML.match(/class="compact-gantt"/g)||[]).length,1);assert.equal((el('#timing-inline').innerHTML.match(/data-segment=/g)||[]).length,3);
assert.match(el('#candidate-nodes').innerHTML,/지속 5초/);
run("build=['회전 난격','검기 폭발','대검 강타','연속 충격'].map(n=>S.find(s=>s.name===n).id);D.baseSlots=build.slice();step=4;$('#link-scope').value='all';$('#candidate-search').value='연쇄 번개';render()");
assert.match(el('#candidate-nodes').innerHTML,/만료/);assert.match(el('#candidate-nodes').innerHTML,/0.8초 초과/);assert.match(el('#candidate-nodes').innerHTML,/점수 제외/);
assert.equal(run('shown[0].score'),0);
run("$('#candidate-mode').value='linked';renderGraph()");assert.equal(run('shown.length'),0);
run("$('#candidate-mode').value='all';$('#candidate-search').value='';$('#link-scope').value='previous';build=['s015'];D.baseSlots=build.slice();step=1;select('s060')");
run("timingSegment=1;renderTimingPanel()");assert.match(el('#timing-inline').innerHTML,/20초부터 40초까지/);
run("timingHorizon=120;renderGraph()");assert.equal((el('#timing-inline').innerHTML.match(/data-segment=/g)||[]).length,6);
run("build=['s019','s015','s062','s059','s025','s003','s012','s060','s066'];D.baseSlots=['s062','s059','s060','s019','s015'];timingHorizon=60;step=8;selected='s066';render()");assert.match(el('#timing-inline').innerHTML,/파멸 · 요기범람/);assert.match(el('#timing-inline').innerHTML,/신식 미적용 → 적용/);assert.match(el('#mechanics-summary').innerHTML,/현재 조합/);
run("build=[];step=0;selected=null;render()");assert.equal(el('#timing-inline').innerHTML,'');assert.equal(el('#timing-inline').hidden,true);
// Reproduce the screenshot: 8 normals, 4 smash, linked-only and no direct effect link.
run("build=['연속 충격','삼단 찌르기','올려치기','회전 난격','화염 분출','얼음화살','검기 날리기','내려치기'].map(n=>S.find(s=>s.name===n).id);D.baseSlots=['연속 충격','올려치기','검기 날리기','회전 난격','얼음화살'].map(n=>S.find(s=>s.name===n).id);step=8;selected=build[7];$('#candidate-mode').value='linked';render()");
assert.ok(run("shown.some(x=>x.skill.name==='천벌')"));assert.match(el('#ultimate-suggestions').innerHTML,/천벌/);assert.match(el('#ultimate-suggestions').innerHTML,/9단계에 배치/);
// Filling eighth normal auto-appends the sole eligible ultimate; one undo restores the previous build.
run("build=build.slice(0,7);step=7;pick(S.find(s=>s.name==='내려치기').id)");assert.equal(run('build.length'),9);assert.equal(run('byId(build[8]).name'),'천벌');assert.equal(run('undoStack.at(-1).build.length'),7);
// Three of a second family in extra slots do not unlock another ultimate.
run("build=S.filter(s=>s.family==='강타'&&!s.ultimate).slice(0,3).concat(S.filter(s=>s.family==='파멸'&&!s.ultimate).slice(0,3),S.filter(s=>s.family==='연타'&&!s.ultimate).slice(0,1)).map(s=>s.id);D.baseSlots=build.slice(0,5);step=7;pick(S.filter(s=>s.family==='연타'&&!s.ultimate)[1].id)");assert.equal(run('build.length'),9);assert.equal(run('byId(build[8]).name'),'천벌');assert.deepEqual(JSON.parse(run('JSON.stringify(DosulCombat.active(D,build))')),['강타']);
console.log('Live UI: automatic preview, compact segments, shinsik, linked-filter ultimate recommendation, one-choice auto-fill, multi-choice and empty state passed.');
for(const file of fs.readdirSync('./dist/builds')){const v=JSON.parse(fs.readFileSync('./dist/builds/'+file,'utf8'));c.importFixture=v;run('importBuild(importFixture)');assert.equal(run('mechanicAnalysis(build).casts'),v.comparison.metrics.casts);assert.deepEqual(JSON.parse(run('JSON.stringify(D.baseSlots)')),v.baseSlots);run('download=(name,body)=>{window.exported=JSON.parse(body)}');run("$('#export-build').onclick()");assert.equal(c.exported.schema,'dosul-build-v3');assert.deepEqual(JSON.parse(JSON.stringify(c.exported.skills)),v.skills);assert.deepEqual(JSON.parse(JSON.stringify(c.exported.baseSlots)),v.baseSlots);}
run("importBuild(importFixture);step=7;$('#candidate-mode').value='all';$('#candidate-sort').value='repeat';renderGraph()");assert(run('shown.length')>1);assert(run('shown.every(x=>x.mechanics)'));assert.match(el('#candidate-nodes').innerHTML,/배치 후/);
run("$('#mechanism-filter').value='stock';renderGraph()");assert(run('shown.every(x=>x.skill.usage.charges>1)'));
run("$('#mechanism-filter').value='all';const previous=[...D.baseSlots];const moved=[...build];[moved[0],moved[7]]=[moved[7],moved[0]];commit(moved);window.baseStable=JSON.stringify(previous)===JSON.stringify(D.baseSlots)");assert(c.baseStable);
console.log('UI: four JSON imports/exports, candidate metrics, sorting/filtering, and equipment persistence on reordering passed.');

