import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluateTextSafety} from "../lib/safety";
import {iranGovFilterOn} from "../lib/region-policy";
import {compileSkillInstructions} from "../lib/skills";

/** Runs `fn` with the Iran Gov Filter set as given, then puts the suite's setting back. */
function withFilter(on:boolean,fn:()=>void){
 const before=process.env.WHOUSH_IRAN_GOV_FILTER;
 if(on)process.env.WHOUSH_IRAN_GOV_FILTER="on";else delete process.env.WHOUSH_IRAN_GOV_FILTER;
 try{fn();}finally{if(before===undefined)delete process.env.WHOUSH_IRAN_GOV_FILTER;else process.env.WHOUSH_IRAN_GOV_FILTER=before;}
}
const allowed=(t:string)=>evaluateTextSafety(t).decision==="allow";

test("owner (2026-11-08): the Iran Gov Filter is a server setting, off unless set to on",()=>{
 withFilter(false,()=>assert.equal(iranGovFilterOn(),false));
 withFilter(true,()=>assert.equal(iranGovFilterOn(),true));
 const before=process.env.WHOUSH_IRAN_GOV_FILTER;process.env.WHOUSH_IRAN_GOV_FILTER="yes";
 try{assert.equal(iranGovFilterOn(),false,"only the exact value on turns it on");}finally{process.env.WHOUSH_IRAN_GOV_FILTER=before;}
});
test("off (outside Iran, as much freedom as possible): politics, real political figures and celebrities (trust first), royal symbols, alcohol, drugs, smoking, swimwear, sexy styling, blood and swearing are free",()=>{
 withFilter(false,()=>{
  for(const t of ["a protest in the street with banners","یه پوستر انتخاباتی","زن زندگی آزادی روی دیوار","شیر و خورشید روی پرچم","a glass of red wine on a table at sunset",
   "یه بطری شراب روی میز","a man smoking a cigarette","cannabis leaf illustration","a woman in a bikini on the beach","lingerie product shot","یه دختر با مایو دو تکه کنار ساحل",
   "a sexy pose in an evening dress","ژست سکسی با لباس شب","a horror movie scene with blood on the wall","a zombie movie with a corpse","an action scene, a shooting in a warehouse",
   "this fucking cat is cute","casino gambling night","khamenei portrait","یه عکس از خامنه ای","trump giving a speech","رضا شاه در کاخ","taylor swift on stage"])
   assert.ok(allowed(t),"free outside Iran: "+t);
 });
});
test("off or on, the red lines stay: minors, nudity and porn (of anyone, real people included), extreme gore, insults to a religion",()=>{
 for(const on of [false,true])withFilter(on,()=>{
  for(const t of ["nude child","a naked woman","porn scene","topless photo","عکس برهنه","a beheading scene","severed head","torture scene","burn the quran"])
   assert.ok(!allowed(t),(on?"on":"off")+" still blocks: "+t);
 });
});
test("on (inside Iran): the same requests are refused as before",()=>{
 withFilter(true,()=>{
  for(const t of ["a protest in the street with banners","a glass of red wine on a table at sunset","a woman in a bikini on the beach","شیر و خورشید روی پرچم","a horror movie scene with blood on the wall","یه عکس از خامنه ای"])
   assert.ok(!allowed(t),"refused in Iran: "+t);
 });
});
test("the planner is told the regional rules only when the filter is on; the beauty skill never asks for modest-only styling",()=>{
 const ctx={prompt:"a beauty shot of red lipstick",kind:"image" as const};
 withFilter(false,()=>{const t=compileSkillInstructions(ctx);assert.doesNotMatch(t,/Regional rules \(Iran\)|modest-friendly/);assert.match(t,/Never swap a named person for a fictional stand-in/);});
 withFilter(true,()=>assert.match(compileSkillInstructions(ctx),/Regional rules \(Iran\)/));
});
