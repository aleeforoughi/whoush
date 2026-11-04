import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {GET as catalog} from "../app/api/public/catalog/route";
import {POST as agent} from "../app/api/agent/route";

// Product policy: customers only ever see raw media model names (Seedance, Kling, Soul, Intone…), never the media
// provider (Higgsfield) or any reasoning-LLM vendor or family. Code, comments and internal docs may name them.
const FORBIDDEN=/\b(higgsfield|claude|anthropic|openai|chatgpt|gpt-?\d|gemini|sonnet|opus|haiku|llama|mistral|deepseek)\b/i;
const root=path.resolve(import.meta.dirname,"..");
const walk=(dir:string):string[]=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 const p=path.join(dir,e.name);
 return e.isDirectory()?(e.name==="api"?[]:walk(p)):/\.tsx$/.test(e.name)?[p]:[];
});
// Strip comments so only shipped strings and JSX text are checked.
const shipped=(src:string)=>src.replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:"'`])\/\/.*$/gm,"$1").replace(/\{\/\*[\s\S]*?\*\/\}/g,"");

test("customer-facing UI never names the media provider or an LLM vendor",()=>{
 for(const f of [...walk(path.join(root,"app")),...walk(path.join(root,"components"))]){
  const m=shipped(fs.readFileSync(f,"utf8")).match(FORBIDDEN);
  assert.equal(m,null,path.relative(root,f)+" shows \""+m?.[0]+"\" to customers");
 }
});

test("public catalog lists raw model names only",async()=>{
 const body=JSON.stringify(await (await catalog()).json());
 assert.equal(body.match(FORBIDDEN),null,body.match(FORBIDDEN)?.[0]);
 assert.match(body,/"name":"Soul"/);
});

test("agent responses name raw models only",async()=>{
 for(const text of ["یک عکس از دریاچه با soul","ویدیوی ۵ ثانیه‌ای از شهر با seedance","a cinematic video of a desert road","یک پوستر نوروزی"]){
  const res=await agent(new Request("http://x/api/agent",{method:"POST",body:JSON.stringify({text})}));
  const body=JSON.stringify(await res.json());
  assert.equal(body.match(FORBIDDEN),null,text+": "+body.match(FORBIDDEN)?.[0]);
 }
});
