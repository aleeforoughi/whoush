import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {buildTheme} from "@aleeforoughi/feather-tokens";
import {generateBrand} from "../scripts/brand.mjs";

const root=path.resolve(import.meta.dirname,"..");
const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");
function walk(dir:string,exts:string[],out:string[]=[]):string[]{
 for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
  const rel=path.join(dir,e.name);
  if(e.isDirectory())walk(rel,exts,out);
  else if(exts.some(x=>e.name.endsWith(x)))out.push(rel);
 }
 return out;
}
const sources=[...walk("app",[".ts",".tsx",".css"]),...walk("components",[".ts",".tsx",".css"])];
const tsx=sources.filter(f=>f.endsWith(".tsx"));

test("both brand token files build with Feather's theme engine and zero problems",()=>{
 for(const file of ["brand/tokens.json","brand/tokens.dark.json"]){
  const result=buildTheme(JSON.parse(read(file)));
  assert.equal(result.ok,true,file+" problems: "+(result.ok?"":result.problems.join("; ")));
 }
});

test("brand tokens carry the approved palette",()=>{
 const light=JSON.parse(read("brand/tokens.json")),dark=JSON.parse(read("brand/tokens.dark.json"));
 assert.equal(light.colors.primary,"#1A73E8");assert.equal(light.colors.background,"#FFFFFF");
 assert.equal(dark.colors.primary,"#005BFF");assert.equal(dark.colors.background,"#000000");
});

test("generated brand CSS is identical to a fresh regeneration",()=>{
 const fresh=generateBrand() as Record<string,string>;
 assert.equal(read("app/styles/brand.css"),fresh["brand.css"],"run `npm run brand` and commit app/styles/brand.css");
 assert.equal(read("app/styles/brand-fonts.css"),fresh["brand-fonts.css"],"run `npm run brand` and commit app/styles/brand-fonts.css");
 const css=fresh["brand.css"];
 assert.match(css,/:root:root \{/);assert.match(css,/:root:root\.dark \{/);
 assert.equal((css.match(/^:root:root\.dark \{/gm)??[]).length,1,"only the dark variable block is appended");
});

test("no old prototype purple, no hardcoded hex colors in TSX, and the old stylesheets are gone",()=>{
 const purple=["9c75f9","6240ce","7444e5","7545df","8c61ed","a681ed","b99afd","bea4ff","c0a2ff","c3aaff"];
 for(const f of sources){
  const text=read(f).toLowerCase();
  for(const hex of purple)assert.ok(!text.includes("#"+hex),f+" contains old purple #"+hex);
 }
 for(const f of tsx)assert.ok(!/#[0-9a-f]{6}\b/i.test(read(f)),f+" has a hex color literal; use Feather tokens");
 assert.ok(!fs.existsSync(path.join(root,"app/design-system.css")));
 assert.ok(!fs.existsSync(path.join(root,"app/characters/characters.css")));
 for(const f of sources)assert.ok(!/design-system\.css|characters\.css/.test(read(f)),f+" still references an old stylesheet");
});

test("root layout is Persian, RTL and dark by default, and applies the saved theme before paint",()=>{
 const layout=read("app/layout.tsx");
 assert.match(layout,/lang="fa"/);assert.match(layout,/dir="rtl"/);assert.match(layout,/className="dark"/);
 assert.match(layout,/whoush-theme/);assert.match(layout,/try\{/);
 const globals=read("app/globals.css");
 for(const imp of ["tailwindcss","@aleeforoughi/feather-react/styles.css","./styles/brand-fonts.css","./styles/brand.css","./fonts.css","./feather-rtl.css"])
  assert.ok(globals.includes('@import "'+imp+'"'),"globals.css must import "+imp);
});

test("Whoush TSX uses logical Tailwind utilities, never physical directions",()=>{
 const physical=/\b(ml|mr|pl|pr|left|right)-\d|\btext-(left|right)\b|rounded-[lr]-/;
 for(const f of tsx)assert.ok(!physical.test(read(f)),f+" uses a physical-direction utility; use ms-/me-/ps-/pe-/start-/end-/text-start/text-end");
});

test("fonts are declared but never committed",()=>{
 const fonts=read("app/fonts.css");
 assert.match(fonts,/font-family: "IRANSans"/);assert.match(fonts,/font-display: swap/);
 for(const w of [200,300,400,500,700,900])assert.match(fonts,new RegExp("font-weight: "+w+";"));
 const dir=path.join(root,"public/fonts/iransans");
 assert.ok(fs.existsSync(path.join(dir,"README.md")));
 // The owner keeps licensed binaries here locally; they are git-ignored and must never be tracked in this public repo.
 const tracked=execFileSync("git",["ls-files","public/fonts"],{cwd:root,encoding:"utf8"}).split("\n").filter(f=>/\.(woff2?|ttf|otf|eot)$/i.test(f));
 assert.deepEqual(tracked,[],"licensed font binaries must not be committed");
 assert.equal(execFileSync("git",["check-ignore","-q","public/fonts/iransans/IRANSansWeb.woff2"],{cwd:root}).length,0);
});

test("corner radii: controls 8px, cards 12px, modals 16px in both themes; badges use the control radius",()=>{
 const css=read("app/styles/brand.css");
 for(const [tier,v] of [["control","0.5rem"],["card","0.75rem"],["dialog","1rem"]] as const)assert.equal(css.match(new RegExp("--radius-"+tier+": "+v.replace(".","\\.")+";","g"))?.length,2,tier);
 assert.match(css,/\[data-slot="badge"\] \{\s*border-radius: var\(--radius-control\);/);
 for(const f of ["components/mode-control.tsx","components/style-control.tsx","components/message-text.tsx","components/attachment-chip.tsx","components/assets-gallery.tsx","components/media-viewer.tsx"])assert.ok(!read(f).includes("rounded-full"),f+" overrides the 8px control radius");
});

// The one documented exception to the 8/12/16 radius rule: the full-screen viewer covers the whole viewport, so its surface has no corners (docs/DESIGN_SYSTEM.md).
test("only the full-screen media viewer may use rounded-none, and it is an always-dark, unblurred, full-viewport surface",()=>{
 // mention-textarea's field sits inside a rounded wrapper that owns the control radius and the border, so the inner textarea has none of its own.
 for(const f of tsx.filter(f=>!f.endsWith("media-viewer.tsx")&&!f.endsWith("mention-textarea.tsx")))assert.ok(!/\brounded-none\b/.test(read(f)),f+" uses rounded-none; only components/media-viewer.tsx (full screen) is exempt from the 8/12/16 radii");
 const viewer=read("components/media-viewer.tsx");
 assert.match(viewer,/\brounded-none\b/);
 for(const cls of ["dark","fixed","inset-0","h-dvh","w-screen","max-w-none","bg-background"])assert.match(viewer,new RegExp("[\" \\s]"+cls+"[\" \\s]"),"the viewer surface needs "+cls);
 assert.ok(!viewer.includes("backdrop-blur"),"the viewer has no backdrop blur");
 assert.match(viewer,/aria-modal="true"/);
 assert.match(viewer,/aria-label=\{VIEWER_LABEL_FA\}/);
 // Everything inside the viewer's controls keeps the control radius: no per-component radius override.
 assert.ok(!/rounded-(sm|md|lg|xl|2xl|3xl|full)\b/.test(viewer),"viewer controls keep the 8px control radius");
});

test("media-first assets grid: 1 column below 480px, 2 from 480px, 3 from lg, 4 only from 2xl; media area is 4:5",()=>{
 const gallery=read("components/assets-gallery.tsx");
 assert.match(gallery,/grid-cols-1 gap-4 min-\[480px\]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4/);
 assert.ok(!/\bxl:grid-cols-4\b|\bmd:grid-cols-3\b/.test(gallery),"no earlier breakpoints for 3 or 4 columns");
 assert.match(gallery,/aspect-4\/5/);
 assert.match(gallery,/rounded-t-card/);
 assert.match(gallery,/bg-linear-to-t from-background\/80/);
});
