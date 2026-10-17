const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist'),port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end('Method not allowed');return;}
 let file;try{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);file=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));}catch{res.writeHead(400).end('Bad request');return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);});
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`도술 연계도: http://127.0.0.1:${server.address().port}/\n종료: Ctrl+C`));
