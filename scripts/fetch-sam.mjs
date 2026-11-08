// Fetches the on-device segmentation model for the magic wand and Whoush's exact masks (docs/evidence/SEGMENTATION.md) into public/models, served by
// Whoush itself (no request to Hugging Face from users' browsers). Pinned to one revision; each file is checked against its recorded SHA-256.
// Run: npm run models. The files are git-ignored (Apache-2.0, ~14 MB).
import {createHash} from "node:crypto";
import {copyFile,mkdir,readFile,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";

const ID="Xenova/slimsam-77-uniform",REV="5850ab45f587c112167512ffef949107115e26a0";
/** SHA-256 of each file at REV (recorded on the first fetch, 2026-11-08). */
const FILES={
 "config.json":"6339884f168658d3ca6473b486973913fb33e84e625e06ae2dd7b4a808187419",
 "preprocessor_config.json":"225545a743c654e3c495ec6f545a0eaba57c8ba3fbbd8483b3cb1c0fc58db517",
 "onnx/vision_encoder_quantized.onnx":"cce23c7b2e5d4f330932738fb67ba518e04b0d99ccdd1cccd22a7da4e01f2971",
 "onnx/prompt_encoder_mask_decoder_quantized.onnx":"cb90b279f549d2cab7fd6e20c38522438c65d84bdcca3d2a764cff7d857fdce2"
};
const root=join(process.cwd(),"public","models",ID);
const sha=b=>createHash("sha256").update(b).digest("hex");
for(const [file,want] of Object.entries(FILES)){
 const out=join(root,file);
 const have=await readFile(out).catch(()=>null);
 if(have&&want&&sha(have)===want){console.log("ok",file);continue;}
 const res=await fetch(`https://huggingface.co/${ID}/resolve/${REV}/${file}`,{headers:{"user-agent":"whoush-build"}});
 if(!res.ok)throw new Error(file+": HTTP "+res.status);
 const buf=Buffer.from(await res.arrayBuffer()),got=sha(buf);
 if(want&&got!==want)throw new Error(file+": checksum mismatch "+got);
 await mkdir(dirname(out),{recursive:true});await writeFile(out,buf);
 console.log("fetched",file,buf.length,"bytes sha256",got);
}

// The WebAssembly runtime the model runs on, from the installed onnxruntime-web (the same version transformers.js expects), served by Whoush too:
// by default it would be fetched from a CDN at runtime.
const ort=join(process.cwd(),"public","models","ort");await mkdir(ort,{recursive:true});
for(const f of ["ort-wasm-simd-threaded.asyncify.mjs","ort-wasm-simd-threaded.asyncify.wasm","ort-wasm-simd-threaded.jsep.mjs","ort-wasm-simd-threaded.jsep.wasm"]){
 await copyFile(join(process.cwd(),"node_modules","onnxruntime-web","dist",f),join(ort,f));console.log("copied",f);
}

// Face parts for the wand (docs/evidence/SEGMENTATION.md): Google MediaPipe Face Landmarker (478 points) and the multiclass selfie segmenter (hair,
// face skin, body skin, clothes), both Apache-2.0 per their model cards, version 1 of each, plus the tasks-vision WebAssembly from the installed package.
const MP={
 "face_landmarker.task":["https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task","64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"],
 "selfie_multiclass_256x256.tflite":["https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite","c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0"]
};
const mp=join(process.cwd(),"public","models","mediapipe");await mkdir(join(mp,"wasm"),{recursive:true});
for(const [file,[url,want]] of Object.entries(MP)){
 const out=join(mp,file),have=await readFile(out).catch(()=>null);
 if(have&&want&&sha(have)===want){console.log("ok",file);continue;}
 const res=await fetch(url,{headers:{"user-agent":"whoush-build"}});if(!res.ok)throw new Error(file+": HTTP "+res.status);
 const buf=Buffer.from(await res.arrayBuffer()),got=sha(buf);if(want&&got!==want)throw new Error(file+": checksum mismatch "+got);
 await writeFile(out,buf);console.log("fetched",file,buf.length,"bytes sha256",got);
}
for(const f of ["vision_wasm_internal.js","vision_wasm_internal.wasm"])await copyFile(join(process.cwd(),"node_modules","@mediapipe","tasks-vision","wasm",f),join(mp,"wasm",f));
console.log("copied mediapipe wasm");
