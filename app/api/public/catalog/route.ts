import {NextResponse} from "next/server";
import {MEDIA_CATALOG,MEDIA_CATALOG_VERSION} from "@/lib/catalog";
export function GET(){
 // Public projection: no verification status, evidence, API paths or provider data.
 const models=MEDIA_CATALOG.map(({id,name,kind,description,neurons,resolution,durationSeconds,capabilities:c})=>({id,name,kind,description,neurons,resolution,durationSeconds,
  capabilities:{referenceImages:c.referenceImages,aspectRatios:c.aspectRatios,durationsSeconds:c.durationsSeconds,audio:c.audio,lipSync:c.lipSync,motionReference:c.motionReference,videoReference:c.videoReference}}));
 return NextResponse.json({mode:"demo",catalogVersion:MEDIA_CATALOG_VERSION,models},{headers:{"Cache-Control":"no-store"}});
}
