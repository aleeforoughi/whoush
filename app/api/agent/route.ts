import {NextResponse} from "next/server";
import {CreativeTurnInputSchema} from "@/lib/creative-plan";
import {orchestrateCreativeTurn} from "@/lib/orchestrator";
const headers={"Cache-Control":"no-store"};
export async function POST(request:Request){
 let payload:unknown;try{payload=await request.json();}catch{return NextResponse.json({error:"invalid_json"},{status:400});}
 const parsed=CreativeTurnInputSchema.safeParse(payload);
 if(!parsed.success)return NextResponse.json({error:"invalid_request"},{status:400});
 try{
  const out=await orchestrateCreativeTurn(parsed.data);
  if(out.status==="restricted")return NextResponse.json({error:"content_restricted",category:out.category,decision:out.decision,message:out.message},{status:422,headers});
  if(out.status==="needs_input")return NextResponse.json({error:"needs_input",turnId:out.turnId,message:out.message,question:out.question},{status:422,headers});
  if(out.status==="unsupported")return NextResponse.json({error:"no_compatible_model",turnId:out.turnId,plan:out.plan,message:out.message,...(out.suggestedModel?{suggestedModel:out.suggestedModel}:{})},{status:422,headers});
  return NextResponse.json({...out.proposal,turnId:out.turnId,plan:out.plan},{headers});
 }catch{return NextResponse.json({error:"internal_error",message:"خطایی رخ داد. لطفاً دوباره تلاش کن."},{status:500,headers});}
}
