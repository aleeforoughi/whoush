import {NextResponse} from "next/server";
import {z} from "zod";
import {executeApprovedQuote,JobError,moderateAtExecution,toPublicJob} from "@/lib/jobs";
import {QuoteError} from "@/lib/quotes";
const headers={"Cache-Control":"no-store"};
const schema=z.object({token:z.string().min(1).max(4096),approved:z.literal(true),idempotencyKey:z.string().uuid()}).strict();
// TODO(plan phase 02): derive owner from the authenticated session; single demo owner until auth exists.
const DEMO_OWNER="demo-owner";
export async function POST(request:Request){
 let payload:unknown;try{payload=await request.json();}catch{return NextResponse.json({error:"invalid_json"},{status:400,headers});}
 const parsed=schema.safeParse(payload);if(!parsed.success)return NextResponse.json({error:"invalid_request"},{status:400,headers});
 try{
  const job=await executeApprovedQuote({...parsed.data,ownerId:DEMO_OWNER,moderation:moderateAtExecution(parsed.data.token)});
  return NextResponse.json(toPublicJob(job),{headers});
 }catch(e){
  if(e instanceof QuoteError||e instanceof JobError)return NextResponse.json({error:e.code},{status:e.status,headers});
  return NextResponse.json({error:"internal_error"},{status:500,headers});
 }
}
