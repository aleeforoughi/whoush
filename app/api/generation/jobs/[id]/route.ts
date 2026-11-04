import {NextResponse} from "next/server";
import {pollJob,toPublicJob} from "@/lib/jobs";
const headers={"Cache-Control":"no-store"};
// TODO(plan phase 02): derive owner from the authenticated session.
const DEMO_OWNER="demo-owner";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!UUID.test(id))return NextResponse.json({error:"not_found"},{status:404,headers});
 try{
  const job=await pollJob(id,DEMO_OWNER);
  return job?NextResponse.json(toPublicJob(job),{headers}):NextResponse.json({error:"not_found"},{status:404,headers});
 }catch{return NextResponse.json({error:"internal_error"},{status:500,headers});}
}
