import {NextResponse} from "next/server";
import {readMedia} from "@/lib/media-store";
// TODO(plan phase 02): serve only to the job's owner (session); today the id is an unguessable capability, as for the demo owner elsewhere.
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,m=await readMedia(id);
 if(!m)return NextResponse.json({error:"not_found"},{status:404,headers:{"Cache-Control":"no-store"}});
 return new NextResponse(new Uint8Array(m.bytes),{headers:{"Content-Type":m.mime,"Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"}});
}
