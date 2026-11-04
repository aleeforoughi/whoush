import {test} from "node:test";
import assert from "node:assert/strict";
import {ATTACHMENT_ACCEPT,acceptFor,roleAllowed,ATTACHMENT_KINDS,ATTACHMENT_ROLE_IDS,MAX_ATTACHMENTS,MAX_EXCERPT_CHARS,MAX_TOTAL_ATTACHMENT_BYTES,TAG_PATTERN,allocateTag,describeTagEn,displayTag,insertMention,mentionTrigger,newTagCounters,parseMentions,rewriteMentions,roleLabelFa,rolesFor,sniffKind,splitMentions,tagMatchesQuery,tagPrefix,textExcerpt,toWireAttachment,validateAttachmentSet,withRole,withoutRole,inferAttachmentRoles,type AttachmentKind,type AttachmentRole,type LocalAttachment} from "../lib/attachments";
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
  const ok=roleAllowed(kind,role);
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
test("roles: media may have none, a role must fit its kind, files have none, voice_clone needs consent, speech only rides with lip_sync",()=>{
 const bad:Array<[string,unknown]>=[
  ["general is internal only",[wire({role:"general"})]],["general on video",[clip({role:"general"})]],["general on audio",[sound({role:"general"})]],["speech on audio without a role",[sound({role:undefined,speech:{hasSpeech:true,language:"fa",accent:"unspecified"}})]],
  ["image with a video role",[wire({role:"motion_reference"})]],["video with an image role",[clip({role:"character"})]],["audio with an image role",[sound({role:"object"})]],
  ["image with an audio role",[wire({role:"lip_sync"})]],["md with a role",[doc({role:"object"})]],["pdf with a role",[doc({kind:"pdf",mime:"application/pdf",textExcerpt:undefined,role:"music"})]],
  ["voice_clone without consent",[sound({role:"voice_clone"})]],["voice_clone with consent false",[sound({role:"voice_clone",consent:false})]],
  ["consent on lip_sync",[sound({consent:true})]],["consent on an image",[wire({consent:true})]],
  ["speech on music",[sound({role:"music",speech:{hasSpeech:true,language:"fa",accent:"unspecified"}})]],
  ["speech on voice_clone",[sound({role:"voice_clone",consent:true,speech:{hasSpeech:true,language:"fa",accent:"unspecified"}})]]
 ];
 for(const [label,list] of bad)assert.equal(parse(list).success,false,label);
 for(const [label,list] of [["image","wire"],["video","clip"],["audio","sound"]].map(([l,f])=>[l,[({wire,clip,sound} as Record<string,typeof wire>)[f]({role:undefined})]] as const))assert.equal(parse(list).success,true,label+" without a role is valid: Whoush infers it");
 assert.equal(parse([sound({role:"voice_clone",consent:true})]).success,true);
 assert.equal(parse([sound({speech:{hasSpeech:true,language:"unknown",accent:"unspecified"}})]).success,true);
 assert.equal(roleLabelFa("character"),"کاراکتر");assert.equal(roleLabelFa("edit_reference"),"ادیت عکس");assert.equal(roleLabelFa("edit_reference","video"),"ادیت ویدیو");assert.equal(roleLabelFa("lip_sync"),"الگوی گفتار");assert.equal(roleLabelFa("music"),"موزیک");assert.equal(roleLabelFa("environment"),"محیط");assert.equal(roleLabelFa("object"),"اشیا");assert.equal(roleLabelFa("motion_reference"),"الگوی حرکت");assert.equal(roleLabelFa("voice_clone"),"کلون صدا");
 assert.equal(roleLabelFa("general"),"مرجع کلی");assert.ok(!ATTACHMENT_ROLE_IDS.includes("general" as never)&&!rolesFor("image").some(r=>r.id==="general")&&!rolesFor("audio").some(r=>r.id==="voice_clone"),"general is never offered or accepted");
 assert.deepEqual(rolesFor("pdf"),[]);assert.deepEqual(rolesFor("image").map(r=>r.id),["character","start_frame","end_frame","environment","object","outfit","hairstyle","makeup","graphic","edit_reference"]);assert.deepEqual(rolesFor("video").map(r=>r.id),["motion_reference","edit_reference","continue"]);assert.deepEqual(rolesFor("audio").map(r=>r.id),["lip_sync","music"]);assert.ok(!ATTACHMENT_ROLE_IDS.includes("style" as never));
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
test("displayTag shows the Persian word, an ASCII hyphen and Persian digits for every kind and for two-digit numbers",()=>{
 assert.equal(displayTag("image1"),"#تصویر-۱");assert.equal(displayTag("video1"),"#ویدیو-۱");assert.equal(displayTag("audio1"),"#صدا-۱");assert.equal(displayTag("file1"),"#فایل-۱");
 assert.equal(displayTag("image12"),"#تصویر-۱۲");assert.equal(displayTag("file99"),"#فایل-۹۹");assert.equal(displayTag("video10"),"#ویدیو-۱۰");
 assert.ok(/^#[\u0600-\u06ff]+-[\u06f0-\u06f9]+$/.test(displayTag("audio7")),"Persian digits U+06F0-U+06F9 and a U+002D hyphen");
 assert.equal(displayTag("image1").charCodeAt(displayTag("image1").indexOf("-")),0x2d);
 for(const kind of Object.keys(ATTACHMENT_KINDS) as AttachmentKind[]){const tag=tagPrefix(kind)+"3";assert.deepEqual(parseMentions(displayTag(tag)),[tag],"the display form parses back to the internal tag");}
});
test("parseMentions accepts the hyphenated, plain, Arabic-script and English spellings with # or @",()=>{
 assert.deepEqual(parseMentions("#تصویر-۱"),["image1"]);assert.deepEqual(parseMentions("#تصویر۱"),["image1"]);
 assert.deepEqual(parseMentions("#صدا-۱ #صدا۱ #صدا1 #صدا-1"),["audio1"],"hyphen, no hyphen and ASCII digits name the same tag");
 assert.deepEqual(parseMentions("#تصوير-١"),["image1"],"Arabic yeh and an Arabic-Indic digit");assert.deepEqual(parseMentions("#تصوير١"),["image1"]);
 assert.deepEqual(parseMentions("#ویدئو-۲"),["video2"]);assert.deepEqual(parseMentions("#ویدیو۲"),["video2"]);assert.deepEqual(parseMentions("@صدا-۳"),["audio3"]);assert.deepEqual(parseMentions("@صدا۳"),["audio3"]);
 assert.deepEqual(parseMentions("#فایل1"),["file1"]);assert.deepEqual(parseMentions("#فایل-1"),["file1"]);
 assert.deepEqual(parseMentions("@image1"),["image1"]);assert.deepEqual(parseMentions("@image-1"),["image1"]);assert.deepEqual(parseMentions("#image-1 @Video2"),["image1","video2"]);
 for(const dash of ["\u2010","\u2011","\u2013","\u2212"])assert.deepEqual(parseMentions("#تصویر"+dash+"۱"),["image1"],"dash U+"+dash.charCodeAt(0).toString(16));
 assert.deepEqual(parseMentions("#فايل-٣ و #صدا1"),["file3","audio1"],"Arabic yeh in the word, mixed digit sets");
 assert.deepEqual(parseMentions("#تص\u200cویر-۱"),["image1"],"ZWNJ inside the word is dropped");assert.deepEqual(parseMentions("#تصویر\u200c۱"),["image1"],"a ZWNJ in place of the hyphen");assert.deepEqual(parseMentions("#تصـویر-۱"),["image1"],"tatweel inside the word is dropped");
 assert.deepEqual(parseMentions("#تصویر-۱، بعد #تصویر۱ و #تصویر-۲."),["image1","image2"],"punctuation after is fine; each tag once");
 assert.deepEqual(parseMentions("کاراکتر #تصویر-۱ را در #تصویر-۱۲ بگذار"),["image1","image12"]);assert.deepEqual(parseMentions("(#صدا-۳)"),["audio3"]);
});
test("parseMentions rejects ordinary hashtags, emails, longer numbers and zero",()=>{
 for(const no of ["#نوروز","email@image1.com","#تصویر-۱۲۳","#تصویر۱۲۳","#تصویر-۰","#تصویر۰","#تصویر-۰۱","#تصویر","#تصویر-","#تصویرها-۱","#تصویر--۱","متن#تصویر-۱","x#صدا-۱","##تصویر-۱","#تصویر-۱ام","#تصویر-۱\u200cام","#تصویر-۱_","#تصویر-۱a","#عکس-۱","@@صدا-۱","email@image-1.com"])assert.deepEqual(parseMentions(no),[],no);
 assert.deepEqual(splitMentions("a #تصویر-۱، b @Image2"),[{text:"a "},{tag:"image1",raw:"#تصویر-۱"},{text:"، b "},{tag:"image2",raw:"@Image2"}]);
 assert.deepEqual(splitMentions("#تصویر۱ و @image-1"),[{tag:"image1",raw:"#تصویر۱"},{text:" و "},{tag:"image1",raw:"@image-1"}]);
});
test("rewriteMentions turns every accepted spelling into the same English description",()=>{
 const m=new Map([["image1",{tag:"image1",kind:"image" as const,role:"character" as const}],["audio1",{tag:"audio1",kind:"audio" as const,role:"music" as const}]]);
 assert.equal(rewriteMentions("#تصوير-١ با #تصویر۱ و @image1 و @image-1 و #صدا-۱ و #تصویر-۳ و #نوروز",m),"[reference image 1 · character] با [reference image 1 · character] و [reference image 1 · character] و [reference image 1 · character] و [music reference audio 1] و [missing attachment] و #نوروز");
});
test("composer helpers: insertMention writes the canonical hyphenated Persian tag and keeps spacing and the caret",()=>{
 assert.deepEqual(insertMention("",0,0,"image1"),{text:"#تصویر-۱ ",caret:9});
 assert.deepEqual(insertMention("hello",5,5,"image1"),{text:"hello #تصویر-۱ ",caret:15});
 assert.deepEqual(insertMention("hello ",6,6,"image1"),{text:"hello #تصویر-۱ ",caret:15});
 assert.deepEqual(insertMention("hi @im there",3,6,"image1"),{text:"hi #تصویر-۱ there",caret:12});
 assert.deepEqual(insertMention("hi #تص there",3,6,"audio12"),{text:"hi #صدا-۱۲ there",caret:11});
 assert.deepEqual(insertMention("hi #صدا- there",3,8,"audio1"),{text:"hi #صدا-۱ there",caret:10});
 assert.deepEqual(insertMention("a @im",2,5,"video1"),{text:"a #ویدیو-۱ ",caret:11});
 const r=insertMention("بیا #صد",4,7,"audio2");assert.equal(r.text,"بیا #صدا-۲ ");assert.equal(r.text.slice(0,r.caret),"بیا #صدا-۲ ");assert.deepEqual(parseMentions(r.text),["audio2"]);
});
test("mentionTrigger opens on # or @ at a word start and closes for ordinary hashtags",()=>{
 assert.deepEqual(mentionTrigger("@",1),{start:0,query:""});assert.deepEqual(mentionTrigger("#",1),{start:0,query:""});assert.deepEqual(mentionTrigger("see @Im",7),{start:4,query:"im"});
 assert.deepEqual(mentionTrigger("x\n@image1",9),{start:2,query:"image1"});assert.deepEqual(mentionTrigger("سلام @aud",9),{start:5,query:"aud"});
 assert.deepEqual(mentionTrigger("سلام #تص",8),{start:5,query:"تص"});assert.deepEqual(mentionTrigger("#صدا",4),{start:0,query:"صدا"});assert.deepEqual(mentionTrigger("#im",3),{start:0,query:"im"});
 assert.deepEqual(mentionTrigger("#صدا-",5),{start:0,query:"صدا-"},"a hyphen after the word keeps the list open");assert.deepEqual(mentionTrigger("#صدا\u2011۱",6),{start:0,query:"صدا-1"},"other dashes and digits are normalized");
 assert.deepEqual(mentionTrigger("#تصوير-١",8),{start:0,query:"تصویر-1"},"the query is normalized");assert.deepEqual(mentionTrigger("#ويدئو",6),{start:0,query:"ویدئو"},"Arabic yeh is unified");
 assert.equal(mentionTrigger("#نوروز",6),undefined,"an ordinary hashtag");assert.equal(mentionTrigger("#ن",2),undefined);assert.equal(mentionTrigger("#تصویر-۱۲۳",10),undefined);assert.equal(mentionTrigger("#تصویر--",8),undefined);assert.equal(mentionTrigger("@xyz",4),undefined);
 assert.equal(mentionTrigger("email@im",8),undefined);assert.equal(mentionTrigger("a#تص",4),undefined);assert.equal(mentionTrigger("@im ",4),undefined);assert.equal(mentionTrigger("hello",5),undefined);
 assert.deepEqual(mentionTrigger("#تصویر-۱ and more",3),{start:0,query:"تص"});assert.deepEqual(mentionTrigger("@image1 and more",3),{start:0,query:"im"});
});
test("tagMatchesQuery filters by Persian or English word, either digit set, with or without the hyphen",()=>{
 for(const q of ["","ت","تص","تصویر","تصویر-","تصویر۱","تصویر-۱","تصویر1","تصوير-١","im","IM","image","image-","image1","image-1"])assert.ok(tagMatchesQuery("image1",q),q);
 for(const q of ["صدا","vid","تصویر۲","تصویر-۲","image2","image12","نوروز","تصویر--"])assert.ok(!tagMatchesQuery("image1",q),q);
 assert.ok(tagMatchesQuery("audio1","صدا")&&tagMatchesQuery("audio1","صدا-")&&tagMatchesQuery("audio1","au")&&tagMatchesQuery("video2","ویدئو-")&&tagMatchesQuery("video2","ویدیو-۲")&&tagMatchesQuery("file12","فا")&&tagMatchesQuery("file12","fi")&&tagMatchesQuery("file12","فایل-۱")&&tagMatchesQuery("file12","فایل۱۲"));
});

const media=(tag:string,over:Partial<{role:AttachmentRole}>={})=>({tag,kind:(tag.replace(/\d+$/,"")==="file"?"md":tag.replace(/\d+$/,"")) as AttachmentKind,...over});
const inferOf=(text:string,...tags:string[])=>inferAttachmentRoles(text,tags.map(t=>media(t))).map(r=>r.role);
test("inferAttachmentRoles: keywords in Persian and English, first match wins in the documented order",()=>{
 const cases:Array<[string,string,AttachmentRole]>=[
  // image: edit_reference > start_frame > outfit > hairstyle > makeup > character > graphic > object > environment > general
  ["ویرایش","این عکس را ویرایش کن","edit_reference"],["ادیت","یک ادیت ساده","edit_reference"],["حذف کن","پسزمینه را حذف کن","edit_reference"],["پاک کن","لکه را پاک کن","edit_reference"],["جایگزین","جایگزین کن","edit_reference"],["عوض کن","رنگ را عوض کن","edit_reference"],["تغییر بده","تغییر بده","edit_reference"],["رتوش","رتوش پوست","edit_reference"],
  ["edit","edit the photo","edit_reference"],["remove","remove the car","edit_reference"],["replace","replace the sky","edit_reference"],["retouch","retouch skin","edit_reference"],
  ["کاراکتر","کاراکتر داستان","character"],["شخصیت","این شخصیت","character"],["چهره","چهره او","character"],["صورت","صورت من","character"],["پرتره","یک پرتره","character"],["این آدم","این آدم در پارک","character"],["این فرد","این فرد","character"],["خودم","من خودم","character"],
  ["character","keep this character","character"],["face","same face","character"],["portrait","a portrait","character"],["person","this person","character"],
  ["لوگو","لوگوی برند","graphic"],["پوستر","پوستر فیلم","graphic"],["گرافیک","گرافیک","graphic"],["تایپوگرافی","تایپوگرافی","graphic"],["فونت","همین فونت","graphic"],["متن روی","متن روی تصویر","graphic"],["بنر","بنر سایت","graphic"],
  ["logo","the logo","graphic"],["poster","a poster","graphic"],["graphic","graphic","graphic"],["typography","typography","graphic"],["banner","banner","graphic"],
  ["محصول","محصول ما","object"],["شیء","یک شیء","object"],["اشیا","اشیا","object"],["کالا","کالا","object"],["لباس","لباس قرمز","outfit"],["کیف","کیف چرمی","object"],["کفش","کفش ورزشی","outfit"],["بطری","بطری آب","object"],
  ["product","the product","object"],["object","an object","object"],["item","this item","object"],
  ["محیط","محیط جنگلی","environment"],["فضا","فضا","environment"],["مکان","مکان","environment"],["لوکیشن","لوکیشن","environment"],["پسزمینه","پس\u200cزمینه","environment"],["اتاق","اتاق","environment"],["خیابان","خیابان","environment"],["منظره","منظره","environment"],
  ["location","the location","environment"],["background","background","environment"],["scene","scene","environment"],["room","a room","environment"],
  ["general","یک دریاچه آرام","general"],["general en","a calm lake","general"],
  ["edit beats character","edit the face","edit_reference"],["character beats graphic","character with a logo","character"],["graphic beats object","logo on a product","graphic"],["object beats environment","product in a room","object"]
 ];
 for(const [label,text,role] of cases)assert.deepEqual(inferOf(text,"image1"),[role],label+": "+text);
 assert.deepEqual(inferOf("not a keyword: facetime, objective, backgrounds","image1"),["general"],"whole words only");
 assert.deepEqual(inferOf("کیف‌ها و چهره‌ام","image1"),["character"],"a Persian keyword may take a plural or possessive suffix");assert.deepEqual(inferOf("لوگوی برند","image1"),["graphic"]);
});
test("inferAttachmentRoles: video and audio keywords",()=>{
 for(const [text,role] of [["این ویدیو را ادیت کن","edit_reference"],["remove the logo","edit_reference"],["مثل این حرکت","motion_reference"],["رقص","motion_reference"],["الگوی حرکت","motion_reference"],["motion","motion_reference"],["dance","motion_reference"],["movement","motion_reference"],["یک دریاچه آرام","general"],["a calm lake","general"],["edit the dance","edit_reference"]] as const)assert.deepEqual(inferOf(text,"video1"),[role],text);
 for(const [text,role] of [["لب","lip_sync"],["لیپ سینک","lip_sync"],["دیالوگ","lip_sync"],["گفتار","lip_sync"],["صحبت","lip_sync"],["حرف بزند","lip_sync"],["lip sync","lip_sync"],["lipsync","lip_sync"],["speech","lip_sync"],["talk","lip_sync"],
  ["موسیقی","music"],["آهنگ","music"],["ریتم","music"],["بیت","music"],["ملودی","music"],["music","music"],["song","music"],["beat","music"],["یک دریاچه","general"],["a lake","general"],["music and speech","lip_sync"]] as const)assert.deepEqual(inferOf(text,"audio1"),[role],text);
});
test("inferAttachmentRoles: the clause around a mention decides, an unmentioned attachment uses the whole text",()=>{
 assert.deepEqual(inferAttachmentRoles("#تصویر-۱ رو کاراکتر کن و #تصویر-۲ پس‌زمینه باشه",[media("image1"),media("image2")]).map(r=>[r.tag,r.role,r.roleSource]),[["image1","character","inferred"],["image2","environment","inferred"]]);
 assert.deepEqual(inferOf("کاراکتر #تصویر-۱ را در محیط #تصویر-۲ بگذار","image1","image2"),["character","environment"],"the words before a mention count too");
 assert.deepEqual(inferOf("make #image1 the logo. #image2 is the product, ok","image1","image2"),["graphic","object"],"sentences are separate");
 assert.deepEqual(inferOf("#تصویر-۱ پوستر است؛ #تصویر-۲ کاراکتر است","image1","image2"),["graphic","character"]);
 assert.deepEqual(inferOf("لوگو\n#تصویر۲ را بگذار","image2"),["general"],"a newline ends the clause");
 assert.deepEqual(inferOf("@image1 and @image-1 as the face","image1"),["character"],"any accepted spelling; both mentions share one clause");
 assert.deepEqual(inferOf("the logo on #تصویر-۱, ok #تصویر-۱ is a room","image1"),["graphic"],"the first matching group over all of its clauses");
 assert.deepEqual(inferOf("a portrait in a room","image1","image2"),["character","character"],"unmentioned attachments use the whole text");
 assert.deepEqual(inferOf("#تصویر-۱ محیط است؛ a portrait of a person","image1","image2"),["environment","character"],"one mentioned, one not");
 assert.deepEqual(inferOf("#تصویر-۱ را بگذار؛ پوستر","image1"),["general"],"words in other clauses do not count for a mentioned attachment");
 assert.deepEqual(inferOf("#صدا-۱ موسیقی پس‌زمینه #ویدیو-۱ مثل این حرکت","audio1","video1"),["music","motion_reference"]);
 assert.deepEqual(inferOf("#صدا-۱ صحبت و #صدا-۲ ریتم","audio1","audio2"),["lip_sync","music"]);
});
test("inferAttachmentRoles: a chosen role wins, files get none, voice_clone is never inferred",()=>{
 assert.deepEqual(inferAttachmentRoles("this is the face of a person",[media("image1",{role:"environment"})]),[{tag:"image1",role:"environment",roleSource:"user"}]);
 assert.deepEqual(inferAttachmentRoles("x",[{tag:"audio1",kind:"audio",role:"voice_clone"}]),[{tag:"audio1",role:"voice_clone",roleSource:"user"}]);
 assert.deepEqual(inferAttachmentRoles("لوگو",[{tag:"file1",kind:"md"},{tag:"file2",kind:"pdf"},{tag:"file3",kind:"json"}]),[],"files have no role");
 for(const text of ["clone this voice","کلون صدا","voice clone, copy the voice","صدای من را شبیه سازی کن","use his voice","","#صدا-۱ voice clone"])for(const r of inferAttachmentRoles(text,[media("audio1")]))assert.notEqual(r.role,"voice_clone",text);
 assert.deepEqual(inferAttachmentRoles("clone this voice",[media("audio1")]),[{tag:"audio1",role:"general",roleSource:"inferred"}]);
 assert.deepEqual(inferAttachmentRoles("x",[]),[]);
});
test("withoutRole goes back to automatic and drops speech details",()=>{
 const audio:LocalAttachment={id:"a",tag:"audio1",kind:"audio",mime:"audio/mpeg",bytes:1,sha256:"a".repeat(64),name:"x.mp3"};
 const cleared=withoutRole(withRole(audio,"lip_sync"));assert.ok(!("role" in cleared)&&!("speech" in cleared));
  assert.deepEqual(toWireAttachment(cleared),{id:"a",tag:"audio1",kind:"audio",mime:"audio/mpeg",bytes:1,sha256:"a".repeat(64)});
});

test("choosing a role drops what belongs to another role and ignores roles the kind cannot have",()=>{
 const audio:LocalAttachment={id:"a",tag:"audio1",kind:"audio",mime:"audio/mpeg",bytes:1,sha256:"a".repeat(64),name:"x.mp3"};
 const lip=withRole(audio,"lip_sync");assert.deepEqual(lip.speech,{hasSpeech:true,language:"unknown",accent:"unspecified"});
 const tuned=withRole({...lip,speech:{hasSpeech:true,language:"fa",accent:"original"}},"lip_sync");assert.equal(tuned.speech?.language,"fa","re-picking the same role keeps the choices");
 const music=withRole(tuned,"music");assert.equal(music.role,"music");assert.ok(!("speech" in music));
 assert.equal(withRole(music,"voice_clone"),music,"the UI never sets voice_clone");
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
test("the wire payload carries role and speech only where they belong; the schema still guards voice_clone",()=>{
 const base={id:crypto.randomUUID(),mime:"audio/mpeg",bytes:99,sha256:"e".repeat(64),name:"voice.mp3",speech:{hasSpeech:true,language:"fa" as const,accent:"unspecified" as const}};
 const lip=toWireAttachment({...base,tag:"audio1",kind:"audio",role:"lip_sync"});
 assert.equal(lip.role,"lip_sync");assert.deepEqual(lip.speech,base.speech);
 const music=toWireAttachment({...base,tag:"audio2",kind:"audio",role:"music"});
 assert.ok(!("speech" in music),"speech is for lip_sync only");
 assert.equal(CreativeTurnInputSchema.safeParse({text:"x",attachments:[lip,music]}).success,true);
 const clone={...toWireAttachment({...base,tag:"audio3",kind:"audio",role:"voice_clone"})};
 assert.equal(CreativeTurnInputSchema.safeParse({text:"x",attachments:[clone]}).success,false,"the server still refuses voice_clone without consent");
 assert.equal(CreativeTurnInputSchema.safeParse({text:"x",attachments:[{...clone,consent:true}]}).success,true,"and accepts it with consent, only to answer unsupported");
});


test("Persian duration formatting",()=>{assert.equal(faDuration(65),"۱:۰۵");assert.equal(faDuration(7),"۰:۰۷");});
test("inferAttachmentRoles: the curated roles in Persian and English, in the documented order",()=>{
 const cases:Array<[string,string,AttachmentRole]>=[
  ["متحرکش کن","این عکس رو متحرکش کن","start_frame"],["زنده‌اش کن","زنده‌اش کن","start_frame"],["جون بده","بهش جون بده","start_frame"],["انیمیت","انیمیت کن","start_frame"],["متحرک کن","متحرک کن","start_frame"],["تبدیل به ویدیو","تبدیل به ویدیو","start_frame"],
  ["animate","animate this","start_frame"],["bring to life","bring to life","start_frame"],["make it move","make it move","start_frame"],["شروع کن","شروع کن","start_frame"],["start from","start from this","start_frame"],
  ["فریم آخر","فریم آخر باشه","end_frame"],["آخر ویدیو","آخر ویدیو","end_frame"],["تهش","تهش این باشه","end_frame"],["پایان ویدیو","پایان ویدیو","end_frame"],["ختم بشه به","ختم بشه به این","end_frame"],
  ["end frame","end frame","end_frame"],["last frame","last frame","end_frame"],["ending","the ending","end_frame"],
  ["لباس","لباس قرمز","outfit"],["مانتو","مانتو","outfit"],["کت","کت و شلوار","outfit"],["پیراهن","پیراهن","outfit"],["دامن","دامن","outfit"],["پوشش","پوشش","outfit"],["ست لباس","ست لباس","outfit"],["outfit","the outfit","outfit"],["dress","a dress","outfit"],["clothes","clothes","outfit"],["wardrobe","wardrobe","outfit"],
  ["مدل مو","مدل مو","hairstyle"],["مو","مو","hairstyle"],["رنگ مو","رنگ مو","hairstyle"],["کوتاهی مو","کوتاهی مو","hairstyle"],["ریش","ریش","hairstyle"],["سبیل","سبیل","hairstyle"],["فرم ریش","فرم ریش","hairstyle"],["پیرایش","پیرایش","hairstyle"],["اصلاح","اصلاح","hairstyle"],
  ["hairstyle","the hairstyle","hairstyle"],["haircut","haircut","hairstyle"],["hair","her hair","hairstyle"],["beard","a beard","hairstyle"],["moustache","moustache","hairstyle"],["grooming","grooming","hairstyle"],
  ["آرایش","آرایش","makeup"],["میکاپ","میکاپ","makeup"],["رژ","رژ","makeup"],["رژ لب","رژ لب","makeup"],["سایه چشم","سایه چشم","makeup"],["خط چشم","خط چشم","makeup"],["ریمل","ریمل","makeup"],["ابرو","ابرو","makeup"],["makeup","makeup","makeup"],["lipstick","lipstick","makeup"],["eyebrow","eyebrow","makeup"],
  ["makeup beats character","آرایش این عکس روی چهره‌ام","makeup"],["outfit beats character","dress on this person","outfit"],["end beats start","last frame, make it move","end_frame"],["edit beats outfit","edit the dress","edit_reference"]
 ];
 for(const [label,text,role] of cases)assert.deepEqual(inferOf(text,"image1"),[role],label+": "+text);
 assert.deepEqual(inferOf("از #تصویر-۱ شروع کن و به #تصویر-۲ برسه","image1","image2"),["start_frame","end_frame"],"clauses are shared between two mentions");
 assert.deepEqual(inferOf("آرایش نود مثل #تصویر-۲","image2"),["makeup"],"a nude cosmetic color is a makeup reference");
 for(const [text,role] of [["امتداد","continue"],["ادامه بده","continue"],["ادامهٔ ویدیو","continue"],["طولانی‌ترش کن","continue"],["ادامه‌اش","continue"],["extend","continue"],["continue","continue"],["edit the clip","edit_reference"],["مثل این حرکت","motion_reference"]] as const)assert.deepEqual(inferOf(text,"video1"),[role],text);
 for(const [text,role] of [["لیپ‌سینک","lip_sync"],["لیپ سینک","lip_sync"],["موزیک","music"],["موسیقی","music"]] as const)assert.deepEqual(inferOf(text,"audio1"),[role],text);
});
test("accept lists follow the kind, and the role labels are the curated Persian copy",()=>{
 assert.equal(acceptFor("image"),".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp");
 assert.ok(acceptFor("video").includes(".mp4")&&acceptFor("video").includes("video/webm")&&!acceptFor("video").includes(".mp3"));
 assert.ok(acceptFor("audio").includes(".mp3")&&acceptFor("audio").includes("audio/mpeg")&&!acceptFor("audio").includes(".mp4,"));
 assert.equal(acceptFor("file"),".pdf,.json,.md,.markdown,application/pdf,application/json,text/markdown,text/x-markdown,text/plain");
 const labels=(k:"image"|"video"|"audio")=>rolesFor(k).map(r=>r.labelFa);
 assert.deepEqual(labels("image"),["کاراکتر","فریم اول","فریم آخر","محیط","اشیا","لباس و کفش","پیرایش","آرایش","لوگو و گرافیک","ادیت عکس"]);
 assert.deepEqual(labels("video"),["الگوی حرکت","ادیت ویدیو","امتداد ویدیو"]);assert.deepEqual(labels("audio"),["الگوی گفتار","موزیک"]);
 assert.equal(rolesFor("image").find(r=>r.id==="hairstyle")!.hintFa,"مدل مو و فرم ریش");
});
