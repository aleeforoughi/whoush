// Local receiver for the Spline exporter (spline-exporter.html): writes each POSTed model to <dir>/<name>.json. Usage: node receiver.mjs .models-3d-work
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const OUT=process.argv[2];
const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'*','Access-Control-Allow-Private-Network':'true'};
http.createServer((req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,H);return res.end();}
 const name=(new URL(req.url,'http://x').searchParams.get('name')||'ping').replace(/[^a-z0-9_-]/gi,'');
 let b=[];req.on('data',c=>b.push(c));req.on('end',()=>{const buf=Buffer.concat(b);fs.writeFileSync(path.join(OUT,name+'.json'),buf);console.log(new Date().toISOString(),req.method,name,buf.length);res.writeHead(200,{...H,'Content-Type':'text/plain'});res.end('ok '+buf.length);});
}).listen(47913,'127.0.0.1',()=>console.log('listening 47913'));
