/**
 * Byte ranges for served media (owner, 2026-11-07: a finished video showed nothing on the phone). Safari, on iPhone above all, plays an MP4 only from a server
 * that answers `Range` requests with 206 Partial Content; a plain 200 leaves the player empty. One range per request (what players send); a multi-range or
 * malformed header gets the whole file, and a range past the end gets 416.
 */
export type ByteRange={start:number;end:number};

/** The single range asked for in a `Range` header, clamped to the file; null for the whole file; "unsatisfiable" when it starts past the end. */
export function parseRange(header:string|null,size:number):ByteRange|null|"unsatisfiable"{
 if(!header)return null;
 const m=/^bytes=(\d*)-(\d*)$/.exec(header.trim());
 if(!m||(m[1]===""&&m[2]===""))return null;
 if(m[1]===""){ // the last N bytes
  const n=Number(m[2]);if(!Number.isSafeInteger(n)||n<=0)return "unsatisfiable";
  return {start:Math.max(0,size-n),end:size-1};
 }
 const start=Number(m[1]),end=m[2]===""?size-1:Math.min(Number(m[2]),size-1);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return "unsatisfiable";
 return {start,end};
}

/** The response for `bytes`: 206 with Content-Range for a range, 416 when it cannot be served, else 200; every answer says ranges are accepted. */
export function rangedResponse(bytes:Uint8Array,mime:string,rangeHeader:string|null,base:Record<string,string>={}):Response{
 const size=bytes.byteLength,headers={...base,"Content-Type":mime,"Accept-Ranges":"bytes"};
 const r=parseRange(rangeHeader,size);
 if(r==="unsatisfiable")return new Response(null,{status:416,headers:{...headers,"Content-Range":"bytes */"+size}});
 if(!r)return new Response(new Blob([bytes.slice()],{type:mime}),{status:200,headers:{...headers,"Content-Length":String(size)}});
 return new Response(new Blob([bytes.slice(r.start,r.end+1)],{type:mime}),{status:206,headers:{...headers,"Content-Range":"bytes "+r.start+"-"+r.end+"/"+size,"Content-Length":String(r.end-r.start+1)}});
}
