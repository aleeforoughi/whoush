import {test} from "node:test";
import assert from "node:assert/strict";
import {buildProposal,familyOf} from "../lib/agent";
import {findMediaModel} from "../lib/catalog";

test("the generation card's settings come from the catalogue: each suggested model family with all its versions, resolution, duration and verified ratios",()=>{
 const p=buildProposal("a cinematic video of waves at sunset","quality");
 const fams=[...new Set(p.suggestions.map(s=>familyOf(s.name)))];
 assert.ok(fams.length>=1&&fams.length<=3,"up to three families: "+fams.join(", "));
 for(const s of p.suggestions){
  const m=findMediaModel(s.modelId)!;
  assert.equal(s.resolution,m.resolution);assert.equal(s.durationSeconds,m.durationSeconds);assert.deepEqual(s.aspectRatios,[...m.capabilities.aspectRatios],"only what the model's own schema accepts");
 }
 const seedance=p.suggestions.filter(s=>familyOf(s.name)==="Seedance 2.5");
 if(seedance.length)assert.deepEqual(seedance.map(s=>s.durationSeconds).sort(),[10,5].sort(),"a family's durations are offered together");
 assert.equal(familyOf("Nano Banana Pro · 2K"),"Nano Banana Pro");
 assert.ok(!JSON.stringify(p.suggestions).toLowerCase().includes("higgsfield"),"no provider details reach the card");
});
