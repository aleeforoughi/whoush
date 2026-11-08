/**
 * Cleans a segmentation mask (owner, 2026-11-08: "smooth the edges and fill the empty dot gaps"). Pure, so it runs in the worker and in tests.
 * - Holes: background patches enclosed by the object are filled when small (specks and gaps). A larger opening (the inside of a cup's handle,
 *   the space between an arm and the body) stays open, so what shows through it is not selected.
 * - Specks: small separate bits of the mask away from the object are dropped.
 * - Edges: two passes of a box blur, then a threshold at the middle, round off the stair-step edge without growing or shrinking the object.
 */
export type RefineOptions={/** Holes up to this share of the object's area are filled. */maxHole:number;/** Islands below this share of the largest part are dropped. */minIsland:number;/** Edge smoothing radius as a share of the longer side. */smooth:number};
export const REFINE_DEFAULTS:RefineOptions={maxHole:0.015,minIsland:0.02,smooth:0.0035};

/** Connected components (4-neighbour) of pixels equal to `value`: a label per pixel (0 = other) and each label's size and whether it touches the border. */
function components(m:Uint8Array,w:number,h:number,value:number){
 const label=new Int32Array(w*h),size=[0],border=[false],stack=new Int32Array(w*h);
 let next=0;
 for(let start=0;start<w*h;start++){
  if(m[start]!==value||label[start])continue;
  next++;let n=0,touches=false,top=0;stack[top++]=start;label[start]=next;
  while(top){
   const i=stack[--top],x=i%w,y=(i-x)/w;n++;
   if(x===0||y===0||x===w-1||y===h-1)touches=true;
   if(x>0&&m[i-1]===value&&!label[i-1]){label[i-1]=next;stack[top++]=i-1;}
   if(x<w-1&&m[i+1]===value&&!label[i+1]){label[i+1]=next;stack[top++]=i+1;}
   if(y>0&&m[i-w]===value&&!label[i-w]){label[i-w]=next;stack[top++]=i-w;}
   if(y<h-1&&m[i+w]===value&&!label[i+w]){label[i+w]=next;stack[top++]=i+w;}
  }
  size.push(n);border.push(touches);
 }
 return {label,size,border};
}

/** One horizontal then vertical box blur of radius r (running sums), in place on a Float32 plane. */
function boxBlur(src:Float32Array,w:number,h:number,r:number){
 const tmp=new Float32Array(w*h),k=2*r+1;
 for(let y=0;y<h;y++){let acc=0;const row=y*w;
  for(let x=-r;x<=r;x++)acc+=src[row+Math.min(w-1,Math.max(0,x))];
  for(let x=0;x<w;x++){tmp[row+x]=acc/k;acc+=src[row+Math.min(w-1,x+r+1)]-src[row+Math.max(0,x-r)];}
 }
 for(let x=0;x<w;x++){let acc=0;
  for(let y=-r;y<=r;y++)acc+=tmp[Math.min(h-1,Math.max(0,y))*w+x];
  for(let y=0;y<h;y++){src[y*w+x]=acc/k;acc+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x];}
 }
}

/** A cleaned copy of a 0/1 mask (w×h): small holes filled, specks dropped, edges smoothed. An empty mask comes back empty. */
export function refineMask(plane:Uint8Array,w:number,h:number,o:RefineOptions=REFINE_DEFAULTS):Uint8Array{
 const m=new Uint8Array(w*h);for(let i=0;i<w*h;i++)m[i]=plane[i]?1:0;
 let area=0;for(let i=0;i<w*h;i++)area+=m[i];
 if(!area)return m;
 // Holes: enclosed background patches small enough to be gaps.
 const bg=components(m,w,h,0);
 for(let i=0;i<w*h;i++){const l=bg.label[i];if(l&&!bg.border[l]&&bg.size[l]<=o.maxHole*area)m[i]=1;}
 // Specks: separate bits much smaller than the main part.
 const fg=components(m,w,h,1),largest=Math.max(...fg.size.slice(1));
 for(let i=0;i<w*h;i++){const l=fg.label[i];if(l&&fg.size[l]<o.minIsland*largest)m[i]=0;}
 // Edges: blur twice (close to a Gaussian) and cut at the middle.
 const r=Math.max(1,Math.round(o.smooth*Math.max(w,h)));
 const f=new Float32Array(w*h);for(let i=0;i<w*h;i++)f[i]=m[i];
 boxBlur(f,w,h,r);boxBlur(f,w,h,r);
 for(let i=0;i<w*h;i++)m[i]=f[i]>=0.5?1:0;
 return m;
}

/** Where a selection's badge goes: the middle of its top row (0..1 of the photo), so it never covers the object itself. */
export function maskTop(plane:Uint8Array,w:number,h:number):{x:number;y:number}|null{
 for(let y=0;y<h;y++){let x0=-1,x1=-1;for(let x=0;x<w;x++)if(plane[y*w+x]){if(x0<0)x0=x;x1=x;}if(x0>=0)return {x:(x0+x1)/2/w,y:y/h};}
 return null;
}
