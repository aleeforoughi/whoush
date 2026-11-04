import {test} from "node:test";
import assert from "node:assert/strict";
import {CHARACTER_VIEWS,REQUIRED_CHARACTER_VIEWS,characterCoverage,validateCharacterProfile,buildCharacterLockBrief,type CharacterProfile,type CharacterReferences} from "../lib/characters";
const photo=()=>new Blob(["dummy image data"],{type:"image/jpeg"});
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
test("profile requires consent, a readable name and valid photo types",()=>{
 const now=new Date("2026-11-04").toISOString();
 const p:CharacterProfile={id:"test-profile",name:"Test Character",notes:"Keep facial hair and natural skin",createdAt:now,updatedAt:now,consentConfirmedAt:now,references:{front:photo()},version:1};
 assert.doesNotThrow(()=>validateCharacterProfile(p));
 assert.throws(()=>validateCharacterProfile({...p,consentConfirmedAt:""}));
 assert.throws(()=>validateCharacterProfile({...p,name:"X"}));
 assert.throws(()=>validateCharacterProfile({...p,references:{front:new Blob(["bad"],{type:"text/html"})}}));
});
test("lock briefs list only provided angles and do not claim an actual face lock",()=>{
 const prompt=buildCharacterLockBrief({name:"Character A",notes:"same beard",references:{front:photo()}});
 assert.match(prompt,/front/);
 assert.match(prompt,/Missing recommended angles/);
 assert.match(prompt,/Model-specific identity adherence/i);
 assert.doesNotMatch(prompt,/perfect face lock guaranteed/i);
});
