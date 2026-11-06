import {test} from "node:test";
import assert from "node:assert/strict";
import {resolveCreativeSkills,compileSkillInstructions,SKILLS} from "../lib/skills";
test("all tasks inherit anti-drift and continuity",()=>{
 for(const kind of ["image","video"] as const){
  const skills=resolveCreativeSkills({prompt:"create artwork",kind});
  assert.ok(skills.includes("anti_drift"));
  assert.ok(skills.includes("continuity"));
  assert.ok(skills.includes("qa"));
 }
});
test("videos always activate anti-teleport and cinematography",()=>{
 const skills=resolveCreativeSkills({prompt:"cinematic video",kind:"video"});
 for(const id of ["cinematographer","videographer","anti_teleport","continuity"] as const)assert.ok(skills.includes(id));
});
test("Persian speech lip-sync activates phonetics and Tehrani only when appropriate",()=>{
 const active=resolveCreativeSkills({prompt:"این صدا را با لب هماهنگ کن",kind:"video",hasSpeechAudio:true,speechLanguage:"fa"});
 assert.ok(active.includes("persian_lip_sync_phonetics"));
 assert.ok(active.includes("tehrani_accent"));
 const originalAccent=resolveCreativeSkills({prompt:"lip sync",kind:"video",hasSpeechAudio:true,speechLanguage:"fa",accent:"original"});
 assert.ok(originalAccent.includes("persian_lip_sync_phonetics"));
 assert.equal(originalAccent.includes("tehrani_accent"),false);
 const noVoice=resolveCreativeSkills({prompt:"picture of a singer",kind:"image"});
 assert.equal(noVoice.includes("persian_lip_sync_phonetics"),false);
});
test("explicit Tehrani accent activates on video prompt",()=>{
 const ids=resolveCreativeSkills({prompt:"ویدیو با لهجه تهرانی",kind:"video"});
 assert.ok(ids.includes("tehrani_accent"));
});
test("photorealism applies to ordinary media, not explicit stylized work",()=>{
 assert.ok(resolveCreativeSkills({prompt:"portrait photo",kind:"image"}).includes("hyper_realism"));
 assert.equal(resolveCreativeSkills({prompt:"cartoon portrait",kind:"image",visualStyle:"stylized"}).includes("hyper_realism"),false);
 const prompt=compileSkillInstructions({prompt:"portrait photo",kind:"image"});
 for(const word of ["pores","lighting","focal length","contrast","textures"]){
  assert.ok(prompt.toLowerCase().includes(word.toLowerCase()),word);
 }
});
test("character workflow and attached identity refs activate character creation",()=>{
 const ids=resolveCreativeSkills({prompt:"make a new character",kind:"image",task:"character"});
 assert.ok(ids.includes("character_creation"));
 assert.ok(resolveCreativeSkills({prompt:"portrait",kind:"image",hasCharacterReference:true}).includes("character_creation"));
});
test("all 25 professional skills include objectives and checks",()=>{
 assert.equal(Object.keys(SKILLS).length,39);
 for(const [id,s] of Object.entries(SKILLS)){
  assert.ok(s.title.length>4,id);
  assert.ok(s.objective.length>20,id);
  assert.ok(s.checks.length>0,id);
 }
});
