import {test} from "node:test";
import assert from "node:assert/strict";
import {roleBrief,ROLE_BRIEF_KEYS} from "../lib/role-briefs";
import {menuRoles} from "../lib/insert-menu";

test("owner (2026-11-08): every role in the + menu has a ready prompt that names the file, in Persian and in Finglish",()=>{
 for(const {kind,role} of menuRoles()){
  const fa=roleBrief(kind,role,"#ویدیو-۱"),fi=roleBrief(kind,role,"@video1","fi");
  assert.ok(fa&&fi,"a ready prompt for "+kind+":"+role);
  assert.ok(fa!.text.includes("#ویدیو-۱")&&fi!.text.includes("@video1"),"it names the file");
  assert.doesNotMatch(fi!.text,/[؀-ۿ]/,"Finglish has no Persian letters");
  assert.doesNotMatch(fi!.text,/[A-Za-z]-[A-Za-z]/,"no hyphens in Finglish");
  assert.match(fi!.text,/^[A-Z@]/,"a capital first letter");
 }
 assert.equal(ROLE_BRIEF_KEYS.length,menuRoles().length,"one prompt per menu role");
});
test("«امتداد ویدیو به جلو» is a complete prompt (Whoush already knows what to do); an edit leaves room for what to change",()=>{
 const fwd=roleBrief("video","continue","#ویدیو-۱")!;
 assert.equal(fwd.complete,true);assert.match(fwd.text,/به جلو ادامه بده/);
 const back=roleBrief("video","extend_back","#ویدیو-۱")!;assert.equal(back.complete,true);assert.match(back.text,/فریم اولش/);
 const edit=roleBrief("image","edit_reference","#تصویر-۱")!;assert.equal(edit.complete,false);assert.match(edit.text,/: $/,"ends where the user writes the change");
});
