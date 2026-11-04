import {NextResponse} from "next/server";
import {z} from "zod";
import {findMediaModel} from "@/lib/catalog";
const schema=z.object({modelId:z.string().max(128)}).strict();
export async function POST(request:Request){
 let payload:unknown;try{payload=await request.json();}catch{return NextResponse.json({error:"invalid_json"},{status:400});}
 const parsed=schema.safeParse(payload);if(!parsed.success)return NextResponse.json({error:"invalid_request"},{status:400});
 if(!findMediaModel(parsed.data.modelId))return NextResponse.json({error:"unsupported_model"},{status:422});
 // No payment, credit deduction, user jobs or provider call in demo mode.
 return NextResponse.json({mode:"demo",chargedNeurons:0,hasRealMedia:false,message:"در نسخه نمایشی هیچ هزینه‌ای کم نشده و رسانه واقعی تولید نشده است.",sampleId:crypto.randomUUID()},{headers:{"Cache-Control":"no-store"}});
}
