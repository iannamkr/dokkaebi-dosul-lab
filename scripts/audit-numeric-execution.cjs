'use strict';
// Strict source-to-execution contracts. Missing consumers are failures, never skips.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),BASE=require('../dist/data.json'),raw=require('../dist/kkaebigg/skills.json'),buffs=require('../dist/kkaebigg/buffs.json');
const C=require('../dist/combat.js'),A=require('../dist/timing-auto.js'),H=require('../dist/hit-timing.js'),S=require('../dist/simulation.js'),F=require('../dist/shinsik.js'),O=require('../dist/optimizer.js'),K=require('../dist/kkaebigg.js'),N=require('../dist/numbers.js');
const clone=x=>structuredClone(x),near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b));
function run(){
 // Audit the source snapshot at its base progression state. Legendary breakthrough
 // execution has its own exhaustive contract test and must not alter these baselines.
 const D=clone(BASE);D.legendaryBreakthroughStep=0;K.apply(D,{skills:raw,buffs});
 const cases=[],inventory=[];
 function check(id,category,expected,fn){try{const actual=fn();cases.push({id,category,status:(typeof expected==='number'?near(actual,expected):JSON.stringify(actual)===JSON.stringify(expected))?'pass':'fail',expected,actual});}catch(e){cases.push({id,category,status:'fail',expected,error:e.message});}}
 function first(s){return C.run({...D,skills:[s]},[s.id],20,false).events[0];}
 function leaves(x,p=''){if(typeof x==='number')return [{path:p,value:x}];if(!x||typeof x!=='object')return [];return Object.entries(x).flatMap(([k,v])=>leaves(v,p?p+'.'+k:k));}
 for(const k of raw.skills){
  const original=D.skills.find(s=>s.name===k.n),id=k.n;
  if(!original){check(id,'missing-skill',true,()=>false);continue;}
  const s=clone(original),n=k.num;
  check(id+':executable','execution',Number.isFinite(n.m),()=>!!first(s)); const ev=first(s)||{id:s.id,start:0,end:0,cooldownEnd:s.basic.cooldown,parts:{action:0,prep:0,charge:0}},selected=n.cm?n.dc.slice(-1):n.dc;
  // Every source numeric leaf receives an explicit classification. A new field fails closed.
  for(const leaf of leaves(k)){
   let kind=/^(id|st|u|ms|ph|mt)$/.test(leaf.path)?'identity':/^num\.lv\.\d+\.level$/.test(leaf.path)||/^num\.dc\.\d+\.damage_id$/.test(leaf.path)?'index':/^num\.(cd|m|pm|cm)$/.test(leaf.path)?'execution':/^num\.dc\.\d+\.(basic_coefficient|hits)$/.test(leaf.path)?'damage':/^num\.lv\.\d+\.coefficient$/.test(leaf.path)?'level':/^ef\.\d+\.v$/.test(leaf.path)?'effect-value':/^ef\.\d+\.fl\.\d+\.level$/.test(leaf.path)?'index':/^ef\.\d+\.fl\.\d+\.coefficient$/.test(leaf.path)?'effect-level':leaf.path==='num.total'?'derived-total':leaf.path==='num.dm'?'damage-motion':'unmapped';
   inventory.push({skill:id,...leaf,kind});if(kind==='unmapped')check(id+':'+leaf.path,'unmapped-numeric-field','registered execution contract',()=>null);
  }
  check(id+':source-effect-values','source-storage',k.ef||[],()=>s.referenceProgression.effects);
  check(id+':source-numbers','source-storage',n,()=>s.referenceNumbers);
  check(id+':cooldown','cooldown',Math.round(n.cd*100)/100,()=>ev.cooldownEnd-ev.start);
  {const t=clone(s);t.basic.cooldown+=1;check(id+':cooldown-mutation','cooldown',ev.cooldownEnd+1,()=>first(t)?.cooldownEnd??t.basic.cooldown);}
  for(const [key,part,unit] of [['m','action',1000],['pm','prep',1],['cm','charge',1000]]){
   check(id+':'+key,'motion',(n[key]??0)/unit,()=>ev.parts[part]);const t=clone(s);t.referenceNumbers[key]=(n[key]??0)+unit;
   check(id+':'+key+':mutation','motion',n.m===null&&key!=='m'?null:ev.parts[part]+1,()=>first(t)?.parts[part]??A.motion(t)?.[part]??null);
  }
  if(n.dm!==null&&n.dm!==undefined){check(id+':dm:stored','damage-motion-storage',n.dm,()=>s.referenceNumbers.dm);if(n.dm!==n.m){const t=clone(s);t.referenceNumbers.dm+=1000;check(id+':dm-does-not-replace-action','damage-motion',A.motion(s).action,()=>A.motion(t).action);}}
  const total=selected.reduce((a,v)=>a+v.basic_coefficient*v.hits,0);
  check(id+':declared-total','derived-total',n.total,()=>s.referenceNumbers.total);
  if(n.total!==null&&!near(total,n.total))inventory.push({skill:id,path:'num.total',kind:'source-conflict',value:n.total,componentSum:total});
  if(!n.nd){
   check(id+':coefficient-total','damage',total,()=>F.eventCoefficient(s));
   let offset=0;
   for(let j=0;j<n.dc.length;j++){
    const p=n.dc[j],active=!n.cm||j===n.dc.length-1;
    if(!active){const t=clone(s);t.chargeStage=j+1;t.referenceNumbers.dc[j].basic_coefficient+=10;
     check(id+':charge-stage-'+(j+1),'charge-stage-selection',true,()=>S.coefficient(t,1)!==S.coefficient(s,1));continue;}
    for(let h=1;h<=p.hits;h++){
     const index=offset+h;check(id+':hit-'+index,'hit-coefficient',p.basic_coefficient,()=>S.coefficient(s,index));
     const t=clone(s);t.referenceNumbers.dc[j].basic_coefficient+=10;
     check(id+':hit-'+index+':mutation','hit-coefficient',p.basic_coefficient+10,()=>S.coefficient(t,index));
    }
    const t=clone(s);t.referenceNumbers.dc[j].hits++;
    check(id+':hits-'+j+':mutation','hit-count',H.schedule(s,ev).hits.length+(ev.hitIndices||s.damage===false||H.schedule(s,ev).unknown?0:1),()=>H.schedule(t,ev).hits.length);offset+=p.hits;
   }
   for(const lv of n.lv||[]){const t=clone(s);t.level=lv.level;
    check(id+':level-'+lv.level,'level',total*(1+lv.coefficient),()=>F.eventCoefficient(t));
   }
  }else check(id+':non-damage','non-damage',0,()=>H.schedule(s,ev).hits.length);
  for(let i=0;i<(k.ef||[]).length;i++){
   const t=clone(s),before=N.effectRows(s);t.referenceProgression.effects[i].v+=1;
   check(id+':effect-'+i+':mutation','effect-projection',true,()=>JSON.stringify(N.effectRows(t))!==JSON.stringify(before));
   for(let j=0;j<(k.ef[i].fl||[]).length;j++){const t=clone(s);t.level=k.ef[i].fl[j].level;const baseline=JSON.stringify(O.sources(t));t.referenceProgression.effects[i].fl[j].coefficient+=1;check(id+':effect-'+i+':level-'+t.level,'effect-level',true,()=>JSON.stringify(O.sources(t))!==baseline);}
  }
  for(const [name,t]of Object.entries(s.timingEffects||{})){
   check(id+':duration:'+name,'effect-duration',t.duration,()=>A.duration(s,name).value);
   const bag={[name]:[{appliedAt:0,duration:t.duration,expiresAt:t.duration,confirmed:true}]};
   if(Number.isFinite(t.duration))for(const [at,status]of [[t.duration-.001,'yes'],[t.duration,'no'],[t.duration+.001,'no']])check(id+':expiry:'+name+':'+at,'expiry-boundary',status,()=>S.effectState(bag,name,at).status);
   else check(id+':expiry:'+name+':unknown','expiry-boundary','unknown',()=>S.effectState(bag,name,0).status);
  }
  check(id+':range','range',s.basic.range,()=>S.geometry(s).range);
  const ranged=clone(s);ranged.basic.range+=1;check(id+':range:mutation','range',s.basic.range+1,()=>S.geometry(ranged).range);
  if(s.targeting.count){check(id+':target-cap','target-cap',s.targeting.count,()=>S.geometry(s).cap);const t=clone(s);t.targeting.count++;check(id+':target-cap:mutation','target-cap',s.targeting.count+1,()=>S.geometry(t).cap);}
 }
 // Metadata has no battle meaning; it is inventoried separately rather than misrepresented as simulated.
 for(const leaf of leaves(raw.trr,'trr'))inventory.push({...leaf,kind:'upgrade-probability-not-combat'});
 for(const leaf of leaves(raw.awk,'awk'))inventory.push({...leaf,kind:'awakening-cost-or-owned-stat'});
 for(const [category,ranks]of Object.entries(raw.awk))ranks.forEach((row,i)=>{for(const [name,value]of row[2])check(category+':'+i+':'+name,'awakening-connection',value,()=>N.awakening(raw.awk,[{category,rank:i+1}])[name]);});
 const ctx=f=>({active:[f],windows:[],procs:[],horizon:60});
 for(const [count,pct]of [[3,.55],[4,.75],[5,1.25]])check('절명:'+count,'shinsik-damage',pct,()=>F.bonus(ctx('절명'),{ultimate:true},{resources:{forms:count}},1));
 for(const [count,pct]of [[33,.03],[66,.07],[100,.1]])check('강타:'+count,'shinsik-damage',pct,()=>F.bonus(ctx('강타'),{},{resources:{smash:count}},1));
 for(let count=1;count<=3;count++)for(const [family,pct]of [['저격',.15],['연타',.015]])check('저격:'+family+':'+count,'shinsik-damage',pct*count,()=>F.bonus(ctx('저격'),{family},{resources:{arrows:count}},1));
 for(let count=1;count<=3;count++)for(const ultimate of [true,false])check('제압:'+ultimate+':'+count,'shinsik-damage',ultimate?.02*count:0,()=>F.bonus(ctx('제압'),{ultimate},{resources:{locks:count}},1));
 for(let count=1;count<=50;count++)check('연타:'+count,'shinsik-damage',count*.004,()=>F.bonus({...ctx('연타'),rage:{points:[{time:0,stacks:count}]}},{},{resources:{}},1));
 for(const [family,window,duration,pct]of [['기동','연쇄',10,.5],['파멸','요기범람',20,.1],['척살','척살 태세',10,.1]])for(const [time,value]of [[1,pct],[duration,0],[duration+.001,0]])check(family+':window:'+time,'shinsik-boundary',value,()=>F.bonus({...ctx(family),windows:[{name:window,start:0,end:duration}]},{family,ultimate:true},{start:0,resources:{}},time));
 for(const [family,hits,duration]of [['기동',14,10],['파멸',8,20]]){const d=clone(D),skills=d.skills.filter(s=>s.family===family&&!s.ultimate).slice(0,3);for(const s of skills){s.basic.cooldown=0;s.referenceNumbers.m=1000;s.referenceNumbers.pm=0;s.referenceNumbers.cm=0;s.usage={charges:1};}d.baseSlots=skills.map(s=>s.id);const r=C.run(d,d.baseSlots,40);check(family+':resource-threshold','shinsik-resource',hits-1,()=>r.windows[0].start);check(family+':duration','shinsik-resource',duration,()=>r.windows[0].end-r.windows[0].start);}
 function familyFixture(family,events=[]){const d=clone(D),skills=d.skills.filter(s=>s.family===family&&!s.ultimate).slice(0,3);d.baseSlots=skills.map(s=>s.id);d.combatEvents=events;return {d,ids:d.baseSlots};}
 {const {d,ids}=familyFixture('척살',[{type:'kill',time:0}]),r=C.run(d,ids,20);check('척살:실제 처치','event-integration',true,()=>r.procs.some(p=>p.name==='척결 1중첩'&&p.time===0));}
 {const life=D.shinsikEventRules['강인'].hitCooldown,{d,ids}=familyFixture('강인',[{type:'incoming-hit',time:0},{type:'incoming-hit',time:life/2},{type:'incoming-hit',time:life}]),r=C.run(d,ids,20);check('강인:피격 내부 대기시간','event-integration',2,()=>r.procs.filter(p=>p.name==='피격 영력').length);}
 {const {d,ids}=familyFixture('저격',[{type:'dodge',time:0}]),r=C.run(d,ids,20);check('저격:귀보 후 첫 시전 화살촉','event-integration',1,()=>r.events[0].resources.arrows);}
 {const needed=Math.ceil(D.shinsikEventRules['기동'].maximum/D.shinsikEventRules['기동'].dodgeEnergy),{d,ids}=familyFixture('기동',Array.from({length:needed},()=>({type:'dodge',time:0}))),r=C.run(d,ids,20);check('기동:귀보 영력 초기화','event-integration',true,()=>r.windows.some(w=>w.name==='연쇄'&&w.start===0));}
 {const {d,ids}=familyFixture('기만'),target={id:1,beneficialBuffs:[{name:'호법'},{name:'시험 강화'}]};C.run(d,ids,20,true,{advance(){},start(){},next(){return Infinity;},init(run,hit,notify){for(let i=0;i<D.shinsikEventRules['기만'].illusionCap;i++)notify('skill-hit',0,{target,skill:d.skills.find(s=>s.id===ids[0])});}});check('기만:제거 대상/호법 보호','event-integration',['호법'],()=>target.beneficialBuffs.map(b=>b.name));}
 {const {d,ids}=familyFixture('제압'),target={id:1},rules=D.shinsikEventRules['제압'];C.run(d,ids,20,true,{advance(){},start(){},next(){return Infinity;},init(run,hit,notify){notify('skill-hit',0,{target,skill:d.skills.find(s=>s.family==='제압'&&s.ultimate),event:{resources:{locks:3}}});}});check('제압:속박 지속','event-integration',rules.rootLife,()=>target.rootUntil);check('제압:증폭 지속','event-integration',rules.ampLife,()=>target.blueChainUntil);check('제압:증폭 수치','event-integration',rules.ampPerStack/100,()=>target.blueChainPct);}
 // Unpublished semantics stay explicit in the inventory. They are not guessed and
 // cannot be executable assertions until the source exposes a numeric contract.
 for(const [family,rule]of [['주술','궁극기 강화저주/폭발 구성 피해 식별'],['헌신','하트 소비 후 이로운 효과 증가량']])inventory.push({skill:family,path:rule,kind:'unresolved-source-contract'});

 const summary={total:cases.length,passed:cases.filter(c=>c.status==='pass').length,failed:cases.filter(c=>c.status==='fail').length,skipped:0,inventory:inventory.length,skills:raw.skills.length};
 const byCategory={};for(const c of cases){const b=byCategory[c.category]??={passed:0,failed:0};b[c.status==='pass'?'passed':'failed']++;}
 return {schema:'numeric-execution-audit-v1',createdAt:new Date().toISOString(),scope:'Finite source snapshot coverage; not a claim of all possible combinations. 105 skills: source numeric leaves, all confirmed target caps, all 50 damage levels, motion/cooldown/coefficients mutations, effect description projection (not full execution proof for all utility effects), sustain scaling, known-duration boundaries, 12 family rule contracts. Source enum fields remain identity metadata. New unmapped numeric fields fail. Unpublished semantics remain explicit unresolved inventory and are never guessed. Not proof of all possible runtime combinations.',summary,byCategory,inventory,cases};
}
module.exports={run};if(require.main===module){const report=run(),file=process.argv[2]||path.join(ROOT,'numeric-execution-report.json');fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify({summary:report.summary,byCategory:report.byCategory},null,2));if(report.summary.failed)process.exitCode=1;}


