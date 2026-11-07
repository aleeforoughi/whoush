import {NextResponse} from "next/server";
import {readMedia} from "@/lib/media-store";
import {rangedResponse} from "@/lib/media-range";
// TODO(plan phase 02): serve only to the job's owner (session); today the id is an unguessable capability, as for the demo owner elsewhere.
// Byte ranges (lib/media-range.ts): Safari on iPhone plays a video only from 206 Partial Content answers.
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,m=await readMedia(id);
 if(!m)return NextResponse.json({error:"not_found"},{status:404,headers:{"Cache-Control":"no-store"}});
 return rangedResponse(new Uint8Array(m.bytes),m.mime,request.headers.get("range"),{"Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"});
}
