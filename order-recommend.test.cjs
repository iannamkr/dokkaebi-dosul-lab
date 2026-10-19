const assert=require('node:assert/strict');
globalThis.DosulAuto={
 simulate(data,ids){const disabled=new Set(data.executionPolicy?.disabled||[]),active=ids.filter(id=>!disabled.has(id)),pos=Object.fromEntries(active.map((id,i)=>[id,i]));const wait=Math.abs((pos.a??0)-0)+Math.abs((pos.b??1)-1);return {ids:active,events:active.map((id,i)=>({id,start:i,end:i+.2,completed:true})),missing:[],wait,total:active.length,horizon:8};},
 assess(data,simulation,edge){const source=simulation.ids.indexOf(edge.source),target=simulation.ids.indexOf(edge.target);let passes=source<target?1:0;if(data.regressionCase)passes=simulation.horizon===8?(simulation.ids[0]==='a'?10:0):(simulation.ids.join('|')===data.baseline?9:1);return {passes,conditional:0,failures:passes?0:1,cycles:Array.from({length:passes},(_,i)=>({status:'pass',hit:target+i}))};}
};
globalThis.DosulCombat={run(data,ids,horizon){const disabled=new Set(data.executionPolicy?.disabled||[]),active=ids.filter(id=>!disabled.has(id)),pos=Object.fromEntries(active.map((id,i)=>[id,i])),wait=Math.abs((pos.a??0)-0)+Math.abs((pos.b??1)-1);return {ids,horizon,total:horizon,events:active.map((id,i)=>({id,start:i,end:i+.2,completed:true})),idle:[],wait,casts:active.length};}};
const O=require('./dist/order-recommend.js'),data={skills:[{id:'a'},{id:'b'},{id:'c'},{id:'u',ultimate:true}]},edges=[{type:'explicit',source:'a',target:'b',effect:'질풍',result:'강화'}];
assert.equal([...O.permutations(['a','b','c'])].length,6);
const search=O.createSearch(data,edges,['c','b','a','u'],['c','b','a'],{shortlist:6});while(!search.step(2)){}const results=search.finish(60);
assert.deepEqual(results[0].ids,['a','b','c','u']);
assert.equal(results[0].links.passed,1);
assert.equal(results[0].wait,0);
const policyData={...data,executionPolicy:{disabled:['a','u'],hpBelow:{u:60},hpTrace:[{time:0,hp:100},{time:10,hp:55}]}};
const policyBefore=JSON.stringify(policyData.executionPolicy),quick=O.quick(policyData,edges,['a','b','c','u']);
assert.deepEqual(quick.ids,['a','b','c','u']);
assert.equal(quick.casts,2);
assert.equal(quick.links.passed,0);
const policyFull=O.full(policyData,edges,['a','b','c','u'],['a','b','c'],60);
assert.equal(policyFull.casts,2);
assert.equal(policyFull.simulation.events.some(event=>event.id==='u'),false);
assert.equal(JSON.stringify(policyData.executionPolicy),policyBefore);
const fast={ids:['a'],wait:2,casts:5,total:10,links:{passed:1,conditional:0}},linked={ids:['b'],wait:8,casts:4,total:10,links:{passed:4,conditional:0}};
assert.equal(O.compareBy('wait')(fast,linked)<0,true);
assert.equal(O.compareBy('links')(fast,linked)>0,true);
const regressionData={skills:[{id:'a'},{id:'b'},{id:'c'},{id:'d'},{id:'u',ultimate:true}],regressionCase:true,baseline:'d|c|b|a|u'},regressionEdges=[{type:'explicit',source:'a',target:'b',effect:'질풍',result:'강화'}],regressionSearch=O.createSearch(regressionData,regressionEdges,['d','c','b','a','u'],['d','c','b','a'],{shortlist:6,mode:'links'});while(!regressionSearch.step(50)){}const guarded=regressionSearch.finish(180);
assert.deepEqual(guarded.map(x=>x.ids),[['d','c','b','a','u']]);
assert.equal(guarded[0].links.passed,9);
console.log('Order recommendation: balanced, wait-first and link-first ranking with execution policy propagation passed.');
