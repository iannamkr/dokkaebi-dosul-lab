const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),net=require('node:net'),os=require('node:os'),{spawnSync}=require('node:child_process');
if(process.platform!=='win32'){console.log('Windows launcher: skipped on non-Windows');process.exit(0);}
const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'dosul-launcher-test-'));let launched=[];
function launch(port){const log=path.join(dir,'launcher.log'),fd=fs.openSync(log,'w');try{const out=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(dir,'scripts/launch.ps1'),'-NoBrowser','-Port',String(port)],{windowsHide:true,timeout:30000,stdio:['ignore',fd,fd]});if(out.error)throw out.error;return {...out,stderr:fs.readFileSync(log,'utf8')};}finally{fs.closeSync(fd);}}
const state=()=>JSON.parse(fs.readFileSync(path.join(dir,'.local/server.json'),'utf8').replace(/^\uFEFF/,''));
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
(async()=>{try{
 fs.mkdirSync(path.join(dir,'scripts'));fs.mkdirSync(path.join(dir,'dist'));fs.copyFileSync('scripts/launch.ps1',path.join(dir,'scripts/launch.ps1'));fs.copyFileSync('scripts/serve.cjs',path.join(dir,'scripts/serve.cjs'));fs.writeFileSync(path.join(dir,'dist/index.html'),'isolated launcher test');
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 console.log('Launcher: starting');let out=launch(port);assert.equal(out.status,0,out.stderr);console.log('Launcher: first started');const first=state();launched.push(first.pid);assert(alive(first.pid));assert.equal(await (await fetch(first.url,{signal:AbortSignal.timeout(5000)})).text(),'isolated launcher test');
 console.log('Launcher: restarting');out=launch(port);assert.equal(out.status,0,out.stderr);const second=state();launched.push(second.pid);assert.notEqual(first.pid,second.pid);assert(!alive(first.pid));assert(alive(second.pid));
 console.log('Launcher: stopping second');process.kill(second.pid);await new Promise((resolve,reject)=>{const start=Date.now();const check=()=>!alive(second.pid)?resolve():Date.now()-start>5000?reject(Error('Test server stop timeout')):setTimeout(check,30);check();});
 const other=net.createServer();await new Promise(r=>other.listen(0,'127.0.0.1',r));try{out=launch(other.address().port);assert.notEqual(out.status,0);assert(other.listening);assert.match(out.stderr,/포트를 다른 프로그램/);}finally{await new Promise(r=>other.close(r));}
 console.log('Windows launcher: isolated project starts, second launch replaces only its old PID, unrelated port owner is preserved');
 }finally{for(const pid of launched)if(alive(pid))process.kill(pid);const resolved=path.resolve(dir);assert(resolved.startsWith(parent+path.sep+'dosul-launcher-test-'));fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}})().catch(e=>{console.error(e);process.exitCode=1;});
