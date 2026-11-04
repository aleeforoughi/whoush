"use client";
import {ALLOWED_CHARACTER_IMAGE_TYPES,MAX_CHARACTER_IMAGE_BYTES,MIN_CHARACTER_IMAGE_SIDE,buildReferenceMeta,sha256Hex,type ReferenceMeta} from "./characters";
/** Reads the pixel size of an image blob in the browser; rejects when it cannot be decoded. */
export function readImageSize(blob:Blob):Promise<{width:number;height:number}>{
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(blob);
  const img=new window.Image();
  img.onload=()=>{URL.revokeObjectURL(url);resolve({width:img.naturalWidth,height:img.naturalHeight});};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("تصویر بارگذاری‌شده قابل خواندن نیست."));};
  img.src=url;
 });
}
/** Validates a user-chosen file (type, size, pixels) and returns its stored metadata. */
export async function describeReferenceFile(file:File,addedAt:string):Promise<ReferenceMeta>{
 if(!(ALLOWED_CHARACTER_IMAGE_TYPES as readonly string[]).includes(file.type)||file.size>MAX_CHARACTER_IMAGE_BYTES)
  throw new Error("فقط عکس‌های JPEG، PNG یا WebP تا ۸ مگابایت مجازند.");
 const {width,height}=await readImageSize(file);
 if(width<MIN_CHARACTER_IMAGE_SIDE||height<MIN_CHARACTER_IMAGE_SIDE)throw new Error("تصویر باید حداقل ۵۱۲ پیکسل عرض و ارتفاع داشته باشد.");
 return buildReferenceMeta({width,height,blob:file,sha256:await sha256Hex(file),addedAt});
}
