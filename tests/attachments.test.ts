import {test} from "node:test";
import assert from "node:assert/strict";
import {ATTACHMENT_ACCEPT,ATTACHMENT_KINDS,ATTACHMENT_ROLE_IDS,MAX_ATTACHMENTS,MAX_EXCERPT_CHARS,MAX_TOTAL_ATTACHMENT_BYTES,TAG_PATTERN,allocateTag,describeTagEn,displayTag,insertMention,mentionTrigger,newTagCounters,parseMentions,rewriteMentions,roleLabelFa,rolesFor,sendBlockers,sniffKind,splitMentions,tagMatchesQuery,tagPrefix,textExcerpt,toWireAttachment,validateAttachmentSet,withRole,type AttachmentKind,type LocalAttachment} from "../lib/attachments";
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

const wire=(over:Record<string,unknown>={})=>({id:crypto.randomUUID(),tag:"image1",kind:"image",mime:"image/png",bytes:1234,sha256:"a".repeat(64),role:"character",width:640,height:480,...over});
const doc=(over:Record<string,unknown>={})=>wire({tag:"file1",kind:"md",mime:"text/markdown",width:undefined,height:undefined,role:undefined,textExcerpt:"# hi",...over});
const clip=(over:Record<string,unknown>={})=>wire({tag:"video1",kind:"video",mime:"video/mp4",role:"motion_reference",...over});
const sound=(over:Record<string,unknown>={})=>wire({tag:"audio1",kind:"audio",mime:"audio/mpeg",width:undefined,height:undefined,durationSeconds:30,role:"lip_sync",...over});
const parse=(attachments:unknown)=>CreativeTurnInputSchema.safeParse({text:"a photo of a lake",attachments});
test("schema accepts valid attachments of every kind and keeps them optional",()=>{
 assert.equal(CreativeTurnInputSchema.safeParse({text:"x"}).success,true);
 const list=[wire(),clip({durationSeconds:12.5}),
  sound({speech:{hasSpeech:true,language:"fa",accent:"tehrani"}}),
  wire({tag:"audio2",kind:"audio",mime:"audio/wav",width:undefined,height:undefined,role:"music"}),
  wire({tag:"audio3",kind:"audio",mime:"audio/ogg",width:undefined,height:undefined,role:"voice_clone",consent:true}),
  doc({tag:"file1",kind:"pdf",mime:"application/pdf",textExcerpt:undefined}),doc({tag:"file2"}),doc({tag:"file3",kind:"json",mime:"application/json",textExcerpt:"{}"})];
 const r=parse(list);assert.equal(r.success,true,JSON.stringify(r.error?.issues));
 // every role of every media kind is accepted on its own kind and rejected on the others
 for(const kind of ["image","video","audio"] as const)for(const role of ATTACHMENT_ROLE_IDS){
  const ok=rolesFor(kind).some(r=>r.id===role);
  const base=kind==="image"?wire():kind==="video"?clip():sound();
  assert.equal(parse([{...base,role,...(role==="voice_clone"?{consent:true}:{}),speech:undefined}]).success,ok,kind+" "+role);
 }
});
test("schema rejects names, misplaced fields, bad ids/hashes/mimes, oversize and too many attachments",()=>{
 const bad:Array<[string,unknown]>=[
  ["name",[wire({name:"secret-photo.png"})]],
  ["excerpt on image",[wire({textExcerpt:"hi"})]],
  ["speech on video",[clip({width:undefined,height:undefined,speech:{hasSpeech:true,language:"fa",accent:"unspecified"}})]],
  ["dimensions on audio",[sound({width:640})]],
  ["duration on image",[wire({durationSeconds:3})]],
  ["11 attachments",Array.from({length:11},(_,i)=>wire({tag:"image"+(i+1)}))],
  ["excerpt over 8000",[doc({textExcerpt:"x".repeat(8001)})]],
  ["id not a uuid",[wire({id:"nope"})]],["short hash",[wire({sha256:"abc"})]],["uppercase hash",[wire({sha256:"A".repeat(64)})]],
  ["zero bytes",[wire({bytes:0})]],["fractional bytes",[wire({bytes:1.5})]],["mime of another kind",[wire({mime:"video/mp4"})]],["long mime",[wire({mime:"image/"+"x".repeat(100)})]],
  ["image over cap",[wire({bytes:20*1024*1024+1})]],["json over cap",[doc({kind:"json",mime:"application/json",bytes:1024*1024+1,textExcerpt:"{}"})]],
  ["total over 200 MB",Array.from({length:3},(_,i)=>clip({tag:"video"+(i+1),width:undefined,height:undefined,bytes:100*1024*1024}))],
  ["unknown role",[wire({role:"other"})]],["old role reference",[wire({role:"reference"})]],["old role context",[wire({role:"context"})]],
  ["extra key",[wire({url:"blob:x"})]],["width too large",[wire({width:20001})]],["duration too long",[clip({width:undefined,height:undefined,durationSeconds:3601})]]
 ];
 for(const [label,list] of bad)assert.equal(parse(list).success,false,label);
});
test("tags: prefix must match the kind, be unique, and stay within 1 to 99",()=>{
 for(const tag of ["image1","image9","image10","image99"])assert.equal(parse([wire({tag})]).success,true,tag);
 const bad:Array<[string,unknown]>=[
  ["image0",[wire({tag:"image0"})]],["image100",[wire({tag:"image100"})]],["image01",[wire({tag:"image01"})]],["uppercase",[wire({tag:"Image1"})]],["no number",[wire({tag:"image"})]],
  ["unknown prefix",[wire({tag:"pic1"})]],["missing tag",[wire({tag:undefined})]],["leading @",[wire({tag:"@image1"})]],
  ["image tag on video",[clip({tag:"image1"})]],["video tag on image",[wire({tag:"video1"})]],["audio tag on image",[wire({tag:"audio1"})]],
  ["file tag on image",[wire({tag:"file1"})]],["image tag on md",[doc({tag:"image1"})]],["file tag on audio",[sound({tag:"file1"})]],
  ["duplicate tags",[wire(),wire()]],["duplicate across kinds",[doc({tag:"file1"}),doc({tag:"file1",kind:"json",mime:"application/json",textExcerpt:"{}"})]]
 ];
 for(const [label,list] of bad)assert.equal(parse(list).success,false,label);
 for(const t of ["image1","video12","audio5","file99"])assert.ok(TAG_PATTERN.test(t),t);
 for(const t of ["image0","image100","file","document1"])assert.ok(!TAG_PATTERN.test(t),t);
 assert.deepEqual((["image","video","audio","pdf","json","md"] as AttachmentKind[]).map(tagPrefix),["image","video","audio","file","file","file"]);
});
test("roles: media needs one that fits its kind, files have none, voice_clone needs consent, speech only rides with lip_sync",()=>{
 const bad:Array<[string,unknown]>=[
  ["image without role",[wire({role:undefined})]],["video without role",[clip({role:undefined})]],["audio without role",[sound({role:undefined})]],
  ["image with a video role",[wire({role:"motion_reference"})]],["video with an image role",[clip({role:"character"})]],["audio with an image role",[sound({role:"object"})]],
  ["image with an audio role",[wire({role:"lip_sync"})]],["md with a role",[doc({role:"object"})]],["pdf with a role",[doc({kind:"pdf",mime:"application/pdf",textExcerpt:undefined,role:"music"})]],
  ["voice_clone without consent",[sound({role:"voice_clone"})]],["voice_clone with consent false",[sound({role:"voice_clone",consent:false})]],
  ["consent on lip_sync",[sound({consent:true})]],["consent on an image",[wire({consent:true})]],
  ["speech on music",[sound({role:"music",speech:{hasSpeech:true,language:"fa",accent:"unspecified"}})]],
  ["speech on voice_clone",[sound({role:"voice_clone",consent:true,speech:{hasSpeech:true,language:"fa",accent:"unspecified"}})]]
 ];
 for(const [label,list] of bad)assert.equal(parse(list).success,false,label);
 assert.equal(parse([sound({role:"voice_clone",consent:true})]).success,true);
 assert.equal(parse([sound({speech:{hasSpeech:true,language:"unknown",accent:"unspecified"}})]).success,true);
 assert.equal(roleLabelFa("character"),"کاراکتر");assert.equal(roleLabelFa("edit_reference"),"مرجع ادیت");assert.equal(roleLabelFa("lip_sync"),"الگوی حرکت لب");
 assert.deepEqual(rolesFor("pdf"),[]);assert.deepEqual(rolesFor("image").map(r=>r.id),["character","environment","object","graphic","edit_reference"]);
});

test("the tag allocator counts up per prefix, never reuses a removed number, and resets with a new chat",()=>{
 let c=newTagCounters();const got:string[]=[];
 const take=(k:AttachmentKind)=>{const r=allocateTag(c,k)!;c=r.counters;got.push(r.tag);return r.tag;};
 take("image");take("image");take("video");take("audio");take("pdf");take("md");take("json");take("image");
 assert.deepEqual(got,["image1","image2","video1","audio1","file1","file2","file3","image3"]);
 // removing image2 and image3 from the tray changes nothing: the counters live outside the attachment list
 assert.equal(take("image"),"image4");
 assert.equal(allocateTag(newTagCounters(),"image")!.tag,"image1");
 // the original counters object is not mutated
 const before=newTagCounters();allocateTag(before,"audio");assert.deepEqual(before,newTagCounters());
 // 99 numbers per prefix, then none
 let full=newTagCounters();for(let i=0;i<99;i++)full=allocateTag(full,"video")!.counters;
 assert.equal(full.video,99);assert.equal(allocateTag(full,"video"),undefined);assert.equal(allocateTag(full,"image")!.tag,"image1");
 for(const t of got)assert.ok(TAG_PATTERN.test(t),t);
});

test("mentions: word-boundary, case-insensitive, never inside an email address or a longer number",()=>{
 assert.deepEqual(parseMentions("use @Image1, and @VIDEO2."),["image1","video2"]);
 assert.deepEqual(parseMentions("@image1"),["image1"]);assert.deepEqual(parseMentions("(@audio3)"),["audio3"]);assert.deepEqual(parseMentions("@file12\n@file12"),["file12"]);
 assert.deepEqual(parseMentions("کاراکتر @image1 را در محیط @image2 بگذار"),["image1","image2"]);
 for(const no of ["email@image1.com","a@image1","@image100","@image0","@image","@@image1","x@video1","@images1","_@image1","@image1x","@image12a","@image1_"])assert.deepEqual(parseMentions(no),[],no);
 assert.deepEqual(parseMentions("متن@image1"),[],"a letter right before the @ blocks it");
 assert.deepEqual(splitMentions("a @Image1, b @audio2"),[{text:"a "},{tag:"image1",raw:"@Image1"},{text:", b "},{tag:"audio2",raw:"@audio2"}]);
 assert.deepEqual(splitMentions("plain"),[{text:"plain"}]);assert.deepEqual(splitMentions(""),[]);
});
test("rewriteMentions describes each mention in English and marks a missing tag",()=>{
 const m=new Map([["image1",{tag:"image1",kind:"image" as const,role:"character" as const}],["video1",{tag:"video1",kind:"video" as const,role:"motion_reference" as const}],
  ["audio2",{tag:"audio2",kind:"audio" as const,role:"music" as const}],["file1",{tag:"file1",kind:"md" as const}]]);
 assert.equal(rewriteMentions("@Image1 walks like @video1, to @audio2, per @file1; @image3 and a@image1.com",m),
  "[reference image 1 · character] walks like [motion reference video 1], to [music reference audio 2], per [attached document 1]; [missing attachment] and a@image1.com");
 assert.equal(describeTagEn({tag:"image12",kind:"image",role:"edit_reference"}),"[reference image 12 · edit reference]");
 assert.equal(describeTagEn({tag:"video2",kind:"video",role:"edit_reference"}),"[edit reference video 2]");
 assert.equal(describeTagEn({tag:"audio1",kind:"audio",role:"lip_sync"}),"[lip sync audio 1]");
});
test("displayTag shows the Persian word and Persian digits for every kind and for two-digit numbers",()=>{
 assert.equal(displayTag("image1"),"#تصویر۱");assert.equal(displayTag("video1"),"#ویدیو۱");assert.equal(displayTag("audio1"),"#صدا۱");assert.equal(displayTag("file1"),"#فایل۱");
 assert.equal(displayTag("image12"),"#تصویر۱۲");assert.equal(displayTag("file99"),"#فایل۹۹");assert.equal(displayTag("video10"),"#ویدیو۱۰");
 assert.ok(/^#[\u0600-\u06ff]+[\u06f0-\u06f9]+$/.test(displayTag("audio7")),"Persian digits U+06F0-U+06F9 only");
 for(const kind of Object.keys(ATTACHMENT_KINDS) as AttachmentKind[]){const tag=tagPrefix(kind)+"3";assert.deepEqual(parseMentions(displayTag(tag)),[tag],"the display form parses back to the internal tag");}
});
test("parseMentions accepts Persian, Arabic-script and English spellings with # or @",()=>{
 assert.deepEqual(parseMentions("#تصویر۱"),["image1"]);
 assert.deepEqual(parseMentions("#تصوير١"),["image1"],"Arabic yeh and an Arabic-Indic digit");
 assert.deepEqual(parseMentions("#ویدئو۲"),["video2"]);assert.deepEqual(parseMentions("#ویدیو۲"),["video2"]);assert.deepEqual(parseMentions("@صدا۳"),["audio3"]);
 assert.deepEqual(parseMentions("#فایل1"),["file1"]);assert.deepEqual(parseMentions("@image1"),["image1"]);assert.deepEqual(parseMentions("#image1 @Video2"),["image1","video2"]);
 assert.deepEqual(parseMentions("#فايل٣ و #صدا1"),["file3","audio1"],"Arabic yeh in the word, mixed digit sets");
 assert.deepEqual(parseMentions("#تص\u200cویر۱"),["image1"],"ZWNJ inside the word is dropped");assert.deepEqual(parseMentions("#تصـویر۱"),["image1"],"tatweel inside the word is dropped");
 assert.deepEqual(parseMentions("#تصویر۱، بعد #تصویر۱ و #تصویر۲."),["image1","image2"],"punctuation after is fine; each tag once");
 assert.deepEqual(parseMentions("کاراکتر #تصویر۱ را در #تصویر۱۲ بگذار"),["image1","image12"]);assert.deepEqual(parseMentions("(#صدا۳)"),["audio3"]);
});
test("parseMentions rejects ordinary hashtags, emails, longer numbers and zero",()=>{
 for(const no of ["#نوروز","email@image1.com","#تصویر۱۲۳","#تصویر۰","#تصویر۰۱","#تصویر","#تصویرها۱","متن#تصویر۱","x#صدا۱","##تصویر۱","#تصویر۱ام","#تصویر۱\u200cام","#تصویر۱_","#تصویر۱a","#عکس۱","@@صدا۱"])assert.deepEqual(parseMentions(no),[],no);
 assert.deepEqual(splitMentions("a #تصویر۱، b @Image2"),[{text:"a "},{tag:"image1",raw:"#تصویر۱"},{text:"، b "},{tag:"image2",raw:"@Image2"}]);
});
test("rewriteMentions turns Persian and English mentions into the same English description",()=>{
 const m=new Map([["image1",{tag:"image1",kind:"image" as const,role:"character" as const}],["audio1",{tag:"audio1",kind:"audio" as const,role:"music" as const}]]);
 assert.equal(rewriteMentions("#تصوير١ با @image1 و #صدا۱ و #تصویر۳ و #نوروز",m),"[reference image 1 · character] با [reference image 1 · character] و [music reference audio 1] و [missing attachment] و #نوروز");
});
test("composer helpers: insertMention writes the canonical Persian tag and keeps spacing and the caret",()=>{
 assert.deepEqual(insertMention("",0,0,"image1"),{text:"#تصویر۱ ",caret:8});
 assert.deepEqual(insertMention("hello",5,5,"image1"),{text:"hello #تصویر۱ ",caret:14});
 assert.deepEqual(insertMention("hello ",6,6,"image1"),{text:"hello #تصویر۱ ",caret:14});
 assert.deepEqual(insertMention("hi @im there",3,6,"image1"),{text:"hi #تصویر۱ there",caret:11});
 assert.deepEqual(insertMention("hi #تص there",3,6,"audio12"),{text:"hi #صدا۱۲ there",caret:10});
 assert.deepEqual(insertMention("a @im",2,5,"video1"),{text:"a #ویدیو۱ ",caret:10});
 const r=insertMention("بیا #صد",4,7,"audio2");assert.equal(r.text,"بیا #صدا۲ ");assert.equal(r.text.slice(0,r.caret),"بیا #صدا۲ ");assert.deepEqual(parseMentions(r.text),["audio2"]);
});
test("mentionTrigger opens on # or @ at a word start and closes for ordinary hashtags",()=>{
 assert.deepEqual(mentionTrigger("@",1),{start:0,query:""});assert.deepEqual(mentionTrigger("#",1),{start:0,query:""});assert.deepEqual(mentionTrigger("see @Im",7),{start:4,query:"im"});
 assert.deepEqual(mentionTrigger("x\n@image1",9),{start:2,query:"image1"});assert.deepEqual(mentionTrigger("سلام @aud",9),{start:5,query:"aud"});
 assert.deepEqual(mentionTrigger("سلام #تص",8),{start:5,query:"تص"});assert.deepEqual(mentionTrigger("#صدا",4),{start:0,query:"صدا"});assert.deepEqual(mentionTrigger("#im",3),{start:0,query:"im"});
 assert.deepEqual(mentionTrigger("#تصوير١",7),{start:0,query:"تصویر1"},"the query is normalized");assert.deepEqual(mentionTrigger("#ويدئو",6),{start:0,query:"ویدئو"},"Arabic yeh is unified");
 assert.equal(mentionTrigger("#نوروز",6),undefined,"an ordinary hashtag");assert.equal(mentionTrigger("#ن",2),undefined);assert.equal(mentionTrigger("#تصویر۱۲۳",9),undefined);assert.equal(mentionTrigger("@xyz",4),undefined);
 assert.equal(mentionTrigger("email@im",8),undefined);assert.equal(mentionTrigger("a#تص",4),undefined);assert.equal(mentionTrigger("@im ",4),undefined);assert.equal(mentionTrigger("hello",5),undefined);
 assert.deepEqual(mentionTrigger("#تصویر۱ and more",3),{start:0,query:"تص"});assert.deepEqual(mentionTrigger("@image1 and more",3),{start:0,query:"im"});
});
test("tagMatchesQuery filters by Persian or English word and either digit set",()=>{
 for(const q of ["","ت","تص","تصویر","تصویر۱","تصویر1","تصوير١","im","IM","image","image1"])assert.ok(tagMatchesQuery("image1",q),q);
 for(const q of ["صدا","vid","تصویر۲","image2","image12","نوروز"])assert.ok(!tagMatchesQuery("image1",q),q);
 assert.ok(tagMatchesQuery("audio1","صدا")&&tagMatchesQuery("audio1","au")&&tagMatchesQuery("video2","ویدئو")&&tagMatchesQuery("video2","ویدیو۲")&&tagMatchesQuery("file12","فا")&&tagMatchesQuery("file12","fi")&&tagMatchesQuery("file12","فایل۱"));
});

test("send blockers: media without a role, and voice_clone without consent",()=>{
 const a=(tag:string,kind:AttachmentKind,over:Partial<LocalAttachment>={})=>({id:tag,tag,kind,...over});
 assert.deepEqual(sendBlockers([a("image1","image"),a("video1","video",{role:"motion_reference"}),a("audio1","audio"),a("file1","md"),a("file2","pdf")]),
  [{id:"image1",tag:"image1",reason:"role"},{id:"audio1",tag:"audio1",reason:"role"}]);
 assert.deepEqual(sendBlockers([a("audio1","audio",{role:"voice_clone"})]),[{id:"audio1",tag:"audio1",reason:"consent"}]);
 assert.deepEqual(sendBlockers([a("audio1","audio",{role:"voice_clone",consent:true}),a("image1","image",{role:"object"})]),[]);
});

test("choosing a role drops what belongs to another role and ignores roles the kind cannot have",()=>{
 const audio:LocalAttachment={id:"a",tag:"audio1",kind:"audio",mime:"audio/mpeg",bytes:1,sha256:"a".repeat(64),name:"x.mp3"};
 const lip=withRole(audio,"lip_sync");assert.deepEqual(lip.speech,{hasSpeech:true,language:"unknown",accent:"unspecified"});
 const tuned=withRole({...lip,speech:{hasSpeech:true,language:"fa",accent:"original"}},"lip_sync");assert.equal(tuned.speech?.language,"fa","re-picking the same role keeps the choices");
 const music=withRole(tuned,"music");assert.equal(music.role,"music");assert.ok(!("speech" in music));
 const clone=withRole(music,"voice_clone");assert.equal(clone.role,"voice_clone");assert.ok(!("consent" in clone)&&sendBlockers([clone])[0].reason==="consent");
 assert.equal(withRole({...clone,consent:true},"voice_clone").consent,true);assert.ok(!("consent" in withRole({...clone,consent:true},"music")));
 assert.equal(withRole(audio,"character"),audio,"an image role on audio is ignored");
 assert.equal(withRole({...audio,kind:"md"},"music").role,undefined);
});
test("the wire payload carries metadata only: no name, no object URL, no bytes",()=>{
 const local:LocalAttachment={id:crypto.randomUUID(),tag:"file1",kind:"md",mime:"text/markdown",bytes:12,sha256:"b".repeat(64),name:"private-notes.md",textExcerpt:"# hi",previewUrl:"blob:http://x/1"};
 const w=toWireAttachment(local);
 assert.deepEqual(Object.keys(w).sort(),["bytes","id","kind","mime","sha256","tag","textExcerpt"]);
 assert.ok(!JSON.stringify(w).includes("private-notes")&&!JSON.stringify(w).includes("blob:"));
 assert.equal(CreativeTurnInputSchema.safeParse({text:"x",attachments:[w]}).success,true);
});
test("the wire payload carries role, consent and speech only where they belong",()=>{
 const base={id:crypto.randomUUID(),mime:"audio/mpeg",bytes:99,sha256:"e".repeat(64),name:"voice.mp3",speech:{hasSpeech:true,language:"fa" as const,accent:"unspecified" as const}};
 const lip=toWireAttachment({...base,tag:"audio1",kind:"audio",role:"lip_sync"});
 assert.equal(lip.role,"lip_sync");assert.deepEqual(lip.speech,base.speech);assert.ok(!("consent" in lip));
 const music=toWireAttachment({...base,tag:"audio2",kind:"audio",role:"music",consent:true});
 assert.ok(!("speech" in music)&&!("consent" in music),"speech is for lip_sync only, consent for voice_clone only");
 const clone=toWireAttachment({...base,tag:"audio3",kind:"audio",role:"voice_clone",consent:true});assert.equal(clone.consent,true);
 const unconsented=toWireAttachment({...base,tag:"audio4",kind:"audio",role:"voice_clone"});assert.ok(!("consent" in unconsented));
 assert.equal(CreativeTurnInputSchema.safeParse({text:"x",attachments:[lip,music,clone]}).success,true);
 assert.equal(CreativeTurnInputSchema.safeParse({text:"x",attachments:[unconsented]}).success,false,"the schema is the backstop for a missing consent");
});

test("Persian duration formatting",()=>{assert.equal(faDuration(65),"۱:۰۵");assert.equal(faDuration(7),"۰:۰۷");});
