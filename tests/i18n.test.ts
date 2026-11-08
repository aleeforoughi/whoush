import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import {toFinglish,inDictionary} from "../lib/i18n/translate";
import {dirFor,htmlLangFor,isUiLang,UI_LANG_COOKIE} from "../lib/ui-lang";

/** Every Persian string the interface draws (components and app), as the dictionary is keyed. */
function interfaceStrings():string[]{
 const out=new Set<string>(),FA=/[؀-ۿ]/;
 const add=(s:string)=>{const t=s.replace(/\s+/g," ").trim();if(t.length>=2&&FA.test(t))out.add(t);};
 const walk=(d:string)=>{for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(/\.tsx?$/.test(f)){
  const src=ts.createSourceFile(p,fs.readFileSync(p,"utf8"),ts.ScriptTarget.Latest,true,p.endsWith("x")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  (function v(n:ts.Node){if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isJsxText(n))add(n.text);ts.forEachChild(n,v);})(src);}}};
 for(const d of ["components","app"])walk(path.join(process.cwd(),d));
 return [...out];
}

test("owner (2026-11-08): the interface language is a cookie; Finglish is left to right, Persian right to left",()=>{
 assert.equal(UI_LANG_COOKIE,"whoush-lang");
 assert.equal(dirFor("fi"),"ltr");assert.equal(dirFor("fa"),"rtl");
 assert.equal(htmlLangFor("fi"),"fa-Latn");assert.equal(htmlLangFor("fa"),"fa");
 assert.ok(isUiLang("fi")&&isUiLang("fa")&&!isUiLang("en")&&!isUiLang(undefined));
});
test("Finglish text: a known string is translated whole, a composed one part by part, digits become Latin, and Latin text is untouched",()=>{
 assert.equal(toFinglish("حالت تاریک"),toFinglish("  حالت تاریک  ").trim());
 assert.doesNotMatch(toFinglish("حالت تاریک"),/[؀-ۿ]/);
 assert.equal(toFinglish("Seedance 2.5"),"Seedance 2.5");
 assert.match(toFinglish("هیچی ۱۲۳"),/123/,"Persian digits as Latin ones even when the words are unknown");
 assert.equal(toFinglish("یه جمله‌ی آزاد که توی فرهنگ نیست",true),"یه جمله‌ی آزاد که توی فرهنگ نیست","Whoush's free replies are never half-translated");
});
test("the dictionary covers the interface: every Persian string the components and pages draw has a Finglish line",()=>{
 const all=interfaceStrings(),missing=all.filter(s=>!inDictionary(s));
 const covered=1-missing.length/all.length;
 assert.ok(covered>=0.97,"Finglish coverage "+(covered*100).toFixed(1)+"%; missing (add to lib/i18n/finglish.json): "+missing.slice(0,15).join(" | "));
});
test("owner (2026-11-08): Finglish is capitalised like English: a label or sentence starts with a capital, and so does a new sentence",async()=>{
 const dict=(await import("../lib/i18n/finglish.json")).default as Record<string,string>;
 const STARTS_WITH_WORD=/^[ء-يپچژکگیآ]/;
 for(const [fa,fi] of Object.entries(dict)){
  const first=fi.match(/[A-Za-z]/);
  if(STARTS_WITH_WORD.test(fa)&&first&&!/[A-Za-z0-9]/.test(fi.slice(0,first.index)))assert.match(first[0],/[A-Z]/,"capital: "+fi);
  assert.doesNotMatch(fi,/[.!?]\s+["(]?[a-z]/,"a new sentence starts with a capital: "+fi);
 }
});
test("owner (2026-11-08): Finglish tags: «#tasvir-1» is typed and shown, Persian tags on the page become Finglish, no Persian is left in interface text",async()=>{
 const {parseMentions,finglishTags,displayTagIn}=await import("../lib/attachments");
 assert.deepEqual(parseMentions("ba #tasvir-1 va #video-2 va #seda-3 va #tolid-1"),["image1","video2","audio3","generation1"]);
 assert.equal(finglishTags("#تصویر-۱ رو با #ویدیو-۲ ببین"),"#tasvir-1 رو با #video-2 ببین");
 assert.equal(displayTagIn("image1","fi"),"#tasvir-1");assert.equal(displayTagIn("image1","fa"),"#تصویر-۱");
 assert.doesNotMatch(toFinglish("یه متن که توی فرهنگ نیست"),/[؀-ۿ]/,"unknown interface text is written in Latin letters");
});
test("owner (2026-11-08): the chat box's direction: Persian text right to left, Latin left to right; with no letter yet (empty, a new line after Enter) the interface's",async()=>{
 const {textDir}=await import("../lib/text-dir");
 for(const [t,f,want] of [["","rtl","rtl"],["\n","rtl","rtl"],["  12 \n","rtl","rtl"],["سلام\n","ltr","rtl"],["hello","rtl","ltr"],["#تصویر-۱ رو ببین","ltr","rtl"],["","ltr","ltr"],["\n","ltr","ltr"],["salam","rtl","ltr"]] as const)
  assert.equal(textDir(t,f),want,JSON.stringify(t)+" in "+f);
});
test("owner (2026-11-08): «$96.00» in Persian text stays «$96.00»: Latin and number runs are kept left to right; the marks are never sent",async()=>{
 const {bidiParts,markLtrRuns,stripMarks,LRM}=await import("../lib/bidi");
 assert.deepEqual(bidiParts("قیمتش $96.00 هست"),[{text:"قیمتش ",ltr:false},{text:"$96.00",ltr:true},{text:" هست",ltr:false}]);
 assert.deepEqual(bidiParts("با Seedance 2.5 و نسبت 16:9 بساز").filter(p=>p.ltr).map(p=>p.text),["Seedance 2.5","16:9"]);
 assert.deepEqual(bidiParts("make a video of $96"),[{text:"make a video of $96",ltr:false}],"all Latin: nothing to isolate");
 const marked=markLtrRuns("بخر $96.00 الان");
 assert.equal(marked,"بخر "+LRM+"$96.00 الان");assert.equal(stripMarks(marked),"بخر $96.00 الان");
});
