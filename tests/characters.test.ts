import {test} from "node:test";
import assert from "node:assert/strict";
import {CHARACTER_VIEWS,CONSENT_TEXT_FA,CONSENT_VERSION,LEGACY_CONSENT_TEXT_FA,LEGACY_CONSENT_VERSION,buildCharacterManifest,buildReferenceMeta,characterCoverage,characterExportBaseName,characterSlug,characterUsability,consentProblem,createCharacterConsent,findDuplicateReference,hasCurrentConsent,migrateCharacterProfile,nextCharacterVersion,referenceFingerprint,referenceWarnings,sha256Hex,validateCharacterProfile,validateReferenceMeta,type CharacterProfile,type CharacterReferenceMeta,type CharacterReferences,type CharacterView,type ReferenceMeta,type StoredCharacterRecord} from "../lib/characters";
import {faBytes,faDate,faDimensions} from "../lib/format";

const T0="2026-11-01T10:00:00.000Z",T1="2026-11-02T10:00:00.000Z",T2="2026-11-03T10:00:00.000Z";
const img=(seed:string,type="image/jpeg")=>new Blob([seed],{type});
const meta=async(blob:Blob,addedAt=T0,width=1200,height=1600):Promise<ReferenceMeta>=>buildReferenceMeta({width,height,blob,sha256:await sha256Hex(blob),addedAt});
const REQUIRED:CharacterView[]=["front","three_quarter_left","profile_left","full_body"];
async function profile(views:readonly CharacterView[]=REQUIRED,over:Partial<CharacterProfile>={}):Promise<CharacterProfile>{
 const references:CharacterReferences={},referenceMeta:CharacterReferenceMeta={};
 for(const v of views){const b=img("pixels of "+v);references[v]=b;referenceMeta[v]=await meta(b);}
 return {id:"char-0001-aaaa",name:"Sara Khan",notes:"",createdAt:T0,updatedAt:T1,consent:createCharacterConsent(T1),references,referenceMeta,version:1,...over};
}

test("sha256Hex hashes the bytes: stable for equal content, different otherwise, known vector",async()=>{
 assert.equal(await sha256Hex(new Blob(["abc"])),"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
 assert.equal(await sha256Hex(img("same")),await sha256Hex(img("same","image/png")));
 assert.notEqual(await sha256Hex(img("a")),await sha256Hex(img("b")));
});
test("reference metadata is validated against the blob it describes",async()=>{
 const b=img("hello");const m=await meta(b);
 assert.deepEqual(Object.keys(m).sort(),["addedAt","bytes","height","sha256","type","width"]);
 assert.equal(m.bytes,b.size);assert.equal(m.type,"image/jpeg");
 assert.doesNotThrow(()=>validateReferenceMeta(m,b));
 assert.throws(()=>validateReferenceMeta(undefined,b));
 assert.throws(()=>validateReferenceMeta({...m,bytes:m.bytes+1},b));
 assert.throws(()=>validateReferenceMeta({...m,type:"image/png"},b));
 assert.throws(()=>validateReferenceMeta({...m,sha256:"xyz"},b));
 assert.throws(()=>validateReferenceMeta({...m,addedAt:"not a date"},b));
 assert.throws(()=>validateReferenceMeta({...m,width:511},b),/۵۱۲/);
 assert.throws(()=>validateReferenceMeta({...m,height:0},b));
 assert.throws(()=>validateReferenceMeta({...m,width:1.5},b));
 const gif=img("gif","image/gif");
 assert.throws(()=>buildReferenceMeta({width:800,height:800,blob:gif,sha256:"a".repeat(64),addedAt:T0}));
});
test("the same image cannot be used for two angles; replacing an angle with its own image is fine",async()=>{
 const a=await meta(img("one")),b=await meta(img("two"));
 const m:CharacterReferenceMeta={front:a,profile_left:b};
 assert.equal(findDuplicateReference(m,a.sha256),"front");
 assert.equal(findDuplicateReference(m,a.sha256,"front"),undefined);
 assert.equal(findDuplicateReference(m,a.sha256,"full_body"),"front");
 assert.equal(findDuplicateReference(m,"f".repeat(64)),undefined);
 // the profile validator enforces it too, with a Persian message naming the first angle
 const p=await profile(["front","three_quarter_left","profile_left","full_body"]);
 p.references.full_body=p.references.front;p.referenceMeta.full_body={...p.referenceMeta.front!};
 assert.throws(()=>validateCharacterProfile(p),/روبرو/);
});
test("quality warnings: small images and landscape full-body shots warn but are not errors",async()=>{
 const small=await meta(img("s"),T0,800,900);
 assert.equal(referenceWarnings("front",small).length,1);
 assert.match(referenceWarnings("front",small)[0],/کیفیت پایین‌تر از حد توصیه‌شده/);
 const ok=await meta(img("o"),T0,1024,1500);
 assert.deepEqual(referenceWarnings("front",ok),[]);
 const wide=await meta(img("w"),T0,2000,1100);
 assert.deepEqual(referenceWarnings("front",wide),[]);
 const w=referenceWarnings("full_body",wide);assert.equal(w.length,1);assert.match(w[0],/افقی/);
 assert.equal(referenceWarnings("full_body",await meta(img("w2"),T0,800,700)).length,2);
 assert.deepEqual(referenceWarnings("full_body",ok),[]);
 // a warned image still saves
 const p=await profile();p.referenceMeta.front=await meta(p.references.front!,T0,800,900);
 assert.doesNotThrow(()=>validateCharacterProfile(p));
});
test("coverage summary separates required from optional views",async()=>{
 const p=await profile(["front","three_quarter_right","full_body"]);
 const c=characterCoverage(p.references);
 assert.deepEqual({r:c.requiredCount,rt:c.requiredTotal,o:c.optionalCount,ot:c.optionalTotal,n:c.count},{r:2,rt:4,o:1,ot:2,n:3});
 assert.deepEqual(c.missing,["three_quarter_left","profile_left"]);
 const all=characterCoverage((await profile(CHARACTER_VIEWS.map(v=>v.id))).references);
 assert.deepEqual({r:all.requiredCount,o:all.optionalCount,ready:all.requiredReady},{r:4,o:2,ready:true});
});
test("consent v1.0 records the exact text shown, a timestamp and a planning-only scope",()=>{
 const c=createCharacterConsent(T1);
 assert.deepEqual(c,{version:"1.0",textFa:CONSENT_TEXT_FA,confirmedAt:T1,scope:["reference_planning"]});
 assert.equal(CONSENT_VERSION,"1.0");
 assert.match(CONSENT_TEXT_FA,/فقط در همین مرورگر/);assert.match(CONSENT_TEXT_FA,/پس بگیرم/);
 assert.doesNotMatch(CONSENT_TEXT_FA,/تضمین‌شده است|قفل چهره تضمین/);
});
test("consent is current only with the v1.0 text, the planning scope and no image added after it",async()=>{
 const p=await profile();
 assert.equal(hasCurrentConsent(p),true);assert.equal(consentProblem(p.consent,p.referenceMeta),undefined);
 assert.ok(consentProblem(null,p.referenceMeta));
 assert.ok(consentProblem({...p.consent!,version:"0.9"},p.referenceMeta));
 assert.ok(consentProblem({...p.consent!,textFa:"something else"},p.referenceMeta));
 assert.ok(consentProblem({...p.consent!,scope:[]},p.referenceMeta));
 assert.ok(consentProblem({...p.consent!,confirmedAt:"garbage"},p.referenceMeta));
 // an image added after the consent invalidates it until the consent is confirmed again
 const later={...p.referenceMeta,front:{...p.referenceMeta.front!,addedAt:T2}};
 assert.match(consentProblem(p.consent,later)!,/دوباره تأیید کن/);
 assert.throws(()=>validateCharacterProfile({...p,referenceMeta:later}),/دوباره تأیید کن/);
 assert.doesNotThrow(()=>validateCharacterProfile({...p,referenceMeta:later,consent:createCharacterConsent(T2)}));
 assert.throws(()=>validateCharacterProfile({...p,consent:null}));
 assert.throws(()=>validateCharacterProfile({...p,consent:{...p.consent!,version:"0.9"}}));
});
test("old profiles with only consentConfirmedAt migrate to a legacy consent record that is not current",async()=>{
 const p=await profile();
 const {consent:_c,referenceMeta:_m,...rest}=p;void _c;void _m;
 const old:StoredCharacterRecord={...rest,consentConfirmedAt:T1};
 const m=migrateCharacterProfile(old);
 assert.deepEqual(m.consent,{version:LEGACY_CONSENT_VERSION,textFa:LEGACY_CONSENT_TEXT_FA,confirmedAt:T1,scope:["reference_planning"]});
 assert.equal("consentConfirmedAt" in m,false);assert.deepEqual(m.referenceMeta,{});assert.equal(m.version,p.version);assert.equal(m.references.front,p.references.front);
 assert.equal(hasCurrentConsent(m),false);
 assert.equal(characterUsability(m).ok,false);
 assert.throws(()=>validateCharacterProfile(m));
 // a record that already has a consent record is left alone; one with no consent at all stays unconsented
 assert.equal(migrateCharacterProfile(p as StoredCharacterRecord).consent,p.consent);
 assert.equal(migrateCharacterProfile(rest as StoredCharacterRecord).consent,null);
});
test("usability for chat needs all required views and a current consent, with a Persian reason otherwise",async()=>{
 assert.deepEqual(characterUsability(await profile()),{ok:true});
 const partial=characterUsability(await profile(["front","full_body"]));
 assert.equal(partial.ok,false);assert.match((partial as {reason:string}).reason,/سه‌رخ چپ/);assert.match((partial as {reason:string}).reason,/نیم‌رخ چپ/);
 const noConsent=characterUsability(await profile(REQUIRED,{consent:null}));
 assert.equal(noConsent.ok,false);
 // optional views are not needed
 assert.equal(characterUsability(await profile(REQUIRED)).ok,true);
});
test("the version bumps only when the name, notes or an image changes",async()=>{
 const p=await profile(REQUIRED,{version:3});
 const same={name:p.name,notes:p.notes,referenceMeta:p.referenceMeta};
 assert.equal(nextCharacterVersion(undefined,same),1);
 assert.equal(nextCharacterVersion(p,same),3);
 assert.equal(nextCharacterVersion(p,{...same,name:"Sara K"}),4);
 assert.equal(nextCharacterVersion(p,{...same,notes:"keep the beard"}),4);
 const swapped={...p.referenceMeta,front:await meta(img("a different front"))};
 assert.equal(nextCharacterVersion(p,{...same,referenceMeta:swapped}),4);
 const removed={...p.referenceMeta};delete removed.full_body;
 assert.equal(nextCharacterVersion(p,{...same,referenceMeta:removed}),4);
 // a re-added image with identical bytes, a new consent time or metadata-only differences do not count
 const readded={...p.referenceMeta,front:{...p.referenceMeta.front!,addedAt:T2}};
 assert.equal(nextCharacterVersion(p,{...same,referenceMeta:readded}),3);
 assert.equal(referenceFingerprint(p.referenceMeta),referenceFingerprint(readded));
});
test("file names use a Latin-safe slug with a fallback to the id",()=>{
 assert.equal(characterSlug("Sara  Khan!","char-0001-aaaa"),"sara-khan");
 assert.equal(characterSlug("Émile Zola","x"),"emile-zola");
 assert.equal(characterSlug("سارا","char-0001-aaaa"),"char-0001-aaaa");
 assert.equal(characterSlug("سارا Sara","char-0001-aaaa"),"sara");
 assert.equal(characterSlug("","a1b2c3d4"),"a1b2c3d4");
 assert.match(characterSlug("x".repeat(200),"id"),/^x{1,40}$/);
 assert.equal(characterExportBaseName({name:"Sara Khan",id:"char-0001-aaaa",version:3}),"whoush-sara-khan-v3");
 assert.equal(characterExportBaseName({name:"سارا",id:"char-0001-aaaa",version:2}),"whoush-char-0001-aaaa-v2");
});
test("the manifest carries identity, version, notes, consent and per-angle metadata but no image data",async()=>{
 const p=await profile(["front","three_quarter_left","profile_left"],{notes:"same beard",version:4});
 const m=buildCharacterManifest(p,T2);
 assert.deepEqual({schema:m.schema,v:m.schemaVersion,at:m.exportedAt,storage:m.storage,images:m.imagesIncluded},{schema:"whoush.character-manifest",v:1,at:T2,storage:"browser-local",images:false});
 assert.deepEqual({id:m.id,name:m.name,version:m.version,notes:m.notes},{id:p.id,name:p.name,version:4,notes:"same beard"});
 assert.deepEqual(m.consent,p.consent);
 assert.deepEqual(m.coverage,{uploaded:["front","three_quarter_left","profile_left"],missingRequired:["full_body"],requiredReady:false});
 assert.equal(m.references.length,6);
 const front=m.references.find(r=>r.view==="front")!;
 assert.equal(front.provided,true);assert.deepEqual(front.meta,p.referenceMeta.front);assert.equal(front.titleEn,"Front");
 const fb=m.references.find(r=>r.view==="full_body")!;
 assert.deepEqual({provided:fb.provided,meta:fb.meta,required:fb.required},{provided:false,meta:null,required:true});
 const json=JSON.stringify(m);
 assert.doesNotMatch(json,/data:|blob:|base64/i);
 assert.deepEqual(JSON.parse(json),m);
 for(const r of m.references)if(r.meta)assert.deepEqual(Object.keys(r.meta).sort(),["addedAt","bytes","height","sha256","type","width"]);
});
test("Persian display helpers: digits, sizes, dimensions and dates",()=>{
 assert.equal(faDimensions(1024,1536),"۱۰۲۴×۱۵۳۶");
 assert.equal(faBytes(512*1024),"۵۱۲ کیلوبایت");
 assert.equal(faBytes(2.5*1024*1024),"۲٫۵ مگابایت");
 assert.equal(faBytes(10),"۱ کیلوبایت");
 assert.match(faDate("2026-11-04T12:00:00.000Z"),/^[۰-۹]+\/[۰-۹]+\/[۰-۹]+$/);
});
