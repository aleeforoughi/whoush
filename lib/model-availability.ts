/**
 * Which models can really run right now (owner, 2026-11-06: no friction, no error). While real generation is on (owner dev testing or live), Whoush offers
 * only models that can run: their provider's key is set, the API path is verified, the media they need can reach the provider, and the provider has the
 * model open for this account. A model a provider has not opened (BytePlus answers `404 ModelNotOpen`) is listed in `WHOUSH_MODELS_NOT_OPEN`, or found at
 * runtime the first time a submission is refused that way. Demo mode (tests, no keys) offers everything, as before.
 */
import type {MediaModel} from "./types";
import {devLiveTest,generationGate,needsHostedMedia} from "./policy";
import {hasProviderCredentials} from "./provider-credentials";

/**
 * Not open on the owner's accounts in the live check of 2026-11-06 (docs/evidence/PROVIDER_CHECK_2026-11-06.md). `WHOUSH_MODELS_NOT_OPEN` replaces this list
 * (comma-separated ids; `none` for an empty list) once the owner activates them in the provider console.
 */
export const NOT_OPEN_AS_CHECKED=["seedream-5-lite","seedance-2-0-720p-5s","seedance-2-0-720p-10s","seedance-2-0-mini-720p-5s"] as const;
const runtimeNotOpen=()=>((globalThis as {__whoushNotOpen?:Set<string>}).__whoushNotOpen??=new Set<string>());
/** A provider refused this model as not open for the account: stop offering it until the server restarts. */
export const markModelNotOpen=(modelId:string)=>{runtimeNotOpen().add(modelId);};
function notOpen(id:string):boolean{
 const env=process.env.WHOUSH_MODELS_NOT_OPEN;
 const listed=env===undefined?[...NOT_OPEN_AS_CHECKED]:env.trim()==="none"?[]:env.split(",").map(s=>s.trim()).filter(Boolean);
 return listed.includes(id)||runtimeNotOpen().has(id);
}
/** Whether real generation is on at all (owner dev testing or every launch gate): only then is availability worth checking. */
export const realGenerationOn=()=>devLiveTest().enabled||generationGate().blockers.every(b=>b==="model_unspecified");
/** Whether this model can run now: key set, verified path, no hosted media needed, open on the account. */
export function runnableNow(m:MediaModel):boolean{
 return hasProviderCredentials(m.provider)&&m.capabilities.verified&&Boolean(m.verifiedApiPath)&&!needsHostedMedia(m)&&!notOpen(m.id);
}
/** The models to offer: only runnable ones while real generation is on (all of them when none can run, so the turn still gets its demo card). */
export function offerable<T extends MediaModel>(models:readonly T[]):T[]{
 if(!realGenerationOn())return [...models];
 const ok=models.filter(runnableNow);
 return ok.length?ok:[...models];
}
