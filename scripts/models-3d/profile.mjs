// Silhouette profile of a transparent PNG: per row (top→bottom, N rows over the alpha bbox) the left/right extent as a share of the bbox HEIGHT, centred on the bbox centre.
import {createRequire} from 'node:module'; const sharp=createRequire(new URL('../../package.json', import.meta.url))('sharp');
const [file, nArg] = process.argv.slice(2); const N = +(nArg || 24);
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, a = (x, y) => data[(y * W + x) * 4 + 3];
let x0 = W, x1 = -1, y0 = H, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a(x, y) > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const bh = y1 - y0 + 1, bw = x1 - x0 + 1, cx = (x0 + x1) / 2;
const rows = [];
for (let i = 0; i < N; i++) {
  const y = Math.round(y0 + (i + 0.5) * bh / N); const segs = []; let inside = false, s = 0;
  for (let x = x0; x <= x1 + 1; x++) { const on = x <= x1 && a(x, y) > 128; if (on && !inside) { inside = true; s = x; } if (!on && inside) { inside = false; segs.push([((s - cx) / bh).toFixed(3), ((x - 1 - cx) / bh).toFixed(3)]); } }
  rows.push(((1 - (i + 0.5) / N)).toFixed(3) + ': ' + segs.map(s => s.join('..')).join('  '));
}
console.log(file.split('/').pop(), 'px', W + 'x' + H, 'bbox', bw + 'x' + bh, 'aspect w/h', (bw / bh).toFixed(3));
console.log(rows.join('\n'));
