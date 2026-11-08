/**
 * Drift awareness (owner, 2026-11-08): "Whoush shouldn't guess what it doesn't know." When a request needs something about a person that none of their
 * photos shows (another angle of the face, the whole body, the teeth, open eyes), a model has to invent it and the person drifts away from themselves.
 * Whoush asks for that photo first, says why, and lets the user skip and have its best guess. What each photo shows is noted by the photo check at upload
 * (lib/reference-inspect.ts); what a request needs comes from its words. Pure: safe in the browser and on the server.
 */
import {normalizePersian} from "./safety";

/** What one photo shows of its main person (the photo check's answer). */
export type PhotoCoverage={framing:"face"|"head_shoulders"|"half_body"|"full_body";headAngle:"front"|"three_quarter"|"profile"|"back";teeth:boolean;eyesOpen:boolean};
export const FRAMINGS=["face","head_shoulders","half_body","full_body"] as const;
export const HEAD_ANGLES=["front","three_quarter","profile","back"] as const;

/** Something a request needs that a model would otherwise invent. `angle` for another view of the head. */
export type DriftNeed={id:"face_angle";angle:"three_quarter"|"profile"|"back"}|{id:"full_body"}|{id:"smile"}|{id:"eyes_open"};

const words=(t:string,list:readonly string[])=>{const s=" "+normalizePersian(t).toLowerCase()+" ";return list.some(w=>s.includes(" "+normalizePersian(w).toLowerCase()+" "));};
const PROFILE=["نیم رخ","نیمرخ","از بغل","از کنار","بغل رخ","پروفایل صورت","profile view","side view","from the side","side profile","in profile"];
const THREE_QUARTER=["سه رخ","سه ربع","سرشو بچرخون","سرش رو بچرخون","سرشو برگردون","three quarter","three-quarter","3/4 view","turn his head","turn her head","turn their head","head turned"];
const BACK=["از پشت","از پشت سر","پشت به دوربین","from behind","back view","back to the camera"];
const FULL_BODY=["تمام قد","تمامقد","کل بدن","کل هیکل","هیکل کامل","سر تا پا","از سر تا پا","از دور","زوم اوت","زوم بک","عقب تر","کادر باز","ایستاده","راه میره","راه بره","در حال راه رفتن","قدم میزنه","میدوه","full body","full-body","head to toe","zoom out","zoom back","wide shot","long shot","standing","walking","running"];
const SMILE=["بخنده","بخندی","بخندم","خندان","میخنده","لبخند","لبخند بزنه","دندون","دندوناش","دندان","smile","smiling","laugh","laughing","grin","grinning","teeth","open mouth"];
const EYES_CLOSED=["چشم بسته","چشماش بسته","چشم هاش بسته","eyes closed","closed eyes"];

/** What a request needs about the person, from its words (in this order: angle, body, smile). */
export function driftNeedsOf(text:string):DriftNeed[]{
 const out:DriftNeed[]=[];
 if(words(text,PROFILE))out.push({id:"face_angle",angle:"profile"});
 else if(words(text,BACK))out.push({id:"face_angle",angle:"back"});
 else if(words(text,THREE_QUARTER))out.push({id:"face_angle",angle:"three_quarter"});
 if(words(text,FULL_BODY))out.push({id:"full_body"});
 if(words(text,SMILE))out.push({id:"smile"});
 return out;
}

/**
 * The needs no photo of the person covers. `coverages`: one per photo of the person (unknown photos are left out, so they never block); `savedAngles`:
 * the angles a saved character already has («front», «three_quarter», «profile»…). Open eyes are needed when every photo has them closed and Whoush makes a
 * new picture of the person (`editing`: the photo itself is edited and keeps its face, so its closed eyes stay closed), unless the request keeps them closed.
 */
export function missingNeeds(text:string,coverages:readonly PhotoCoverage[],savedAngles:readonly string[]=[],editing=false):DriftNeed[]{
 if(!coverages.length&&!savedAngles.length)return [];
 const needs=driftNeedsOf(text);
 if(!editing&&coverages.length&&coverages.every(c=>!c.eyesOpen)&&!words(text,EYES_CLOSED))needs.push({id:"eyes_open"});
 return needs.filter(n=>{
  if(n.id==="face_angle")return !coverages.some(c=>c.headAngle===n.angle)&&!savedAngles.includes(n.angle);
  if(n.id==="full_body")return !coverages.some(c=>c.framing==="full_body")&&!savedAngles.includes("full_body");
  if(n.id==="smile")return !coverages.some(c=>c.teeth);
  return !coverages.some(c=>c.eyesOpen);
 });
}

/** The marker of the drift question (how its answer is recognised), and the skip button. */
export const DRIFT_MARKER_FA="تا چهره و بدنت عوض نشه";
export const DRIFT_MARKER_FINGLISH="Ta chehre o badanet avaz nashe";
export const DRIFT_SKIP={id:"drift_skip",labelFa:"همین‌طوری بساز",replyFa:"عکس دیگه‌ای ندارم؛ همین‌طوری با بهترین حدست بساز"};
export const DRIFT_SKIP_FINGLISH={id:"drift_skip",labelFa:"Hamintori besaz",replyFa:"Akse dige'i nadaram; hamintori ba behtarin hadset besaz"};
const WHAT_FA:Record<DriftNeed["id"],string>={face_angle:"",full_body:"اندام و قدت",smile:"دندون‌هات و لبخندت",eyes_open:"شکل و رنگ چشم‌هات"};
const ANGLE_FA={three_quarter:"سه‌رخ",profile:"نیم‌رخ",back:"پشت سر"} as const;
/** Why Whoush asks, in one friendly line: what it cannot know from these photos, and the way out. */
export function driftAskFa(n:DriftNeed):string{
 const what=n.id==="face_angle"?"صورتت از "+ANGLE_FA[n.angle]:WHAT_FA[n.id];
 return DRIFT_MARKER_FA+"، یه عکس دیگه لازم دارم: از روی این عکس‌ها نمی‌دونم "+what+" چه شکلیه و نمی‌خوام حدسی بسازم. اگه نداری، «"+DRIFT_SKIP.labelFa+"» رو بزن تا با بهترین حدسم بسازم.";
}
export function driftAskFinglish(n:DriftNeed):string{
 const what=n.id==="face_angle"?"soorat-et az "+{three_quarter:"se-rokh",profile:"nim-rokh",back:"poshte sar"}[n.angle]:{full_body:"andam o ghad-et",smile:"dandoonhat o labkhand-et",eyes_open:"shekl o range cheshmat"}[n.id];
 return DRIFT_MARKER_FINGLISH+", ye akse dige lazem daram: az rooye in aksa nemidoonam "+what+" che shekliye. Age nadari, \""+DRIFT_SKIP_FINGLISH.labelFa+"\" ro bezan.";
}
/** The photos to ask for (the upload card's slots). */
export function driftAngles(n:DriftNeed):{id:string;titleFa:string}[]{
 if(n.id==="face_angle")return [{id:n.angle,titleFa:"صورت از "+ANGLE_FA[n.angle]+"، با نور خوب"}];
 if(n.id==="full_body")return [{id:"full_front",titleFa:"تمام‌قد از روبه‌رو"},{id:"full_side",titleFa:"تمام‌قد از بغل (اگه داری)"}];
 if(n.id==="smile")return [{id:"smile",titleFa:"صورت با لبخند، دندون‌ها پیدا"}];
 return [{id:"eyes_open",titleFa:"صورت با چشم‌های باز"}];
}
