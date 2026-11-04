import {test} from "node:test";
import assert from "node:assert/strict";
import {NEXT_STEPS,diffModels,diffSets,diffSnapshots,extractMarkdownLinks,extractOpenApi,fingerprintText,hasChanges,htmlToText,mergeForWrite,renderReport,type Snapshot} from "../scripts/capability-scout-lib.mjs";

const INDEX=`# Docs
- Start at https://console.higgsfield.ai to discover models.
- [Quickstart](https://docs.higgsfield.ai/docs/quickstart.md): First walkthrough.
- [Auth](https://docs.higgsfield.ai/docs/authentication.md): Keys.
- [Quickstart again](https://docs.higgsfield.ai/docs/quickstart.md)
- [Wrapped](<https://docs.higgsfield.ai/docs/a b.md>) and [relative](/docs/x.md) and [mail](mailto:a@b.c)
- [Anchor](https://docs.higgsfield.ai/docs/errors.md#retries "title")`;
const snap=(over:Partial<Snapshot["higgsfield"]>={},llms:Snapshot["llms"]={skipped:true},seeded=true):Snapshot=>({schema:1,seeded,higgsfield:{
 docsIndex:{links:["https://a/1","https://a/2"]},openapi:{version:"2.0.0",paths:["/x","/y"]},terms:{sha256:"a".repeat(64),chars:10},...over},llms});
const model=(id:string,over:Record<string,unknown>={})=>({id,display_name:id.toUpperCase(),created_at:"2026-01-01T00:00:00Z",max_input_tokens:200000,max_tokens:64000,...over});

test("scout: markdown links are absolute, unique and sorted; other text is ignored",()=>{
 assert.deepEqual(extractMarkdownLinks(INDEX),["https://docs.higgsfield.ai/docs/a","https://docs.higgsfield.ai/docs/authentication.md","https://docs.higgsfield.ai/docs/errors.md#retries","https://docs.higgsfield.ai/docs/quickstart.md"].sort());
 assert.deepEqual(extractMarkdownLinks(""),[]);
});
test("scout: openapi paths are sorted and the version is read; bad input is empty",()=>{
 const doc={info:{title:"T",version:"2.0.0"},paths:{"/b":{},"/a/{id}":{post:{}},"/c":{}}};
 assert.deepEqual(extractOpenApi(doc),{version:"2.0.0",paths:["/a/{id}","/b","/c"]});
 assert.deepEqual(extractOpenApi(JSON.stringify(doc)),extractOpenApi(doc));
 for(const bad of ["not json",null,{},{info:{version:2},paths:[]}])assert.equal(extractOpenApi(bad).version,null);
 assert.deepEqual(extractOpenApi("not json").paths,[]);
});
test("scout: text fingerprints ignore whitespace only",()=>{
 assert.deepEqual(fingerprintText(" a  b\n\nc "),fingerprintText("a b c"));
 assert.notEqual(fingerprintText("a b c").sha256,fingerprintText("a b d").sha256);
 assert.match(fingerprintText("x").sha256,/^[0-9a-f]{64}$/);
});
test("scout: set and model diffs",()=>{
 assert.deepEqual(diffSets(["a","b"],["b","c","c"]),{added:["c"],removed:["a"]});
 assert.deepEqual(diffSets(undefined,undefined),{added:[],removed:[]});
 const d=diffModels([model("a"),model("b"),model("c")],[model("b",{max_tokens:128000,created_at:"2027-01-01T00:00:00Z"}),model("c",{display_name:"C2"}),model("d")]);
 assert.deepEqual(d.added.map(m=>m.id),["d"]);assert.deepEqual(d.removed.map(m=>m.id),["a"]);
 assert.deepEqual(d.changed,[{id:"b",fields:[{field:"max_tokens",from:64000,to:128000}]},{id:"c",fields:[{field:"display_name",from:"C",to:"C2"}]}]);
 assert.deepEqual(diffModels([model("a")],[model("a",{created_at:"x"})]).changed,[],"created_at alone is not a change");
});
test("scout: snapshot diff reports new, removed and changed; unchanged is quiet",()=>{
 const prev=snap();
 assert.equal(hasChanges(diffSnapshots(prev,snap())),false);
 const next=snap({docsIndex:{links:["https://a/2","https://a/3"]},openapi:{version:"2.1.0",paths:["/y","/z"]},terms:{sha256:"b".repeat(64),chars:11}});
 const d=diffSnapshots(prev,next);
 assert.deepEqual(d.docsIndex,{added:["https://a/3"],removed:["https://a/1"]});
 assert.deepEqual(d.openapi,{added:["/z"],removed:["/x"],from:"2.0.0",to:"2.1.0",versionChanged:true});
 assert.ok(d.terms&&hasChanges(d));
 const llm=diffSnapshots(snap({},{models:[model("a")]}),snap({},{models:[model("a"),model("b")]}));
 assert.deepEqual(llm.llms?.added.map(m=>m.id),["b"]);
});
test("scout: failed or skipped sources are unavailable, never 'everything removed'; no baseline compares nothing",()=>{
 const d=diffSnapshots(snap(),snap({docsIndex:{error:"HTTP 503"},openapi:{error:"timeout after 10 s"}}));
 assert.equal(hasChanges(d),false);assert.deepEqual(d.unavailable.map(u=>u.source),["llms.txt","openapi.json","llm models"]);
 const none=diffSnapshots(null,snap({docsIndex:{links:["x"]}}));assert.equal(none.baseline,false);assert.equal(hasChanges(none),false);
 assert.equal(diffSnapshots(snap({},{skipped:true},false),snap()).baseline,false);
 const first=diffSnapshots(snap(),snap({},{models:[model("a")]}));assert.equal(first.llmsBaselineMissing,true);assert.equal(hasChanges(first),true);
});
test("scout: writing keeps the previous value of an unavailable source and seeds only with every Higgsfield source",()=>{
 const merged=mergeForWrite(snap(),snap({openapi:{error:"HTTP 500"}}));
 assert.deepEqual(merged.higgsfield.openapi,{version:"2.0.0",paths:["/x","/y"]});assert.equal(merged.seeded,true);
 const empty=mergeForWrite(null,snap({openapi:{error:"x"},docsIndex:{error:"x"},terms:{error:"x"}}));assert.equal(empty.seeded,false);
});
test("scout: the report lists new, removed and changed items and a next-steps checklist only when something changed",()=>{
 const d=diffSnapshots(snap({},{models:[model("a")]}),snap({docsIndex:{links:["https://a/9"]},terms:{sha256:"c".repeat(64),chars:1}},{models:[model("a",{max_tokens:1}),model("z")]}));
 const r=renderReport(d,{date:"2026-11-04"});
 for(const s of ["New links","Removed links","https://a/9","terms of service","LLM models","New:","Changed:","max_tokens","## Next steps"])assert.ok(r.includes(s),s);
 for(const s of NEXT_STEPS)assert.ok(r.includes(s));
 const quiet=renderReport(diffSnapshots(snap(),snap()),{date:"2026-11-04",llmsSkipped:true,links:2,paths:2});
 assert.ok(quiet.includes("## No changes")&&!quiet.includes("Next steps")&&quiet.includes("skipped"));
 assert.ok(renderReport(diffSnapshots(null,snap()),{}).includes("No seeded baseline"));
});
test("scout: terms fingerprint covers visible text only, so server-rendered state is not a change",()=>{
 const page=(ts:number,body:string)=>`<html><head><style>.a{}</style><script>window.s={u:${ts}}</script></head><body><!-- ${ts} --><h1>Terms</h1><p>${body}</p></body></html>`;
 assert.equal(htmlToText(page(1,"A &amp; B&nbsp;c &#39;d&#x27;")).replace(/\s+/g," ").trim(),"Terms A & B c 'd'");
 assert.deepEqual(fingerprintText(htmlToText(page(1,"Hello"))),fingerprintText(htmlToText(page(2,"Hello"))));
 assert.notEqual(fingerprintText(htmlToText(page(1,"Hello"))).sha256,fingerprintText(htmlToText(page(1,"Hello!"))).sha256);
});
