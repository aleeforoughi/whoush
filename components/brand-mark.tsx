"use client";
import Link from "next/link";
import {cn} from "@aleeforoughi/feather-react";

/** Latin wordmark first, Persian name beside it. The Latin part is isolated so bidi never reorders it. */
export function BrandMark({className=""}:{className?:string}){
 return <Link href="/" aria-label="هووش، صفحه اصلی" className={cn("inline-flex min-h-control items-center gap-2 rounded-control text-fg-primary motion-hover hover:opacity-80",className)}>
  <bdi dir="ltr" className="font-heading type-title">whoush</bdi>
  <span className="type-label text-fg-secondary" aria-hidden="true">هووش</span>
 </Link>;
}
