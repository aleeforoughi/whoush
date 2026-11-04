import {Suspense} from "react";
import {Studio} from "@/components/studio";
/** The studio reads ?project= and ?character=, so it renders on the client behind a Suspense boundary. */
export default function StudioPage(){return <Suspense fallback={<div className="h-dvh" aria-busy="true"/>}><Studio/></Suspense>;}
