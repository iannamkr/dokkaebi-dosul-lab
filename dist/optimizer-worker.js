/* Dedicated search worker: same engine and data as the planner. */
'use strict';
importScripts('numbers.js','sequence.js','timing.js','hit-timing.js','timing-auto.js','execution-policy.js','combat.js','shinsik.js','simulation.js','kkaebigg.js','encounter.js','optimizer.js');
self.onmessage=event=>{
 const {data,start,options,limit=10,zones=[],includeImprovements=false}=event.data;
 try{
  const reserve=includeImprovements?100+zones.length:0;
  const searchOptions={...options,totalEvaluationBudget:options.totalEvaluationBudget-reserve};
  const search=DosulOptimizer.createSearch(data,start,searchOptions),began=Date.now();let lastPreview=0;
  const tick=()=>{try{
   const progress=search.step(60),now=Date.now();
   const preview=now-lastPreview>=1500||progress.finished?search.preview(3):null;
   if(preview)lastPreview=now;
   self.postMessage({type:'progress',progress,preview,elapsedMs:now-began});
   if(!progress.finished){setTimeout(tick,0);return;}
   self.postMessage({type:'validating',elapsedMs:Date.now()-began});
   const result=search.grouped(limit);
   let extra=0;
   if(includeImprovements&&!result.similar.length&&!result.different.length&&result.closest?.[0]){
    const c=result.closest[0];
    result.improve=DosulOptimizer.improvements(data,c.ids,c.baseSlots,{...options,onEvaluate:()=>{extra++;}},{zones});
   }
   if(result.diagnostics?.selection){result.diagnostics.selection.totalEvaluations+=extra;result.diagnostics.selection.totalBudget=options.totalEvaluationBudget;}
   self.postMessage({type:'complete',result,elapsedMs:Date.now()-began});
  }catch(error){self.postMessage({type:'error',message:error.message});}};
  tick();
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
