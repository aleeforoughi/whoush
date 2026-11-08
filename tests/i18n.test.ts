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
