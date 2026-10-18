const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(seed={},deny=false){
 const els=new Map(),storage=new Map(Object.entries(seed)),events={};let download;
 function el(k){if(!els.has(k))els.set(k,{innerHTML:'',textContent:'',value:k==='#candidate-mode'?'all':k==='#link-scope'?'previous':'',checked:false,clientHeight:500,clientWidth:1000,hidden:false,open:false,classList:{add(){},remove(){},toggle(){}},listeners:{},addEventListener(n,fn){this.listeners[n]=fn;},getBoundingClientRect(){return{};},contains(t){return t.inside;},querySelector:el,focus(){this.focused=true;}});return els.get(k);}
 const ctx={console,document:{querySelector:el,querySelectorAll:()=>[],addEventListener:(n,fn)=>(events[n]??=[]).push(fn)},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(deny)throw Error('Quota');storage.set(k,v);}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},ResizeObserver:class{observe(){}},prompt:()=>'<조합 이름>',fetch:async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('dist/builds/04-yeonta-area.json','utf8'))})};ctx.window=ctx;vm.createContext(ctx);
 for(const f of ['data','graph','sequence','targets','timing','hit-timing','timing-auto','combat','link-timing','mechanics','mechanics-ui','hangul','planner','timing-ui','game-ui'])vm.runInContext(fs.readFileSync('dist/'+f+'.js','utf8'),ctx,{filename:f});
 const run=s=>vm.runInContext(s,ctx),value=s=>JSON.parse(run('JSON.stringify('+s+')'));
 run('download=(name,body,type)=>{window.lastDownload={name,body,type}}');
 const click=(selector,dataset={})=>events.click.forEach(fn=>fn({target:{inside:false,closest:s=>s===selector?{dataset}:null}}));
 return {ctx,el,run,value,storage,events,click};
}
(async()=>{
 const {ctx,el,run,value,storage,events,click}=setup();
 run("pick('s011');pick('s015');pick('s060')");const original=value('build');assert.equal(original.length,3);
 click('[data-insert]',{insert:'1'});run("pick('s021')");assert.deepEqual(value('build'),['s011','s021','s015','s060']);assert.match(el('#candidate-nodes').innerHTML,/대상/);assert.match(el('#candidate-nodes').innerHTML,/사거리/);
 click('[data-move]',{move:'1,1'});assert.deepEqual(value('build'),['s011','s015','s021','s060']);click('[data-remove]',{remove:'2'});assert.deepEqual(value('build'),original);el('#undo').onclick();assert.equal(value('build').length,4);
 el('#save').onclick();assert.equal(el('#save-form').hidden,false,'Inline name field opens');el('#save-name').value='<조합 이름>';el('#save-ok').onclick();assert.equal(el('#save-form').hidden,true);assert.equal(value('saved').length,1);assert(el('#saved').innerHTML.includes('&lt;조합 이름&gt;'));assert.match(el('#saved').innerHTML,/&lt;조합 이름&gt; · 궁극기 (없음|\S+) \(\d\/9\)/,'Saved combos show their ultimate');const kept=value('build');el('#clear').onclick();el('#saved').value='0';el('#load').onclick();assert.deepEqual(value('build'),kept);
 const restored=setup(Object.fromEntries(storage));assert.deepEqual(restored.value('build'),kept);assert.deepEqual(restored.value('D.baseSlots'),value('D.baseSlots'));
 el('#export-build').onclick();assert.deepEqual(JSON.parse(ctx.lastDownload.body).skills,kept);
 for(const id of ['#download-csv','#download-data','#download-graph','#download-dot']){el(id).onclick();assert(ctx.lastDownload.body.length>100);assert(!ctx.lastDownload.body.includes('[object Object]'));}
 el('#search').value='주먹';el('#search').oninput();assert.match(el('#skill-list').innerHTML,/주먹 지르기/);assert(!el('#skill-list').innerHTML.includes('회전 난격'));
 el('#search').value='ㅈㅁ ㅈㄹㄱ';el('#search').oninput();assert.match(el('#skill-list').innerHTML,/주먹 지르기/,'초성 search');assert.match(el('#list-count').textContent,/^1개/);
 el('#search').value='';el('#family').value='연타';el('#family').onchange();assert.match(el('#list-count').textContent,/8개/);
 click('[data-target-filter]',{targetFilter:'single'});assert(!el('#skill-list').innerHTML.includes('회전 난격'));assert(el('#skill-list').innerHTML.includes('주먹 지르기'));
 el('#table-search').value='회전 난격';el('#table-search').oninput();assert.equal((el('#table-body').innerHTML.match(/<tr>/g)||[]).length,1);
 el('#table-search').value='ㅎㅈㄴㄱ';el('#table-search').oninput();assert.equal((el('#table-body').innerHTML.match(/<tr>/g)||[]).length,1,'초성 search in the catalog');
 const menu=el('.build-menu');menu.open=true;events.click[0]({target:{inside:true}});assert(menu.open);events.click[0]({target:{inside:false}});assert(!menu.open);menu.open=true;let prevented=false;events.keydown[0]({key:'Escape',preventDefault:()=>prevented=true});assert(!menu.open&&prevented&&el('summary').focused);
 const before=value('build');for(const file of [{size:100001,text:async()=>''},{size:3,text:async()=>'{x}'},{size:50,text:async()=>JSON.stringify({schema:'dosul-build-v3',skills:['bad']})}]){const target={files:[file],value:'chosen'};await el('#import').onchange({target});assert.equal(target.value,'');assert.deepEqual(value('build'),before,'Rejected import is atomic');}
 el('#reference-build').value='04-yeonta-area';await el('#load-reference').onclick();assert.deepEqual(value('build'),require('./dist/builds/04-yeonta-area.json').skills);
 el('#saved').value='0';el('#delete').onclick();assert.equal(value('saved').length,0);
 const corrupt=setup({'dosul-current-v2':'not JSON'});assert.deepEqual(corrupt.value('build'),[]);assert.match(corrupt.el('#detail').innerHTML,/도술을 선택하세요/);
 const denied=setup({},true);denied.run("pick('s011')");assert.equal(denied.value('build').length,1);assert.match(denied.el('#toast').textContent,/JSON/);
 // Base slots always satisfy the ultimate: a stored broken base is repaired on load, and unequipping a required family skill is refused.
 const y3=['s071','s003','s012','s069','s010','s085','s007','s001','s075'];
 const fixed=setup({'dosul-current-v2':JSON.stringify(y3),'dosul-base-v3':JSON.stringify(['s071','s069','s075','s012','s085'])});
 assert.deepEqual(fixed.value('D.baseSlots'),['s071','s069','s003','s007','s001']);assert.deepEqual(fixed.value('Q.validate(D,build).issues'),[]);
 fixed.events.change.forEach(fn=>fn({target:{dataset:{baseSlot:'s003'},checked:false}}));
 assert.deepEqual(fixed.value('D.baseSlots'),['s071','s069','s003','s007','s001'],'Required family slot stays');assert.match(fixed.el('#toast').textContent,/암습.*절명 도술 3개/);
 fixed.events.change.forEach(fn=>fn({target:{dataset:{baseSlot:'s071'},checked:false}}));assert.deepEqual(fixed.value('D.baseSlots'),['s069','s003','s007','s001'],'Other slots stay editable');
 console.log('Planner workflows: insert/move/remove/undo, save/load/reload/delete, all export formats, search/filters, popover/Escape, invalid import atomicity and storage failure passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
