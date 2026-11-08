import {test} from "node:test";
import assert from "node:assert/strict";
import {RefInputSchema,resolveReferences} from "../lib/ref-resolver";

test("owner (2026-11-08): the # a message means is read from the whole chat; without earlier work there is nothing to read, and unavailable is not «nothing»",async()=>{
 assert.deepEqual(await resolveReferences(RefInputSchema.parse({text:"یه عکس بساز"})),[],"no earlier work: no references");
 const withWork=RefInputSchema.parse({text:"موهاشو بلوند کن",works:[{tag:"generation1",kind:"image",ready:true,summaryFa:"ویرایش عکس"}]});
 assert.equal(await resolveReferences(withWork),null,"no model here (tests): it could not be read, so the studio's word rules decide");
 assert.equal(RefInputSchema.safeParse({text:"x",works:[{tag:"image1",kind:"image",ready:true,summaryFa:""}]}).success,false,"a work is a generation tag");
 assert.equal(RefInputSchema.safeParse({text:"x",files:[{tag:"generation1",kind:"image"}]}).success,false,"a file is a file tag");
});
