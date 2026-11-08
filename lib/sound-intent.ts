import {normalizePersian} from "./safety";
/**
 * Sound on a video (owner, 2026-11-08): what the brief says about it. `false` for a silent video («بی‌صدا», «بدون صدا», "no sound"), `true` when sound is
 * asked for («با صدا», «صداش باشه», «دیالوگ», "with sound"), else undefined (the card starts with sound on, where the model offers checked sound, and
 * Whoush asks). Silence wins when both appear.
 */
const OFF=/(بی ?صدا|بی‌صدا|بدون (?:صدا|موزیک|آهنگ|دیالوگ)|صدا (?:نداشته|نمی ?خوام|نذار|خاموش)|صداش رو (?:بردار|قطع|خاموش)|\bsilent\b|\bno (?:sound|audio)\b|\bwithout (?:sound|audio)\b|\bmuted?\b|bi ?seda)/i;
const ON=/(با صدا|صدا ?دار|صداش? (?:داشته|باشه|رو بذار|روشن)|دیالوگ|حرف بزن|آهنگ|موزیک|افکت صوتی|\bwith (?:sound|audio)\b|\bsound on\b|\bdialogue\b|\bvoice ?over\b|ba seda)/i;
export function soundWanted(text:string):boolean|undefined{
 const t=normalizePersian(text);
 if(OFF.test(t))return false;
 if(ON.test(t))return true;
 return undefined;
}
/** Whoush's line about sound on a video proposal: it asks when the brief said nothing, and confirms what the brief said. */
export function soundLineFa(wanted:boolean|undefined,script:"fa"|"finglish"):string{
 if(script==="finglish")return wanted===false?"Biseda misazamesh.":wanted===true?"Ba seda misazamesh.":"Seda ham dashteh basheh? Alan roshaneh; ageh biseda mikhay, az ruye kart khamushesh kon.";
 return wanted===false?"بی‌صدا می‌سازمش.":wanted===true?"با صدا می‌سازمش.":"صدا هم داشته باشه؟ الان روشنه؛ اگه بی‌صدا می‌خوای از روی کارت خاموشش کن.";
}
