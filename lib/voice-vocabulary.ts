/**
 * Words Whoush users say in voice messages that a general speech recognizer may mishear: model names, AI and production terms, and camera, light and
 * social-media jargon. Persian speakers say most of them as loanwords with a Persian accent («پرامپت», «سیدریم», «کلوزآپ»), so each common term is listed
 * in Latin script and, where Persians usually write it so, in Persian script too. The list biases the recognizer towards these spellings; accent itself is
 * handled by the recognizer. Keep it at most 100 terms (the provider's advice for best accuracy: docs/evidence/GOOGLE.md#voice-transcription).
 *
 * Only model families a customer may name. Never a provider or LLM vendor name.
 */
export const VOICE_VOCABULARY_VERSION="2026-11-06.1";

const BRAND=["Whoush","هووش"];
const MODELS=[
 "Nano Banana","نانو بنانا","Seedream","سیدریم","Seedance","سیدنس","Kling","کلینگ","Soul","سول","Intone","اینتون","Genjutsu","گنجوتسو"
];
const AI_TERMS=[
 "prompt","پرامپت","render","رندر","upscale","آپ‌اسکیل","lip-sync","لیپ‌سینک","text-to-video","image-to-video","reference","رفرنس",
 "style","استایل","mockup","ماکاپ","logo","لوگو","thumbnail","تامبنیل","poster","پوستر","banner","بنر"
];
const SOCIAL=["Instagram","اینستاگرام","Reels","ریلز","story","استوری","post","پست"];
const CAMERA_AND_LIGHT=[
 "close-up","کلوزآپ","wide shot","medium shot","low angle","high angle","bird's-eye view","drone shot","tracking shot","dolly zoom",
 "portrait","پرتره","landscape","macro","ماکرو","bokeh","بوکه","depth of field","focus","فوکوس","frame","فریم",
 "35mm","50mm","85mm","f/1.8","ISO","shutter speed","white balance","HDR",
 "golden hour","گلدن آور","softbox","سافت‌باکس","ring light","رینگ‌لایت","rim light","backlight","بک‌لایت",
 "cinematic","سینماتیک","slow motion","اسلوموشن","time-lapse","تایم‌لپس","color grading","کالرگرید","LUT",
 "aspect ratio","4K","1080p","fps"
];

/** The recognizer's custom vocabulary: unique, in priority order (brand and models first). tests/voice.test.ts keeps it at 100 terms or fewer. */
export const VOICE_VOCABULARY:readonly string[]=[...new Set([...BRAND,...MODELS,...AI_TERMS,...SOCIAL,...CAMERA_AND_LIGHT])];
