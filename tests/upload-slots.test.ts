import {test} from "node:test";
import assert from "node:assert/strict";
import {INSERT_MENU} from "../lib/insert-menu";
import {MAX_ATTACHMENTS,displayTag,newTagCounters} from "../lib/attachments";
import {SLOTS_FULL_FA,SLOT_CATEGORY_FA,addSlot,removeSlot,reserveSlotTag,slotCategory,slotFor,slotLabelFa,uploadRejection} from "../lib/upload-slots";

const item=(id:string)=>INSERT_MENU.flatMap(g=>g.items).find(i=>i.id===id)!;

test("each upload entry of the + menu gives a card with its Persian title, icon and upload; «کاراکترهای من» gives none",()=>{
 assert.deepEqual(slotFor(item("image:character"),"s1"),{id:"s1",titleFa:item("image:character").titleFa,icon:"character",upload:{kind:"image",role:"character"}});
 assert.deepEqual(slotFor(item("popular:audio:lip_sync"),"s2")?.upload,{kind:"audio",role:"lip_sync"},"a popular shortcut behaves like its entry");
 assert.deepEqual(slotFor(item("file"),"s3")?.upload,{kind:"file"});
 const auto=slotFor(item("auto"),"s4")!;assert.equal(auto.upload,undefined,"automatic: any file, role inferred");assert.equal(auto.icon,"auto");
 assert.equal(slotFor(item("characters"),"s5"),undefined);
 for(const g of INSERT_MENU)for(const i of g.items){
  const s=slotFor(i,"x");if(!s)continue;
  assert.ok(/[؀-ۿ]/.test(s.titleFa)&&s.icon,i.id);assert.equal(slotLabelFa(s),"آپلود "+s.titleFa);
 }
});
test("cards plus attached files never exceed the per-message limit; remove drops one card",()=>{
 const s=(id:string)=>slotFor(item("image:outfit"),id)!;
 let r=addSlot([],s("a"),0);assert.equal(r.full,false);assert.deepEqual(r.slots.map(x=>x.id),["a"]);
 r=addSlot(r.slots,s("b"),MAX_ATTACHMENTS-2);assert.equal(r.full,false);assert.equal(r.slots.length,2);
 const full=addSlot(r.slots,s("c"),MAX_ATTACHMENTS-2);assert.equal(full.full,true);assert.deepEqual(full.slots.map(x=>x.id),["a","b"],"unchanged");
 assert.match(SLOTS_FULL_FA,/۱۰/);
 assert.deepEqual(removeSlot(r.slots,"a").map(x=>x.id),["b"]);assert.deepEqual(removeSlot(r.slots,"zz").length,2);
});
test("a card accepts only its kind",()=>{
 assert.equal(uploadRejection({kind:"image",role:"character"},"image"),undefined);
 assert.match(uploadRejection({kind:"image",role:"character"},"video")!,/تصویر/);
 for(const k of ["pdf","json","md"] as const)assert.equal(uploadRejection({kind:"file"},k),undefined);
 assert.ok(uploadRejection({kind:"file"},"image"));assert.ok(uploadRejection({kind:"audio",role:"music"},"video"));
});

test("a card shows its category (kind), not its role, as icon and subtitle",()=>{
 const cat=(id:string)=>{const c=slotCategory(slotFor(item(id),"x")!);return [c,SLOT_CATEGORY_FA[c]];};
 assert.deepEqual(cat("image:character"),["image","تصویر"]);assert.deepEqual(cat("image:outfit"),["image","تصویر"]);
 assert.deepEqual(cat("video:motion_reference"),["video","ویدیو"]);assert.deepEqual(cat("audio:music"),["audio","صدا"]);
 assert.deepEqual(cat("file"),["file","فایل"]);assert.deepEqual(cat("auto"),["any","هر نوع فایل"]);
});
test("cards reserve the next tag of their kind; documents share the file prefix; the automatic card reserves none",()=>{
 let c=newTagCounters();
 const take=(id:string)=>{const r=reserveSlotTag(c,slotFor(item(id),"x")!.upload);if(r)c=r.counters;return r&&displayTag(r.tag);};
 assert.deepEqual([take("image:character"),take("image:outfit"),take("video:continue"),take("file"),take("auto"),take("image:makeup")],["#تصویر-۱","#تصویر-۲","#ویدیو-۱","#فایل-۱",undefined,"#تصویر-۳"]);
 assert.equal(reserveSlotTag({...newTagCounters(),image:99},{kind:"image",role:"character"}),undefined,"exhausted");
});
