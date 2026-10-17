const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const {sync,extractScript}=require('./scripts/kkaebigg-sync.cjs');
// A fake kkaebigg.com built from the committed snapshot, so tests never touch the real site.
const real=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'dist/kkaebigg',name+'.json'),'utf8'));
const pages={skills:real('skills'),buffs:real('buffs'),maps:real('maps'),monsters:real('monsters')};
const page=(id,data)=>`<!doctype html><html><body><main>…</main><script type="application/json" id="${id}">${JSON.stringify(data)}</script></body></html>`;
let broken=false,requests=[];
const site=http.createServer((req,res)=>{requests.push({url:req.url,ua:req.headers['user-agent']});
 const body={'/data/skills.json':JSON.stringify(pages.skills),'/buffs/':page('bf-data',broken?{groups:'x'}:pages.buffs),'/maps/':page('mp-data',pages.maps),'/monsters/':page('mn-data',pages.monsters)}[req.url];
 if(!body){res.writeHead(404).end();return;}res.writeHead(200).end(body);});
assert.throws(()=>extractScript('<html></html>','bf-data'),/찾지 못했습니다/);
(async()=>{
 await new Promise(r=>site.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${site.address().port}`;
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'kkaebigg-'));
 try{
  const first=await sync({base,outDir:out,now:()=>new Date('2026-10-18T00:00:00Z')});
  for(const f of ['skills.json','buffs.json','maps.json','monsters.json','meta.json','snapshot.js'])assert(fs.existsSync(path.join(out,f)),f);
  assert.equal(first.meta.counts.skills,105);assert(requests.every(r=>/dokkaebi-dosul-lab/.test(r.ua)),'Identifies itself');
  const script=fs.readFileSync(path.join(out,'snapshot.js'),'utf8');const sandbox={window:{}};new Function('window',script)(sandbox.window);
  assert.equal(sandbox.window.KKAEBIGG_SNAPSHOT.skills.skills.length,105,'snapshot.js loads in the page');assert(!('maps' in sandbox.window.KKAEBIGG_SNAPSHOT),'Maps stay out of the page load');
  // A patch on the site: one cooldown changes.
  pages.skills=structuredClone(pages.skills);pages.skills.skills.find(s=>s.n==='방패 밀기').num.cd=6;
  const second=await sync({base,outDir:out});
  assert.deepEqual(second.changes.skills.map(s=>s.name),['방패 밀기']);assert.match(second.changes.skills[0].change,/수치/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'skills.json'),'utf8')).skills.find(s=>s.n==='방패 밀기').num.cd,6);
  // Malformed data: nothing is written and the previous snapshot stays.
  const before=fs.readFileSync(path.join(out,'meta.json'),'utf8');broken=true;
  await assert.rejects(sync({base,outDir:out}),/형식/);
  assert.equal(fs.readFileSync(path.join(out,'meta.json'),'utf8'),before,'Failed sync keeps the old snapshot');
  assert(!fs.readdirSync(out).some(f=>f.startsWith('.sync-')),'No temp folders left');broken=false;
  // Local server route: POST runs the sync against the fake site; GET is refused.
  const child=spawn(process.execPath,['scripts/serve.cjs'],{env:{...process.env,PORT:'0',KKAEBIGG_BASE:base,KKAEBIGG_OUT:out},windowsHide:true,stdio:['ignore','pipe','pipe']});
  try{
   const port=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('server start timeout')),10000);child.stdout.on('data',b=>{const m=String(b).match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(t);resolve(+m[1]);}});});
   const call=method=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:'/api/kkaebigg/sync',method},r=>{const d=[];r.on('data',x=>d.push(x));r.on('end',()=>resolve({status:r.statusCode,body:Buffer.concat(d).toString()}));});req.on('error',reject);req.end();});
   assert.equal((await call('GET')).status,405);
   const ok=await call('POST');assert.equal(ok.status,200);const body=JSON.parse(ok.body);assert.equal(body.ok,true);assert.equal(body.meta.counts.buffGroups,pages.buffs.groups.length);
   broken=true;const bad=await call('POST');assert.equal(bad.status,502);assert.equal(JSON.parse(bad.body).ok,false);broken=false;
  }finally{child.kill();}
  console.log('Kkaebigg sync: fetch/extract/validate, snapshot.js, change report, atomic keep-on-failure and local server route passed.');
 }finally{site.close();fs.rmSync(out,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;site.close();});
