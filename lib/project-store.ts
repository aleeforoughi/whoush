"use client";
import {cleanTitle,parseProject,summarize,validateProject,sortRecent,type Project,type ProjectSummary,type StoredAsset} from "./projects";
const DB_NAME="whoush-local-projects";
const PROJECTS="projects";
const ASSETS="assets";
const BY_PROJECT="projectId";
export const STORAGE_UNAVAILABLE_FA="ذخیره‌سازی محلی در این مرورگر در دسترس نیست؛ گفت‌وگو فقط تا بستن صفحه می‌ماند.";
export const STORAGE_FULL_FA="فضای ذخیره‌سازی مرورگر پر است؛ این فایل فقط تا بستن صفحه در دسترس است";
const CHANGED_EVENT="whoush-projects-changed";
const CHANNEL="whoush-projects";

function openDB():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof window==="undefined"||!("indexedDB" in window)){reject(new Error(STORAGE_UNAVAILABLE_FA));return;}
  let req:IDBOpenDBRequest;
  try{req=window.indexedDB.open(DB_NAME,1);}catch{reject(new Error(STORAGE_UNAVAILABLE_FA));return;}
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(PROJECTS))db.createObjectStore(PROJECTS,{keyPath:"id"});
   if(!db.objectStoreNames.contains(ASSETS))db.createObjectStore(ASSETS,{keyPath:"id"}).createIndex(BY_PROJECT,BY_PROJECT);
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(new Error(STORAGE_UNAVAILABLE_FA));
  req.onblocked=()=>reject(new Error("پایگاه ذخیره‌سازی توسط تب دیگری قفل شده است؛ آن را ببند و دوباره امتحان کن."));
 });
}
/** A write that failed because the browser has no room left. */
export class StorageFullError extends Error{constructor(){super(STORAGE_FULL_FA);this.name="StorageFullError";}}
const isQuota=(e:unknown)=>typeof e==="object"&&e!==null&&(e as {name?:string}).name==="QuotaExceededError";
/** One transaction over the given stores. `work` issues requests and returns the one whose result is wanted (or nothing). */
async function run<T>(stores:string[],mode:IDBTransactionMode,work:(tx:IDBTransaction)=>IDBRequest<T>|void,failure:string):Promise<T|undefined>{
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  let result:T|undefined,finished=false,request:IDBRequest<T>|undefined;
  const done=(fn:()=>void)=>{if(finished)return;finished=true;db.close();fn();};
  try{
   const tx=db.transaction(stores,mode);
   const issued=work(tx);
   request=issued||undefined;
   if(request){const r=request;r.onsuccess=()=>{result=r.result;};}
   tx.oncomplete=()=>done(()=>resolve(result));
   tx.onabort=tx.onerror=()=>done(()=>{
    const err=tx.error??(request?.error??null);
    reject(isQuota(err)?new StorageFullError():new Error(failure));
   });
  }catch(e){done(()=>reject(isQuota(e)?new StorageFullError():new Error(failure)));}
 });
}

// ---- change notifications: the rail and the assets page refresh when anything is saved, renamed or deleted (also from another tab) ----
const channel=()=>typeof BroadcastChannel==="undefined"?undefined:new BroadcastChannel(CHANNEL);
function notify(){
 if(typeof window==="undefined")return;
 window.dispatchEvent(new Event(CHANGED_EVENT));
 try{const c=channel();c?.postMessage("changed");c?.close();}catch{ /* other tabs refresh on their next focus */ }
}
export function subscribeProjects(cb:()=>void):()=>void{
 window.addEventListener(CHANGED_EVENT,cb);
 let c:BroadcastChannel|undefined;
 try{c=channel();if(c)c.onmessage=cb;}catch{ /* same-tab updates still work */ }
 return()=>{window.removeEventListener(CHANGED_EVENT,cb);c?.close();};
}

// ---- projects ----
/** The recent projects, newest first, without their transcripts. Records that do not validate are skipped. */
export async function listProjects():Promise<ProjectSummary[]>{
 const all=await run<unknown[]>([PROJECTS],"readonly",tx=>tx.objectStore(PROJECTS).getAll(),"خواندن پروژه‌ها ناموفق بود.");
 return sortRecent((all??[]).map(parseProject).filter((p):p is Project=>p!==undefined).map(summarize));
}
export async function getProject(id:string):Promise<Project|undefined>{
 const raw=await run<unknown>([PROJECTS],"readonly",tx=>tx.objectStore(PROJECTS).get(id),"خواندن پروژه ناموفق بود.");
 return raw===undefined?undefined:parseProject(raw);
}
export async function saveProject(project:Project):Promise<void>{
 validateProject(project);
 await run<IDBValidKey>([PROJECTS],"readwrite",tx=>tx.objectStore(PROJECTS).put(project),"ذخیرهٔ پروژه ناموفق بود.");
 notify();
}
/** Renames in place (`titleSource: "user"`); the project keeps its place in the recent list. Resolves false if the project no longer exists. */
export async function renameProject(id:string,title:string):Promise<boolean>{
 const clean=cleanTitle(title);
 if(!clean)throw new Error("عنوان باید بین ۱ تا ۸۰ نویسه باشد.");
 const current=await getProject(id);
 if(!current)return false;
 await saveProject({...current,title:clean,titleSource:"user"});
 return true;
}
/** The project and all its files leave this browser in one transaction. */
export async function deleteProject(id:string):Promise<void>{
 await run<undefined>([PROJECTS,ASSETS],"readwrite",tx=>{
  tx.objectStore(PROJECTS).delete(id);
  const assets=tx.objectStore(ASSETS),keys=assets.index(BY_PROJECT).getAllKeys(id);
  keys.onsuccess=()=>{for(const k of keys.result)assets.delete(k);};
 },"حذف پروژه ناموفق بود.");
 notify();
}

// ---- assets ----
/** Stores a file with its bytes; when the browser is out of room, stores its details alone and resolves "metadata_only" so the caller can tell the person. */
export async function saveAsset(asset:StoredAsset):Promise<"stored"|"metadata_only">{
 try{
  await run<IDBValidKey>([ASSETS],"readwrite",tx=>tx.objectStore(ASSETS).put(asset),"ذخیرهٔ فایل ناموفق بود.");
  notify();return "stored";
 }catch(e){
  if(!(e instanceof StorageFullError)||!asset.blob)throw e;
 }
 const {blob:_blob,...bare}=asset;void _blob;
 await run<IDBValidKey>([ASSETS],"readwrite",tx=>tx.objectStore(ASSETS).put(bare),"ذخیرهٔ فایل ناموفق بود.");
 notify();return "metadata_only";
}
/** Every stored file, or those of one project. */
export async function listAssets(projectId?:string):Promise<StoredAsset[]>{
 const rows=await run<StoredAsset[]>([ASSETS],"readonly",tx=>{
  const store=tx.objectStore(ASSETS);
  return projectId?store.index(BY_PROJECT).getAll(projectId):store.getAll();
 },"خواندن فایل‌ها ناموفق بود.");
 return rows??[];
}
