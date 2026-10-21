const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist'),port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const SYNC_PATH='/api/kkaebigg/sync',STATUS_PATH='/api/kkaebigg/status';let syncing=null;
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
function sameOrigin(req){if(!req.headers.origin)return true;try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
// The only write: validate the new snapshot, commit its cache and push main. Concurrent presses share one run.
function sync(req,res){
 if(req.method!=='POST'){res.writeHead(405,{'Allow':'POST'}).end('Method not allowed');return;}
 if(!sameOrigin(req)){json(res,403,{ok:false,error:'로컬 빌더에서만 동기화할 수 있습니다.'});return;}
 if(!syncing){const task=process.env.KKAEBIGG_SYNC_ONLY==='1'?require('./kkaebigg-sync.cjs').sync():require('./publish-kkaebigg.cjs').publish();syncing=task.finally(()=>{syncing=null;});}
 syncing.then(result=>json(res,200,{ok:true,...result}),error=>json(res,502,{ok:false,error:error.message}));
}
function status(req,res){
 if(req.method!=='GET'){res.writeHead(405,{'Allow':'GET'}).end('Method not allowed');return;}
 require('./publish-kkaebigg.cjs').deploymentStatus().then(result=>json(res,200,{ok:true,...result}),error=>json(res,502,{ok:false,error:error.message}));
}
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end('Bad request');return;}
 if(pathname===SYNC_PATH){sync(req,res);return;}
 if(pathname===STATUS_PATH){status(req,res);return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end('Method not allowed');return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);});
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`도깨비 스킬 빌더: http://127.0.0.1:${server.address().port}/\n종료: Ctrl+C`));
