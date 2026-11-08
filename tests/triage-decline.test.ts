import {test} from "node:test";
import assert from "node:assert/strict";
import {triageDeclines} from "../lib/turn-triage";
import {mightEditPhoto} from "../lib/edit-card";

// Owner, 2026-11-08: a retouch of the user's own photo got «این مدل تصویر رو نمی‌سازم» from the triage, and no edit widget.
const RETOUCH="این عکس منه، یه روتوش طبیعی کن: پوست صاف‌تر، آرایش ملایم با رژ لب نود";

test("a retouch of a sent photo reaches the edit check",()=>{
 assert.equal(mightEditPhoto(RETOUCH),true);
 assert.equal(mightEditPhoto("یه گل کنار صورتش بذار"),true,"place words no longer read as a new picture");
 assert.equal(mightEditPhoto("از این عکس یه ویدیو بساز"),false,"a video request is not a photo edit");
});

test("triage text that declines is recognised; ordinary replies are not",()=>{
 for(const t of ["این مدل تصویر رو نمی‌سازم. ولی یه عکس شیک و قشنگ با همون حس می‌تونیم بسازیم:","نمی‌تونم بسازم","Sorry, I can't make that","I won't create this","Nemisazam"])
  assert.equal(triageDeclines(t),true,t);
 for(const t of ["سلام! چی بسازیم؟","می‌تونم یه پرتره نرم برات بسازم","کدومو بسازم؟ یا بگو چی‌ش عوض شه.","Hi! What should we make?"])
  assert.equal(triageDeclines(t),false,t);
});

test("a declining triage is ignored and the turn is planned; a real reply still answers",async()=>{
 const {orchestrateCreativeTurn,deterministicPlanner}=await import("../lib/orchestrator");
 const declining=async()=>({mode:"reply" as const,replyFa:"این مدل تصویر رو نمی‌سازم. ولی یه عکس شیک می‌تونیم بسازیم:",effort:"standard" as const,storyFa:[]});
 const planned=await orchestrateCreativeTurn({text:"یه عکس از یه گربه روی پشت‌بوم"},{planner:deterministicPlanner,triage:declining as never});
 assert.notEqual(planned.status,"reply","the refusal is not shown");
 const greeting=async()=>({mode:"reply" as const,replyFa:"سلام! امروز چی بسازیم؟",effort:"standard" as const,storyFa:[]});
 const hi=await orchestrateCreativeTurn({text:"سلام"},{planner:deterministicPlanner,triage:greeting as never});
 assert.equal(hi.status,"reply");
});
