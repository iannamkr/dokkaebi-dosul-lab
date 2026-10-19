(function(root){
'use strict';
const cache=new WeakMap();
function summarize(result){
 const cycle=result.cycles[0]?.index,hits=result.cycles.filter(h=>h.index===cycle),valid=hits.filter(h=>h.status==='pass').length;
 let status='unknown';
 if(hits.length){
  if(valid===hits.length)status='pass';
  else if(valid)status='partial';
  else if(hits.some(h=>h.status==='conditional'))status='conditional';
  else if(hits.some(h=>h.status==='unknown'))status='unknown';
  else if(hits.some(h=>h.status==='boundary'))status='boundary';
  else if(hits.every(h=>h.status==='blocked'))status='blocked';
  else if(hits.every(h=>h.status==='absent'))status='absent';
  else status='fail';
 }
 return {status,valid,total:hits.length,ratio:hits.length?valid/hits.length:0,duration:result.duration,margin:hits[0]?.remaining??null,hit:hits[0]?.hit??null,application:hits[0]?.application??null,estimated:result.estimated,eligible:valid>0};
}
function evaluate(data,ids,baseSlots,connections){
 if(!connections.length)return [];
 const A=typeof module!=='undefined'?require('./timing-auto.js'):root.DosulAuto,C=typeof module!=='undefined'?require('./combat.js'):root.DosulCombat;
 let memo=cache.get(data);if(!memo){memo=new Map();cache.set(data,memo);}
 const key=JSON.stringify([ids,baseSlots,data.executionPolicy]);
 if(!memo.has(key)){if(memo.size>240)memo.clear();memo.set(key,C.run({...data,baseSlots},ids,60,true));}
 const sim=memo.get(key);
 return connections.map(e=>({...e,timing:e.type==='resource'?{status:'unknown',eligible:false,ratio:0,duration:null,total:0,valid:0}:summarize(A.assess(data,sim,e))}));
}
const api={summarize,evaluate};if(typeof module!=='undefined')module.exports=api;else root.DosulLinkTiming=api;
})(typeof window==='undefined'?globalThis:window);

