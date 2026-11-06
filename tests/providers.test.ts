import {test} from "node:test";
import assert from "node:assert/strict";
import {MockMediaProvider,RoutingMediaProvider,registerAdapter,splitRequestId,tagRequestId,type MediaProvider} from "../lib/media-provider";
import {hasProviderCredentials,PROVIDER_CREDENTIAL_ENV} from "../lib/provider-credentials";
import {isStoredMediaUrl,readMedia,storeMedia} from "../lib/media-store";
import {MEDIA_CATALOG} from "../lib/catalog";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
// Media the adapters store goes to a temporary folder, never the real `.media/` store.
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-media-test-"));

test("provider request ids name their provider; Higgsfield ids keep their original form",()=>{
 assert.equal(tagRequestId("higgsfield","abc-123"),"abc-123");
 assert.equal(tagRequestId("google","models/x/operations/1"),"google:models/x/operations/1");
 assert.deepEqual(splitRequestId("google:models/x/operations/1"),{provider:"google",id:"models/x/operations/1"});
 assert.deepEqual(splitRequestId("kling:task:9"),{provider:"kling",id:"task:9"},"only the first prefix is the provider");
 assert.deepEqual(splitRequestId("abc-123"),{provider:"higgsfield",id:"abc-123"});
 assert.deepEqual(splitRequestId("other:1"),{provider:"higgsfield",id:"other:1"},"an unknown prefix is not a provider");
});
test("the router sends each call to the adapter of the model's provider, and status and cancel back to the same one",async()=>{
 const seen:string[]=[],mock=new MockMediaProvider();
 const fake:MediaProvider={submit:async j=>{seen.push("submit:"+j.modelId);return mock.submit();},status:async id=>{seen.push("status:"+id);return mock.status(id);},cancel:async id=>{seen.push("cancel:"+id);return mock.cancel(id);}};
 registerAdapter("higgsfield",()=>fake);
 const r=new RoutingMediaProvider("dev_live"),{providerRequestId}=await r.submit({modelId:"soul-image",prompt:"p",configuration:{},idempotencyKey:"k"});
 assert.ok(providerRequestId.startsWith("mock-"),"higgsfield ids are not prefixed");
 await r.status(providerRequestId);
 assert.deepEqual(seen,["submit:soul-image","status:"+providerRequestId]);
 const kseen:string[]=[];registerAdapter("kling",()=>({...fake,status:async id=>{kseen.push(id);return {state:"queued",outputs:[]};}}));
 assert.equal((await r.status("kling:t1")).state,"queued");assert.deepEqual(kseen,["t1"],"a tagged id reaches its own provider, prefix removed");
 await assert.rejects(()=>r.submit({modelId:"no-such-model",prompt:"p",configuration:{},idempotencyKey:"k"}),/Unknown model/);
});
test("credentials are per provider and every model names one",()=>{
 const saved={...process.env};
 try{
  for(const k of Object.values(PROVIDER_CREDENTIAL_ENV).flat())delete process.env[k];
  assert.equal(hasProviderCredentials("kling"),false);
  process.env.KLING_API_KEY="k";assert.equal(hasProviderCredentials("kling"),true);
  assert.equal(hasProviderCredentials("google"),false);
 }finally{process.env={...saved};}
 for(const m of MEDIA_CATALOG)assert.ok(["higgsfield","google","byteplus","kling"].includes(m.provider),m.id);
});
test("media store: stored bytes come back at an unguessable id; only stored media types; the route path is recognized",async()=>{
 const bytes=new Uint8Array([137,80,78,71,1,2,3]);
 const s=await storeMedia(bytes,"image/png");
 assert.ok(isStoredMediaUrl(s.url));assert.ok(!isStoredMediaUrl("/api/generation/media/../../etc"));
 const back=await readMedia(s.id);assert.equal(back?.mime,"image/png");assert.deepEqual(new Uint8Array(back!.bytes),bytes);
 assert.equal(await readMedia("../secret"),undefined);
 await assert.rejects(()=>storeMedia(bytes,"text/html" as "image/png"),/Unsupported/);
 await assert.rejects(()=>storeMedia(new Uint8Array(),"image/png"),/size/);
});
