/**
 * The interface language (owner, 2026-11-08: "a language change in the top bar; Finglish is LTR"). Persian (right to left) is the default; Finglish
 * (Persian in Latin letters, left to right) is the other. The choice lives in a cookie so the server renders the right direction from the first paint.
 * Separate from the chat: Whoush always answers in the script the user writes (lib/finglish.ts replyScriptFor).
 */
export const UI_LANGS=["fa","fi"] as const;
export type UiLang=(typeof UI_LANGS)[number];
export const UI_LANG_COOKIE="whoush-lang";
export const isUiLang=(v:unknown):v is UiLang=>v==="fa"||v==="fi";
export const dirFor=(l:UiLang)=>l==="fi"?"ltr":"rtl";
/** BCP 47: Finglish is Persian in Latin script. */
export const htmlLangFor=(l:UiLang)=>l==="fi"?"fa-Latn":"fa";
