import {test} from "node:test";
import assert from "node:assert/strict";
import {createDemoProposal,selectProposalModel} from "../lib/agent";
import {reasoningTier} from "../lib/router";
test("explicit media model is respected",()=>{
 const a=createDemoProposal("Generate an image using Nano Banana Pro 2K");
 assert.equal(a.selectedModelId,"nano-banana-pro-2k");
});
test("chat agents do not disclose LLM models",()=>{
 const out=JSON.stringify(createDemoProposal("یک عکس زیبا از تهران بساز"));
 for(const term of ["claude","opus","sonnet","haiku","astra","gpt-6"])assert.equal(out.toLowerCase().includes(term),false);
});
test("model change updates displayed integer fixed charge",()=>{
 const a=createDemoProposal("generate an image");
 const b=selectProposalModel(a,"soul-image");
 assert.equal(b.fixedNeurons,2);
 assert.throws(()=>selectProposalModel(a,"unknown"));
});
test("internal reasoning tier remains private",()=>{
 assert.equal(reasoningTier("hi",false),"fast");
 assert.equal(reasoningTier("Create a multi-shot storyboard",true),"deep");
});
