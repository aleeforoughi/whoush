import {NextResponse} from "next/server";
import {getDemoPackageResponse} from "@/lib/pricing";
export function GET(){return NextResponse.json(getDemoPackageResponse(),{headers:{"Cache-Control":"no-store"}});}
