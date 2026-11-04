import {test} from "node:test";
import assert from "node:assert/strict";
import {INSERT_MENU} from "../lib/insert-menu";
import {MAX_ATTACHMENTS} from "../lib/attachments";
import {SLOTS_FULL_FA,addSlot,removeSlot,slotFor,slotLabelFa,uploadRejection} from "../lib/upload-slots";

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
