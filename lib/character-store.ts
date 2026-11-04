"use client";
import {validateCharacterProfile,type CharacterProfile} from "./characters";
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
export async function listLocalCharacters():Promise<CharacterProfile[]>{
 const all=await withDB<CharacterProfile[]>("readonly",store=>store.getAll());
 return all.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
export async function getLocalCharacter(id:string):Promise<CharacterProfile|undefined>{
 if(!/^[a-z0-9-]{8,80}$/i.test(id))return undefined;
 return withDB<CharacterProfile|undefined>("readonly",store=>store.get(id));
}
export async function saveLocalCharacter(character:CharacterProfile):Promise<void>{
 validateCharacterProfile(character);
 await withDB<IDBValidKey>("readwrite",store=>store.put(character));
}
export async function deleteLocalCharacter(id:string):Promise<void>{
 await withDB<undefined>("readwrite",store=>store.delete(id));
}
