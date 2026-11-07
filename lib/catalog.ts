import { hasApprovedPrice, isPriced, type MediaModel } from "./types";
/**
 * How well a model, or one capability of it, is established (docs/CANVAS_TO_IMAGE.md section 8): `verified` from the model's own API reference;
 * `unsupported` when that reference says it lacks the capability; `documented_unverified` when only the agent catalogue lists it; `unknown` otherwise.
 * A capability flag that is false on an unverified model is unknown, never unsupported: absence from a catalogue proves nothing.
 */
export type CapabilityState="verified"|"documented_unverified"|"unknown"|"unsupported";
export type CapabilityName="referenceImages"|"audio"|"lipSync"|"motionReference"|"videoReference"|"startImage"|"endImage"|"videoContinuation";
export function capabilityState(m:MediaModel,cap?:CapabilityName):CapabilityState{
 const has=cap===undefined||(cap==="referenceImages"?m.capabilities.referenceImages.supported:Boolean(m.capabilities[cap]));
 if(m.capabilities.verified&&m.verifiedApiPath)return has?"verified":"unsupported";
 return m.evidenceSource==="agent_catalogue"&&has?"documented_unverified":"unknown";
}
/** Bump on ANY change to ids, capabilities or Neuron prices; quotes are bound to it. */
export const MEDIA_CATALOG_VERSION = "2026-11-05.1";
// Per-model API reference pages (docs.higgsfield.ai/docs/models/**), read 2026-11-04: see docs/HIGGSFIELD_EVIDENCE.md.
const SOUL_STANDARD_RATIOS = ["9:16","16:9","4:3","3:4","1:1","2:3","3:2"] as const;
const SEEDANCE_2_5_RATIOS = ["16:9","4:3","1:1","3:4","9:16","21:9"] as const;
const unverified = { verified:false, referenceImages:{supported:false,max:0}, aspectRatios:[], audio:false, lipSync:false, motionReference:false, videoReference:false, startImage:false, endImage:false, videoContinuation:false } as const;
const INTONE_RATIOS = ["21:9","16:9","9:16","1:1","4:3","3:4"] as const;
// Verified from the per-model API reference: soul-image, seedance-2-5-*, genjutsu-replace, genjutsu-motion (paths and input schemas).
// Intone's facts still come only from the provider's agent platform catalogue (docs/HIGGSFIELD_EVIDENCE.md#mcp-intone): it has no API reference page, so it stays unverified.
// Kling 4.0 has no API reference page either: unverified, never submitted live. (Nano Banana Pro now comes from Google's own API reference, below.)
// Genjutsu takes a source video and reference images as public URLs; Whoush has no hosted media yet, so policy blocks it (needs_hosted_media). Its price needs a server-measured source length.
// Neuron SKUs for soul-image, seedance-2-5-* and genjutsu-* were approved by the owner on 2026-11-04 from provider list prices (docs/HIGGSFIELD_EVIDENCE.md#provider-prices):
// ceil((provider + $0.05 planner allowance) / $0.128). The other SKUs are illustrative seeds. Fixed integers, FX-independent.
// The direct-provider SKUs (nano-banana-*, seedream-5-*, seedance-2-0-*, kling-3-0-*) were approved by the owner on 2026-11-06 with the same formula (docs/PROVIDERS.md).
// Genjutsu 720p is billed per input-video second, so it has one SKU per source-length band.
const GENJUTSU_720P_SKUS = [{upToSeconds:5,neurons:27},{upToSeconds:10,neurons:54},{upToSeconds:15,neurons:81},{upToSeconds:30,neurons:160}] as const;
export const MEDIA_CATALOG: readonly MediaModel[] = [
  {id:"nano-banana-pro-2k",provider:"google",name:"Nano Banana Pro · 2K",kind:"image",description:"Detailed, realistic image generation",tags:["quality","realistic","portrait"],aliases:["nano banana","nanobanana","نانو بنانا","nano banana pro"],neurons:2,resolution:"2K",operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/v1beta/interactions",providerModel:"gemini-3-pro-image",providerParams:{image_size:"2K"},
    capabilities:{verified:true,evidence:"docs/evidence/GOOGLE.md",referenceImages:{supported:false,max:0},aspectRatios:["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"],audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false}},
  {id:"nano-banana-2-1",provider:"google",name:"Nano Banana 2.1",kind:"image",typicalSeconds:20,description:"Fast, affordable realistic images",tags:["cost","speed","realistic"],aliases:["nano banana 2.1","نانو بنانا ۲.۱"],neurons:1,resolution:"1K",operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/v1beta/interactions",providerModel:"gemini-nano-banana-2.1",providerParams:{image_size:"1K"},
    capabilities:{verified:true,evidence:"docs/evidence/GOOGLE.md",referenceImages:{supported:true,max:10},identityReferences:4,aspectRatios:["1:1","1:4","1:8","2:3","3:2","3:4","4:1","4:3","4:5","5:4","8:1","9:16","16:9","21:9"],audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false}},
  {id:"nano-banana-2",provider:"google",name:"Nano Banana 2",kind:"image",description:"Realistic images with fine detail",tags:["quality","realistic","portrait"],aliases:["nano banana 2","نانو بنانا ۲"],neurons:1,resolution:"1K",operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/v1beta/interactions",providerModel:"gemini-3.1-flash-image",providerParams:{image_size:"1K"},
    capabilities:{verified:true,evidence:"docs/evidence/GOOGLE.md",referenceImages:{supported:true,max:10},identityReferences:4,aspectRatios:["1:1","1:4","1:8","2:3","3:2","3:4","4:1","4:3","4:5","5:4","8:1","9:16","16:9","21:9"],audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false}},
  {id:"seedream-5-pro-2k",provider:"byteplus",name:"Seedream 5.0 Pro · 2K",kind:"image",typicalSeconds:150,description:"Strong camera-angle and composition following",tags:["quality","composition"],aliases:["seedream","seedream 5","سیدریم"],neurons:2,resolution:"2K",operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/images/generations",providerModel:"dola-seedream-5-0-pro-260628",providerParams:{pixels:4194304},
    capabilities:{verified:true,evidence:"docs/evidence/BYTEPLUS.md",referenceImages:{supported:true,max:10},aspectRatios:["1:1","2:3","3:2","3:4","4:3","9:16","16:9","21:9"],audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false}},
  {id:"seedream-5-lite",provider:"byteplus",name:"Seedream 5.0 Lite",kind:"image",description:"Affordable high-resolution images",tags:["cost"],aliases:["seedream lite","سیدریم لایت"],neurons:1,resolution:"2K",operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/images/generations",providerModel:"seedream-5-0-260128",providerParams:{pixels:4194304},
    capabilities:{verified:true,evidence:"docs/evidence/BYTEPLUS.md",referenceImages:{supported:true,max:14},aspectRatios:["1:1","2:3","3:2","3:4","4:3","9:16","16:9","21:9"],audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false}},
  {id:"seedance-2-0-720p-5s",provider:"byteplus",name:"Seedance 2.0 · 5s",kind:"video",description:"Motion-rich short video, 720p",tags:["motion","cost"],aliases:["seedance 2","seedance 2.0","سیدنس ۲"],neurons:7,resolution:"720p",durationSeconds:5,operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/contents/generations/tasks",providerModel:"dreamina-seedance-2-0-260128",providerParams:{resolution:"720p"},
    capabilities:{verified:true,evidence:"docs/evidence/BYTEPLUS.md",referenceImages:{supported:false,max:0},aspectRatios:["16:9","4:3","1:1","3:4","9:16","21:9"],audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false,durationsSeconds:[5]}},
  {id:"seedance-2-0-720p-10s",provider:"byteplus",name:"Seedance 2.0 · 10s",kind:"video",description:"Longer motion-rich video, 720p",tags:["motion"],aliases:["seedance 2 10s"],neurons:13,resolution:"720p",durationSeconds:10,operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/contents/generations/tasks",providerModel:"dreamina-seedance-2-0-260128",providerParams:{resolution:"720p"},
    capabilities:{verified:true,evidence:"docs/evidence/BYTEPLUS.md",referenceImages:{supported:false,max:0},aspectRatios:["16:9","4:3","1:1","3:4","9:16","21:9"],audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false,durationsSeconds:[10]}},
  {id:"seedance-2-0-mini-720p-5s",provider:"byteplus",name:"Seedance 2.0 Mini · 5s",kind:"video",description:"Fast, affordable short video, 720p",tags:["speed","cost"],aliases:["seedance mini","سیدنس مینی"],neurons:4,resolution:"720p",durationSeconds:5,operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/contents/generations/tasks",providerModel:"dreamina-seedance-2-0-mini-260615",providerParams:{resolution:"720p"},
    capabilities:{verified:true,evidence:"docs/evidence/BYTEPLUS.md",referenceImages:{supported:false,max:0},aspectRatios:["16:9","4:3","1:1","3:4","9:16","21:9"],audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false,durationsSeconds:[5]}},
  {id:"kling-3-0-720p-5s",provider:"kling",name:"Kling 3.0 · 5s",kind:"video",description:"Cinematic motion, 720p",tags:["quality","motion"],aliases:["kling 3","kling 3.0","کلینگ ۳"],neurons:4,resolution:"720p",durationSeconds:5,operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/text-to-video/kling-3.0",providerModel:"kling-3.0",providerParams:{resolution:"720p"},
    capabilities:{verified:true,evidence:"docs/evidence/KLING.md",referenceImages:{supported:false,max:0},aspectRatios:["16:9","9:16","1:1"],audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false,durationsSeconds:[5]}},
  {id:"kling-3-0-720p-10s",provider:"kling",name:"Kling 3.0 · 10s",kind:"video",description:"Longer cinematic motion, 720p",tags:["quality","motion"],aliases:["kling 3 10s"],neurons:7,resolution:"720p",durationSeconds:10,operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/text-to-video/kling-3.0",providerModel:"kling-3.0",providerParams:{resolution:"720p"},
    capabilities:{verified:true,evidence:"docs/evidence/KLING.md",referenceImages:{supported:false,max:0},aspectRatios:["16:9","9:16","1:1"],audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false,durationsSeconds:[10]}},
  {id:"soul-image",provider:"higgsfield",name:"Soul",kind:"image",description:"Fast creative image exploration",tags:["speed","cost","creative"],aliases:["soul","higgsfield soul","سول ایمیج"],neurons:2,resolution:"720p",operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/higgsfield-ai/soul/standard",
    capabilities:{verified:true,evidence:"docs/HIGGSFIELD_EVIDENCE.md#soul-standard",referenceImages:{supported:false,max:0},aspectRatios:SOUL_STANDARD_RATIOS,audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false}},
  // Text-to-video only (no media inputs). Audio generation is sent as false: generated audio is not inspected by moderation yet.
  {id:"seedance-2-5-5s",provider:"higgsfield",name:"Seedance 2.5 · 5s",kind:"video",description:"Motion-rich short video",tags:["quality","motion"],aliases:["seedance 2.5","seedance","سیدنس"],neurons:45,resolution:"1080p",durationSeconds:5,operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/bytedance/seedance-2.5/text-to-video",
    capabilities:{verified:true,evidence:"docs/HIGGSFIELD_EVIDENCE.md#seedance-2-5",referenceImages:{supported:false,max:0},aspectRatios:SEEDANCE_2_5_RATIOS,audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false,durationsSeconds:[5]}},
  {id:"seedance-2-5-10s",provider:"higgsfield",name:"Seedance 2.5 · 10s",kind:"video",description:"Longer cinematic generation",tags:["quality","motion"],aliases:["seedance 10s","seedance ten"],neurons:90,resolution:"1080p",durationSeconds:10,operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/bytedance/seedance-2.5/text-to-video",
    capabilities:{verified:true,evidence:"docs/HIGGSFIELD_EVIDENCE.md#seedance-2-5",referenceImages:{supported:false,max:0},aspectRatios:SEEDANCE_2_5_RATIOS,audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false,durationsSeconds:[10]}},
  {id:"kling-4-0-5s",provider:"higgsfield",name:"Kling 4.0 · 5s",kind:"video",description:"Alternative video model",tags:["speed","quality"],aliases:["kling 4","kling","کلینگ"],neurons:50,resolution:"1080p",durationSeconds:5,operations:["generate"],evidenceSource:"api_docs",capabilities:{...unverified,durationsSeconds:[5]}},
  {id:"intone",provider:"higgsfield",name:"Intone",kind:"video",description:"Talking-head video from supplied voice recordings, with one or two characters",tags:["talking-head","lip-sync","dialogue"],aliases:["intone","اینتون","اینتن"],pricePending:true,resolution:"1080p",resolutions:["480p","720p","1080p"],
    operations:["lip_sync"],evidenceSource:"agent_catalogue",characterImagesMax:2,audioClipsMax:6,audioSecondsRange:[2,30],locationImage:true,
    capabilities:{...unverified,referenceImages:{supported:true,max:2},aspectRatios:INTONE_RATIOS,audio:true,lipSync:true}},
  // Source video 4-30 s (longer is trimmed to 30 s; output length follows it), each frame at least 409,600 pixels, 1-8 reference images. Billed per input-video second.
  {id:"genjutsu-replace",provider:"higgsfield",name:"Genjutsu",kind:"video",description:"Replace a character or object in a supplied video using reference images",tags:["video-edit","object-replacement"],aliases:["genjutsu","گنجوتسو","جنجوتسو"],sourceSecondsSkus:GENJUTSU_720P_SKUS,resolution:"720p",resolutions:["480p","720p","1080p"],
    operations:["replace"],evidenceSource:"api_docs",verifiedApiPath:"/higgsfield/genjutsu/object-swap/v1.0",sourceVideoSecondsRange:[4,30],
    capabilities:{...unverified,verified:true,evidence:"docs/HIGGSFIELD_EVIDENCE.md#genjutsu",referenceImages:{supported:true,max:8},videoReference:true}},
  {id:"genjutsu-motion",provider:"higgsfield",name:"Genjutsu",kind:"video",description:"Transfer the motion of a reference video onto subjects in reference images",tags:["motion-control","video-reference"],aliases:["genjutsu motion","genjutsu-motion"],sourceSecondsSkus:GENJUTSU_720P_SKUS,resolution:"720p",resolutions:["480p","720p","1080p"],
    operations:["motion_transfer"],evidenceSource:"api_docs",verifiedApiPath:"/higgsfield/genjutsu/motion-transfer/v1.0",sourceVideoSecondsRange:[4,30],
    capabilities:{...unverified,verified:true,evidence:"docs/HIGGSFIELD_EVIDENCE.md#genjutsu",referenceImages:{supported:true,max:8},motionReference:true}}
] as const;
export function findMediaModel(id: string): MediaModel | undefined { return MEDIA_CATALOG.find(x => x.id===id); }
/** `sourceVideoSeconds` is the source video's length, rounded up to whole seconds. It must come from server-side media inspection, never from the client. */
export type MediaConfiguration = { aspectRatio?: string; durationSeconds?: number; sourceVideoSeconds?: number };
/** Returns a Persian reason when the configuration is not offered by this SKU, else undefined. */
export function configurationProblem(m: MediaModel, c: MediaConfiguration = {}): string | undefined {
  if (c.aspectRatio !== undefined && !m.capabilities.aspectRatios.includes(c.aspectRatio)) return "نسبت تصویر درخواستی برای این مدل در دسترس نیست.";
  if (c.durationSeconds !== undefined && !(m.capabilities.durationsSeconds ?? []).includes(c.durationSeconds)) return "مدت‌زمان درخواستی برای این مدل در دسترس نیست.";
  if (m.sourceSecondsSkus) {
    const s = c.sourceVideoSeconds, [min, max] = m.sourceVideoSecondsRange ?? [1, 0];
    if (s === undefined) return "طول ویدیوی منبع باید پیش از قیمت‌گذاری مشخص شود.";
    if (!Number.isSafeInteger(s) || s < min || s > max) return "طول ویدیوی منبع برای این مدل مجاز نیست.";
  } else if (c.sourceVideoSeconds !== undefined) return "این مدل ویدیوی منبع نمی‌پذیرد.";
  return undefined;
}
/** Fixed integer SKU price for model+configuration. FX-independent by construction: no FX input exists here. Throws for a model with no approved price. */
export function priceFor(m: MediaModel, c: MediaConfiguration = {}): number {
  if (!hasApprovedPrice(m)) throw new Error("Price pending: no approved Neuron SKU");
  const problem = configurationProblem(m, c);
  if (problem) throw new Error("Unsupported configuration: " + problem);
  if (isPriced(m)) return m.neurons;
  return m.sourceSecondsSkus!.find(b => c.sourceVideoSeconds! <= b.upToSeconds)!.neurons;
}
export function assertValidCatalog(models: readonly MediaModel[] = MEDIA_CATALOG): void {
  const ids = new Set<string>();
  for(const m of models) {
    if(m.pricePending) { if(m.neurons !== undefined || m.sourceSecondsSkus) throw new Error("A price-pending model cannot carry a Neuron price"); }
    else if(m.sourceSecondsSkus) {
      const b = m.sourceSecondsSkus, r = m.sourceVideoSecondsRange;
      if(m.neurons !== undefined) throw new Error("A banded model cannot also carry a single Neuron price");
      if(!r || !b.length || b[b.length-1].upToSeconds !== r[1] || b[0].upToSeconds < r[0]) throw new Error("Source-length SKU bands must end at the source range maximum");
      if(b.some((x,i) => !Number.isSafeInteger(x.neurons) || x.neurons<=0 || !Number.isSafeInteger(x.upToSeconds) || (i>0 && (x.upToSeconds<=b[i-1].upToSeconds || x.neurons<b[i-1].neurons)))) throw new Error("Invalid integer Neuron SKU band");
    }
    else if(!Number.isSafeInteger(m.neurons) || (m.neurons as number)<=0) throw new Error("Invalid integer Neuron SKU");
    if(!m.operations.length) throw new Error("Model needs at least one operation");
    if(m.evidenceSource==="agent_catalogue" && (m.capabilities.verified || !m.pricePending)) throw new Error("Agent-catalogue models are unverified and price-pending until their API docs and SKU are approved");
    if(ids.has(m.id)) throw new Error("Duplicate model id");
    ids.add(m.id);
    const c = m.capabilities;
    if(!c) throw new Error("Missing capabilities");
    if(c.verified !== Boolean(m.verifiedApiPath && c.evidence)) throw new Error("verified requires verifiedApiPath and evidence, and vice versa");
    const rmax = c.referenceImages.max;
    if(rmax === null ? !c.referenceImages.supported : (!Number.isSafeInteger(rmax) || rmax<0 || c.referenceImages.supported !== rmax>0)) throw new Error("Invalid reference image capability");
    if(c.aspectRatios.some(r => !/^\d{1,2}:\d{1,2}$/.test(r))) throw new Error("Invalid aspect ratio");
    if(m.kind==="image" && c.durationsSeconds) throw new Error("Image models cannot declare durations");
    if(m.kind==="video" && m.operations.includes("generate")) {
      if(!c.durationsSeconds?.length || c.durationsSeconds.some(d => !Number.isSafeInteger(d) || d<=0)) throw new Error("Video models need positive integer durations");
      if(m.durationSeconds !== undefined && !c.durationsSeconds.includes(m.durationSeconds)) throw new Error("SKU duration not in capabilities");
    }
    if(c.lipSync && !c.audio) throw new Error("lipSync requires audio");
    if(m.operations.includes("lip_sync") && !c.lipSync) throw new Error("lip_sync operation requires lipSync");
    if(m.operations.includes("replace") && !c.videoReference) throw new Error("replace operation requires videoReference");
    if(m.operations.includes("motion_transfer") && !c.motionReference) throw new Error("motion_transfer operation requires motionReference");
    for(const n of [m.characterImagesMax, m.audioClipsMax]) if(n !== undefined && (!Number.isSafeInteger(n) || n<=0)) throw new Error("Invalid limit");
    for(const r of [m.audioSecondsRange, m.sourceVideoSecondsRange]) if(r && (r.some(n => !Number.isSafeInteger(n) || n<=0) || r[0] >= r[1])) throw new Error("Invalid duration range");
  }
}
