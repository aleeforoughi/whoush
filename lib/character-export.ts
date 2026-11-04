"use client";
import {CHARACTER_VIEWS,buildCharacterManifest,characterExportBaseName,type CharacterProfile} from "./characters";
import {fa,faDate} from "./format";

/** Reads the colors of the live theme through the browser, so the sheet matches light or dark and never hard-codes a color. */
function themeColors(){
 const probe=document.createElement("span");probe.style.display="none";document.body.appendChild(probe);
 const resolve=(variable:string,fallback:string)=>{probe.style.color=fallback;probe.style.color="var("+variable+", "+fallback+")";return getComputedStyle(probe).color;};
 const colors={
  background:resolve("--background","canvas"),card:resolve("--card","canvas"),text:resolve("--text-primary","canvastext"),
  muted:resolve("--text-secondary","graytext"),line:resolve("--border-secondary","gray"),
  font:getComputedStyle(document.body).fontFamily||"sans-serif"
 };
 probe.remove();
 return colors;
}
async function drawReference(ctx:CanvasRenderingContext2D,blob:Blob,x:number,y:number,w:number,h:number):Promise<void>{
 const url=URL.createObjectURL(blob);
 const img=new window.Image();
 try{
  await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("تصویر قابل نمایش نیست."));img.src=url;});
  const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
  ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
 }finally{URL.revokeObjectURL(url);}
}
function download(blob:Blob,fileName:string){
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=fileName;a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/**
 * PNG contact sheet of the saved references. Views without a photo are marked «ارائه نشده / Not provided»;
 * nothing is ever drawn in their place.
 */
export async function exportReferenceSheet(profile:CharacterProfile):Promise<string>{
 const width=1500,height=1260,margin=32,gap=16,header=160;
 const cols=3,cellW=(width-2*margin-(cols-1)*gap)/cols,cellH=(height-header-margin-gap)/2,label=56;
 await document.fonts.ready;
 const c=themeColors();
 const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("خروجی تصویر در این مرورگر پشتیبانی نمی‌شود.");
 ctx.fillStyle=c.background;ctx.fillRect(0,0,width,height);
 // The sheet reads right to left: title at the right edge, the first view in the top right cell.
 ctx.direction="rtl";ctx.textAlign="right";ctx.textBaseline="alphabetic";
 ctx.fillStyle=c.text;ctx.font="700 40px "+c.font;ctx.fillText(profile.name,width-margin,64,width-2*margin);
 ctx.fillStyle=c.muted;ctx.font="500 22px "+c.font;
 ctx.direction="ltr";ctx.textAlign="right";ctx.fillText("WHOUSH · CHARACTER REFERENCE SHEET",width-margin,100);
 ctx.direction="rtl";ctx.font="22px "+c.font;
 const consent=profile.consent?"تأیید رضایت: "+faDate(profile.consent.confirmedAt):"رضایت ثبت نشده";
 ctx.fillText("نسخهٔ "+fa(profile.version)+" · "+consent+" · فقط مرجع برنامه‌ریزی؛ قفل چهره تضمین‌شده نیست",width-margin,136,width-2*margin);
 for(let i=0;i<CHARACTER_VIEWS.length;i++){
  const view=CHARACTER_VIEWS[i],col=i%cols,row=Math.floor(i/cols);
  const x=width-margin-cellW-col*(cellW+gap),y=header+row*(cellH+gap);
  ctx.fillStyle=c.card;ctx.fillRect(x,y,cellW,cellH);
  ctx.strokeStyle=c.line;ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,cellW-1,cellH-1);
  const blob=profile.references[view.id];
  if(blob)await drawReference(ctx,blob,x+8,y+8,cellW-16,cellH-label-16);
  else{
   ctx.fillStyle=c.muted;ctx.font="24px "+c.font;ctx.textAlign="center";ctx.direction="rtl";
   ctx.fillText("ارائه نشده / Not provided",x+cellW/2,y+(cellH-label)/2);
   ctx.textAlign="right";
  }
  ctx.fillStyle=c.background;ctx.fillRect(x,y+cellH-label,cellW,label);
  ctx.fillStyle=c.text;ctx.font="600 22px "+c.font;ctx.direction="rtl";ctx.textAlign="right";
  ctx.fillText(view.title+(view.required?"":" (اختیاری)"),x+cellW-16,y+cellH-20,cellW*0.6);
  ctx.fillStyle=c.muted;ctx.font="20px "+c.font;ctx.direction="ltr";ctx.textAlign="left";
  ctx.fillText(view.english,x+16,y+cellH-20);
 }
 const out=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("خروجی تصویر ناموفق بود.")),"image/png"));
 const fileName=characterExportBaseName(profile)+"-reference-sheet.png";
 download(out,fileName);
 return fileName;
}
/** JSON description of the profile without any image data. */
export function exportManifest(profile:CharacterProfile):string{
 const manifest=buildCharacterManifest(profile,new Date().toISOString());
 const fileName=characterExportBaseName(profile)+"-manifest.json";
 download(new Blob([JSON.stringify(manifest,null,2)],{type:"application/json"}),fileName);
 return fileName;
}
