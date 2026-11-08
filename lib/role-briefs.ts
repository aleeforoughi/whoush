/**
 * A ready prompt for every «+» menu role (owner, 2026-11-08: "when the user adds «امتداد ویدیو به جلو», Whoush already knows they want this video
 * continued forward and has the prompt planned"). Picking a role and adding the file fills an empty message box with it, naming the file; the user sends it
 * as it is or changes it. `complete`: it says everything Whoush needs; otherwise it is a beginning that ends where the user writes the rest (an edit
 * needs to say what to change). The planner gets the role's own rule on top (lib/orchestrator.ts roleRule).
 */
import type {AttachmentKind,AttachmentRole} from "./attachments";
import type {UiLang} from "./ui-lang";

type Brief={fa:(t:string)=>string;fi:(t:string)=>string;complete:boolean};
const BRIEFS:Partial<Record<string,Brief>>={
 "image:reference":{complete:false,fa:t=>"با الهام از "+t+" بساز: ",fi:t=>"Ba elham az "+t+" besaz: "},
 "image:edit_reference":{complete:false,fa:t=>t+" رو ادیت کن: ",fi:t=>t+" ro edit kon: "},
 "image:character":{complete:true,fa:t=>"یه پرتره‌ی طبیعی و واقعی از "+t+" بساز؛ چهره‌ش دقیقاً همین بمونه.",fi:t=>"Ye portreh tabi'i va vaghei az "+t+" besaz; chehrash daghighan hamin bemuneh."},
 "image:hairstyle":{complete:true,fa:t=>"مدل مو، ریش و آرایش "+t+" رو روی سوژه پیاده کن؛ چهره‌ی سوژه همون بمونه.",fi:t=>"Model mu, rish va arayesh "+t+" ro ruye sujeh piadeh kon; chehreye sujeh hamun bemuneh."},
 "image:outfit":{complete:true,fa:t=>"سوژه همین لباس "+t+" رو بپوشه؛ طرح، رنگ و جنسش دقیقاً همین بمونه.",fi:t=>"Sujeh hamin lebas "+t+" ro bepusheh; tarh, rang va jensesh daghighan hamin bemuneh."},
 "image:environment":{complete:true,fa:t=>"صحنه رو توی همین محیط "+t+" بساز؛ فضا، نور و ساعت روز همین بمونه.",fi:t=>"Sahneh ro tuye hamin mohit "+t+" besaz; faza, nur va saat ruz hamin bemuneh."},
 "image:object":{complete:true,fa:t=>"یه عکس تبلیغاتی حرفه‌ای از همین محصول "+t+" بساز؛ شکل و رنگش دقیقاً همین بمونه.",fi:t=>"Ye aks tablighati herfei az hamin mahsul "+t+" besaz; shekl va rangesh daghighan hamin bemuneh."},
 "image:graphic":{complete:false,fa:t=>"طرح "+t+" رو بدون هیچ تغییری روی کار بذار: ",fi:t=>"Tarh "+t+" ro bedun hich taghiri ruye kar bezar: "},
 "image:frame":{complete:true,fa:t=>"یه ویدیو بساز که با "+t+" شروع بشه.",fi:t=>"Ye video besaz ke ba "+t+" shoru besheh."},
 "video:reference":{complete:false,fa:t=>"یه ویدیو با حال‌وهوا و سبک "+t+" بساز: ",fi:t=>"Ye video ba hal o hava va sabk "+t+" besaz: "},
 "video:edit_reference":{complete:false,fa:t=>t+" رو ادیت کن: ",fi:t=>t+" ro edit kon: "},
 "video:motion_reference":{complete:true,fa:t=>"حرکت‌های "+t+" رو روی سوژه‌ی جدید پیاده کن؛ ریتم و زمان‌بندی همین بمونه.",fi:t=>"Harekathaye "+t+" ro ruye sujeye jadid piadeh kon; ritm va zamanbandi hamin bemuneh."},
 "video:continue":{complete:true,fa:t=>t+" رو از آخرین فریمش به جلو ادامه بده؛ همون سوژه، حرکت، نور و دوربین بمونه.",fi:t=>t+" ro az akharin frameash be jolo edameh bedeh; hamun sujeh, harekat, nur va durbin bemuneh."},
 "video:extend_back":{complete:true,fa:t=>"یه تکه‌ی تازه قبل از "+t+" بساز که دقیقاً به فریم اولش ختم بشه؛ همون سوژه، نور و دوربین بمونه.",fi:t=>"Ye tekkeh tazeh ghabl az "+t+" besaz ke daghighan be frame avvalesh khatm besheh; hamun sujeh, nur va durbin bemuneh."},
 "audio:lip_sync":{complete:true,fa:t=>"یه ویدیو بساز که سوژه با صدای "+t+" حرف بزنه و لب‌هاش دقیقاً هماهنگ باشه.",fi:t=>"Ye video besaz ke sujeh ba sedaye "+t+" harf bezaneh va labhash daghighan hamahang basheh."},
 "audio:music":{complete:true,fa:t=>"یه ویدیو بساز که کات‌هاش با ریتم "+t+" هماهنگ باشه.",fi:t=>"Ye video besaz ke kathash ba ritm "+t+" hamahang basheh."}
};
/** The ready prompt for a file added with `role`, naming it by `mention` («#ویدیو-۱», or «@video1» in Finglish); undefined for a role without one. */
export function roleBrief(kind:AttachmentKind,role:AttachmentRole,mention:string,lang:UiLang="fa"):{text:string;complete:boolean}|undefined{
 const b=BRIEFS[kind+":"+role];if(!b)return undefined;
 return {text:(lang==="fi"?b.fi:b.fa)(mention),complete:b.complete};
}
/** Every (kind, role) with a ready prompt, for the tests. */
export const ROLE_BRIEF_KEYS=Object.keys(BRIEFS);
