import "server-only";
import type {GifMood} from "./creative-plan";
import {evaluateTextSafety} from "./safety";

/**
 * Chat GIFs from GIPHY (server only; the API key never reaches the browser).
 * - Off unless GIPHY_API_KEY is set; in production also GIPHY_AUTHORIZED=true, an operator's assertion that GIPHY's terms and regional availability were checked
 *   for Whoush's users (not verified in this repository).
 * - Whoush picks a mood; the server searches a fixed, harmless query for it with rating G and keeps only results whose title and creator pass the safety prefilter
 *   and a stricter word list. The images themselves are NOT inspected (no multimodal moderation yet): a G rating and text filters lower the risk, they do not
 *   remove it. A curated list of approved GIF ids is the production-safe option.
 * - GIPHY requires its media to load from the URLs its API returns (no caching, proxying or rewriting) and a visible «Powered by GIPHY» attribution; the chat
 *   shows both. The viewer's browser therefore contacts GIPHY's media servers directly.
 * Any failure (no key, timeout, bad response, nothing safe) simply means no GIF; it never fails the turn.
 */
export type ChatGif={id:string;url:string;stillUrl:string;width:number;height:number;title:string};
export const GIF_QUERIES:Record<GifMood,string>={celebrate:"celebration confetti",high_five:"high five",mind_blown:"mind blown",thinking:"thinking hmm",on_it:"lets do this",oops:"oops",cool:"cool sunglasses",thumbs_up:"thumbs up"};
/** Words that drop a result even when the prefilter allows it: politics, flags and countries, religion, alcohol and drugs, weapons, romance and bodies. */
const DENY=["president","politic","election","vote","protest","flag","country","america","usa","iran","israel","russia","china","army","military","war","gun","weapon","blood","fight",
 "church","mosque","pray","jesus","allah","god","bible","quran","beer","wine","drunk","alcohol","smoke","weed","drug","sexy","hot","kiss","bikini","butt","booty","twerk","nsfw","love"];
const MEDIA=/^https:\/\/media\d*\.giphy\.com\/media\//;
export function gifsEnabled(env:Record<string,string|undefined>=process.env):boolean{
 return Boolean(env.GIPHY_API_KEY)&&(env.NODE_ENV!=="production"||env.GIPHY_AUTHORIZED==="true");
}
type GiphyImage={url?:string;width?:string;height?:string};
type GiphyItem={id?:string;title?:string;username?:string;slug?:string;rating?:string;images?:{fixed_height?:GiphyImage;fixed_height_still?:GiphyImage}};
/** Whether one search result may be shown: G-rated, a GIPHY media URL, and nothing in its title, creator or slug that the prefilter or the word list rejects. */
export function acceptableGif(item:GiphyItem):ChatGif|undefined{
 const fh=item.images?.fixed_height,still=item.images?.fixed_height_still;
 if(!item.id||item.rating!=="g"||!fh?.url||!still?.url||!MEDIA.test(fh.url)||!MEDIA.test(still.url))return undefined;
 const words=[item.title,item.username,item.slug].filter(Boolean).join(" ").toLowerCase();
 if(evaluateTextSafety(words).decision!=="allow"||DENY.some(w=>new RegExp("(?<![a-z])"+w).test(words)))return undefined;
 const width=Number(fh.width),height=Number(fh.height);
 if(!(width>0&&height>0))return undefined;
 return {id:item.id,url:fh.url,stillUrl:still.url,width,height,title:(item.title??"").slice(0,120)};
}
type Deps={fetch?:typeof fetch;env?:Record<string,string|undefined>;pick?:(n:number)=>number};
/** Searches GIPHY (rating G) and returns up to `max` acceptable results; [] on any failure or when GIFs are off. Persian queries search in Persian. */
export async function searchGifs(q:string,max=12,deps:Deps={}):Promise<ChatGif[]>{
 const env=deps.env??process.env;
 if(!gifsEnabled(env)||!q.trim())return [];
 const params=new URLSearchParams({api_key:env.GIPHY_API_KEY!,q:q.trim().slice(0,50),limit:"30",rating:"g",lang:/[\u0600-\u06ff]/.test(q)?"fa":"en"});
 try{
  const res=await (deps.fetch??fetch)("https://api.giphy.com/v1/gifs/search?"+params,{signal:AbortSignal.timeout(2500),cache:"no-store"});
  if(!res.ok)return [];
  const body=await res.json() as {data?:GiphyItem[]};
  return (body.data??[]).flatMap(i=>{const g=acceptableGif(i);return g?[g]:[];}).slice(0,max);
 }catch{return [];}
}
/** One G-rated GIF for the mood (a fixed, harmless query), or undefined. `pick` chooses among the first ten acceptable results (random by default). */
export async function findGif(mood:GifMood,deps:Deps={}):Promise<ChatGif|undefined>{
 const ok=await searchGifs(GIF_QUERIES[mood],10,deps);
 if(!ok.length)return undefined;
 return ok[Math.min(ok.length-1,Math.max(0,(deps.pick??(n=>Math.floor(Math.random()*n)))(ok.length)))];
}
