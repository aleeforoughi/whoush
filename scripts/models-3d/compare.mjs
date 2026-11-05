// Silhouette match between an exported Spline model (scratchpad/spline-out/<model>.json, world units) and the 2D asset pack.
// Usage: node compare.mjs <model> <png-id>:<azimuth>[:<elevation>] ... [--search] [--rows]
// Azimuth: 0 = camera in front (+z), 90 = camera on the model's +x side (its front then points left in the picture). Orthographic.
// Both masks are scaled to the same bbox height and aligned at bbox bottom and horizontal bbox centre; prints IoU and the bbox aspect of each.
import { createRequire } from 'node:module'; import fs from 'node:fs';
const sharp = createRequire(new URL('../../package.json', import.meta.url))('sharp');
const OUT = process.env.MODELS_3D_WORK || new URL('../../.models-3d-work/', import.meta.url).pathname;
const VIS = new URL('../../public/visuals/', import.meta.url).pathname;
const args = process.argv.slice(2), model = args[0], search = args.includes('--search'), showRows = args.includes('--rows');
const parts = JSON.parse(fs.readFileSync(OUT + model + '.json')).parts;
const HP = +(process.env.HP || 640); // normalised mask height in px
function grid(w, h) { return { w, h, d: new Uint8Array(w * h) }; }
function renderModel(az, el) {
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  const r = [Math.cos(a), 0, -Math.sin(a)], u = [-Math.sin(a) * Math.sin(e), Math.cos(e), -Math.cos(a) * Math.sin(e)];
  const P = []; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of parts) { const v = p.vertices, q = new Float64Array(v.length / 3 * 2);
    for (let i = 0, j = 0; i < v.length; i += 3, j += 2) { const sx = v[i] * r[0] + v[i + 2] * r[2], sy = v[i] * u[0] + v[i + 1] * u[1] + v[i + 2] * u[2]; q[j] = sx; q[j + 1] = sy;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy; }
    P.push({ q, idx: p.indices || [...Array(v.length / 3).keys()] }); }
  const k = (HP - 1) / (y1 - y0), W = Math.ceil((x1 - x0) * k) + 1, g = grid(W, HP);
  for (const { q, idx } of P) for (let t = 0; t < idx.length; t += 3) {
    const A = [(q[idx[t] * 2] - x0) * k, (y1 - q[idx[t] * 2 + 1]) * k], B = [(q[idx[t + 1] * 2] - x0) * k, (y1 - q[idx[t + 1] * 2 + 1]) * k], C = [(q[idx[t + 2] * 2] - x0) * k, (y1 - q[idx[t + 2] * 2 + 1]) * k];
    const minx = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), maxx = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const miny = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), maxy = Math.min(HP - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const ar = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); if (Math.abs(ar) < 1e-9) continue;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) { const px = x + 0.5, py = y + 0.5;
      const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / ar, w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / ar, w2 = 1 - w0 - w1;
      if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) g.d[y * W + x] = 1; } }
  return g;
}
async function loadPng(id) {
  const { data, info } = await sharp(VIS + id + '.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; const W = info.width, H = info.height;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const k = (HP - 1) / (y1 - y0), w = Math.ceil((x1 - x0) * k) + 1, g = grid(w, HP);
  for (let y = 0; y < HP; y++) for (let x = 0; x < w; x++) { const sx = Math.min(W - 1, Math.round(x0 + x / k)), sy = Math.min(H - 1, Math.round(y0 + y / k)); g.d[y * w + x] = data[(sy * W + sx) * 4 + 3] > 128 ? 1 : 0; }
  return g;
}
function iou(a, b, dx = 0) { const W = Math.max(a.w, b.w) + 6, oa = Math.floor((W - a.w) / 2) + dx, ob = Math.floor((W - b.w) / 2); let i = 0, u = 0; const rows = [];
  for (let y = 0; y < HP; y++) { let ra = [1e9, -1], rb = [1e9, -1];
    for (let x = 0; x < W; x++) { const A = x - oa >= 0 && x - oa < a.w && a.d[y * a.w + x - oa], B = x - ob >= 0 && x - ob < b.w && b.d[y * b.w + x - ob];
      if (A && B) i++; if (A || B) u++; if (A) { ra[0] = Math.min(ra[0], x); ra[1] = x; } if (B) { rb[0] = Math.min(rb[0], x); rb[1] = x; } }
    if (y % Math.round(HP / 20) === 5) rows.push(`${(1 - y / HP).toFixed(2)} model ${ra[1] < 0 ? '-' : (ra[0] - W / 2) + '..' + (ra[1] - W / 2)} asset ${rb[1] < 0 ? '-' : (rb[0] - W / 2) + '..' + (rb[1] - W / 2)}`); }
  const edge = (g, off) => { const pts = []; for (let y = 0; y < HP; y++) for (let x = 0; x < g.w; x++) { if (!g.d[y * g.w + x]) continue; if (x === 0 || y === 0 || x === g.w - 1 || y === HP - 1 || !g.d[y * g.w + x - 1] || !g.d[y * g.w + x + 1] || !g.d[(y - 1) * g.w + x] || !g.d[(y + 1) * g.w + x]) pts.push([x + off, y]); } return pts; };
  const ea = edge(a, oa), eb = edge(b, ob), grid = new Map(), cell = 8;
  const key = (x, y) => (Math.floor(x / cell)) + ',' + (Math.floor(y / cell));
  const near = (pts) => { const m = new Map(); for (const p of pts) { const k = key(p[0], p[1]); (m.get(k) || m.set(k, []).get(k)).push(p); } return m; };
  const dist = (p, m) => { let best = 1e9; for (let r = 0; r < 12 && best > (r - 1) * cell; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const L = m.get((Math.floor(p[0] / cell) + dx) + ',' + (Math.floor(p[1] / cell) + dy)); if (L) for (const q of L) best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1])); } return best; };
  const ma = near(ea), mb = near(eb), ds = [...ea.map(p => dist(p, mb)), ...eb.map(p => dist(p, ma))].sort((x, y) => x - y);
  return { iou: i / u, rows, p90: ds[Math.floor(ds.length * 0.9)] };
}
for (const spec of args.slice(1).filter(s => !s.startsWith('--'))) {
  const [id, azS, elS] = spec.split(':'), az = +azS, el = +(elS || 0), png = await loadPng(id);
  let best = null;
  const azs = search ? [-10, -5, 0, 5, 10].map(d => az + d) : [az], els = search ? [0, 5, 10, 15, 20] : [el]; const dxs = HP > 300 ? [-4, -2, 0, 2, 4] : [-2, -1, 0, 1, 2];
  for (const A of azs) for (const E of els) { const m = renderModel(A, E); for (const dx of dxs) { const r = iou(m, png, dx); if (!best || r.iou > best.iou) best = { ...r, A, E, mw: m.w, pw: png.w }; } }
  console.log(`${id} az ${best.A} el ${best.E}: IoU ${(best.iou * 100).toFixed(1)}%  contour p90 ${best.p90.toFixed(1)}px@${HP}  aspect model ${(best.mw / HP).toFixed(3)} asset ${(best.pw / HP).toFixed(3)}`);
  if (showRows) console.log('  ' + best.rows.join('\n  '));
}
