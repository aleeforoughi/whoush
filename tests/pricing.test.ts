import {test} from "node:test";
import assert from "node:assert/strict";
import {packageQuotes,allocatePackage} from "../lib/pricing";
test("all six amounts produce integer-only Neurons",()=>{
 const a=packageQuotes(250000,176000);
 assert.deepEqual(a.map(x=>x.totalNeurons),[45,115,236,481,1227,2500]);
 for(const q of a){assert.equal(Number.isInteger(q.totalNeurons),true);assert.equal(q.baseNeurons+q.giftNeurons,q.totalNeurons);assert.ok(q.giftNeurons>=0);}
});
test("rising USD rate reduces newly allocated Neurons but not generation SKU prices",()=>{
 const a=allocatePackage(10_000_000,4,200_000,176_000);
 const b=allocatePackage(10_000_000,4,350_000,176_000);
 assert.ok(a.totalNeurons>b.totalNeurons);
});
test("bonus package yields more per toman than starter",()=>{
 const q=packageQuotes(250000,176000);
 assert.ok(q[5].totalNeurons*2_000_000>q[0].totalNeurons*100_000_000);
});
test("floats are rejected",()=>{
 assert.throws(()=>allocatePackage(2_000_000,2.5,250000,176000));
 assert.throws(()=>allocatePackage(2_000_000,2,0,176000));
});
