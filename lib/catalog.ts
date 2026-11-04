import { isPriced, type MediaModel } from "./types";
/** Bump on ANY change to ids, capabilities or Neuron prices; quotes are bound to it. */
export const MEDIA_CATALOG_VERSION = "2026-11-04.3";
const SOUL_STANDARD_RATIOS = ["1:1","4:3","3:4","3:2","2:3","5:4","4:5","16:9","9:16","21:9"] as const;
const unverified = { verified:false, referenceImages:{supported:false,max:0}, aspectRatios:[], audio:false, lipSync:false, motionReference:false, videoReference:false, startImage:false, endImage:false, videoContinuation:false } as const;
const INTONE_RATIOS = ["21:9","16:9","9:16","1:1","4:3","3:4"] as const;
// Capability facts for intone / genjutsu-* come from the provider's agent platform catalogue (docs/HIGGSFIELD_EVIDENCE.md#mcp-intone etc.), NOT from the API docs:
// their API paths and input schemas are unverified, no Neuron price is approved, and none of them can be quoted or proposed.
// Neuron prices are ILLUSTRATIVE seed SKUs (fixed integers, FX-independent), not derived from provider cost.
// Only soul-image is verified (docs/HIGGSFIELD_EVIDENCE.md); the other models stay verified:false and can never be submitted live.
export const MEDIA_CATALOG: readonly MediaModel[] = [
  {id:"nano-banana-pro-2k",name:"Nano Banana Pro · 2K",kind:"image",description:"Detailed, realistic image generation",tags:["quality","realistic","portrait"],aliases:["nano banana","nanobanana","نانو بنانا"],neurons:10,resolution:"2K",operations:["generate"],evidenceSource:"api_docs",capabilities:{...unverified}},
  {id:"soul-image",name:"Soul",kind:"image",description:"Fast creative image exploration",tags:["speed","cost","creative"],aliases:["soul","higgsfield soul","سول ایمیج"],neurons:4,resolution:"Standard",operations:["generate"],evidenceSource:"api_docs",verifiedApiPath:"/higgsfield-ai/soul/standard",
    capabilities:{verified:true,evidence:"docs/HIGGSFIELD_EVIDENCE.md#soul-standard",referenceImages:{supported:false,max:0},aspectRatios:SOUL_STANDARD_RATIOS,audio:false,lipSync:false,motionReference:false,videoReference:false,startImage:false,endImage:false,videoContinuation:false}},
  {id:"seedance-2-5-5s",name:"Seedance 2.5 · 5s",kind:"video",description:"Motion-rich short video",tags:["quality","motion"],aliases:["seedance 2.5","seedance","سیدنس"],neurons:42,resolution:"1080p",durationSeconds:5,operations:["generate"],evidenceSource:"api_docs",capabilities:{...unverified,durationsSeconds:[5]}},
  {id:"seedance-2-5-10s",name:"Seedance 2.5 · 10s",kind:"video",description:"Longer cinematic generation",tags:["quality","motion"],aliases:["seedance 10s","seedance ten"],neurons:80,resolution:"1080p",durationSeconds:10,operations:["generate"],evidenceSource:"api_docs",capabilities:{...unverified,durationsSeconds:[10]}},
  {id:"kling-4-0-5s",name:"Kling 4.0 · 5s",kind:"video",description:"Alternative video model",tags:["speed","quality"],aliases:["kling 4","kling","کلینگ"],neurons:50,resolution:"1080p",durationSeconds:5,operations:["generate"],evidenceSource:"api_docs",capabilities:{...unverified,durationsSeconds:[5]}},
  {id:"intone",name:"Intone",kind:"video",description:"Talking-head video from supplied voice recordings, with one or two characters",tags:["talking-head","lip-sync","dialogue"],aliases:["intone","اینتون","اینتن"],pricePending:true,resolution:"1080p",resolutions:["480p","720p","1080p"],
    operations:["lip_sync"],evidenceSource:"agent_catalogue",characterImagesMax:2,audioClipsMax:6,audioSecondsRange:[2,30],locationImage:true,
    capabilities:{...unverified,referenceImages:{supported:true,max:2},aspectRatios:INTONE_RATIOS,audio:true,lipSync:true}},
  {id:"genjutsu-replace",name:"Genjutsu",kind:"video",description:"Replace a character or object in a supplied video using reference images",tags:["video-edit","object-replacement"],aliases:["genjutsu","گنجوتسو","جنجوتسو"],pricePending:true,resolution:"720p",resolutions:["480p","720p","1080p"],
    operations:["replace"],evidenceSource:"agent_catalogue",
    capabilities:{...unverified,referenceImages:{supported:true,max:null},videoReference:true}},
  {id:"genjutsu-motion",name:"Genjutsu",kind:"video",description:"Transfer the motion of a reference video onto subjects in reference images",tags:["motion-control","video-reference"],aliases:["genjutsu motion","genjutsu-motion"],pricePending:true,resolution:"720p",resolutions:["480p","720p","1080p"],
    operations:["motion_transfer"],evidenceSource:"agent_catalogue",
    capabilities:{...unverified,referenceImages:{supported:true,max:null},motionReference:true}}
] as const;
export function findMediaModel(id: string): MediaModel | undefined { return MEDIA_CATALOG.find(x => x.id===id); }
export type MediaConfiguration = { aspectRatio?: string; durationSeconds?: number };
/** Returns a Persian reason when the configuration is not offered by this SKU, else undefined. */
export function configurationProblem(m: MediaModel, c: MediaConfiguration = {}): string | undefined {
  if (c.aspectRatio !== undefined && !m.capabilities.aspectRatios.includes(c.aspectRatio)) return "نسبت تصویر درخواستی برای این مدل در دسترس نیست.";
  if (c.durationSeconds !== undefined && !(m.capabilities.durationsSeconds ?? []).includes(c.durationSeconds)) return "مدت‌زمان درخواستی برای این مدل در دسترس نیست.";
  return undefined;
}
/** Fixed integer SKU price for model+configuration. FX-independent by construction: no FX input exists here. Throws for a model with no approved price. */
export function priceFor(m: MediaModel, c: MediaConfiguration = {}): number {
  if (!isPriced(m)) throw new Error("Price pending: no approved Neuron SKU");
  const problem = configurationProblem(m, c);
  if (problem) throw new Error("Unsupported configuration: " + problem);
  return m.neurons;
}
export function assertValidCatalog(models: readonly MediaModel[] = MEDIA_CATALOG): void {
  const ids = new Set<string>();
  for(const m of models) {
    if(m.pricePending) { if(m.neurons !== undefined) throw new Error("A price-pending model cannot carry a Neuron price"); }
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
    if(m.audioSecondsRange && (m.audioSecondsRange.some(n => !Number.isSafeInteger(n) || n<=0) || m.audioSecondsRange[0] >= m.audioSecondsRange[1])) throw new Error("Invalid audio duration range");
  }
}
