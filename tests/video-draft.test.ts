import {test} from "node:test";
import assert from "node:assert/strict";
import {draftVideoModel} from "../lib/router";
import {matchSourceLength} from "../lib/orchestrator";
import {buildProposal} from "../lib/agent";

test("owner (2026-11-08): a video's draft is the cheapest 480p video model, silent and short; none for a ratio it lacks",()=>{
 const m=draftVideoModel("9:16");
 assert.equal(m?.id,"seedance-2-5-480p-5s");assert.equal(m?.neurons,9);
 assert.equal(draftVideoModel("2:3"),undefined,"no 480p model offers 2:3: the draft falls back to the opening-frame still");
});
test("owner (2026-11-08): a replacement in a video lasts as long as that video: the recommended model's version that covers it, same resolution",()=>{
 const p=buildProposal("a cinematic video with seedance 2.5","quality",undefined,"video");
 const head=p.suggestions.find(s=>s.modelId===p.selectedModelId)!;
 assert.equal(head.durationSeconds,5);
 const seven=matchSourceLength(p,7);
 assert.equal(seven.seconds,10);const s7=seven.proposal.suggestions.find(s=>s.modelId===seven.proposal.selectedModelId)!;
 assert.equal(s7.durationSeconds,10);assert.equal(s7.resolution,head.resolution,"the resolution stays");assert.equal(seven.proposal.fixedNeurons,s7.neurons,"the price follows the version");
 assert.equal(seven.proposal.recommendedModelId,s7.modelId);
 assert.equal(matchSourceLength(p,4.8).seconds,5,"a 4.8 s clip fits the 5 s version");
 assert.equal(matchSourceLength(p,25).seconds,10,"longer than any version: the longest");
});
