/** The «سبک» setting beside the build mode: pure data, safe in the browser and on the server. `null` is «اتوماتیک» (Whoush reads the style from the brief). */
import {GENERATION_STYLES,STYLE_LABEL_FA,type GenerationStyle} from "./creative-plan";

export const STYLE_STORAGE_KEY="whoush-style";
export const AUTO_STYLE_FA={titleFa:"اتوماتیک",hintFa:"هووش سبک را از متن تشخیص می‌دهد"} as const;
/** The options in menu order; titles equal `STYLE_LABEL_FA` (tested). */
export const STYLE_OPTIONS:readonly {style:GenerationStyle;titleFa:string;hintFa:string}[]=[
 {style:"realistic",titleFa:STYLE_LABEL_FA.realistic,hintFa:"مثل عکس واقعی، بافت و نور طبیعی"},
 {style:"three_d",titleFa:STYLE_LABEL_FA.three_d,hintFa:"رندر سه‌بعدی تمیز"},
 {style:"cartoon",titleFa:STYLE_LABEL_FA.cartoon,hintFa:"کارتونی و رنگی"}
];
export const styleLabelFa=(s:GenerationStyle|null)=>s?STYLE_LABEL_FA[s]:AUTO_STYLE_FA.titleFa;
/** A stored or untrusted value as a style; anything unknown is «اتوماتیک» (null). */
export const parseStyle=(v:unknown):GenerationStyle|null=>GENERATION_STYLES.find(s=>s===v)??null;
