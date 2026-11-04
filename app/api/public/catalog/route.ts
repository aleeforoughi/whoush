import {NextResponse} from "next/server";
import {MEDIA_CATALOG,MEDIA_CATALOG_VERSION} from "@/lib/catalog";
import {needsHostedMedia} from "@/lib/policy";
import {isPriced} from "@/lib/types";
export function GET(){
 // Public projection: no verification status, evidence, API paths or provider data. Only a model with one fixed Neuron price that needs no hosted user media is `available`;
 // the others (price pending, or priced by source length like Genjutsu) are listed `available:false` with no Neuron price.
 const models=MEDIA_CATALOG.map(m=>({m,c:m.capabilities})).map(({m,c})=>({id:m.id,name:m.name,kind:m.kind,description:m.description,available:isPriced(m)&&!needsHostedMedia(m),neurons:isPriced(m)?m.neurons:undefined,resolution:m.resolution,durationSeconds:m.durationSeconds,
  capabilities:{referenceImages:c.referenceImages,aspectRatios:c.aspectRatios,durationsSeconds:c.durationsSeconds,audio:c.audio,lipSync:c.lipSync,motionReference:c.motionReference,videoReference:c.videoReference,startImage:c.startImage,endImage:c.endImage,videoContinuation:c.videoContinuation}}));
 return NextResponse.json({mode:"demo",catalogVersion:MEDIA_CATALOG_VERSION,models},{headers:{"Cache-Control":"no-store"}});
}
