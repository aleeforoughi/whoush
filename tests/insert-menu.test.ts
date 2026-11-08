import {test} from "node:test";
import assert from "node:assert/strict";
import {ATTACHMENT_ROLES,FILE_MENU_FA,isMediaKind,roleAllowed,rolesFor} from "../lib/attachments";
import {INSERT_MENU,menuRoles} from "../lib/insert-menu";

test("owner (2026-11-08): INSERT_MENU in four groups: references, photo roles, video roles, audio roles («پرکاربردترین» kept, hidden)",()=>{
 assert.deepEqual(INSERT_MENU.map(g=>g.labelFa),["پرکاربردترین","رفرنس","تصویر","ویدیو","صدا"]);
 assert.deepEqual(INSERT_MENU[0].items.map(i=>[i.titleFa,i.action.type]),[["رفرنس اتوماتیک","auto"],["عکس رفرنس","role"],["شخص","role"],["فریم","role"],["پوشاک","role"],["الگوی گفتار","role"]]);
 const titles=(id:string)=>INSERT_MENU.find(g=>g.id===id)!.items.map(i=>i.titleFa);
 assert.deepEqual(titles("references"),["رفرنس اتوماتیک","عکس رفرنس","ویدیو رفرنس","ادیت عکس","ادیت ویدیو","فایل"],"the two edits just above «فایل» (owner, 2026-11-08)");
 assert.deepEqual(titles("image"),["شخص","کاراکتر","پیرایش و آرایش","پوشاک","محیط","اشیا و محصول","گرافیک","فریم"],"the owner's list, «فریم» kept last");
 assert.deepEqual(titles("video"),["الگوی حرکت","امتداد ویدیو به جلو","امتداد ویدیو از عقب"]);
 assert.deepEqual(titles("audio"),["الگوی گفتار","موزیک"]);
 assert.equal(INSERT_MENU[1].items[5].hintFa,"متن یا سند (PDF، JSON یا Markdown) برای توضیح بیشتر");assert.equal(FILE_MENU_FA.labelFa,"فایل");
});
test("INSERT_MENU: every role of the role table appears exactly once, plus the edit and extend roles; nothing else, and voice_clone is absent",()=>{
 const pairs=menuRoles().map(r=>r.kind+":"+r.role);
 const table=(["image","video","audio"] as const).flatMap(k=>ATTACHMENT_ROLES[k].map(r=>k+":"+r.id));
 assert.deepEqual([...pairs].sort(),[...table,"image:edit_reference","video:edit_reference","video:continue","video:extend_back"].sort());assert.equal(new Set(pairs).size,pairs.length);
 for(const {kind,role} of menuRoles())assert.ok(isMediaKind(kind)&&roleAllowed(kind,role)&&(["edit_reference","continue","extend_back"].includes(role)||rolesFor(kind).some(r=>r.id===role)));
 assert.ok(!pairs.some(p=>p.endsWith(":voice_clone")),"voice_clone is not in the UI");
 assert.ok(!JSON.stringify(INSERT_MENU).includes("voice_clone")&&!JSON.stringify(INSERT_MENU).includes("کلون")&&!JSON.stringify(INSERT_MENU).includes("requiresConsent"));
 assert.ok(!pairs.some(p=>p.endsWith(":style")));
});
test("INSERT_MENU: every entry has a Persian title, a one-line hint, an icon and a known action; ids are unique",()=>{
 const items=INSERT_MENU.flatMap(g=>g.items);
 assert.equal(new Set(items.map(i=>i.id)).size,items.length);
 for(const i of items){assert.match(i.titleFa,/[؀-ۿ]/);assert.ok(i.hintFa.length>0&&!i.hintFa.includes("\n"),i.id);assert.ok(i.icon,i.id);assert.ok(["auto","role","file","characters"].includes(i.action.type));}
 assert.equal(items.filter(i=>i.action.type==="characters").length,1);
 assert.equal(items.find(i=>i.id==="image:hairstyle")!.hintFa,"عکس مدل مو، ریش یا آرایشی که می‌خوای روی سوژه بیاد");
 assert.equal(items.find(i=>i.id==="image:frame")!.hintFa,"عکسی که ویدیو باهاش شروع یا تموم می‌شه");
 for(const gone of ["image:start_frame","image:end_frame","image:makeup"])assert.ok(!items.some(i=>i.id===gone),gone+" left the menu");
});
test("INSERT_MENU: «پرکاربردترین» shortcuts repeat entries of the kind groups with the same action",()=>{
 const g=INSERT_MENU[0];assert.equal(g.featured,true);
 const rest=INSERT_MENU.slice(1).flatMap(x=>x.items);
 for(const i of g.items.slice(1)){const o=rest.find(x=>"popular:"+x.id===i.id);assert.ok(o,i.id);assert.deepEqual([i.titleFa,i.hintFa,i.icon,i.action],[o!.titleFa,o!.hintFa,o!.icon,o!.action]);}
 assert.equal(rest.filter(i=>i.action.type==="auto").length,1,"auto upload appears once in the groups");
});
test("INSERT_MENU: style is no longer a menu group (it is the «سبک» setting beside the build mode); every group uploads",()=>{
 assert.ok(!INSERT_MENU.some(g=>(g.id as string)==="style"));
 assert.ok(INSERT_MENU.flatMap(g=>g.items).every(i=>["auto","role","file","characters"].includes(i.action.type)));
 assert.equal(menuRoles().length,INSERT_MENU.filter(x=>!x.featured).flatMap(x=>x.items).filter(i=>i.action.type==="role").length,"popular shortcuts are not counted twice");
});
test("visible menu: «پرکاربردترین» is hidden for now; four groups set apart by lines, the automatic upload first",async()=>{
 const {SHOW_POPULAR,visibleInsertMenu}=await import("../lib/insert-menu");
 assert.equal(SHOW_POPULAR,false);
 const v=visibleInsertMenu();
 assert.deepEqual(v.map(s=>s.labelFa),["رفرنس","تصویر","ویدیو","صدا"]);assert.ok(v.every(s=>!s.heading),"lines, no headings");
 assert.equal(v[0].items[0].action.type,"auto");
 assert.ok(!JSON.stringify(v).includes("پرکاربردترین")&&!v.flatMap(s=>s.items).some(i=>i.id.startsWith("popular:")));
 assert.equal(visibleInsertMenu(true)[0].labelFa,"پرکاربردترین","the switch brings it back");
});
test("menu search: folds Persian letter variants and ZWNJ, matches title, hint or group label, every word must match",async()=>{
 const {filterInsertMenu,foldSearch,visibleInsertMenu}=await import("../lib/insert-menu");
 const v=visibleInsertMenu(),ids=(q:string)=>filterInsertMenu(v,q).flatMap(s=>s.items.map(i=>i.id));
 assert.deepEqual(ids(""),v.flatMap(s=>s.items.map(i=>i.id)),"empty query: everything");
 assert.equal(ids("کاراکتر")[0],"characters");assert.equal(ids("شخص")[0],"image:character","a title match comes first");
 const video=ids("ويدئو");
 assert.deepEqual(video.filter(id=>["video:reference","video:edit_reference"].includes(id)),["video:reference","video:edit_reference"],"Arabic ي and ئ fold");
 assert.equal(video[0],"video:reference","an entry named «ویدیو» first");assert.ok(video.includes("video:motion_reference"),"the video group label matches");
 assert.ok(video.includes("image:frame"),"«فریم» through its hint");
 assert.deepEqual(ids("کفش"),["image:outfit"],"the hint matches");assert.deepEqual(ids("رفرنس").slice(0,3),["auto","image:reference","video:reference"]);
 assert.deepEqual(ids("عکس‌رفرنس"),["image:reference"],"ZWNJ and spaces ignored");
 assert.deepEqual(ids("ریش"),["image:hairstyle"],"the hint matches");
 assert.deepEqual(ids("PDF"),["file"]);
 assert.deepEqual(ids("تصویر فریم"),["image:frame"],"every word must match");
 assert.deepEqual(ids("zzz"),[]);assert.equal(filterInsertMenu(v,"zzz").length,0,"empty sections are dropped");
 assert.equal(foldSearch("  ويديو‌ها ۱٢ "),"ویدیوها 12");
});
