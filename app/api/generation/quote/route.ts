import {NextResponse} from "next/server";
import {z} from "zod";
import {CHARACTER_VIEWS} from "@/lib/characters";
import {createQuote,QuoteError} from "@/lib/quotes";
const headers={"Cache-Control":"no-store"};
const VIEW_IDS=CHARACTER_VIEWS.map(v=>v.id) as [string,...string[]];
// The prompt is NEVER accepted from the client: it is looked up server-side by turnId.
const schema=z.object({
 modelId:z.string().min(1).max(128),turnId:z.string().min(1).max(64),
 configuration:z.object({aspectRatio:z.string().max(12).optional(),durationSeconds:z.number().int().positive().max(600).optional()}).strict().optional(),
 characterRef:z.object({id:z.string().regex(/^[a-z0-9-]{8,80}$/i),version:z.number().int().min(1),angles:z.array(z.enum(VIEW_IDS)).min(1).max(6)}).strict().optional()
}).strict();
export async function POST(request:Request){
 let payload:unknown;try{payload=await request.json();}catch{return NextResponse.json({error:"invalid_json"},{status:400,headers});}
 const parsed=schema.safeParse(payload);if(!parsed.success)return NextResponse.json({error:"invalid_request"},{status:400,headers});
 try{return NextResponse.json(createQuote(parsed.data),{headers});}
 catch(e){
  if(e instanceof QuoteError)return NextResponse.json({error:e.code},{status:e.status,headers});
  return NextResponse.json({error:"internal_error"},{status:500,headers});
 }
}
