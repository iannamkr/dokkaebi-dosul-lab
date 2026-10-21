#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const CACHE_FILES=['dist/kkaebigg/skills.json','dist/kkaebigg/buffs.json','dist/kkaebigg/maps.json','dist/kkaebigg/monsters.json','dist/kkaebigg/meta.json','dist/kkaebigg/snapshot.js'];
const RAW_FILES=CACHE_FILES.slice(0,4);
const TESTS=['effect-timeline.test.cjs','kkaebigg-sync.test.cjs','numeric-audit-harness.test.cjs','optimizer.test.cjs','progression-integration.test.cjs','ui-contract.test.cjs'];
const PAGES_META_URL='https://iannamkr.github.io/dokkaebi-dosul-lab/kkaebigg/meta.json';
function execute(command,args,{cwd=ROOT}={}){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']}),stdout=[],stderr=[];child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b));child.on('error',reject);child.on('close',code=>{const result={code,stdout:Buffer.concat(stdout).toString('utf8').trim(),stderr:Buffer.concat(stderr).toString('utf8').trim()};if(code===0)resolve(result);else reject(Object.assign(Error(result.stderr||result.stdout||`${command} 종료 코드 ${code}`),{result}));});});}
function backup(root=ROOT){return new Map(CACHE_FILES.map(rel=>{const file=path.join(root,rel);return[rel,fs.existsSync(file)?fs.readFileSync(file):null];}));}
function restore(saved,root=ROOT){for(const [rel,content] of saved){const file=path.join(root,rel);if(content===null){if(fs.existsSync(file))fs.rmSync(file,{force:true});}else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}}}
function rawChanged(saved,root=ROOT){return RAW_FILES.some(rel=>!saved.get(rel)?.equals(fs.readFileSync(path.join(root,rel))));}
async function publish({root=ROOT,syncImpl,execImpl=execute,tests=TESTS,now=()=>new Date()}={}){
 const run=(command,args)=>execImpl(command,args,{cwd:root}),git=args=>run('git',args);
 const branch=(await git(['branch','--show-current'])).stdout,remote=(await git(['remote','get-url','origin'])).stdout;
 if(branch!=='main')throw Error(`main 브랜치에서만 배포할 수 있습니다. 현재 브랜치: ${branch||'없음'}`);
 if(!/github\.com[/:]iannamkr\/dokkaebi-dosul-lab(?:\.git)?$/i.test(remote))throw Error('허용된 도깨비 스킬 빌더 원격 저장소가 아닙니다.');
 const dirty=(await git(['status','--porcelain','--',...CACHE_FILES])).stdout;if(dirty)throw Error('동기화 캐시 파일에 미커밋 변경이 있습니다. 먼저 현재 변경을 정리해 주세요.');
 const saved=backup(root);let committed=false,result;
 try{
  result=await (syncImpl||require('./kkaebigg-sync.cjs').sync)();
  for(const test of tests)await run(process.execPath,[test]);
  const changed=rawChanged(saved,root);
  if(changed){
   await git(['add','--',...CACHE_FILES]);
   const stamp=now().toISOString().slice(0,16).replace('T',' ');
   await git(['commit','--only','-m',`chore(data): sync Kkaebigg snapshot ${stamp}`,'--',...CACHE_FILES]);committed=true;
  }else restore(saved,root);
  const commit=(await git(['rev-parse','HEAD'])).stdout;await git(['push','origin','main']);
  return {...result,changed,commit,shortCommit:commit.slice(0,7),pushed:true,pagesUrl:'https://iannamkr.github.io/dokkaebi-dosul-lab/'};
 }catch(error){if(!committed)restore(saved,root);throw error;}
}
function sourceHashes(meta){return Object.fromEntries(Object.entries(meta?.sources||{}).map(([key,value])=>[key,value?.sha256||null]));}
async function deploymentStatus({root=ROOT,url=PAGES_META_URL,fetchImpl=globalThis.fetch}={}){
 const local=JSON.parse(fs.readFileSync(path.join(root,'dist/kkaebigg/meta.json'),'utf8')),res=await fetchImpl(`${url}?check=${Date.now()}`,{headers:{Accept:'application/json'},cache:'no-store'});
 if(!res.ok)throw Error(`GitHub Pages 응답 ${res.status}`);const live=await res.json(),localHashes=sourceHashes(local),liveHashes=sourceHashes(live),keys=Object.keys(localHashes),deployed=keys.length>0&&keys.every(key=>localHashes[key]===liveHashes[key]);
 return {deployed,localFetchedAt:local.fetchedAt,liveFetchedAt:live.fetchedAt||null,url:url.replace(/\/kkaebigg\/meta\.json$/,'/')};
}
module.exports={publish,deploymentStatus,execute,backup,restore,rawChanged,CACHE_FILES,RAW_FILES,TESTS,PAGES_META_URL};
if(require.main===module)publish().then(r=>console.log(JSON.stringify(r,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
