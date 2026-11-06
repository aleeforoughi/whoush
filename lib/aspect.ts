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
