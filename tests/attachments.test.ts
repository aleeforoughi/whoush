import {test} from "node:test";
import assert from "node:assert/strict";
import {ATTACHMENT_ACCEPT,ATTACHMENT_KINDS,MAX_ATTACHMENTS,MAX_EXCERPT_CHARS,MAX_TOTAL_ATTACHMENT_BYTES,sniffKind,textExcerpt,toWireAttachment,validateAttachmentSet,type AttachmentKind,type LocalAttachment} from "../lib/attachments";
import {CreativeTurnInputSchema} from "../lib/creative-plan";
import {faDuration} from "../lib/format";

// Tiny hand-made byte arrays: signature plus padding, never real media.
const enc=(s:string)=>new TextEncoder().encode(s);
const bytes=(...parts:Array<number[]|string>)=>Uint8Array.from(parts.flatMap(p=>typeof p==="string"?[...p].map(c=>c.charCodeAt(0)):p));
const pad=(n:number)=>new Array(n).fill(0);
const SIGS={
 jpeg:bytes([0xff,0xd8,0xff,0xe0],pad(8)),png:bytes([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],pad(8)),webp:bytes("RIFF",pad(4),"WEBP",pad(4)),
 mp4:bytes(pad(3),[0x18],"ftypisom",pad(4)),mov:bytes(pad(3),[0x14],"ftypqt  ",pad(4)),m4a:bytes(pad(3),[0x18],"ftypM4A ",pad(4)),
 webm:bytes([0x1a,0x45,0xdf,0xa3],pad(8)),mp3id3:bytes("ID3",pad(8)),mp3sync:bytes([0xff,0xfb,0x90,0x00],pad(8)),wav:bytes("RIFF",pad(4),"WAVEfmt ",pad(4)),
 ogg:bytes("OggS",pad(8)),pdf:bytes("%PDF-1.7\n",pad(4))
};
const kindOf=(b:Uint8Array,mime:string,name:string,size?:number)=>{const r=sniffKind(b,mime,name,size);return r.ok?r.kind+":"+r.mime:"rejected";};

test("every supported signature is accepted with the right kind and canonical mime",()=>{
 const cases:Array<[Uint8Array,string,string,string]>=[
  [SIGS.jpeg,"image/jpeg","a.jpg","image:image/jpeg"],[SIGS.png,"image/png","a.png","image:image/png"],[SIGS.webp,"image/webp","a.webp","image:image/webp"],
  [SIGS.mp4,"video/mp4","a.mp4","video:video/mp4"],[SIGS.mov,"video/quicktime","a.mov","video:video/quicktime"],[SIGS.webm,"video/webm","a.webm","video:video/webm"],
  [SIGS.webm,"audio/webm","a.webm","audio:audio/webm"],
  [SIGS.m4a,"audio/mp4","a.m4a","audio:audio/mp4"],[SIGS.m4a,"audio/x-m4a","a.m4a","audio:audio/mp4"],
  [SIGS.mp3id3,"audio/mpeg","a.mp3","audio:audio/mpeg"],[SIGS.mp3sync,"audio/mpeg","a.mp3","audio:audio/mpeg"],
  [SIGS.wav,"audio/wav","a.wav","audio:audio/wav"],[SIGS.wav,"audio/x-wav","a.wav","audio:audio/wav"],[SIGS.ogg,"audio/ogg","a.ogg","audio:audio/ogg"],
  [SIGS.pdf,"application/pdf","a.pdf","pdf:application/pdf"],
  [enc("{\"a\":1}"),"application/json","a.json","json:application/json"],
  [enc("# سلام"),"text/markdown","a.md","md:text/markdown"],[enc("# x"),"text/x-markdown","a.markdown","md:text/markdown"],[enc("# x"),"text/plain","notes.md","md:text/markdown"],
  [SIGS.png,"","clip","image:image/png"],[SIGS.png,"application/octet-stream","image","image:image/png"]
 ];
 for(const [b,mime,name,want] of cases)assert.equal(kindOf(b,mime,name),want,mime+" "+name);
 assert.ok(ATTACHMENT_ACCEPT.includes(".md")&&ATTACHMENT_ACCEPT.includes("audio/webm"));
});

test("a declared type or extension that disagrees with the bytes is rejected with a Persian reason",()=>{
 const rejected=(b:Uint8Array,mime:string,name:string)=>{const r=sniffKind(b,mime,name);assert.equal(r.ok,false,mime+" "+name);return (r as {error:string}).error;};
 assert.match(rejected(SIGS.png,"video/mp4","clip.mp4"),/[؀-ۿ]/);
 rejected(SIGS.png,"image/jpeg","a.png");rejected(SIGS.pdf,"application/json","a.json");rejected(SIGS.pdf,"application/pdf","notes.json");rejected(SIGS.jpeg,"image/jpeg","a.png");
 rejected(SIGS.m4a,"video/mp4","a.mp4");rejected(SIGS.mp4,"audio/mp4","a.m4a");rejected(SIGS.png,"text/markdown","a.md");rejected(enc("{}"),"text/plain","a.json");
 rejected(enc("# x"),"text/plain","a.txt");rejected(enc("{}"),"application/json","a.md");
});

test("invalid UTF-8, invalid JSON, SVG, HTML, executables and empty files are rejected",()=>{
 const no=(b:Uint8Array,mime:string,name:string,why:RegExp)=>{const r=sniffKind(b,mime,name);assert.equal(r.ok,false,name);assert.match((r as {error:string}).error,why,name);};
 no(Uint8Array.from([0x23,0x20,0xff,0xfe,0xfd]),"text/markdown","a.md",/UTF-8/);
 no(enc("{nope"),"application/json","a.json",/JSON/);
 no(enc("<svg xmlns='http://www.w3.org/2000/svg'/>"),"image/svg+xml","a.svg",/پشتیبانی/);
 no(enc("<svg xmlns='http://www.w3.org/2000/svg'/>"),"text/markdown","a.md",/SVG/);
 no(enc("<!DOCTYPE html><html></html>"),"text/html","a.html",/پشتیبانی/);
 no(enc("<html><body>x</body></html>"),"text/markdown","a.md",/HTML/);
 no(Uint8Array.from([0x4d,0x5a,0x90,0x00,0x03,0x00]),"application/x-msdownload","a.exe",/پشتیبانی/);
 no(Uint8Array.from([0x4d,0x5a,0x90,0x00]),"text/markdown","a.md",/پشتیبانی|UTF-8/);
 no(new Uint8Array(0),"image/png","a.png",/خالی/);
 no(enc("a\0b"),"text/markdown","a.md",/UTF-8/);
});

test("size caps are per kind, and text kinds need the whole file",()=>{
 const MB=1024*1024;
 assert.equal(kindOf(SIGS.png,"image/png","a.png",20*MB),"image:image/png");
 assert.equal(kindOf(SIGS.png,"image/png","a.png",20*MB+1),"rejected");
 assert.equal(kindOf(SIGS.mp4,"video/mp4","a.mp4",100*MB),"video:video/mp4");assert.equal(kindOf(SIGS.mp4,"video/mp4","a.mp4",100*MB+1),"rejected");
 assert.equal(kindOf(SIGS.wav,"audio/wav","a.wav",25*MB+1),"rejected");assert.equal(kindOf(SIGS.pdf,"application/pdf","a.pdf",20*MB+1),"rejected");
 assert.equal(kindOf(enc("{}"),"application/json","a.json",1*MB+1),"rejected");
 assert.equal(kindOf(enc("# x"),"text/markdown","a.md",2*MB),"rejected");
 for(const k of Object.keys(ATTACHMENT_KINDS) as AttachmentKind[])assert.ok(ATTACHMENT_KINDS[k].maxBytes>0);
});

test("attachment sets: at most 10 files and 200 MB in total",()=>{
 const ok=Array.from({length:MAX_ATTACHMENTS},()=>({bytes:1}));
 assert.equal(validateAttachmentSet(ok).ok,true);
 const many=validateAttachmentSet([...ok,{bytes:1}]);assert.equal(many.ok,false);assert.match((many as {error:string}).error,/[؀-ۿ]/);
 assert.equal(validateAttachmentSet([{bytes:MAX_TOTAL_ATTACHMENT_BYTES}]).ok,true);
 assert.equal(validateAttachmentSet([{bytes:MAX_TOTAL_ATTACHMENT_BYTES},{bytes:1}]).ok,false);
});

test("text excerpts: first 8000 chars, JSON compact, no half surrogate pair",()=>{
 assert.equal(textExcerpt("md","x".repeat(9000)).length,MAX_EXCERPT_CHARS);
 assert.equal(textExcerpt("json",'{ "a" : [ 1, 2 ] }'),'{"a":[1,2]}');
 const emoji=textExcerpt("md","x".repeat(MAX_EXCERPT_CHARS-1)+"😀");assert.equal(emoji.length,MAX_EXCERPT_CHARS-1);
 const r=sniffKind(enc("# عنوان\nمتن"),"text/markdown","a.md");assert.ok(r.ok&&r.textExcerpt==="# عنوان\nمتن");
});

const wire=(over:Record<string,unknown>={})=>({id:crypto.randomUUID(),kind:"image",mime:"image/png",bytes:1234,sha256:"a".repeat(64),role:"reference",width:640,height:480,...over});
const parse=(attachments:unknown)=>CreativeTurnInputSchema.safeParse({text:"a photo of a lake",attachments});
test("schema accepts valid attachments of every kind and keeps them optional",()=>{
 assert.equal(CreativeTurnInputSchema.safeParse({text:"x"}).success,true);
 const list=[wire(),wire({kind:"video",mime:"video/mp4",durationSeconds:12.5}),
  wire({kind:"audio",mime:"audio/mpeg",width:undefined,height:undefined,durationSeconds:30,speech:{hasSpeech:true,language:"fa",accent:"tehrani"}}),
  wire({kind:"pdf",mime:"application/pdf",width:undefined,height:undefined,role:"context"}),
  wire({kind:"md",mime:"text/markdown",width:undefined,height:undefined,role:"context",textExcerpt:"# hi"}),
  wire({kind:"json",mime:"application/json",width:undefined,height:undefined,role:"context",textExcerpt:"{}"})];
 const r=parse(list);assert.equal(r.success,true,JSON.stringify(r.error?.issues));
});
test("schema rejects names, misplaced fields, bad ids/hashes/mimes, oversize and too many attachments",()=>{
 const bad:Array<[string,unknown]>=[
  ["name",[wire({name:"secret-photo.png"})]],
  ["excerpt on image",[wire({textExcerpt:"hi"})]],
  ["speech on video",[wire({kind:"video",mime:"video/mp4",width:undefined,height:undefined,speech:{hasSpeech:true,language:"fa",accent:"unspecified"}})]],
  ["dimensions on audio",[wire({kind:"audio",mime:"audio/mpeg"})]],
  ["duration on image",[wire({durationSeconds:3})]],
  ["11 attachments",Array.from({length:11},()=>wire())],
  ["excerpt over 8000",[wire({kind:"md",mime:"text/markdown",width:undefined,height:undefined,role:"context",textExcerpt:"x".repeat(8001)})]],
  ["id not a uuid",[wire({id:"nope"})]],["short hash",[wire({sha256:"abc"})]],["uppercase hash",[wire({sha256:"A".repeat(64)})]],
  ["zero bytes",[wire({bytes:0})]],["fractional bytes",[wire({bytes:1.5})]],["mime of another kind",[wire({mime:"video/mp4"})]],["long mime",[wire({mime:"image/"+"x".repeat(100)})]],
  ["image over cap",[wire({bytes:20*1024*1024+1})]],["json over cap",[wire({kind:"json",mime:"application/json",width:undefined,height:undefined,bytes:1024*1024+1,textExcerpt:"{}"})]],
  ["total over 200 MB",Array.from({length:3},()=>wire({kind:"video",mime:"video/mp4",width:undefined,height:undefined,bytes:100*1024*1024}))],
  ["bad role",[wire({role:"other"})]],["extra key",[wire({url:"blob:x"})]],["width too large",[wire({width:20001})]],["duration too long",[wire({kind:"video",mime:"video/mp4",width:undefined,height:undefined,durationSeconds:3601})]]
 ];
 for(const [label,list] of bad)assert.equal(parse(list).success,false,label);
});

test("the wire payload carries metadata only: no name, no object URL, no bytes",()=>{
 const local:LocalAttachment={id:crypto.randomUUID(),kind:"md",mime:"text/markdown",bytes:12,sha256:"b".repeat(64),name:"private-notes.md",role:"context",textExcerpt:"# hi",previewUrl:"blob:http://x/1"};
 const w=toWireAttachment(local);
 assert.deepEqual(Object.keys(w).sort(),["bytes","id","kind","mime","role","sha256","textExcerpt"]);
 assert.ok(!JSON.stringify(w).includes("private-notes")&&!JSON.stringify(w).includes("blob:"));
 assert.equal(CreativeTurnInputSchema.safeParse({text:"x",attachments:[w]}).success,true);
});

test("Persian duration formatting",()=>{assert.equal(faDuration(65),"۱:۰۵");assert.equal(faDuration(7),"۰:۰۷");});
