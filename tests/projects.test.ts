import {test} from "node:test";
import assert from "node:assert/strict";
import {allocateTag,newTagCounters} from "../lib/attachments";
import {AUTO_TITLE_MAX,UNTITLED_FA,assetToAttachment,attachmentToAsset,autoTitle,cleanTitle,filterAssets,jobStateFa,parseProject,relativeTimeFa,sortAssets,sortRecent,validateProject,type Project,type StoredAsset} from "../lib/projects";

const T0="2026-11-04T12:00:00.000Z";
const project=(over:Partial<Project>={}):Project=>({id:"11111111-2222-4333-8444-555555555555",title:"پروژه",titleSource:"auto",createdAt:T0,updatedAt:T0,version:1,messages:[],tagCounters:newTagCounters(),mode:"quality",style:null,...over});
const plan={intentSummaryFa:"یک منظره",mediaKind:"image",hardConstraints:[],softPreferences:[],references:[],continuity:{locks:[],antiTeleport:[]},realism:{mode:"photoreal"},qaChecklist:["الف","ب","ج"]};

test("autoTitle: mentions removed, whitespace collapsed, empty becomes «پروژهٔ بی‌نام»",()=>{
 assert.equal(autoTitle("  یک   منظره از #تصویر-۱ بساز\n"),"یک منظره از بساز");
 assert.equal(autoTitle("@image1 و #ویدیو۲ را ترکیب کن"),"و را ترکیب کن");
 assert.equal(autoTitle("#تصویر-۱"),UNTITLED_FA);
 assert.equal(autoTitle("   \n\t "),UNTITLED_FA);
 assert.equal(autoTitle("#نوروز مبارک"),"#نوروز مبارک","an ordinary hashtag is not a mention");
});
test("autoTitle: at most 40 characters plus «…», never cut inside a ZWNJ word or before a combining mark",()=>{
 assert.equal(autoTitle("کوتاه"),"کوتاه");
 const exact="الف".repeat(AUTO_TITLE_MAX/3*1).padEnd(AUTO_TITLE_MAX,"ب");
 assert.equal(autoTitle(exact),exact);
 const long=autoTitle("یک منظرهٔ بسیار طولانی از کوهستان برفی در طلوع آفتاب با مه ملایم");
 assert.ok(Array.from(long).length<=AUTO_TITLE_MAX+1&&long.endsWith("…"),long);
 // the cut falls between "می" and "خواهم": the whole ZWNJ-joined word goes
 const prefix="الف ".repeat(9)+"ب"; // 37 characters
 const text=prefix+" می‌خواهم یک تصویر بسازم";
 const t=autoTitle(text);
 assert.ok(!t.includes("می")&&!/‌…?$/.test(t),JSON.stringify(t));
 assert.ok(!/[\s‌]…$/.test(t));
 const lone=autoTitle("می‌".repeat(30));
 assert.ok(!lone.includes("‌…"),JSON.stringify(lone));
 const marked=autoTitle("ا".repeat(39)+"بَ"+"ج".repeat(10));
 assert.ok(!/َ/.test(marked)||/بَ/.test(marked),"a mark stays with its letter");
 assert.equal(Array.from(autoTitle("😀".repeat(60))).length,AUTO_TITLE_MAX+1,"code points, not UTF-16 halves");
});
test("cleanTitle: 1..80 characters after trimming",()=>{
 assert.equal(cleanTitle("  نام   تازه "),"نام تازه");
 assert.equal(cleanTitle("   "),undefined);
 assert.equal(cleanTitle("ا".repeat(80))?.length,80);
 assert.equal(cleanTitle("ا".repeat(81)),undefined);
});
test("sortRecent: newest first, stable by id, does not mutate",()=>{
 const items=[{id:"b",updatedAt:"2026-11-01T00:00:00Z"},{id:"c",updatedAt:"2026-11-03T00:00:00Z"},{id:"a",updatedAt:"2026-11-01T00:00:00Z"}];
 assert.deepEqual(sortRecent(items).map(x=>x.id),["c","a","b"]);
 assert.deepEqual(items.map(x=>x.id),["b","c","a"]);
});
test("relativeTimeFa: buckets against a fixed now",()=>{
 const now=new Date("2026-11-04T12:00:00Z"),ago=(ms:number)=>new Date(now.getTime()-ms);
 const min=60_000,hour=60*min,day=24*hour;
 assert.equal(relativeTimeFa(ago(0),now),"همین الان");
 assert.equal(relativeTimeFa(ago(59_000),now),"همین الان");
 assert.equal(relativeTimeFa(new Date(now.getTime()+5*min),now),"همین الان","a clock slightly ahead is not negative");
 assert.equal(relativeTimeFa(ago(5*min),now),"۵ دقیقه پیش");
 assert.equal(relativeTimeFa(ago(59*min),now),"۵۹ دقیقه پیش");
 assert.equal(relativeTimeFa(ago(2*hour),now),"۲ ساعت پیش");
 assert.equal(relativeTimeFa(ago(23*hour),now),"۲۳ ساعت پیش");
 assert.equal(relativeTimeFa(ago(day),now),"دیروز");
 assert.equal(relativeTimeFa(ago(2*day-1),now),"دیروز");
 assert.equal(relativeTimeFa(ago(3*day),now),"۳ روز پیش");
 assert.equal(relativeTimeFa(ago(6*day),now),"۶ روز پیش");
 assert.equal(relativeTimeFa(ago(7*day),now),ago(7*day).toLocaleDateString("fa-IR"));
 assert.equal(relativeTimeFa(ago(400*day).toISOString(),now),ago(400*day).toLocaleDateString("fa-IR"));
 assert.equal(relativeTimeFa("not a date",now),"");
});
test("jobStateFa: Persian labels, unknown states read as queued",()=>{
 assert.equal(jobStateFa("running"),"در حال تولید");
 assert.equal(jobStateFa("failed"),"ناموفق");
 assert.equal(jobStateFa("whatever"),"در صف");
});
test("validateProject: accepts a complete project and every message kind",()=>{
 const messages:Project["messages"]=[
  {id:"m1",role:"user",text:"سلام",at:T0,attachmentIds:["aaaaaaaa-1111-4222-8333-444444444444"]},
  {id:"m2",role:"agent",text:"پیشنهاد",at:T0,kind:"proposal",snapshot:{operation:"generate_image",modelName:"Soul",neurons:12,intentSummaryFa:"یک منظره",plan:plan as never}},
  {id:"m3",role:"agent",text:"مدلی نیست",at:T0,kind:"no_model",snapshot:{message:"مدلی نیست"}},
  {id:"m4",role:"agent",text:"نمی‌توانم",at:T0,kind:"restricted"},
  {id:"m5",role:"agent",text:"تمام",at:T0,kind:"job",snapshot:{state:"completed_demo",messageFa:"تمام"}}
 ];
 validateProject(project({messages,style:"cartoon",mode:"cost",characterRef:{id:"char-12345678",name:"سارا",angles:["front"],version:1}}));
 assert.ok(parseProject(project()));
});
test("validateProject: limits and enums",()=>{
 const fails=(over:Record<string,unknown>)=>assert.throws(()=>validateProject({...project(),...over}),/پروژهٔ ذخیره‌شده نامعتبر/);
 fails({title:""});fails({title:"   "});fails({title:"ا".repeat(81)});fails({titleSource:"x"});fails({version:2});fails({id:"x"});fails({createdAt:"nope"});
 fails({mode:"turbo"});fails({style:"anime"});fails({style:undefined});
 fails({tagCounters:{image:-1,video:0,audio:0,file:0}});fails({tagCounters:{image:1.5,video:0,audio:0,file:0}});fails({tagCounters:{image:100,video:0,audio:0,file:0}});fails({tagCounters:{image:0,video:0,audio:0}});
 fails({messages:Array.from({length:501},(_,i)=>({id:"m"+i,role:"user",text:"x",at:T0}))});
 fails({messages:[{id:"m",role:"robot",text:"x",at:T0}]});
 fails({messages:[{id:"m",role:"agent",text:"x",at:T0,kind:"proposal"}]});
 fails({messages:[{id:"m",role:"agent",text:"x",at:T0,kind:"proposal",snapshot:{operation:"generate_image",modelName:"S",neurons:1.5,intentSummaryFa:"x",plan}}]});
 fails({messages:[{id:"m",role:"agent",text:"x",at:T0,kind:"job",snapshot:{state:"x"}}]});
 fails({messages:[{id:"m",role:"agent",text:"x",at:T0,kind:"mystery"}]});
 fails({messages:[{id:"m",role:"user",text:"x".repeat(8001),at:T0}]});
 fails({characterRef:{id:"c",name:"x",angles:[],version:1}});
 assert.equal(parseProject({...project(),version:9}),undefined);
 assert.equal(parseProject(null),undefined);
 assert.doesNotThrow(()=>validateProject(project({messages:Array.from({length:500},(_,i)=>({id:"m"+i,role:"user" as const,text:"x",at:T0}))})));
});
const asset=(over:Partial<StoredAsset>):StoredAsset=>({id:"a",projectId:"p1",kind:"image",tag:"image1",mime:"image/png",bytes:10,sha256:"0".repeat(64),name:"a.png",createdAt:T0,...over});
test("filterAssets: by kind group and by project",()=>{
 const all=[asset({id:"1"}),asset({id:"2",kind:"video",tag:"video1"}),asset({id:"3",kind:"pdf",tag:"file1",projectId:"p2"}),asset({id:"4",kind:"json",tag:"file2"}),asset({id:"5",kind:"audio",tag:"audio1",projectId:"p2"})];
 const ids=(f:Parameters<typeof filterAssets>[1])=>filterAssets(all,f).map(a=>a.id);
 assert.deepEqual(ids({}),["1","2","3","4","5"]);
 assert.deepEqual(ids({kind:"all",projectId:null}),["1","2","3","4","5"]);
 assert.deepEqual(ids({kind:"image"}),["1"]);
 assert.deepEqual(ids({kind:"file"}),["3","4"],"pdf and json are both «فایل»");
 assert.deepEqual(ids({kind:"audio"}),["5"]);
 assert.deepEqual(ids({projectId:"p2"}),["3","5"]);
 assert.deepEqual(ids({kind:"file",projectId:"p1"}),["4"]);
 assert.deepEqual(ids({kind:"video",projectId:"p2"}),[]);
});
test("sortAssets: newest first",()=>{
 assert.deepEqual(sortAssets([asset({id:"o",createdAt:"2026-01-01T00:00:00Z"}),asset({id:"n",createdAt:"2026-02-01T00:00:00Z"})]).map(a=>a.id),["n","o"]);
});
test("attachment and asset convert both ways and keep the local-only name off nothing but the asset",()=>{
 const a={id:"aaaaaaaa-1111-4222-8333-444444444444",tag:"image2",kind:"image" as const,mime:"image/png",bytes:5,sha256:"1".repeat(64),name:"عکس من.png",role:"start_frame" as const,width:4,height:3,previewUrl:"blob:x"};
 const s=attachmentToAsset(a,"p1",T0);
 assert.equal(s.projectId,"p1");assert.equal(s.roleSource,"user");assert.equal(s.name,"عکس من.png");assert.ok(!("previewUrl" in s));assert.ok(!("blob" in s));
 const back=assetToAttachment(s,"blob:y");
 assert.deepEqual({...back,previewUrl:undefined},{...a,previewUrl:undefined});assert.equal(back.previewUrl,"blob:y");
 assert.ok(!("roleSource" in attachmentToAsset({...a,role:undefined},"p1",T0)));
});
test("tag numbers are never reused across a reload: restored counters continue the numbering",()=>{
 let counters=newTagCounters();
 for(const k of ["image","image","video","pdf"] as const)counters=allocateTag(counters,k)!.counters;
 const p=project({tagCounters:counters});
 const restored=structuredClone(p);validateProject(restored);
 assert.equal(allocateTag(restored.tagCounters,"image")?.tag,"image3");
 assert.equal(allocateTag(restored.tagCounters,"video")?.tag,"video2");
 assert.equal(allocateTag(restored.tagCounters,"json")?.tag,"file2");
 assert.equal(allocateTag(restored.tagCounters,"audio")?.tag,"audio1");
 // image1 was removed before the save; the counter is what remembers it
 assert.equal(allocateTag({...newTagCounters(),image:2},"image")?.tag,"image3");
});
