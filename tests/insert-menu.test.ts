import {test} from "node:test";
import assert from "node:assert/strict";
import {ATTACHMENT_ROLES,FILE_MENU_FA,isMediaKind,roleAllowed,rolesFor} from "../lib/attachments";
import {INSERT_MENU,menuRoles} from "../lib/insert-menu";

test("INSERT_MENU: groups and items in the curated order, with «پرکاربردترین» first",()=>{
 assert.deepEqual(INSERT_MENU.map(g=>g.labelFa),["پرکاربردترین","تصویر","ویدیو","صدا","فایل"]);
 assert.deepEqual(INSERT_MENU[0].items.map(i=>[i.titleFa,i.action.type]),[["آپلود با نقش خودکار","auto"],["کاراکتر","role"],["فریم اول","role"],["ادیت عکس","role"],["لباس و کفش","role"],["الگوی گفتار","role"]]);
 const titles=(id:string)=>INSERT_MENU.find(g=>g.id===id)!.items.map(i=>i.titleFa);
 assert.deepEqual(titles("image"),["کاراکتر","کاراکترهای من","فریم اول","فریم آخر","محیط","اشیا","لباس و کفش","پیرایش","آرایش","لوگو و گرافیک","ادیت عکس"]);
 assert.deepEqual(titles("video"),["الگوی حرکت","ادیت ویدیو","امتداد ویدیو"]);
 assert.deepEqual(titles("audio"),["الگوی گفتار","موزیک"]);
 assert.deepEqual(titles("file"),["فایل"]);assert.equal(INSERT_MENU[4].items[0].hintFa,"PDF، JSON یا Markdown برای زمینه");assert.equal(FILE_MENU_FA.labelFa,"فایل");
});
test("INSERT_MENU: every role of the role table appears exactly once per kind, nothing else, and voice_clone is absent",()=>{
 const pairs=menuRoles().map(r=>r.kind+":"+r.role);
 const table=(["image","video","audio"] as const).flatMap(k=>ATTACHMENT_ROLES[k].map(r=>k+":"+r.id));
 assert.deepEqual(pairs,table,"same pairs, same order");assert.equal(new Set(pairs).size,pairs.length);
 for(const {kind,role} of menuRoles())assert.ok(isMediaKind(kind)&&rolesFor(kind).some(r=>r.id===role)&&roleAllowed(kind,role));
 assert.ok(!pairs.some(p=>p.endsWith(":voice_clone")),"voice_clone is not in the UI");
 assert.ok(!JSON.stringify(INSERT_MENU).includes("voice_clone")&&!JSON.stringify(INSERT_MENU).includes("کلون")&&!JSON.stringify(INSERT_MENU).includes("requiresConsent"));
 assert.ok(!pairs.some(p=>p.endsWith(":style")));
});
test("INSERT_MENU: every entry has a Persian title, a one-line hint, an icon and a known action; ids are unique",()=>{
 const items=INSERT_MENU.flatMap(g=>g.items);
 assert.equal(new Set(items.map(i=>i.id)).size,items.length);
 for(const i of items){assert.match(i.titleFa,/[؀-ۿ]/);assert.ok(i.hintFa.length>0&&!i.hintFa.includes("\n"),i.id);assert.ok(i.icon,i.id);assert.ok(["auto","role","file","characters"].includes(i.action.type));}
 assert.equal(items.filter(i=>i.action.type==="characters").length,1);
 assert.equal(items.find(i=>i.id==="image:hairstyle")!.hintFa,"مدل مو و فرم ریش");
 assert.equal(items.find(i=>i.id==="video:continue")!.hintFa,"از آخر همین ویدیو امتداد پیدا می‌کنه");
});
test("INSERT_MENU: «پرکاربردترین» shortcuts repeat entries of the kind groups with the same action",()=>{
 const g=INSERT_MENU[0];assert.equal(g.featured,true);
 const rest=INSERT_MENU.slice(1).flatMap(x=>x.items);
 for(const i of g.items.slice(1)){const o=rest.find(x=>"popular:"+x.id===i.id);assert.ok(o,i.id);assert.deepEqual([i.titleFa,i.hintFa,i.icon,i.action],[o!.titleFa,o!.hintFa,o!.icon,o!.action]);}
 assert.ok(!rest.some(i=>i.action.type==="auto"),"auto upload appears once");
});
test("INSERT_MENU: style is no longer a menu group (it is the «سبک» setting beside the build mode); every group uploads",()=>{
 assert.ok(!INSERT_MENU.some(g=>(g.id as string)==="style"));
 assert.ok(INSERT_MENU.flatMap(g=>g.items).every(i=>["auto","role","file","characters"].includes(i.action.type)));
 assert.equal(menuRoles().length,INSERT_MENU.filter(x=>!x.featured).flatMap(x=>x.items).filter(i=>i.action.type==="role").length,"popular shortcuts are not counted twice");
});
