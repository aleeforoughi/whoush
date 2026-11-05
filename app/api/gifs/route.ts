import {NextResponse} from "next/server";
import {searchGifs,gifsEnabled} from "@/lib/giphy";
import {evaluateTextSafety} from "@/lib/safety";
const headers={"Cache-Control":"no-store"};
/**
 * GIF search for the composer's GIF picker. The GIPHY key stays on the server. The query is safety-checked like a brief (a political or sexual query gets nothing),
 * results are rating G and filtered like Whoush's own GIFs. Off (404) unless GIFs are enabled (docs/CREATIVE_SKILLS.md, Chat GIFs).
 */
export async function GET(request:Request){
 if(!gifsEnabled())return NextResponse.json({error:"gifs_disabled"},{status:404,headers});
 const q=(new URL(request.url).searchParams.get("q")??"").trim().slice(0,50);
 if(!q)return NextResponse.json({gifs:[]},{headers});
 if(evaluateTextSafety(q).decision!=="allow")return NextResponse.json({gifs:[]},{headers});
 return NextResponse.json({gifs:await searchGifs(q)},{headers});
}
