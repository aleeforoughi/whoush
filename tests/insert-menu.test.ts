import {test} from "node:test";
import assert from "node:assert/strict";
import {ATTACHMENT_ROLES,FILE_MENU_FA,isMediaKind,roleAllowed,rolesFor} from "../lib/attachments";
import {INSERT_MENU,STYLE_ITEMS,menuRoles} from "../lib/insert-menu";
import {GENERATION_STYLES,STYLE_LABEL_FA} from "../lib/creative-plan";

test("INSERT_MENU: groups and items in the curated order, with the top item ungrouped",()=>{
 assert.deepEqual(INSERT_MENU.map(g=>g.labelFa),[undefined,"تصویر","ویدیو","صدا","فایل","سبک"]);
 assert.deepEqual(INSERT_MENU[0].items.map(i=>[i.titleFa,i.action.type]),[["آپلود با نقش خودکار","auto"]]);
 const titles=(id:string)=>INSERT_MENU.find(g=>g.id===id)!.items.map(i=>i.titleFa);
 assert.deepEqual(titles("image"),["کاراکتر","کاراکترهای من","فریم اول","فریم آخر","محیط","اشیا","لباس و کفش","پیرایش","آرایش","لوگو و گرافیک","ادیت عکس"]);
 assert.deepEqual(titles("video"),["الگوی حرکت","ادیت ویدیو","امتداد ویدیو"]);
 assert.deepEqual(titles("audio"),["الگوی گفتار","موزیک"]);
 assert.deepEqual(titles("file"),["فایل"]);assert.deepEqual(titles("style"),["واقع‌گرایانه","سه‌بعدی","کارتونی"]);assert.equal(INSERT_MENU[4].items[0].hintFa,"PDF، JSON یا Markdown برای زمینه");assert.equal(FILE_MENU_FA.labelFa,"فایل");
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
 for(const i of items){assert.match(i.titleFa,/[؀-ۿ]/);assert.ok(i.hintFa.length>0&&!i.hintFa.includes("\n"),i.id);assert.ok(i.icon,i.id);assert.ok(["auto","role","file","characters","style"].includes(i.action.type));}
 assert.equal(items.filter(i=>i.action.type==="characters").length,1);
 assert.equal(items.find(i=>i.id==="image:hairstyle")!.hintFa,"مدل مو و فرم ریش");
 assert.equal(items.find(i=>i.id==="video:continue")!.hintFa,"از آخر همین ویدیو امتداد پیدا می‌کنه");
});
test("INSERT_MENU: the سبک group is last, picks a setting instead of uploading, and matches the style table",()=>{
 const g=INSERT_MENU[INSERT_MENU.length-1];
 assert.equal(g.id,"style");assert.equal(g.upload,false);assert.ok(INSERT_MENU.slice(0,-1).every(x=>x.upload));
 assert.deepEqual(g.items.map(i=>i.action),[{type:"style",style:"realistic"},{type:"style",style:"three_d"},{type:"style",style:"cartoon"}]);
 assert.deepEqual(g.items.map(i=>i.action.type==="style"&&i.action.style),[...GENERATION_STYLES]);
 assert.deepEqual(STYLE_ITEMS.map(i=>i.titleFa),GENERATION_STYLES.map(s=>STYLE_LABEL_FA[s]));
 assert.deepEqual(g.items.map(i=>i.hintFa),["مثل عکس واقعی، بافت و نور طبیعی","رندر سه‌بعدی تمیز","کارتونی و رنگی"]);
 assert.equal(menuRoles().length,INSERT_MENU.filter(x=>x.upload).flatMap(x=>x.items).filter(i=>i.action.type==="role").length,"style entries are not upload roles");
});
