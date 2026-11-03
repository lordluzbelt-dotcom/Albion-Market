const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.md':'text/plain; charset=utf-8'};
const server=http.createServer((req,res) => {
 let url; try {url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);} catch {res.writeHead(400).end();return;}
 const file=path.resolve(root,'.'+(url==='/'?'/index.html':url));
 if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
 if (!types[path.extname(file)]) {res.writeHead(404).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('No encontrado');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache'});res.end(data);});
});
server.listen(Number(process.env.PORT || 8081),'127.0.0.1',()=>console.log('Albion Market: http://127.0.0.1:' + (process.env.PORT || 8081)));


