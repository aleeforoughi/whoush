import {test} from "node:test";
import assert from "node:assert/strict";
import {parseRange,rangedResponse} from "../lib/media-range";

test("owner (2026-11-07): a finished video plays on iPhone: byte ranges are answered with 206 and Content-Range",async()=>{
 const bytes=new Uint8Array([0,1,2,3,4,5,6,7,8,9]);
 const probe=rangedResponse(bytes,"video/mp4","bytes=0-1");
 assert.equal(probe.status,206);assert.equal(probe.headers.get("content-range"),"bytes 0-1/10");assert.equal(probe.headers.get("accept-ranges"),"bytes");
 assert.deepEqual([...new Uint8Array(await probe.arrayBuffer())],[0,1]);
 const whole=rangedResponse(bytes,"video/mp4",null);
 assert.equal(whole.status,200);assert.equal(whole.headers.get("accept-ranges"),"bytes");assert.equal((await whole.arrayBuffer()).byteLength,10);
 assert.equal(rangedResponse(bytes,"video/mp4","bytes=10-").status,416);
});
test("parseRange: open ends, suffixes and clamping; malformed or multi-range headers serve the whole file",()=>{
 assert.deepEqual(parseRange("bytes=4-",10),{start:4,end:9});
 assert.deepEqual(parseRange("bytes=-3",10),{start:7,end:9});
 assert.deepEqual(parseRange("bytes=2-99",10),{start:2,end:9});
 assert.equal(parseRange("bytes=5-2",10),"unsatisfiable");
 assert.equal(parseRange("bytes=0-1,4-5",10),null);
 assert.equal(parseRange("items=0-1",10),null);
 assert.equal(parseRange(null,10),null);
});
