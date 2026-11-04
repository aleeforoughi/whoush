import {test} from "node:test";
import assert from "node:assert/strict";
import {ATTACHMENT_ROLES,roleAllowed,roleLabelFa,toWireAttachment,type AttachmentKind,type LocalAttachment} from "../lib/attachments";
import {SLOT_BASE,SLOT_DEFAULT_ROLE,SLOT_IDS,SLOT_KIND,SLOT_MAX_FILES,UPLOAD_LABEL_FA,applySlotPreset,defaultRoleForSlot,rolesForSlot,slotAccepts,slotCanAdd,slotLook,slotRejection} from "../lib/reference-slots";

const file=(over:Partial<LocalAttachment>={}):LocalAttachment=>({id:"a",tag:"image1",kind:"image",mime:"image/png",bytes:10,sha256:"a".repeat(64),name:"x.png",...over});

test("each card takes only its own kind of file",()=>{
 const kinds:AttachmentKind[]=["image","video","audio","pdf","json","md"];
 const accepted=Object.fromEntries(SLOT_IDS.map(s=>[s,kinds.filter(k=>slotAccepts(s,k))]));
 assert.deepEqual(accepted,{character:["image"],location:["image"],audio:["audio"],motion:["video"]});
 assert.deepEqual(SLOT_IDS.map(s=>SLOT_KIND[s]),["image","image","audio","video"]);
});
test("the character card holds up to two photos, every other card one file",()=>{
 assert.deepEqual(SLOT_MAX_FILES,{character:2,location:1,audio:1,motion:1});
 assert.ok(slotCanAdd("character",0)&&slotCanAdd("character",1)&&!slotCanAdd("character",2));
 for(const s of ["location","audio","motion"] as const)assert.ok(slotCanAdd(s,0)&&!slotCanAdd(s,1),s);
 assert.equal(slotRejection("character","image",1),undefined);
 assert.equal(slotRejection("character","image",2),"این کارت حداکثر ۲ عکس می‌پذیرد");
 assert.equal(slotRejection("location","image",1),"این کارت فقط یک فایل می‌پذیرد؛ اول فایل قبلی را بردار");
 assert.equal(slotRejection("location","video",0),"این کارت فقط عکس می‌پذیرد");assert.equal(slotRejection("character","audio",0),"این کارت فقط عکس می‌پذیرد");
 assert.equal(slotRejection("audio","image",0),"این کارت فقط صدا می‌پذیرد");assert.equal(slotRejection("motion","audio",0),"این کارت فقط ویدیو می‌پذیرد");assert.equal(slotRejection("motion","md",0),"این کارت فقط ویدیو می‌پذیرد");
 assert.equal(slotRejection("audio","audio",0),undefined);assert.equal(slotRejection("motion","video",0),undefined);
});
test("the roles a card offers are the role table's roles for its kind, with the documented defaults",()=>{
 const ids=(s:(typeof SLOT_IDS)[number])=>rolesForSlot(s).map(r=>r.id);
 assert.deepEqual(ids("character"),["character","environment","object","graphic","edit_reference"]);assert.deepEqual(ids("location"),ids("character"));
 assert.deepEqual(ids("audio"),["lip_sync","music","voice_clone"]);assert.deepEqual(ids("motion"),["motion_reference","edit_reference"]);
 assert.deepEqual(rolesForSlot("character").map(r=>r.labelFa),["کاراکتر","محیط","اشیا","گرافیک","مرجع ادیت"]);
 assert.deepEqual(rolesForSlot("audio").map(r=>r.labelFa),["الگوی حرکت لب","موسیقی","کلون صدا"]);assert.deepEqual(rolesForSlot("motion").map(r=>r.labelFa),["الگوی حرکت","مرجع ادیت"]);
 assert.deepEqual(rolesForSlot("audio"),ATTACHMENT_ROLES.audio);assert.deepEqual(rolesForSlot("motion"),ATTACHMENT_ROLES.video);assert.deepEqual(rolesForSlot("location"),ATTACHMENT_ROLES.image);
 for(const s of SLOT_IDS){
  for(const r of rolesForSlot(s)){assert.ok(roleAllowed(SLOT_KIND[s],r.id),s+" "+r.id);assert.notEqual(r.id,"general");}
  assert.ok(ids(s).includes(SLOT_DEFAULT_ROLE[s]as never),s+" default is one of its roles");assert.equal(defaultRoleForSlot(s),SLOT_DEFAULT_ROLE[s]);
 }
 assert.deepEqual(SLOT_IDS.map(defaultRoleForSlot),["character","environment","lip_sync","motion_reference"]);
 assert.ok(!SLOT_IDS.some(s=>s!=="audio"&&rolesForSlot(s).some(r=>r.id==="voice_clone")),"voice_clone only through the audio card");
 assert.deepEqual(UPLOAD_LABEL_FA,{image:"آپلود عکس",audio:"آپلود صدا",video:"آپلود ویدیو"});
});
test("a card's title, hint and icon follow its role",()=>{
 assert.deepEqual(SLOT_IDS.map(s=>SLOT_BASE[s].title),["کاراکتر","محیط","صدا","الگوی حرکت"]);
 for(const s of SLOT_IDS){const l=slotLook(s,defaultRoleForSlot(s),roleLabelFa);assert.equal(l.title,SLOT_BASE[s].title,"default role keeps the card's own title");assert.equal(l.hint,SLOT_BASE[s].hint);}
 assert.deepEqual(slotLook("location","edit_reference",roleLabelFa),{title:"مرجع ادیت",hint:"عکسی که می‌خواهی ویرایش شود",icon:"edit"});
 assert.deepEqual(slotLook("motion","edit_reference",roleLabelFa),{title:"مرجع ادیت",hint:"ویدیویی که می‌خواهی ویرایش شود",icon:"edit"});
 assert.deepEqual(slotLook("audio","music",roleLabelFa),{title:"موسیقی",hint:"موسیقی یا ریتم مرجع",icon:"music"});
 assert.equal(slotLook("audio","voice_clone",roleLabelFa).title,"کلون صدا");assert.equal(slotLook("character","graphic",roleLabelFa).title,"گرافیک");
 assert.equal(slotLook("character","environment",roleLabelFa).title,"محیط");
 assert.deepEqual(slotLook("location","auto",roleLabelFa),{title:"محیط",hint:"هووش نقش را انتخاب می‌کند",icon:"auto"});
 for(const s of SLOT_IDS)for(const r of rolesForSlot(s))assert.ok(slotLook(s,r.id,roleLabelFa).title.length>0&&slotLook(s,r.id,roleLabelFa).hint.length>0);
});
test("a file added through a card gets the card's role, or none for automatic, and remembers its card",()=>{
 const c=applySlotPreset(file(),"character","character");assert.equal(c.role,"character");assert.equal(c.slot,"character");
 assert.equal(applySlotPreset(file(),"location","environment").role,"environment");
 assert.equal(applySlotPreset(file(),"location","edit_reference").role,"edit_reference","the role the user changed it to");
 const auto=applySlotPreset(file(),"location","auto");assert.ok(!("role" in auto));assert.equal(auto.slot,"location");
 const lip=applySlotPreset(file({kind:"audio",tag:"audio1"}),"audio","lip_sync");assert.deepEqual(lip.speech,{hasSpeech:true,language:"unknown",accent:"unspecified"});
 assert.equal(applySlotPreset(file({kind:"video",tag:"video1"}),"motion","motion_reference").role,"motion_reference");
 const music=applySlotPreset(file({kind:"audio",tag:"audio1"}),"audio","music",true);assert.ok(!("consent" in music),"consent rides only with voice_clone");
 const clone=applySlotPreset(file({kind:"audio",tag:"audio1"}),"audio","voice_clone");assert.ok(!("consent" in clone));
 assert.equal(applySlotPreset(file({kind:"audio",tag:"audio1"}),"audio","voice_clone",true).consent,true);
 // the card is browser state only: the wire carries the chosen role and nothing about the card
 const wire=toWireAttachment(c);assert.equal(wire.role,"character");assert.ok(!("slot" in wire)&&!JSON.stringify(wire).includes("slot"));
 assert.ok(!("role" in toWireAttachment(auto)),"automatic sends no role, so the server infers it");
});
