/** The «حالت ساخت» (build mode) control: three levels that map one to one onto the server's `AgentPreference`. Pure; safe in the browser and on the server. */
import type {AgentPreference} from "./types";

export const MODE_STORAGE_KEY="whoush-mode";
export const DEFAULT_MODE:AgentPreference="quality";
/** Persian labels and request values, in menu order: اقتصادی, سریع, با کیفیت. */
export const MODES=[
 {preference:"cost",labelFa:"اقتصادی"},
 {preference:"speed",labelFa:"سریع"},
 {preference:"quality",labelFa:"با کیفیت"}
] as const satisfies readonly {preference:AgentPreference;labelFa:string}[];
export const MODE_CHANGED_HINT_FA="حالت جدید از پیام بعدی اعمال می‌شود";
export const modeLabelFa=(p:AgentPreference)=>MODES.find(m=>m.preference===p)?.labelFa??MODES[2].labelFa;
/** A stored or untrusted value as a preference; anything unknown is the default (quality). */
export const parseMode=(v:unknown):AgentPreference=>MODES.find(m=>m.preference===v)?.preference??DEFAULT_MODE;
