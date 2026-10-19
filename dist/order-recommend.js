(function(root){
'use strict';
const round=n=>Math.round((Number(n)||0)*10)/10;
function* permutations(items,start=0){
 if(start>=items.length-1){yield [...items];return;}
 for(let i=start;i<items.length;i++){
  [items[start],items[i]]=[items[i],items[start]];
  yield* permutations(items,start+1);
  [items[start],items[i]]=[items[i],items[start]];
 }
}
function linkResult(data,edges,simulation,ids){
 const disabled=new Set(data.executionPolicy?.disabled||[]),set=new Set(ids.filter(id=>!disabled.has(id))),relevant=(edges||[]).filter(e=>e.type==='explicit'&&set.has(e.source)&&set.has(e.target));
 let passed=0,conditional=0,failed=0;const moments=[];
 for(const edge of relevant){
  const result=root.DosulAuto.assess(data,simulation,edge);
  passed+=result.passes;conditional+=result.conditional;failed+=result.failures;
  for(const cycle of result.cycles)if(['pass','conditional'].includes(cycle.status))moments.push({time:cycle.hit,id:edge.target,effect:edge.effect,result:edge.result,status:cycle.status});
 }
 return {passed,conditional,failed,moments:moments.sort((a,b)=>a.time-b.time)};
}
function quick(data,edges,ids){
 const disabled=new Set(data.executionPolicy?.disabled||[]),activeIds=ids.filter(id=>!disabled.has(id)),simulation=root.DosulAuto.simulate(data,activeIds,8),links=simulation.missing.length?{passed:0,conditional:0,failed:0,moments:[]}:linkResult(data,edges,simulation,activeIds);
 return {ids:[...ids],wait:simulation.wait??Infinity,total:simulation.total??Infinity,casts:simulation.events.length,links};
}
function full(data,edges,ids,baseSlots,horizon=60){
 const simulation=root.DosulCombat.run({...data,baseSlots:[...baseSlots]},ids,horizon,true),links=linkResult(data,edges,simulation,ids);
 return {ids:[...ids],wait:simulation.wait??Infinity,total:simulation.total??horizon,casts:simulation.casts||0,links,simulation};
}
function moved(a,b){return a.reduce((n,id,i)=>n+(b[i]===id?0:1),0);}
function compare(a,b){return a.wait-b.wait||b.links.passed-a.links.passed||b.links.conditional-a.links.conditional||b.casts-a.casts||a.total-b.total||a.ids.join('|').localeCompare(b.ids.join('|'));}
function compareBy(mode='balanced'){
 if(mode==='links')return (a,b)=>b.links.passed-a.links.passed||b.links.conditional-a.links.conditional||a.wait-b.wait||b.casts-a.casts||a.total-b.total||a.ids.join('|').localeCompare(b.ids.join('|'));
 if(mode==='wait')return (a,b)=>a.wait-b.wait||b.casts-a.casts||b.links.passed-a.links.passed||b.links.conditional-a.links.conditional||a.total-b.total||a.ids.join('|').localeCompare(b.ids.join('|'));
 return compare;
}
function createSearch(data,edges,ids,baseSlots,options={}){
 const ultimate=ids.find(id=>data.skills.find(s=>s.id===id)?.ultimate),normals=ids.filter(id=>id!==ultimate),iterator=permutations([...normals]),limit=Math.max(6,Math.min(80,options.shortlist||36)),sort=compareBy(options.mode),top=[];let checked=0,done=false,results=null;
 const add=candidate=>{top.push(candidate);top.sort(sort);if(top.length>limit)top.length=limit;};
 return {total:normals.reduce((n,_,i)=>n*(i+1),1),get checked(){return checked;},get done(){return done;},step(count=600){if(done)return true;for(let i=0;i<count;i++){const next=iterator.next();if(next.done){done=true;break;}checked++;add(quick(data,edges,ultimate?[...next.value,ultimate]:next.value));}return done;},finish(horizon=60){if(!done)while(!this.step(2000)){}if(!results){const finalists=[...top];if(!finalists.some(x=>x.ids.join('|')===ids.join('|')))finalists.push({ids:[...ids]});const evaluated=finalists.map(x=>full(data,edges,x.ids,baseSlots,horizon)).map(x=>({...x,moved:moved(ids,x.ids)})),baseline=evaluated.find(x=>x.ids.join('|')===ids.join('|'));results=evaluated.filter(x=>options.mode==='links'?x.links.passed>=baseline.links.passed:options.mode==='wait'?x.wait<=baseline.wait:true).sort(sort);}return results;}};
}
const api={permutations,linkResult,quick,full,compare,compareBy,createSearch,round};
if(typeof module!=='undefined')module.exports=api;else root.DosulOrderRecommend=api;
})(typeof window==='undefined'?globalThis:window);
