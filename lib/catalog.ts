import type { MediaModel } from "./types";
export const MEDIA_CATALOG: readonly MediaModel[] = [
  {id:"nano-banana-pro-2k",name:"Nano Banana Pro · 2K",kind:"image",description:"Detailed, realistic image generation",tags:["quality","realistic","portrait"],aliases:["nano banana","nanobanana","نانو بنانا"],neurons:10,resolution:"2K"},
  {id:"soul-image",name:"Higgsfield Soul",kind:"image",description:"Fast creative image exploration",tags:["speed","cost","creative"],aliases:["soul","سول ایمیج"],neurons:4,resolution:"Standard"},
  {id:"seedance-2-5-5s",name:"Seedance 2.5 · 5s",kind:"video",description:"Motion-rich short video",tags:["quality","motion"],aliases:["seedance 2.5","seedance","سیدنس"],neurons:42,resolution:"1080p",durationSeconds:5},
  {id:"seedance-2-5-10s",name:"Seedance 2.5 · 10s",kind:"video",description:"Longer cinematic generation",tags:["quality","motion"],aliases:["seedance 10s","seedance ten"],neurons:80,resolution:"1080p",durationSeconds:10},
  {id:"kling-4-0-5s",name:"Kling 4.0 · 5s",kind:"video",description:"Alternative video model",tags:["speed","quality"],aliases:["kling 4","kling","کلینگ"],neurons:50,resolution:"1080p",durationSeconds:5}
] as const;
export function findMediaModel(id: string): MediaModel | undefined { return MEDIA_CATALOG.find(x => x.id===id); }
export function assertValidCatalog(): void {
  for(const m of MEDIA_CATALOG) if(!Number.isSafeInteger(m.neurons) || m.neurons<=0) throw new Error("Invalid integer Neuron SKU");
}
// Seed Neuron prices are illustrative. Before any live checkout, price per verified
// API configuration must be approved and published as an immutable SKU revision.
