import "server-only";
import {randomUUID} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
/**
 * Whoush's own copy of generated media (docs/LAUNCH_GATES.md gate 8): some providers return the image bytes themselves (Google), and every provider's
 * links expire. This development store keeps files on the server's disk under `.media/` (git-ignored) and serves them at an unguessable id.
 * Production needs owned object storage and session-scoped access (OWNED_MEDIA_STORAGE_VERIFIED gates live generation until then).
 */
export const MEDIA_ROUTE="/api/generation/media/";
const DIR=path.join(process.cwd(),".media");
export const STORED_MIME=["image/png","image/jpeg","image/webp","video/mp4","video/webm","video/quicktime"] as const;
export type StoredMime=(typeof STORED_MIME)[number];
const EXT:Record<StoredMime,string>={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Stores the bytes and returns the path Whoush serves them at. At most 200 MB per file. */
export async function storeMedia(bytes:Uint8Array,mime:StoredMime):Promise<{id:string;url:string}>{
 if(!STORED_MIME.includes(mime))throw new Error("Unsupported media type");
 if(!bytes.byteLength||bytes.byteLength>200*1024*1024)throw new Error("Media size out of range");
 const id=randomUUID();await fs.mkdir(DIR,{recursive:true});
 await fs.writeFile(path.join(DIR,id+"."+EXT[mime]),bytes);
 return {id,url:MEDIA_ROUTE+id};
}
/** Downloads a provider's result and stores it (its link may expire, or need the provider key). Only https, only a stored media type. */
/** `fallback`: the type to assume when the link does not say (a bare object-store download), so a good result is never retried forever. */
export async function mirrorMedia(url:string,headers?:Record<string,string>,fallback?:StoredMime):Promise<{id:string;url:string;mime:StoredMime}>{
 if(new URL(url).protocol!=="https:")throw new Error("Only https media is mirrored");
 const r=await fetch(url,{headers,cache:"no-store",signal:AbortSignal.timeout(120_000)});
 if(!r.ok)throw new Error("Media download failed: "+r.status);
 const said=(r.headers.get("content-type")??"").split(";")[0].trim().toLowerCase();
 const mime=(STORED_MIME as readonly string[]).includes(said)?said as StoredMime:fallback&&(!said||said==="application/octet-stream"||said==="binary/octet-stream")?fallback:undefined;
 if(!mime)throw new Error("Unsupported media type");
 const s=await storeMedia(new Uint8Array(await r.arrayBuffer()),mime);return {...s,mime};
}
export async function readMedia(id:string):Promise<{bytes:Buffer;mime:StoredMime}|undefined>{
 if(!ID.test(id))return undefined;
 for(const mime of STORED_MIME){try{return {bytes:await fs.readFile(path.join(DIR,id+"."+EXT[mime])),mime};}catch{/* next type */}}
 return undefined;
}
/** Whether an output URL is one this store serves. */
export const isStoredMediaUrl=(u:string)=>u.startsWith(MEDIA_ROUTE)&&ID.test(u.slice(MEDIA_ROUTE.length));
