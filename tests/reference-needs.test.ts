import {test} from "node:test";
import assert from "node:assert/strict";
import {detectReferenceNeeds} from "../lib/reference-needs";
import {normalizePersian} from "../lib/safety";
import {orchestrateCreativeTurn} from "../lib/orchestrator";

const need=(t:string)=>detectReferenceNeeds(normalizePersian(t)).map(n=>n.id);

test("Whoush knows when only a photo can keep something: the user's tattoos, logo, product, face, outfit; not a generic mention",()=>{
 assert.deepEqual(need("can you keep my tattoos intact?"),["tattoo"]);
 assert.deepEqual(need("نمی‌خوام تتوهام عوض بشن"),["tattoo"]);
 assert.deepEqual(need("یه عکس از من توی کافه، تتوهام دست نخورده بمونه"),["tattoo"]);
 assert.deepEqual(need("a man with tattoos on a motorbike"),[],"a generic tattoo is just a description");
 assert.deepEqual(need("a coffee cup with a logo"),[]);
 assert.deepEqual(need("یه عکس تبلیغاتی از محصولم روی میز"),["product"]);
 assert.deepEqual(need("keep our logo exactly the same"),["logo"]);
});

test("without the photos Whoush asks for exactly the angles it needs; with them, it maps them to the person and keeps them as a hard rule",async()=>{
 const asked=await orchestrateCreativeTurn({text:"a portrait of me in a cafe, keep my tattoos intact"});
 assert.equal(asked.status,"needs_input");
 const r=(asked as {references?:{need:string;role:string;angles:unknown[]}}).references;
 assert.equal(r?.need,"tattoo");assert.equal(r?.role,"reference");assert.ok((r?.angles.length??0)>=2);
 const answered=await orchestrateCreativeTurn({text:"a portrait of me in a cafe, keep my tattoos intact",answersQuestion:true});
 assert.notEqual(answered.status,"needs_input","never asks twice");
 const withPhoto=await orchestrateCreativeTurn({text:"a portrait of a woman in a cafe, keep my tattoos intact",attachments:[{id:crypto.randomUUID(),tag:"image1",kind:"image",mime:"image/png",bytes:1,sha256:"a".repeat(64),role:"reference"}]});
 assert.ok(withPhoto.status==="planned"||withPhoto.status==="unsupported",JSON.stringify(withPhoto).slice(0,300));
 const plan=(withPhoto as {plan:import("../lib/creative-plan").PublicCreativePlan}).plan;
 assert.deepEqual(plan.staging?.props?.find(p=>p.kind==="person")?.refs,["image1"],"the tattoo photo is mapped to the person");
 assert.ok(plan.hardConstraints.some(c=>c.includes("تتوها دقیقاً مثل #تصویر-۱")),"keeping them is a hard rule");
});
