import {NextResponse} from "next/server";
import {z} from "zod";
import {CHARACTER_VIEWS} from "@/lib/characters";
import {createQuote,FA_DEV_CAP_REACHED,FA_PRICE_PENDING,QuoteError} from "@/lib/quotes";
import {StagingSchema} from "@/lib/creative-plan";
import {deriveTurnWithStaging,SceneEditConflict,SceneOccluded} from "@/lib/orchestrator";
const headers={"Cache-Control":"no-store"};
const VIEW_IDS=CHARACTER_VIEWS.map(v=>v.id) as [string,...string[]];
// The prompt is NEVER accepted from the client: it is looked up server-side by turnId.
const schema=z.object({
 modelId:z.string().min(1).max(128),turnId:z.string().min(1).max(64),
 configuration:z.object({aspectRatio:z.string().max(12).optional(),durationSeconds:z.number().int().positive().max(600).optional(),audio:z.boolean().optional()}).strict().optional(),
 characterRef:z.object({id:z.string().regex(/^[a-z0-9-]{8,80}$/i),version:z.number().int().min(1),angles:z.array(z.enum(VIEW_IDS)).min(1).max(6)}).strict().optional(),
 /** The scene arranged in «بوم» (structured, enum values only): applied to the turn's private plan on the server before quoting. */
 stagingOverride:StagingSchema.optional(),
 aspectOverride:z.string().regex(/^(?:1|2|3|4|5|9|16|21):(?:1|2|3|4|5|9|16)$/).optional(),
 /** Research references the user removed from the package (ids); the kept ones are taken from the turn on the server. */
 excludeReferences:z.array(z.string().uuid()).max(14).optional()
}).strict();
export async function POST(request:Request){
 let payload:unknown;try{payload=await request.json();}catch{return NextResponse.json({error:"invalid_json"},{status:400,headers});}
 const parsed=schema.safeParse(payload);if(!parsed.success)return NextResponse.json({error:"invalid_request"},{status:400,headers});
 try{
  const {stagingOverride,aspectOverride,...q}=parsed.data;
  // An arranged scene makes a new private turn from the original (the prompt stays on the server); the quote binds to that turn, so it cannot be swapped later.
  const turnId=stagingOverride?deriveTurnWithStaging(q.turnId,stagingOverride,aspectOverride):q.turnId;
  if(!turnId)throw new QuoteError("unknown_turn");
  return NextResponse.json(createQuote({...q,turnId}),{headers});
 }
 catch(e){
  // A photo edit that changes the camera and the light together is refused before any price, with what to do instead.
  if(e instanceof SceneOccluded)return NextResponse.json({error:e.code,message:e.messageFa},{status:409,headers});
  if(e instanceof SceneEditConflict)return NextResponse.json({error:e.code,message:e.messageFa},{status:409,headers});
  if(e instanceof QuoteError)return NextResponse.json(e.code==="price_pending"?{error:e.code,message:FA_PRICE_PENDING}:e.code==="dev_cap_reached"?{error:e.code,message:FA_DEV_CAP_REACHED}:{error:e.code},{status:e.status,headers});
  return NextResponse.json({error:"internal_error"},{status:500,headers});
 }
}
