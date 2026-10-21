'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const P=require('./scripts/publish-kkaebigg.cjs');
const make=()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'dosul-publish-'));for(const rel of P.CACHE_FILES){const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,rel.includes('meta')?JSON.stringify({sources:{skills:{sha256:'old'}}}):'old');}return root;};
function runner(log,{dirty='',failTest=false}={}){return async(command,args)=>{log.push([command,...args]);if(command===process.execPath){if(failTest)throw Error('test failed');return{stdout:'',stderr:'',code:0};}const op=args[0];if(op==='branch')return{stdout:'main'};if(op==='remote')return{stdout:'https://github.com/iannamkr/dokkaebi-dosul-lab.git'};if(op==='status')return{stdout:dirty};if(op==='rev-parse')return{stdout:'1234567890abcdef'};return{stdout:'',stderr:'',code:0};};}
(async()=>{
 const root=make(),log=[],syncImpl=async()=>{fs.writeFileSync(path.join(root,P.RAW_FILES[0]),'new');fs.writeFileSync(path.join(root,'dist/kkaebigg/meta.json'),JSON.stringify({sources:{skills:{sha256:'new'}}}));return{meta:{},changes:{skills:[{name:'번개 폭풍'}]}};};
 const result=await P.publish({root,syncImpl,execImpl:runner(log),tests:['one.test.cjs'],now:()=>new Date('2026-10-22T01:02:00Z')});
 assert.equal(result.changed,true);assert.equal(result.shortCommit,'1234567');assert(log.some(x=>x[0]==='git'&&x[1]==='commit'&&x.includes('chore(data): sync Kkaebigg snapshot 2026-10-22 01:02')));assert(log.some(x=>x[0]==='git'&&x[1]==='push'&&x.at(-1)==='main'));
 const rollback=make(),before=fs.readFileSync(path.join(rollback,P.RAW_FILES[0]),'utf8');await assert.rejects(()=>P.publish({root:rollback,syncImpl:async()=>{fs.writeFileSync(path.join(rollback,P.RAW_FILES[0]),'broken');return{};},execImpl:runner([],{failTest:true}),tests:['fail.test.cjs']}),/test failed/);assert.equal(fs.readFileSync(path.join(rollback,P.RAW_FILES[0]),'utf8'),before,'검증 실패 시 기존 캐시 복원');
 const status=await P.deploymentStatus({root,fetchImpl:async()=>({ok:true,json:async()=>({fetchedAt:'live',sources:{skills:{sha256:'new'}}})})});assert.equal(status.deployed,true);
 fs.rmSync(root,{recursive:true,force:true});fs.rmSync(rollback,{recursive:true,force:true});console.log('Kkaebigg publish: main/origin guard, tests, scoped commit, push, rollback and Pages hash verification passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
