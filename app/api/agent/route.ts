import {NextResponse} from "next/server";
import {CreativeTurnInputSchema} from "@/lib/creative-plan";
import {orchestrateCreativeTurn,type OrchestratorResult,type TurnStage} from "@/lib/orchestrator";
const headers={"Cache-Control":"no-store"};
const INTERNAL_FA="خطایی رخ داد. لطفاً دوباره تلاش کن.";

/** The public response for a turn: HTTP status and body (unchanged from the JSON API; streaming wraps the same thing). */
function toResponse(out:OrchestratorResult):{status:number;body:Record<string,unknown>}{
 if(out.status==="restricted")return {status:422,body:{error:"content_restricted",category:out.category,decision:out.decision,message:out.message}};
 if(out.status==="needs_input")return {status:422,body:{error:"needs_input",turnId:out.turnId,message:out.message,question:out.question,...(out.reaction?{reaction:out.reaction}:{})}};
 if(out.status==="unsupported")return {status:422,body:{error:"no_compatible_model",turnId:out.turnId,plan:out.plan,message:out.message,...(out.suggestedModel?{suggestedModel:out.suggestedModel}:{})}};
 return {status:200,body:{...out.proposal,turnId:out.turnId,plan:out.plan,...(out.gif?{gif:out.gif}:{}),...(out.reaction?{reaction:out.reaction}:{})}};
}

/**
 * POST /api/agent. With `Accept: application/x-ndjson` the turn streams its progress: one line per real stage as it starts ({"type":"stage","stage":"planning"})
 * and then the result ({"type":"result","status":200,"body":{...}}), so the chat can show what Whoush is doing right away. The stages carry no private detail
 * (no model, provider or prompt). Without that header: one JSON response, as before.
 */
export async function POST(request:Request){
 let payload:unknown;try{payload=await request.json();}catch{return NextResponse.json({error:"invalid_json"},{status:400});}
 const parsed=CreativeTurnInputSchema.safeParse(payload);
 if(!parsed.success)return NextResponse.json({error:"invalid_request"},{status:400});
 if(!(request.headers.get("accept")??"").includes("application/x-ndjson")){
  try{const r=toResponse(await orchestrateCreativeTurn(parsed.data));return NextResponse.json(r.body,{status:r.status,headers});}
  catch{return NextResponse.json({error:"internal_error",message:INTERNAL_FA},{status:500,headers});}
 }
 const enc=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({
  async start(controller){
   const line=(o:unknown)=>{try{controller.enqueue(enc.encode(JSON.stringify(o)+"\n"));}catch{ /* the client went away */ }};
   try{
    const out=await orchestrateCreativeTurn(parsed.data,{onStage:(stage:TurnStage)=>line({type:"stage",stage})});
    line({type:"result",...toResponse(out)});
   }catch{line({type:"result",status:500,body:{error:"internal_error",message:INTERNAL_FA}});}
   controller.close();
  }
 });
 return new Response(stream,{headers:{...headers,"Content-Type":"application/x-ndjson; charset=utf-8","X-Accel-Buffering":"no"}});
}
