import {NextResponse} from "next/server";
import {MEDIA_CATALOG} from "@/lib/catalog";
export function GET(){
 const models=MEDIA_CATALOG.map(({id,name,kind,description,neurons,resolution,durationSeconds})=>({id,name,kind,description,neurons,resolution,durationSeconds}));
 return NextResponse.json({mode:"demo",models},{headers:{"Cache-Control":"no-store"}});
}
