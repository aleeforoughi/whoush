import {test} from "node:test";
import assert from "node:assert/strict";
import {CHARACTER_VIEWS,REQUIRED_CHARACTER_VIEWS,characterCoverage,validateCharacterProfile,buildCharacterLockBrief,createCharacterConsent,sha256Hex,buildReferenceMeta,type CharacterProfile,type CharacterReferences,type CharacterReferenceMeta} from "../lib/characters";
const photo=(seed="dummy image data")=>new Blob([seed],{type:"image/jpeg"});
const metaFor=async(blob:Blob,addedAt:string)=>buildReferenceMeta({width:1200,height:1600,blob,sha256:await sha256Hex(blob),addedAt});
test("Character Studio provides six named angles and four mandatory views",()=>{
 assert.equal(CHARACTER_VIEWS.length,6);assert.equal(REQUIRED_CHARACTER_VIEWS.length,4);
 assert.ok(REQUIRED_CHARACTER_VIEWS.includes("front"));
 assert.ok(REQUIRED_CHARACTER_VIEWS.includes("full_body"));
 assert.ok(REQUIRED_CHARACTER_VIEWS.includes("three_quarter_left"));
 assert.ok(REQUIRED_CHARACTER_VIEWS.includes("profile_left"));
});
test("character reference coverage is accurate and never fabricates missing views",()=>{
 const refs:CharacterReferences={front:photo(),three_quarter_left:photo(),profile_left:photo(),full_body:photo()};
 const c=characterCoverage(refs);
 assert.equal(c.count,4);assert.equal(c.requiredReady,true);
 assert.deepEqual(c.missing,[]);
 const incomplete=characterCoverage({front:photo()});
 assert.equal(incomplete.requiredReady,false);
 assert.deepEqual(incomplete.missing,["three_quarter_left","profile_left","full_body"]);
});
test("profile requires a current consent record, a readable name and valid photo types",async()=>{
 const now=new Date("2026-11-04").toISOString();
 const front=photo();const referenceMeta:CharacterReferenceMeta={front:await metaFor(front,now)};
 const p:CharacterProfile={id:"test-profile",name:"Test Character",notes:"Keep facial hair and natural skin",createdAt:now,updatedAt:now,consent:createCharacterConsent(now),references:{front},referenceMeta,version:1};
 assert.doesNotThrow(()=>validateCharacterProfile(p));
 assert.throws(()=>validateCharacterProfile({...p,consent:null}));
 assert.throws(()=>validateCharacterProfile({...p,name:"X"}));
 const bad=new Blob(["bad"],{type:"text/html"});
 assert.throws(()=>validateCharacterProfile({...p,references:{front:bad}}));
});
test("lock briefs list only provided angles and do not claim an actual face lock",()=>{
 const prompt=buildCharacterLockBrief({name:"Character A",notes:"same beard",references:{front:photo()}});
 assert.match(prompt,/front/);
 assert.match(prompt,/Missing recommended angles/);
 assert.match(prompt,/Model-specific identity adherence/i);
 assert.doesNotMatch(prompt,/perfect face lock guaranteed/i);
});
