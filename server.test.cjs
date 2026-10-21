const assert=require('node:assert/strict'),http=require('node:http'),{spawn}=require('node:child_process');
const child=spawn(process.execPath,['scripts/serve.cjs'],{env:{...process.env,PORT:'0'},windowsHide:true,stdio:['ignore','pipe','pipe']});let port,errors='';child.stderr.on('data',x=>errors+=x);
function request(path,method='GET',headers={}){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path,method,headers},r=>{const data=[];r.on('data',b=>data.push(b));r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body:Buffer.concat(data)}));});req.on('error',reject);req.end();});}
(async()=>{try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server start timeout: '+errors)),10000);child.on('exit',()=>{clearTimeout(timer);reject(Error('Server exited: '+errors));});child.stdout.on('data',b=>{const m=String(b).match(/127\.0\.0\.1:(\d+)/);if(m){port=Number(m[1]);clearTimeout(timer);resolve();}});});
 const root=await request('/');assert.equal(root.status,200);assert.match(root.headers['content-type'],/text\/html/);assert.match(root.body.toString(),/<title>도깨비 스킬 빌더<\/title>/);assert.match(root.body.toString(),/빌드 최적화/);assert.equal(root.headers['x-content-type-options'],'nosniff');
 const head=await request('/','HEAD');assert.equal(head.status,200);assert.equal(head.body.length,0);
 const icon=await request('/icons/s001.png');assert.equal(icon.headers['content-type'],'image/png');assert.equal(icon.body.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const appIcon=await request('/app-icon.svg');assert.equal(appIcon.status,200);assert.equal(appIcon.headers['content-type'],'image/svg+xml');assert.match(appIcon.body.toString(),/<svg/);
 const manifest=await request('/site.webmanifest');assert.equal(manifest.status,200);assert.match(manifest.headers['content-type'],/application\/manifest\+json/);assert.equal(JSON.parse(manifest.body).name,'도깨비 스킬 빌더');
 assert.equal((await request('/data.json')).headers['cache-control'],'no-cache');assert.equal((await request('/not-found')).status,404);assert.equal((await request('/%zz')).status,400);
 for(const attack of ['/%2e%2e%5cpackage.json','/..%5cpackage.json','/%2f..%5cpackage.json'])assert.notEqual((await request(attack)).status,200,'No file outside dist');
 assert.equal((await request('/api/kkaebigg/sync','GET')).status,405);assert.equal((await request('/api/kkaebigg/sync','POST',{Origin:'https://attacker.example'})).status,403,'외부 사이트가 로컬 Git 배포를 실행할 수 없음');
 const post=await request('/','POST');assert.equal(post.status,405);assert.equal(post.headers.allow,'GET, HEAD');
 console.log('HTTP server: real GET/HEAD, local icons/data, MIME/cache headers, traversal, malformed URLs, missing paths and rejected writes passed');
 }finally{child.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
