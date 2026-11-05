// Comparison sheet: each asset view (top) above the model's render of the same view (bottom), both trimmed and scaled to the same height,
// plus a strip of the wireframe close-ups when they exist (render_views.py). Usage: node sheet.mjs <render dir> <asset prefix> [views...]
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const sharp = createRequire(new URL('../../package.json', import.meta.url))('sharp');
const [dir, prefix, ...rest] = process.argv.slice(2);
const views = rest.length ? rest : ['front', '3q', 'side', '3q-back', 'back'];
const VIS = new URL('../../public/visuals/', import.meta.url).pathname, H = 640, GAP = 24, BG = { r: 244, g: 244, b: 245, alpha: 1 };
const fit = async (f, h) => { const b = await sharp(f).trim().resize({ height: h }).png().toBuffer(); return { b, w: (await sharp(b).metadata()).width }; };
const label = (t, w) => Buffer.from(`<svg width="${w}" height="28"><text x="${w / 2}" y="20" font-family="Helvetica" font-size="16" fill="#555" text-anchor="middle">${t}</text></svg>`);
const cols = [];
for (const v of views) { const a = path.join(VIS, `${prefix}-${v}.png`), m = path.join(dir, `view-${v}.png`); if (!fs.existsSync(a) || !fs.existsSync(m)) continue; cols.push({ v, a: await fit(a, H), m: await fit(m, H) }); }
const W = cols.reduce((s, c) => s + Math.max(c.a.w, c.m.w) + GAP, GAP), comp = []; let x = GAP;
for (const c of cols) { const w = Math.max(c.a.w, c.m.w);
  comp.push({ input: c.a.b, left: x + Math.round((w - c.a.w) / 2), top: GAP }, { input: c.m.b, left: x + Math.round((w - c.m.w) / 2), top: GAP * 2 + H },
    { input: label(c.v + ' · asset / model', w), left: x, top: GAP * 2 + H * 2 + 4 }); x += w + GAP; }
const wires = fs.readdirSync(dir).filter(f => f.startsWith('wire-')).sort();
let wireRow = 0;
if (wires.length) { let wx = GAP; wireRow = 360 + GAP;
  for (const f of wires) { const r = await fit(path.join(dir, f), 360); comp.push({ input: r.b, left: wx, top: GAP * 3 + H * 2 + 32 }, { input: label(f.replace(/^wire-|\.png$/g, ''), r.w), left: wx, top: GAP * 3 + H * 2 + 32 + 360 }); wx += r.w + GAP; } }
const out = path.join(dir, 'sheet.jpg');
await sharp({ create: { width: Math.max(W, 1200), height: GAP * 3 + H * 2 + 40 + wireRow + 32, channels: 4, background: BG } }).composite(comp).flatten({ background: BG }).jpeg({ quality: 84 }).toFile(out);
console.log('sheet', out);
