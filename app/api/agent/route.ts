import {NextResponse} from "next/server";
import {z} from "zod";
import {createDemoProposal} from "@/lib/agent";
import {evaluateTextSafety} from "@/lib/safety";
const schema=z.object({text:z.string().trim().min(1).max(4000),preference:z.enum(["quality","speed","cost"]).default("quality")}).strict();
export async function POST(request:Request){
 let payload:unknown;try{payload=await request.json();}catch{return NextResponse.json({error:"invalid_json"},{status:400});}
 const parsed=schema.safeParse(payload);
 if(!parsed.success)return NextResponse.json({error:"invalid_request"},{status:400});
 const safety=evaluateTextSafety(parsed.data.text);
 if(safety.decision!=="allow")return NextResponse.json({error:"content_restricted",category:safety.category,decision:safety.decision,message:safety.message},{status:422,headers:{"Cache-Control":"no-store"}});
 return NextResponse.json(createDemoProposal(parsed.data.text,parsed.data.preference),{headers:{"Cache-Control":"no-store"}});
}
