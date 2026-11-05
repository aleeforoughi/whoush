"use client";
/**
 * «بوم»'s frame in real 3D: a lo-fi set (procedural clay figures and the place) seen through a real perspective camera, from the same staging the 2D
 * drawing and the provider prompt use (lib/scene3d.ts). Wide lenses stretch near things, long lenses compress, high and low angles see the ground and the
 * figures as they are, the Dutch angle rolls the camera, very wide lenses bow into a fisheye, and depth of field follows the lens, aperture and focus.
 * Loaded only when «بوم» is open (one WebGL view at a time); the collapsed snapshots stay 2D drawings.
 */
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {Canvas,useThree,type ThreeEvent} from "@react-three/fiber";
import {EffectComposer,DepthOfField} from "@react-three/postprocessing";
import {Effect} from "postprocessing";
import * as THREE from "three";
import type {Staging} from "@/lib/creative-plan";
import {SCENE_COLORS as C,camera3D,stageFromWorld,depthOfField,propSize,propWorld,type Camera3D,type FrameRect,wideFrameRect} from "@/lib/scene3d";
import {frameSize as frameSizeOf,genderOf,propTints,type SceneProp} from "@/lib/staging";

/** A material for one figure: clay, or the soft tint that tells several props of the same kind apart. */
function Mat({tint,color,selected}:{tint?:string;color?:string;selected?:boolean}){
 return <meshStandardMaterial color={color??tint??C.clay} roughness={0.75} metalness={0.02} emissive={selected?C.selected:C.black} emissiveIntensity={selected?0.25:0}/>;
}

// ---- the figures: simple clay forms in real sizes (metres), their front facing +z ----
/** A jointed mannequin (so poses can come later): legs, torso, arms, head, and the pack's grey hair, short for a man, a bob for a woman. */
function Person({h,female,tint,selected}:{h:number;female:boolean;tint?:string;selected?:boolean}){
 const s=h/1.75;
 return <group scale={s}>
  {[-1,1].map(side=><mesh key={side} position={[side*0.1,0.45,0]}><capsuleGeometry args={[0.075,0.72,6,12]}/><Mat tint={tint} selected={selected}/></mesh>)}
  <mesh position={[0,1.12,0]}><capsuleGeometry args={[female?0.16:0.18,0.36,8,16]}/><Mat tint={tint} selected={selected}/></mesh>
  {[-1,1].map(side=><mesh key={side} position={[side*(female?0.23:0.26),1.06,0]}><capsuleGeometry args={[0.05,0.5,6,10]}/><Mat tint={tint} selected={selected}/></mesh>)}
  <mesh position={[0,1.42,0]}><cylinderGeometry args={[0.05,0.06,0.1,10]}/><Mat tint={tint} selected={selected}/></mesh>
  <mesh position={[0,1.58,0]}><sphereGeometry args={[0.12,24,18]}/><Mat tint={tint} selected={selected}/></mesh>
  {female
   ?<group><mesh position={[0,1.61,-0.02]} scale={[1.08,1,1.08]}><sphereGeometry args={[0.125,24,18,0,Math.PI*2,0,Math.PI*0.55]}/><Mat color={C.hair}/></mesh>
     <mesh position={[0,1.5,-0.035]}><cylinderGeometry args={[0.135,0.14,0.2,20,1,true,Math.PI*0.62,Math.PI*1.76]}/><meshStandardMaterial color={C.hair} side={THREE.DoubleSide} roughness={0.8}/></mesh></group>
   :<mesh position={[0,1.62,-0.025]} scale={[1.05,0.9,1.05]}><sphereGeometry args={[0.122,24,18,0,Math.PI*2,0,Math.PI*0.5]}/><Mat color={C.hair}/></mesh>}
 </group>;
}
/** A small car, its front (windscreen and lights) toward +z, tail lights at the back. */
function Car({tint,selected}:{tint?:string;selected?:boolean}){
 return <group>
  <mesh position={[0,0.62,0]}><boxGeometry args={[1.75,0.62,3.9]}/><Mat tint={tint} selected={selected}/></mesh>
  <mesh position={[0,1.18,-0.25]}><boxGeometry args={[1.55,0.55,2.1]}/><Mat tint={tint} selected={selected}/></mesh>
  <mesh position={[0,1.18,0.82]} rotation={[-0.5,0,0]}><boxGeometry args={[1.45,0.5,0.04]}/><meshStandardMaterial color={C.glass} roughness={0.3}/></mesh>
  {[-0.6,0.6].map(x=><mesh key={x} position={[x,0.7,1.96]}><sphereGeometry args={[0.11,12,10]}/><meshStandardMaterial color={C.clay} emissive={C.clay} emissiveIntensity={0.3}/></mesh>)}
  {[-0.62,0.62].map(x=><mesh key={x} position={[x,0.72,-1.96]}><boxGeometry args={[0.3,0.12,0.04]}/><meshStandardMaterial color={C.tail}/></mesh>)}
  {[[-0.88,1.25],[0.88,1.25],[-0.88,-1.25],[0.88,-1.25]].map(([x,z])=><mesh key={x+"_"+z} position={[x,0.33,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.33,0.33,0.22,20]}/><meshStandardMaterial color={C.dark}/></mesh>)}
 </group>;
}
/** A sitting cat, facing +z. */
function Cat({tint,selected}:{tint?:string;selected?:boolean}){
 return <group>
  <mesh position={[0,0.17,-0.02]} scale={[0.17,0.17,0.24]}><sphereGeometry args={[1,20,16]}/><Mat tint={tint} selected={selected}/></mesh>
  <mesh position={[0,0.36,0.12]}><sphereGeometry args={[0.1,20,16]}/><Mat tint={tint} selected={selected}/></mesh>
  {[-1,1].map(s=><mesh key={s} position={[s*0.055,0.46,0.12]}><coneGeometry args={[0.035,0.07,8]}/><Mat tint={tint} selected={selected}/></mesh>)}
  <mesh position={[0.1,0.06,-0.2]} rotation={[0,0.6,Math.PI/2]}><capsuleGeometry args={[0.025,0.25,4,8]}/><Mat tint={tint} selected={selected}/></mesh>
 </group>;
}
const Bottle=({tint,selected}:{tint?:string;selected?:boolean})=><group>
 <mesh position={[0,0.13,0]}><cylinderGeometry args={[0.055,0.06,0.26,24]}/><Mat tint={tint} selected={selected}/></mesh>
 <mesh position={[0,0.29,0]}><cylinderGeometry args={[0.022,0.04,0.07,16]}/><Mat tint={tint} selected={selected}/></mesh>
</group>;
const Tree=({tint,selected,h=6}:{tint?:string;selected?:boolean;h?:number})=><group scale={h/6}>
 <mesh position={[0,1.4,0]}><cylinderGeometry args={[0.16,0.24,2.8,10]}/><Mat color={C.bark} selected={selected}/></mesh>
 <mesh position={[0,4,0]}><icosahedronGeometry args={[2,1]}/><Mat tint={tint} color={tint?undefined:C.foliage} selected={selected}/></mesh>
</group>;
const Building=({tint,selected,h=14}:{tint?:string;selected?:boolean;h?:number})=><mesh position={[0,h/2,0]}><boxGeometry args={[9,h,9]}/><Mat tint={tint} selected={selected}/></mesh>;

function Figure({p,tint,selected}:{p:SceneProp;tint?:string;selected?:boolean}){
 const sz=propSize(p);
 switch(p.kind){
  case "person":return <Person h={sz.h} female={genderOf(p)==="female"} tint={tint} selected={selected}/>;
  case "vehicle":return <Car tint={tint} selected={selected}/>;
  case "animal":return <Cat tint={tint} selected={selected}/>;
  case "object":return <Bottle tint={tint} selected={selected}/>;
  case "tree":return <Tree tint={tint} selected={selected}/>;
  case "building":return <Building tint={tint} selected={selected}/>;
 }
}

// ---- the place: the ground and what stands behind, at its real distance ----
function Place({env,backdrop}:{env:NonNullable<Staging["environment"]>;backdrop:number}){
 const ground=<mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]}><planeGeometry args={[4000,4000]}/><meshStandardMaterial color={C.ground} roughness={1}/></mesh>;
 const rnd=(i:number)=>((Math.sin(i*12.9898)*43758.5453)%1+1)%1;
 if(env==="room"){
  const D=backdrop,Wd=4.5,Hc=3;
  return <group>
   {ground}
   <mesh position={[0,Hc/2,-D]}><planeGeometry args={[Wd*2,Hc]}/><meshStandardMaterial color={C.wall} roughness={1}/></mesh>
   {[-1,1].map(s=><mesh key={s} position={[s*Wd,Hc/2,-D+12]} rotation={[0,-s*Math.PI/2,0]}><planeGeometry args={[24,Hc]}/><meshStandardMaterial color={C.wall} roughness={1}/></mesh>)}
   <mesh position={[0,Hc,-D+12]} rotation={[Math.PI/2,0,0]}><planeGeometry args={[Wd*2,24]}/><meshStandardMaterial color={C.wall} roughness={1}/></mesh>
   <mesh position={[1.4,1.6,-D+0.01]}><planeGeometry args={[1.4,1.5]}/><meshStandardMaterial color={C.window} emissive={C.window} emissiveIntensity={0.35}/></mesh>
  </group>;
 }
 if(env==="studio")return <group>
  <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[40,40]}/><meshStandardMaterial color={C.wall} roughness={1}/></mesh>
  <mesh position={[0,6,-backdrop]}><planeGeometry args={[40,12]}/><meshStandardMaterial color={C.wall} roughness={1}/></mesh>
 </group>;
 if(env==="street")return <group>{ground}{Array.from({length:18},(_,i)=><group key={i} position={[(i-9)*11,0,-backdrop-rnd(i)*8]}><Building h={10+rnd(i+3)*18}/></group>)}</group>;
 if(env==="forest")return <group>{ground}{Array.from({length:40},(_,i)=><group key={i} position={[(rnd(i)-0.5)*120,0,-backdrop-rnd(i+7)*25]}><Tree h={5+rnd(i+11)*5}/></group>)}</group>;
 if(env==="beach")return <group>{ground}<mesh rotation={[-Math.PI/2,0,0]} position={[0,0.02,-30-2000]}><planeGeometry args={[4000,4000]}/><meshStandardMaterial color={C.sea} roughness={0.4}/></mesh></group>;
 if(env==="desert")return <group>{ground}{Array.from({length:14},(_,i)=><mesh key={i} position={[(i-7)*90,0,-backdrop-rnd(i)*80]} scale={[70,10+rnd(i+2)*14,40]}><sphereGeometry args={[1,24,12,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color={C.clay} roughness={1}/></mesh>)}</group>;
 return <group>{ground}{Array.from({length:11},(_,i)=><mesh key={i} position={[(i-5)*110+rnd(i)*40,0,-backdrop-rnd(i+5)*120]}><coneGeometry args={[70+rnd(i+1)*50,50+rnd(i+2)*70,7]}/><meshStandardMaterial color={C.clay} roughness={1} flatShading/></mesh>)}</group>;
}

// ---- the camera, depth of field and fisheye ----
/** A barrel distortion (fisheye) on the final picture: the centre bulges, straight lines bow toward the edges. */
class FisheyeEffect extends Effect{
 constructor(){super("Fisheye",`uniform float strength;
void mainUv(inout vec2 uv){vec2 p=uv*2.0-1.0;float r2=dot(p,p);p*=1.0-strength*0.35*r2;uv=p*0.5+0.5;}
void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){outputColor=inputColor;}`,{uniforms:new Map([["strength",new THREE.Uniform(0)]])});}
}
export type {FrameRect} from "@/lib/scene3d";
function Rig({cam,wide,frameAspect,onFrameRect}:{cam:Camera3D;wide?:boolean;frameAspect:number;onFrameRect?:(r:FrameRect)=>void}){
 // The three.js camera is a mutable scene object (R3F's own, not React state): read through the store's getter and set in place.
 const {get,size,invalidate}=useThree();
 useLayoutEffect(()=>{
  const c=get().camera as THREE.PerspectiveCamera;
  c.near=0.03;c.far=6000;c.aspect=size.width/size.height;
  c.position.set(...cam.position);c.up.set(0,1,0);c.lookAt(...cam.target);c.rotateZ(-cam.roll);
  if(wide){
   // The same camera, seeing more: the frame is a window in the middle (moved by the crop); the field of view grows so that window keeps the lens's view.
   const r=wideFrameRect(cam,frameAspect,size.width,size.height);
   c.fov=2*Math.atan(Math.tan(cam.fov*Math.PI/360)/r.h)*180/Math.PI;c.clearViewOffset();onFrameRect?.(r);
  }else{
   c.fov=cam.fov*(1+cam.fisheye*0.6);
   c.setViewOffset(size.width,size.height,cam.shift[0]*size.width,cam.shift[1]*size.height,size.width,size.height);
  }
  c.updateProjectionMatrix();invalidate();
 },[cam,get,size,invalidate,wide,frameAspect,onFrameRect]);
 return null;
}
/** Depth of field from the real lens: the in-focus range from the thin-lens formula, the blur size from the aperture and focal length. */
function Lens({cam,wide}:{cam:Camera3D;wide?:boolean}){
 const fisheye=useMemo(()=>new FisheyeEffect(),[]);
 // The fisheye bends the frame's own picture; the wide view keeps straight lines so the frame's edges stay where they are.
 const bend=wide?0:cam.fisheye;
 useEffect(()=>{(fisheye.uniforms.get("strength") as THREE.Uniform).value=bend;},[fisheye,bend]);
 const dof=depthOfField(cam),range=Math.min(400,(Number.isFinite(dof.far)?dof.far:cam.focusDistance*20)-dof.near);
 const bokeh=Math.max(0,Math.min(8,(cam.focalMm/cam.aperture)/12));
 return <EffectComposer multisampling={0}>
  <DepthOfField worldFocusDistance={cam.focusDistance} worldFocusRange={Math.max(0.05,range)} bokehScale={bokeh}/>
  {bend>0?<primitive object={fisheye}/>:<></>}
 </EffectComposer>;
}
/** Reports where some world points land on screen (fractions of the view), for the HTML overlays (the selection's tag, the centre point). */
function Projector({points,ver,onProject}:{points:Record<string,[number,number,number]>;/** Changes whenever the camera does. */ver:string;onProject:(p:Record<string,[number,number]>)=>void}){
 const {camera,size}=useThree();
 const key=JSON.stringify(points);
 useLayoutEffect(()=>{
  // After the rig has placed the camera this frame (it runs first: it comes first in the tree).
  camera.updateMatrixWorld();
  const out:Record<string,[number,number]>={};
  for(const [k,v] of Object.entries(points)){const p=new THREE.Vector3(...v).project(camera);out[k]=[(p.x+1)/2,(1-p.y)/2];}
  onProject(out);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed when the points, the camera or the view change
 },[key,ver,camera,size.width,size.height]);
 return null;
}

/** R3F's own pointer capture on the 3D object (its event target carries it; typed as a plain DOM target). */
const cap=(e:ThreeEvent<PointerEvent>)=>e.target as unknown as {setPointerCapture(id:number):void;releasePointerCapture(id:number):void};

export type Scene3DProps={staging:Staging;anchor?:Staging;aspect:string;
 /** Props can be selected and dragged on the ground. */editable?:boolean;sel?:number|null;
 onSelect?:(i:number|null)=>void;
 /** A prop dropped at a new place (stage units). */onProp?:(i:number,x:number,z:number)=>void;
 /** A prop tapped (pressed and released without dragging it). */onPropTap?:(i:number)=>void;
 /** A press landed on a prop (it runs before the page's own handlers, so a press on the empty set can start a crop drag instead). */onPropDown?:()=>void;
 /** Where some points land on screen: `center` (the centre point) and `sel` (above the selected prop). */onProject?:(p:Record<string,[number,number]>)=>void;
 /** The wide (full-screen) view: the camera sees past the frame; `onFrameRect` says where the frame lies. */wide?:boolean;onFrameRect?:(r:FrameRect)=>void;
 /** The selection is locked on this prop: only it can be taken. */lockedTo?:number;
 /** Clamps a ground point to where the prop may go. */within?:(p:SceneProp,g:{x:number;z:number})=>{x:number;z:number}};

/** The 3D frame. Dragging a prop moves it on the ground under the finger, at any camera angle. */
export default function Scene3D({staging,anchor,aspect,editable,sel,onSelect,onProp,onPropTap,onPropDown,onProject,wide,onFrameRect,lockedTo,within}:Scene3DProps){
 // The prop being dragged, at its live place (the drawing follows the finger; the scene is updated on release).
 const [moving,setMoving]=useState<{i:number;x:number;z:number}|null>(null);
 const base=(staging.props??[]).map((p,i)=>moving?.i===i?{...p,x:moving.x,z:moving.z}:p);
 // The camera stays where it was while a prop moves (the main subject too): measured on the scene as it was, so only that prop moves.
 // Keyed by value: the page rebuilds equal stagings on every render, and the camera must only move when the scene does.
 const camKey=JSON.stringify([staging,anchor,aspect]);
 // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the value of the scene, not its identity
 const cam=useMemo(()=>camera3D(staging,anchor,aspect),[camKey]);
 const tints=propTints(base);
 const ray=useMemo(()=>new THREE.Raycaster(),[]);
 // A drag keeps the prop's own ground point (its feet, its wheels) under the same screen offset from the finger, as in 2D: where the finger grabbed it
 // (head, torso...) does not matter, and it never runs off toward the horizon.
 const grab=useRef<{i:number;feet:THREE.Vector2;from:THREE.Vector2;lift:number;px:number;py:number;far:boolean}|null>(null);
 const toStage=(pt:THREE.Vector3)=>stageFromWorld(pt.x,pt.z,staging,anchor);
 const points:Record<string,[number,number,number]>={center:cam.target};
 if(sel!=null&&base[sel]){const w=propWorld(base[sel],staging,anchor).pos;points.sel=[w[0],w[1]+propSize(base[sel]).h*1.05,w[2]];}
 const {W,H}=frameSizeOf(aspect);
 return <Canvas frameloop="demand" dpr={[1,2]} gl={{antialias:true,powerPreference:"low-power"}} camera={{position:cam.position,fov:cam.fov,near:0.03,far:6000}}
  style={{position:"absolute",inset:0,touchAction:"none"}}>
  <color attach="background" args={[C.sky]}/>
  <hemisphereLight args={[C.clay,C.ground,1.1]}/>
  <directionalLight position={[4,8,6]} intensity={1.6}/>
  <Rig cam={cam} wide={wide} frameAspect={W/H} onFrameRect={onFrameRect}/>
  {onProject&&<Projector points={points} ver={camKey+(wide?"w":"")} onProject={onProject}/>}
  <Place env={staging.environment??"landscape"} backdrop={cam.backdrop}/>
  {base.map((p,i)=>{const w=propWorld(p,staging,anchor);
   return <group key={i} position={w.pos} rotation={[0,w.rotY,0]}
    onPointerDown={editable?(e:ThreeEvent<PointerEvent>)=>{if(e.button>0||(lockedTo!==undefined&&lockedTo!==i))return;e.stopPropagation();onPropDown?.();onSelect?.(i);
     const f=new THREE.Vector3(...w.pos).project(e.camera);
     cap(e).setPointerCapture(e.pointerId);grab.current={i,feet:new THREE.Vector2(f.x,f.y),from:e.pointer.clone(),lift:w.pos[1],px:e.clientX,py:e.clientY,far:false};}:undefined}
    onPointerMove={editable?(e:ThreeEvent<PointerEvent>)=>{const g=grab.current;if(!g||g.i!==i)return;e.stopPropagation();
     if(!g.far&&Math.hypot(e.clientX-g.px,e.clientY-g.py)<5)return;g.far=true;
     ray.setFromCamera(g.feet.clone().add(e.pointer).sub(g.from),e.camera);
     const pt=new THREE.Vector3();if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-g.lift),pt))return;
     const raw=toStage(pt),c=within?within(p,raw):raw;
     if(Number.isFinite(c.x)&&Number.isFinite(c.z))setMoving({i,...c});}:undefined}
    onPointerUp={editable?(e:ThreeEvent<PointerEvent>)=>{const g=grab.current;if(!g||g.i!==i)return;e.stopPropagation();grab.current=null;
     try{cap(e).releasePointerCapture(e.pointerId);}catch{ /* already released */ }
     if(moving&&moving.i===i)onProp?.(i,moving.x,moving.z);else if(!g.far)onPropTap?.(i);setMoving(null);}:undefined}
    onPointerCancel={editable?()=>{grab.current=null;setMoving(null);}:undefined}>
    <Figure p={p} tint={tints[i]} selected={sel===i}/>
   </group>;})}
  <Lens cam={cam} wide={wide}/>
 </Canvas>;
}
