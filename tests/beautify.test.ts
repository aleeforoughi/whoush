import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-beautify-test-"));
import {forgetReviewsForTests,reviewUpload} from "../lib/upload-review";
import {orchestrateCreativeTurn,getPrivateMediaPrompt,type OrchestratorResult} from "../lib/orchestrator";
import {resetRouterStateForTests} from "../lib/llm-routing";
import {CreativeTurnInputSchema} from "../lib/creative-plan";
import {BEAUTIFY_PARTS,beautifyPrompt,beautifyRequestFa,startingParts,wantsBeautify} from "../lib/beautify";

const ENV_KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();forgetReviewsForTests();saved=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];});
afterEach(()=>{for(const k of ENV_KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
const JPEG=new Uint8Array([0xff,0xd8,0xff,0xe0,9,8,7,6,5,4,3,2]);
const ok=(salt=0)=>reviewUpload(Uint8Array.from([...JPEG,salt]),"image/jpeg",{inspect:async()=>({category:"none",person:true})});
const photo=(over:Record<string,unknown>={})=>({id:crypto.randomUUID(),tag:"image1",kind:"image",mime:"image/jpeg",bytes:2048,sha256:"d".repeat(64),width:1264,height:848,...over});
const loc=(o:{beautify:boolean;minor?:boolean;mode?:"edit"|"reference"|"unclear"})=>async()=>({mode:o.mode??"edit" as const,regions:[],beautify:o.beautify,minor:o.minor??false});

test("Beautify words: looking better is recognised, an ordinary change is not",()=>{
 for(const t of ["عکسمو حرفه‌ای کن","خوشگلم کن","مثل عکس مجله‌ها بشه","یه گلو‌آپ بده","make me look better","editorial vibe please"])assert.ok(wantsBeautify(t),t);
 for(const t of ["رنگ پیرهنشو آبی کن","لیوان رو حذف کن","یه ویدیو بساز","make a magazine cover with this"])assert.ok(!wantsBeautify(t),t);
});

test("Beautify brief: identity, place, outfit and styles locked; never guesses; each chosen part with what was seen; under 18 keeps to the photo craft",()=>{
 const all=beautifyPrompt("[reference image 1]",BEAUTIFY_PARTS,[{part:"camera",noteFa:"زاویه از پایینه",noteEn:"shot from below with a close wide lens; the face looks wider"}]);
 assert.match(all,/^TASK: EDITORIAL BEAUTIFY of \[reference image 1\]: .*Every fix below done fully and visibly, all natural\./);
 assert.match(all,/GOAL: social-media ready: .*would I share it for compliments\? Beautiful\? Still them\? All three must be yes\./);
 assert.match(all,/MOOD: keep the vibe: same moment, setting and background in view, same daylight and colour mood, their own expression\./);
 assert.match(all,/KEEP: identity .*hairline, hairstyle, beard style, outfit, place\./);
 // Owner, 2026-11-08: Whoush never guesses what the photo does not show; never CGI or plastic; full detail, pores and texture.
 assert.match(all,/NEVER GUESS: invent nothing hidden: no hidden side of the face or head, no teeth if the mouth is closed, no opening closed eyes\./);
 assert.match(all,/REAL: a real photograph, never CGI, plastic or airbrushed skin: full detail and sharpness, every pore and fine texture kept, no pixelation, smearing or blur\./);
 assert.match(all,/a slight move to eye level, 85 mm look, a perspective warp of the face to its true shape\. Head keeps its turn/);
 assert.match(all,/eyes to the lens with a slight squinch.*never sexualised/);
 assert.match(all,/thinning filled with the hairline unchanged; beard barber-groomed \(hairs outside its cheek and neck lines shaved/);
 assert.match(all,/tired under-eyes softened; pores and texture fully kept/);assert.match(all,/less puffiness, natural defined jawline/);assert.match(all,/no lint, hair or creases/);
 assert.match(all,/CAMERA: .* Seen: shot from below with a close wide lens; the face looks wider\./);
 for(const h of ["POSE:","LIGHT:","SKIN:","GROOMING:","FACE:","CLOTHES:","COLOUR:"])assert.ok(all.includes(h),h);
 assert.ok(all.length<=2400,"within the plan's prompt cap with room for the findings: "+all.length);
 const worst=beautifyPrompt("[reference image 1 · #تصویر-۱]",BEAUTIFY_PARTS,BEAUTIFY_PARTS.map(p=>({part:p,noteFa:"x",noteEn:"y".repeat(160)})));
 assert.ok(worst.length<=2800,"a long finding on every part still fits: "+worst.length);
 const some=beautifyPrompt("[r]",["light","color"]);
 assert.ok(some.includes("LIGHT:")&&some.includes("COLOUR:"));
 assert.ok(some.includes("Posture and expression: exactly as in the photo.")&&some.includes("Face and features: exactly as in the photo.")&&some.includes("Camera: the same angle, lens and focus."));
 const minor=beautifyPrompt("[r]",BEAUTIFY_PARTS,[],true);
 assert.ok(!minor.includes("SKIN:")&&!minor.includes("POSE:")&&!minor.includes("FACE:")&&!minor.includes("GROOMING:"),"nothing on a minor's face or body");
 assert.ok(minor.includes("LIGHT:")&&minor.includes("CAMERA:")&&minor.includes("CLOTHES:"));
 assert.equal(beautifyRequestFa("#تصویر-۱",["skin","light"]),"#تصویر-۱ رو زیباسازی کن: پوست، نور");
 // The card starts with what the photo needs (and the colour); with nothing listed, everything.
 assert.deepEqual(startingParts([{part:"light",noteFa:"x",noteEn:"y"},{part:"clothes",noteFa:"x",noteEn:"y"}],false),["light","shape","clothes","color"]);
 assert.deepEqual(startingParts([],false),[...BEAUTIFY_PARTS]);
 assert.deepEqual(startingParts([],true),["camera","light","clothes","color"]);
});

test("Beautify is offered only when the user is trying to look better: on its own, beside the edit card, limited for a minor, never for a reference",async()=>{
 const src=await ok(1);
 const alone=await orchestrateCreativeTurn({text:"این عکس منه، حرفه‌ای‌ترش کن",attachments:[photo({reviewId:src.reviewId})]},{locateEdit:loc({beautify:true})});
 assert.equal(alone.status,"needs_input",JSON.stringify(alone).slice(0,300));
 const a=alone as Extract<OrchestratorResult,{status:"needs_input"}>;
 assert.deepEqual(a.beautify,{tag:"image1",parts:[...BEAUTIFY_PARTS]});assert.equal(a.editCards,undefined,"nothing specific to mark: the Beautify card alone");
 const beside=await orchestrateCreativeTurn({text:"روتوشم کن و رژ لبمو نود کن",attachments:[photo({reviewId:src.reviewId})]},
  {locateEdit:async()=>({mode:"edit" as const,regions:[{noteFa:"رژ لب نود",box:[.45,.5,.55,.58],part:"lips" as const,grow:false}],beautify:true,minor:false})});
 const b=beside as Extract<OrchestratorResult,{status:"needs_input"}>;
 assert.ok(b.editCards?.[0]?.suggested?.length&&b.beautify,"the edit card, with Beautify as the other option");
 const kid=await orchestrateCreativeTurn({text:"خوشگلش کن",attachments:[photo({reviewId:(await ok(2)).reviewId})]},{locateEdit:loc({beautify:true,minor:true})});
 assert.deepEqual((kid as Extract<OrchestratorResult,{status:"needs_input"}>).beautify,{tag:"image1",parts:["camera","light","clothes","color"],minor:true});
 const plain=await orchestrateCreativeTurn({text:"رنگ پیرهنشو آبی کن",attachments:[photo({reviewId:src.reviewId})]},{locateEdit:loc({beautify:false})});
 assert.ok(plain.status!=="needs_input"||!plain.beautify,"an ordinary change gets no Beautify");
 const ref=await orchestrateCreativeTurn({text:"با این عکس یه کاور مجله بساز، خوشگلم کن",attachments:[photo({reviewId:src.reviewId})]},{locateEdit:loc({beautify:false,mode:"reference"})});
 assert.ok(ref.status!=="needs_input"||!ref.beautify,"a photo used as a reference for a new picture gets no Beautify");
});

test("Beautify it: the photo is the photo to edit, at its own shape, with the fixed brief; a photo judged under 18 never gets retouch, expression or pose",async()=>{
 const src=await ok(3);
 assert.ok(CreativeTurnInputSchema.safeParse({text:"x",attachments:[photo({reviewId:src.reviewId,beautify:{parts:["light"]}})]}).success);
 assert.ok(!CreativeTurnInputSchema.safeParse({text:"x",attachments:[photo({reviewId:src.reviewId,beautify:{parts:["tattoo"]}})]}).success,"only known parts");
 const r=await orchestrateCreativeTurn({text:beautifyRequestFa("#تصویر-۱",[...BEAUTIFY_PARTS]),attachments:[photo({reviewId:src.reviewId,beautify:{parts:[...BEAUTIFY_PARTS]}})]});
 assert.equal(r.status,"planned",JSON.stringify(r).slice(0,300));
 const p=r as Extract<OrchestratorResult,{status:"planned"}>;
 assert.equal(p.plan.references[0].role,"edit_reference");
 assert.equal(p.plan.camera?.aspectRatio,"3:2","the photo's own shape (1264×848)");
 assert.ok(p.plan.hardConstraints[0].startsWith("«زیباسازی» روی #تصویر-۱: همان شخص"),p.plan.hardConstraints[0]);
 const prompt=getPrivateMediaPrompt(p.turnId)!;
 assert.match(prompt,/^TASK: EDITORIAL BEAUTIFY of \[reference image 1/);assert.ok(prompt.includes("POSE:")&&prompt.includes("SKIN:")&&prompt.includes("COLOUR:"),"every part survives the prompt cap");
 // The vision step judged this photo's person under 18: a request that adds pose and retouch anyway keeps to colour, light and camera.
 const kidSrc=await ok(4);
 await orchestrateCreativeTurn({text:"خوشگلش کن",attachments:[photo({reviewId:kidSrc.reviewId})]},{locateEdit:loc({beautify:true,minor:true})});
 const kid=await orchestrateCreativeTurn({text:beautifyRequestFa("#تصویر-۱",[...BEAUTIFY_PARTS]),attachments:[photo({reviewId:kidSrc.reviewId,beautify:{parts:[...BEAUTIFY_PARTS]}})]});
 const kp=getPrivateMediaPrompt((kid as Extract<OrchestratorResult,{status:"planned"}>).turnId)!;
 assert.ok(!kp.includes("POSE:")&&!kp.includes("SKIN:")&&!kp.includes("FACE:")&&kp.includes("LIGHT:"),kp.slice(0,400));
});

test("Beautify on upload: the photo check's findings are kept by the server and go into the brief; a minor's face parts are dropped",async()=>{
 const issues=[{part:"camera" as const,noteFa:"زاویه از پایینه و صورت پهن‌تر افتاده",noteEn:"shot from below with a close wide lens; the face looks wider"},
  {part:"clothes" as const,noteFa:"تیشرت چروکه و پرز داره",noteEn:"the black t-shirt is creased and covered in lint"},
  {part:"skin" as const,noteFa:"پوست کمی ناصافه",noteEn:"uneven skin tone"}];
 const adult=await reviewUpload(Uint8Array.from([...JPEG,7]),"image/jpeg",{inspect:async()=>({category:"none",person:true,beautify:{needed:true,minor:false,issues}})});
 assert.equal(adult.state,"safe");if(adult.state!=="safe")return;
 assert.deepEqual(adult.beautify?.issues.map(i=>i.part),["camera","clothes","skin"]);
 const r=await orchestrateCreativeTurn({text:beautifyRequestFa("#تصویر-۱",["camera","clothes","color"]),attachments:[photo({reviewId:adult.reviewId,beautify:{parts:["camera","clothes","color"]}})]});
 const prompt=getPrivateMediaPrompt((r as Extract<OrchestratorResult,{status:"planned"}>).turnId)!;
 assert.match(prompt,/CAMERA: .*Seen: shot from below with a close wide lens; the face looks wider\./);
 assert.match(prompt,/CLOTHES: .*Seen: the black t-shirt is creased and covered in lint\./);
 assert.ok(prompt.includes("Skin: as in the photo."),"skin was not chosen, so its finding is not used");
 const kid=await reviewUpload(Uint8Array.from([...JPEG,8]),"image/jpeg",{inspect:async()=>({category:"none",person:true,beautify:{needed:true,minor:true,issues}})});
 assert.ok(kid.state==="safe"&&kid.beautify?.minor&&kid.beautify.issues.every(i=>i.part!=="skin"),"no face parts for a minor");
 const none=await reviewUpload(Uint8Array.from([...JPEG,9]),"image/jpeg",{inspect:async()=>({category:"none",person:false,beautify:{needed:true,minor:false,issues}})});
 assert.ok(none.state==="safe"&&!none.beautify,"no person, no Beautify");
});

test("Beautify brief fits any photo: nothing in it names one photo's setting",()=>{
 const all=beautifyPrompt("[r]",BEAUTIFY_PARTS);
 assert.ok(!/window|sky|building/i.test(all),"no setting of a particular photo in the general brief");
});

test("«زیباسازی» keeps quality: the cheapest 2K-or-higher model is recommended; nothing changes when none is offered",async()=>{
 const {preferDetail}=await import("../lib/orchestrator");
 const s=(modelId:string,neurons:number,resolution?:string)=>({modelId,name:modelId,neurons,reason:"",...(resolution?{resolution}:{})});
 const base={suggestions:[s("a-1k",1,"1K"),s("b-2k",4,"2K"),s("c-4k",9,"4K"),s("d-2k",3,"2K")],selectedModelId:"a-1k",recommendedModelId:"a-1k",fixedNeurons:1} as unknown as Parameters<typeof preferDetail>[0];
 const p=preferDetail(base);
 assert.equal(p.selectedModelId,"d-2k");assert.equal(p.fixedNeurons,3);assert.equal(p.suggestions.length,4,"the cheaper 1K stays in the menu");
 const none={...base,suggestions:[s("a-1k",1,"1K")]} as typeof base;assert.equal(preferDetail(none).selectedModelId,"a-1k");
 const src=await ok(11);
 const r=await orchestrateCreativeTurn({text:beautifyRequestFa("#تصویر-۱",["skin"]),attachments:[photo({reviewId:src.reviewId,beautify:{parts:["skin"]}})]});
 const prop=(r as Extract<OrchestratorResult,{status:"planned"}>).proposal,picked=prop.suggestions.find(x=>x.modelId===prop.selectedModelId);
 if(prop.suggestions.some(x=>/^[2-9]K$/i.test(x.resolution??"")))assert.match(picked?.resolution??"",/^[2-9]K$/i,"a 2K-or-higher model when one is offered: "+prop.selectedModelId);
});
