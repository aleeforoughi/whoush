// Hair (grey) coverage of a figure PNG: per row near the head, the hair extents and whether the bbox centre column is hair. Heights as share of bbox height.
import {createRequire} from 'node:module'; const sharp=createRequire(new URL('../../package.json', import.meta.url))('sharp');
const [file,from,to,lumArg]=process.argv.slice(2); const LUM=+(lumArg||185);
const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}); const W=info.width,H=info.height;
const px=(x,y)=>{const i=(y*W+x)*4;return [data[i],data[i+1],data[i+2],data[i+3]];};
let x0=W,x1=-1,y0=H,y1=-1; for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(px(x,y)[3]>128){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
const bh=y1-y0+1,cx=(x0+x1)/2,out=[];
for(let s=+from;s>=+to;s-=0.01){const y=Math.round(y0+(1-s)*bh);let hs=[];let inH=false,st=0;
 for(let x=x0;x<=x1+1;x++){const p=x<=x1?px(x,y):[0,0,0,0];const lum=0.3*p[0]+0.59*p[1]+0.11*p[2];const h=p[3]>128&&lum<LUM;if(h&&!inH){inH=true;st=x;}if(!h&&inH){inH=false;if(x-st>1)hs.push(((st-cx)/bh).toFixed(3)+'..'+((x-1-cx)/bh).toFixed(3));}}
 out.push(s.toFixed(2)+': '+(hs.join(' ')||'-'));}
console.log(file.split('/').pop());console.log(out.join('\n'));
