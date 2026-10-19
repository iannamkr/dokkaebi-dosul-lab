const assert=require('node:assert/strict'),{Worker}=require('node:worker_threads'),path=require('node:path');
const D=require('./dist/data.json'),O=require('./dist/optimizer.js');
const start=O.conditionSeed(D,{requiredFamilies:['연타','강인']},['연타','강인']);
const boot=`const {parentPort}=require('node:worker_threads'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const context=vm.createContext({setTimeout,clearTimeout,console});context.self=context;context.postMessage=m=>parentPort.postMessage(m);
context.importScripts=(...files)=>files.forEach(f=>{const file=f.split('?')[0];vm.runInContext(fs.readFileSync(path.join(${JSON.stringify(path.resolve('dist'))},file),'utf8'),context,{filename:f});});
context.importScripts('optimizer-worker.js');parentPort.on('message',data=>context.onmessage({data}));`;
async function check(encounter,includeImprovements=false){
 const worker=new Worker(boot,{eval:true}),messages=[];
 const options={stats:{attack:20532,maxHp:101115,regen:2751},families:['연타','강인'],conditions:{requiredFamilies:['연타','강인']},iterations:1000,totalEvaluationBudget:includeImprovements?240:140,perMob:includeImprovements?1e9:undefined,screenLimit:6,finalistLimit:2,boundedSelection:true,encounter,seed:19};
 try{
 const result=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('worker timeout')),30000);worker.on('error',reject);worker.on('message',m=>{messages.push(m);if(m.type==='error'){clearTimeout(timeout);reject(Error(m.message));}if(m.type==='complete'){clearTimeout(timeout);resolve(m.result);}});worker.postMessage({data:D,start,options,limit:10,includeImprovements});});
 assert(messages.some(m=>m.type==='progress'&&(includeImprovements||m.preview?.length)),'Progress and viable interim candidates emitted');
 assert(messages.some(m=>m.type==='validating'));
 assert(result.diagnostics.selection.totalEvaluations<=options.totalEvaluationBudget,'Includes final verification');
 const direct=O.createSearch(D,start,{...options,totalEvaluationBudget:options.totalEvaluationBudget-(includeImprovements?100:0)});while(!direct.step(1000).finished){}const expected=direct.grouped(10);
 assert.deepEqual(result.similar,expected.similar,'Worker preserves exact engine results');assert.deepEqual(result.different,expected.different);
 const candidates=[...result.similar,...result.different,...result.closest];assert(candidates.length);if(includeImprovements)assert(result.improve,'Existing survival improvement advice retained');
 assert(candidates.every(c=>!!c.verification.worst.encounter===encounter),'Selected model is preserved');
 console.log(`Worker ${encounter?'spatial':'legacy'}: preview, final results parity, selected model and total budget passed (${result.diagnostics.selection.totalEvaluations}/${options.totalEvaluationBudget}).`);
 }finally{await worker.terminate();}
}
(async()=>{await check(false);await check(true);await check(false,true);})().catch(e=>{console.error(e);process.exitCode=1;});
