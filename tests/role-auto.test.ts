import test from "node:test";
import assert from "node:assert/strict";
import {inferAttachmentRoles,withRole,withoutRole,type LocalAttachment} from "../lib/attachments";

test("«رفرنس اتوماتیک»: a role the photo check detected is used unless the message's words name another; a chosen role clears the automatic mark",()=>{
 const auto={tag:"image1",kind:"image" as const,role:"environment" as const,roleAuto:true as const};
 assert.deepEqual(inferAttachmentRoles("یه عکس از من توی این فضا بساز",[auto]),[{tag:"image1",role:"environment",roleSource:"inferred"}],"no other role in the words: the detected one");
 assert.deepEqual(inferAttachmentRoles("#تصویر-۱ رو به عنوان لباس استفاده کن",[auto]),[{tag:"image1",role:"outfit",roleSource:"inferred"}],"the words win");
 assert.deepEqual(inferAttachmentRoles("هر چی",[{tag:"image1",kind:"image",role:"environment"}]),[{tag:"image1",role:"environment",roleSource:"user"}],"a chosen role stays the user's");
 const a={id:"1",tag:"image1",kind:"image",mime:"image/jpeg",bytes:1,sha256:"a".repeat(64),name:"x",role:"environment",roleAuto:true} as LocalAttachment;
 assert.equal(withRole(a,"object").roleAuto,undefined,"choosing in the dropdown makes it the user's");
 assert.equal(withoutRole(a).roleAuto,undefined);
});
