/** Aspect-ratio helpers shared by the server and the studio (no server-only imports). */

/** "16:9" → 16/9. Undefined for anything that is not two positive integers. */
export function aspectValue(r:string):number|undefined{
 const m=/^(\d{1,2}):(\d{1,2})$/.exec(r);if(!m)return undefined;
 const w=Number(m[1]),h=Number(m[2]);return w>0&&h>0?w/h:undefined;
}

/**
 * The ratio a model really offers that is closest to the one wanted: the wanted one itself when offered, else the nearest by
 * log distance (so 4:5 and 5:4 are equally far from 1:1, and a portrait never snaps to a wider landscape than it must).
 * Undefined when nothing is wanted, the wanted ratio is malformed, or the model offers no ratios.
 */
export function nearestAspectRatio(want:string|undefined,offered:readonly string[]):string|undefined{
 if(!want)return undefined;
 if(offered.includes(want))return want;
 const w=aspectValue(want);if(w===undefined)return undefined;
 let best:string|undefined,bestD=Infinity;
 for(const r of offered){const v=aspectValue(r);if(v===undefined)continue;const d=Math.abs(Math.log(v/w));if(d<bestD-1e-9){best=r;bestD=d;}}
 return best;
}

/** The ratios people use most, most popular first (owner, 2026-11-08: the card shows only the popular ones; the rest behind «+»). */
export const POPULAR_ASPECT_RATIOS=["9:16","16:9","1:1","4:5","3:4","4:3","2:3","3:2","21:9"] as const;
const rank=(r:string)=>{const i=(POPULAR_ASPECT_RATIOS as readonly string[]).indexOf(r);return i<0?POPULAR_ASPECT_RATIOS.length:i;};
/** Ratios ordered from the tallest to the widest, for the full list. */
export const byShape=(rs:readonly string[])=>[...rs].sort((a,b)=>(aspectValue(a)??1)-(aspectValue(b)??1));
/**
 * The few ratios the card shows before «+»: the ones in `keep` that the model offers (the selected and the automatic one, so a choice never hides),
 * then the most popular of the rest, at most `n`, from the tallest to the widest so a pick never reorders them.
 */
export function popularAspectRatios(offered:readonly string[],keep:ReadonlyArray<string|undefined>,n=3):string[]{
 const out:string[]=[];
 for(const r of keep)if(r&&offered.includes(r)&&!out.includes(r))out.push(r);
 for(const r of [...offered].sort((a,b)=>rank(a)-rank(b))){if(out.length>=n)break;if(!out.includes(r))out.push(r);}
 return byShape(out.slice(0,Math.max(n,out.length)));
}
