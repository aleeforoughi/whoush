import {test} from "node:test";
import assert from "node:assert/strict";
import {INSERT_MENU} from "../lib/insert-menu";
import {MAX_ATTACHMENTS,displayTag} from "../lib/attachments";
import {SLOTS_FULL_FA,SLOT_CATEGORY_FA,addSlot,composerCards,fillSlotWith,forgetAttachment,removeSlot,reserveSlotTag,slotCategory,slotFor,slotLabelFa,tagsInUse,uploadRejection} from "../lib/upload-slots";

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
test("cards reserve the lowest free tag of their kind; documents share the file prefix; the automatic card reserves none",()=>{
 const used:string[]=[];
 const take=(id:string)=>{const t=reserveSlotTag(used,slotFor(item(id),"x")!.upload);if(t)used.push(t);return t&&displayTag(t);};
 assert.deepEqual([take("image:character"),take("image:outfit"),take("video:continue"),take("file"),take("auto"),take("image:makeup")],["#تصویر-۱","#تصویر-۲","#ویدیو-۱","#فایل-۱",undefined,"#تصویر-۳"]);
 used.splice(used.indexOf("image2"),1);
 assert.equal(take("image:environment"),"#تصویر-۲","a removed card's number is used again");
 assert.equal(reserveSlotTag(Array.from({length:99},(_,i)=>"image"+(i+1)),{kind:"image",role:"character"}),undefined,"exhausted");
});
test("tags in use: every file of the conversation plus numbers reserved by empty cards (a filled card's tag is its file's)",()=>{
 const s=(id:string,tag:string,attachmentId?:string)=>({...slotFor(item("image:outfit"),id)!,tag,...(attachmentId?{attachmentId}:{})});
 assert.deepEqual(tagsInUse([{tag:"image1"},{tag:"image3"}],[s("a","image2"),s("b","image3","f3")]).sort(),["image1","image2","image3"]);
});
test("a filled card keeps its place and shows its file; other files follow; a filled card counts once toward the limit",()=>{
 const s=(id:string)=>slotFor(item("image:outfit"),id)!;
 let slots=[s("a"),s("b"),s("c")];
 slots=fillSlotWith(slots,"b","f1");
 const files=[{id:"f0"},{id:"f1"},{id:"f2"}];// f0 and f2 were dropped on the composer
 assert.deepEqual(composerCards(slots,files).map(c=>c.type==="slot"?"slot:"+c.slot.id:"file:"+c.attachment.id),["slot:a","file:f1","slot:c","file:f0","file:f2"]);
 assert.deepEqual(composerCards(fillSlotWith(slots,"c","f1"),files).filter(c=>c.type==="file").map(c=>c.type==="file"&&c.attachment.id),["f1","f0","f2"],"a file is shown once even if two cards point at it");
 assert.deepEqual(composerCards(slots,[{id:"f0"}]).map(c=>c.type==="slot"?c.slot.id:c.attachment.id),["a","c","f0"],"a card whose file is gone is dropped");
 assert.deepEqual(forgetAttachment(slots,"f1").map(x=>x.id),["a","c"],"removing the file removes its card");
 // 2 empty cards + 7 files (one of them filling the third card) = 9 < 10: one more fits; then full
 const r=addSlot(slots,s("d"),7);assert.equal(r.full,false);assert.equal(addSlot(r.slots,s("e"),7).full,true);
});
