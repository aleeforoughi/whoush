import {Suspense} from "react";
import type {Metadata} from "next";
import {AssetsGallery} from "@/components/assets-gallery";

export const metadata:Metadata={title:"دارایی‌ها | هووش"};
/** The gallery reads its filters from ?kind= and ?project=, so it renders on the client behind a Suspense boundary. */
export default function AssetsPage(){return <Suspense fallback={<div className="h-dvh" aria-busy="true"/>}><AssetsGallery/></Suspense>;}
