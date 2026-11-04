import type { MediaModel } from "./types";
/** Bump on ANY change to ids, capabilities or Neuron prices; quotes are bound to it. */
export const MEDIA_CATALOG_VERSION = "2026-11-04.2";
const SOUL_STANDARD_RATIOS = ["1:1","4:3","3:4","3:2","2:3","5:4","4:5","16:9","9:16","21:9"] as const;
const unverified = { verified:false, referenceImages:{supported:false,max:0}, aspectRatios:[], audio:false, lipSync:false, motionReference:false, videoReference:false } as const;
// Neuron prices are ILLUSTRATIVE seed SKUs (fixed integers, FX-independent), not derived from provider cost.
// Only soul-image is verified (docs/HIGGSFIELD_EVIDENCE.md); the other models stay verified:false and can never be submitted live.
export const MEDIA_CATALOG: readonly MediaModel[] = [
  {id:"nano-banana-pro-2k",name:"Nano Banana Pro · 2K",kind:"image",description:"Detailed, realistic image generation",tags:["quality","realistic","portrait"],aliases:["nano banana","nanobanana","نانو بنانا"],neurons:10,resolution:"2K",capabilities:{...unverified}},
  {id:"soul-image",name:"Higgsfield Soul",kind:"image",description:"Fast creative image exploration",tags:["speed","cost","creative"],aliases:["soul","سول ایمیج"],neurons:4,resolution:"Standard",verifiedApiPath:"/higgsfield-ai/soul/standard",
    capabilities:{verified:true,evidence:"docs/HIGGSFIELD_EVIDENCE.md#soul-standard",referenceImages:{supported:false,max:0},aspectRatios:SOUL_STANDARD_RATIOS,audio:false,lipSync:false,motionReference:false,videoReference:false}},
  {id:"seedance-2-5-5s",name:"Seedance 2.5 · 5s",kind:"video",description:"Motion-rich short video",tags:["quality","motion"],aliases:["seedance 2.5","seedance","سیدنس"],neurons:42,resolution:"1080p",durationSeconds:5,capabilities:{...unverified,durationsSeconds:[5]}},
  {id:"seedance-2-5-10s",name:"Seedance 2.5 · 10s",kind:"video",description:"Longer cinematic generation",tags:["quality","motion"],aliases:["seedance 10s","seedance ten"],neurons:80,resolution:"1080p",durationSeconds:10,capabilities:{...unverified,durationsSeconds:[10]}},
  {id:"kling-4-0-5s",name:"Kling 4.0 · 5s",kind:"video",description:"Alternative video model",tags:["speed","quality"],aliases:["kling 4","kling","کلینگ"],neurons:50,resolution:"1080p",durationSeconds:5,capabilities:{...unverified,durationsSeconds:[5]}}
] as const;
export function findMediaModel(id: string): MediaModel | undefined { return MEDIA_CATALOG.find(x => x.id===id); }
export type MediaConfiguration = { aspectRatio?: string; durationSeconds?: number };
/** Returns a Persian reason when the configuration is not offered by this SKU, else undefined. */
export function configurationProblem(m: MediaModel, c: MediaConfiguration = {}): string | undefined {
  if (c.aspectRatio !== undefined && !m.capabilities.aspectRatios.includes(c.aspectRatio)) return "نسبت تصویر درخواستی برای این مدل در دسترس نیست.";
  if (c.durationSeconds !== undefined && !(m.capabilities.durationsSeconds ?? []).includes(c.durationSeconds)) return "مدت‌زمان درخواستی برای این مدل در دسترس نیست.";
  return undefined;
}
/** Fixed integer SKU price for model+configuration. FX-independent by construction: no FX input exists here. */
export function priceFor(m: MediaModel, c: MediaConfiguration = {}): number {
  const problem = configurationProblem(m, c);
  if (problem) throw new Error("Unsupported configuration: " + problem);
  return m.neurons;
}
export function assertValidCatalog(): void {
  const ids = new Set<string>();
  for(const m of MEDIA_CATALOG) {
    if(!Number.isSafeInteger(m.neurons) || m.neurons<=0) throw new Error("Invalid integer Neuron SKU");
    if(ids.has(m.id)) throw new Error("Duplicate model id");
    ids.add(m.id);
    const c = m.capabilities;
    if(!c) throw new Error("Missing capabilities");
    if(c.verified !== Boolean(m.verifiedApiPath && c.evidence)) throw new Error("verified requires verifiedApiPath and evidence, and vice versa");
    if(!Number.isSafeInteger(c.referenceImages.max) || c.referenceImages.max<0 || c.referenceImages.supported !== c.referenceImages.max>0) throw new Error("Invalid reference image capability");
    if(c.aspectRatios.some(r => !/^\d{1,2}:\d{1,2}$/.test(r))) throw new Error("Invalid aspect ratio");
    if(m.kind==="image" && c.durationsSeconds) throw new Error("Image models cannot declare durations");
    if(m.kind==="video") {
      if(!c.durationsSeconds?.length || c.durationsSeconds.some(d => !Number.isSafeInteger(d) || d<=0)) throw new Error("Video models need positive integer durations");
      if(m.durationSeconds !== undefined && !c.durationsSeconds.includes(m.durationSeconds)) throw new Error("SKU duration not in capabilities");
    }
    if(c.lipSync && !c.audio) throw new Error("lipSync requires audio");
  }
}
