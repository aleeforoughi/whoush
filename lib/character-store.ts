"use client";
import {CHARACTER_VIEWS,buildReferenceMeta,migrateCharacterProfile,sha256Hex,validateCharacterProfile,type CharacterProfile,type StoredCharacterRecord} from "./characters";
import {readImageSize} from "./character-files";
const DB_NAME="whoush-local-characters";
const STORE="profiles";
export const LOCAL_CHARACTERS_ONLY=true;
function openCharactersDB():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof window==="undefined"||!("indexedDB" in window)){reject(new Error("ذخیره‌سازی محلی در این مرورگر در دسترس نیست."));return;}
  const req=window.indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"id"});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error??new Error("خطا در باز کردن کتابخانه کاراکترها."));
 });
}
async function withDB<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await openCharactersDB();
 return new Promise((resolve,reject)=>{
  let result:T;
  let finished=false;
  const tx=db.transaction(STORE,mode);
  const request=work(tx.objectStore(STORE));
  request.onsuccess=()=>{result=request.result;};
  request.onerror=()=>{ /* tx abort handles errors */ };
  tx.oncomplete=()=>{finished=true;db.close();resolve(result);};
  tx.onabort=tx.onerror=()=>{if(finished)return;finished=true;db.close();reject(tx.error??request.error??new Error("ثبت کاراکتر ناموفق بود."));};
 });
}
/**
 * Brings a stored record up to the current shape. Profiles saved before reference metadata existed get it computed from
 * the stored images; their `addedAt` is the profile's last save time (the real time is unknown). Nothing is written back
 * here: the upgraded form is stored the next time the person saves.
 */
async function hydrate(raw:StoredCharacterRecord):Promise<CharacterProfile>{
 const profile=migrateCharacterProfile(raw);
 const meta={...profile.referenceMeta};
 for(const v of CHARACTER_VIEWS){
  const blob=profile.references[v.id];
  if(!(blob instanceof Blob)||meta[v.id])continue;
  try{
   const {width,height}=await readImageSize(blob);
   meta[v.id]=buildReferenceMeta({width,height,blob,sha256:await sha256Hex(blob),addedAt:profile.updatedAt});
  }catch{ /* an unreadable legacy image simply has no metadata; saving will ask for it again */ }
 }
 return {...profile,referenceMeta:meta};
}
export async function listLocalCharacters():Promise<CharacterProfile[]>{
 const all=await withDB<StoredCharacterRecord[]>("readonly",store=>store.getAll());
 const profiles=await Promise.all(all.map(hydrate));
 return profiles.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
export async function getLocalCharacter(id:string):Promise<CharacterProfile|undefined>{
 if(!/^[a-z0-9-]{8,80}$/i.test(id))return undefined;
 const raw=await withDB<StoredCharacterRecord|undefined>("readonly",store=>store.get(id));
 return raw?hydrate(raw):undefined;
}
export async function saveLocalCharacter(character:CharacterProfile):Promise<void>{
 validateCharacterProfile(character);
 await withDB<IDBValidKey>("readwrite",store=>store.put(character));
}
/** Withdrawing consent and deleting are the same act: the profile and all its images leave this browser. */
export async function deleteLocalCharacter(id:string):Promise<void>{
 await withDB<undefined>("readwrite",store=>store.delete(id));
}
