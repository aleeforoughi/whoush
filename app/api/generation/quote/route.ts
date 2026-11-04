import {NextResponse} from "next/server";
import {z} from "zod";
import {findMediaModel} from "@/lib/catalog";
const schema=z.object({modelId:z.string().min(1).max(128)}).strict();
export async function POST(request:Request){
 let payload:unknown;try{payload=await request.json();}catch{return NextResponse.json({error:"invalid_json"},{status:400});}
 const parsed=schema.safeParse(payload);if(!parsed.success)return NextResponse.json({error:"invalid_request"},{status:400});
 const model=findMediaModel(parsed.data.modelId);if(!model)return NextResponse.json({error:"unsupported_model"},{status:422});
 return NextResponse.json({mode:"demo",modelId:model.id,neurons:model.neurons,requiresApproval:true,chargeable:false,reason:"No production generation approval or customer wallet"},{headers:{"Cache-Control":"no-store"}});
}
