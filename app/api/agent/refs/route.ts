import {NextResponse} from "next/server";
import {RefInputSchema,resolveReferences} from "@/lib/ref-resolver";
import {evaluateTextSafety} from "@/lib/safety";
const headers={"Cache-Control":"no-store"};
/**
 * POST /api/agent/refs: the earlier files and generations a message is about, read from the whole chat (lib/ref-resolver.ts). The studio calls it
 * before sending a message with no files or # of its own. Answers `{tags}` (internal tags only, never a model, prompt or private detail); any problem
 * answers no tags, so the turn goes on as before.
 */
export async function POST(request:Request){
 let payload:unknown;try{payload=await request.json();}catch{return NextResponse.json({tags:[],resolved:false},{status:400,headers});}
 const parsed=RefInputSchema.safeParse(payload);
 if(!parsed.success)return NextResponse.json({tags:[],resolved:false},{status:400,headers});
 // The same text preflight as a turn: a message or history line that fails it is not sent to a model.
 if(evaluateTextSafety(parsed.data.text).decision!=="allow")return NextResponse.json({tags:[],resolved:false},{headers});
 const history=parsed.data.history.filter(t=>evaluateTextSafety(t.text).decision==="allow");
 const tags=await resolveReferences({...parsed.data,history});
 // `resolved: false`: it could not be read, so the studio falls back to its word rules (lib/follow-up.ts).
 return NextResponse.json({tags:tags??[],resolved:tags!==null},{headers});
}
