// Fuse a Spline-exported model (spline-out/<id>.json) into one continuous smooth surface per material: voxel union of the closed parts
// (open shells such as hair are thickened), a Gaussian blend so the joins melt like pressed clay, naive surface nets, Taubin smoothing.
// Each output vertex keeps the name of the part it grew from (for skinning). Writes spline-out/<id>-fused.json in the same format.
// Usage: node fuse.mjs <id> [voxel cm] [blend sigma cm] [shell thickness cm]
import fs from 'node:fs';
const OUT = process.env.MODELS_3D_WORK || new URL('../../.models-3d-work/', import.meta.url).pathname;
const [id, vArg, sArg, tArg] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(OUT + id + '.json'));
const VOX = +(vArg || 0.7), SIG_SOLID = +(sArg || 1.0), SIG_SHELL = 0.45, SHELL = +(tArg || 2.4);
const SHELLS = new Set(['hair']); // materials whose parts are open shells

function bbox(parts) { const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (const p of parts) for (let i = 0; i < p.vertices.length; i += 3) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], p.vertices[i + k]); b[k + 3] = Math.max(b[k + 3], p.vertices[i + k]); } return b; }

function fuse(parts, shell, cuts = []) {
  const SIG = shell ? SIG_SHELL : SIG_SOLID;
  const bb = bbox(parts), pad = SIG * 3 + SHELL + 2 * VOX;
  const o = [bb[0] - pad, bb[1] - pad, bb[2] - pad], n = [0, 1, 2].map(k => Math.ceil((bb[k + 3] - bb[k] + 2 * pad) / VOX) + 1);
  const [nx, ny, nz] = n, N = nx * ny * nz, at = (i, j, k) => (k * ny + j) * nx + i;
  const occ = new Float32Array(N), label = new Int16Array(N).fill(-1), vol = parts.map(() => 0);
  const partOcc = [];
  parts.forEach((p, pi) => {
    const v = p.vertices, idx = p.indices || [...Array(v.length / 3).keys()], cells = new Uint8Array(N);
    if (!shell) { // ray parity along z for each (x, y) column
      const hits = new Map();
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        const ax = v[a], ay = v[a + 1], bx = v[b], by = v[b + 1], cx = v[c], cy = v[c + 1];
        const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-12) continue;
        const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - o[0]) / VOX)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - o[0]) / VOX));
        const j0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - o[1]) / VOX)), j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, cy) - o[1]) / VOX));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const px = o[0] + i * VOX + 1.3e-5, py = o[1] + j * VOX + 1.7e-5;
          const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, l3 = 1 - l1 - l2;
          if (l1 < 0 || l2 < 0 || l3 < 0) continue;
          const z = l1 * v[a + 2] + l2 * v[b + 2] + l3 * v[c + 2], key = j * nx + i;
          (hits.get(key) || hits.set(key, []).get(key)).push(z);
        }
      }
      for (const [key, zs] of hits) { zs.sort((a, b) => a - b); const i = key % nx, j = (key - i) / nx;
        for (let h = 0; h + 1 < zs.length; h += 2) { const k0 = Math.max(0, Math.ceil((zs[h] - o[2]) / VOX)), k1 = Math.min(nz - 1, Math.floor((zs[h + 1] - o[2]) / VOX)); for (let k = k0; k <= k1; k++) cells[at(i, j, k)] = 1; } }
    } else { // thicken the open surface: voxels within SHELL/2 of any triangle (sampled densely)
      const r = SHELL / 2, rv = Math.ceil(r / VOX), nm = p.normals;
      let cx = 0, cy = 0, cz = 0; for (let i = 0; i < v.length; i += 3) { cx += v[i]; cy += v[i + 1]; cz += v[i + 2]; } const nvv = v.length / 3; cx /= nvv; cy /= nvv; cz /= nvv;
      let sgn = 0; for (let i = 0; i < v.length; i += 3) sgn += nm[i] * (v[i] - cx) + nm[i + 1] * (v[i + 1] - cy) + nm[i + 2] * (v[i + 2] - cz); sgn = sgn >= 0 ? 1 : -1;
      for (let t = 0; t < idx.length; t += 3) {
        const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
        const e = Math.max(Math.hypot(v[A] - v[B], v[A + 1] - v[B + 1], v[A + 2] - v[B + 2]), Math.hypot(v[A] - v[C], v[A + 1] - v[C + 1], v[A + 2] - v[C + 2]));
        const m = Math.max(1, Math.ceil(e / (VOX * 0.5)));
        for (let s = 0; s <= m; s++) for (let u = 0; u <= m - s; u++) { const w1 = s / m, w2 = u / m, w0 = 1 - w1 - w2;
          const Nn = [0, 1, 2].map(k => sgn * (w0 * nm[A + k] + w1 * nm[B + k] + w2 * nm[C + k])), nl = Math.hypot(...Nn) || 1;
          const P = [0, 1, 2].map(k => w0 * v[A + k] + w1 * v[B + k] + w2 * v[C + k] - Nn[k] / nl * r), ci = P.map((q, k) => Math.round((q - o[k]) / VOX));
          for (let dk = -rv; dk <= rv; dk++) for (let dj = -rv; dj <= rv; dj++) for (let di = -rv; di <= rv; di++) {
            const i = ci[0] + di, j = ci[1] + dj, k = ci[2] + dk; if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) continue;
            if (Math.hypot(o[0] + i * VOX - P[0], o[1] + j * VOX - P[1], o[2] + k * VOX - P[2]) <= r) cells[at(i, j, k)] = 1; } }
      }
    }
    for (let q = 0; q < N; q++) if (cells[q]) vol[pi]++;
    partOcc.push(cells);
  });
  // cutters (material "cut"): voxelized like solids in this grid, then cleared from the union
  const cutCells = new Uint8Array(N);
  for (const c of cuts) { const v = c.vertices, idx = c.indices || [...Array(v.length / 3).keys()], hits = new Map();
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t] * 3, b = idx[t + 1] * 3, cc = idx[t + 2] * 3;
      const ax = v[a], ay = v[a + 1], bx = v[b], by = v[b + 1], cx = v[cc], cy = v[cc + 1];
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-12) continue;
      const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - o[0]) / VOX)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - o[0]) / VOX));
      const j0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - o[1]) / VOX)), j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, cy) - o[1]) / VOX));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const px = o[0] + i * VOX + 1.3e-5, py = o[1] + j * VOX + 1.7e-5;
        const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue; const z = l1 * v[a + 2] + l2 * v[b + 2] + l3 * v[cc + 2], key = j * nx + i; (hits.get(key) || hits.set(key, []).get(key)).push(z); } }
    for (const [key, zs] of hits) { zs.sort((x, y) => x - y); const i = key % nx, j = (key - i) / nx;
      for (let h = 0; h + 1 < zs.length; h += 2) { const k0 = Math.max(0, Math.ceil((zs[h] - o[2]) / VOX)), k1 = Math.min(nz - 1, Math.floor((zs[h + 1] - o[2]) / VOX)); for (let k = k0; k <= k1; k++) cutCells[at(i, j, k)] = 1; } } }
  // union; label each voxel with the smallest part containing it
  parts.forEach((p, pi) => { const cells = partOcc[pi]; for (let q = 0; q < N; q++) if (cells[q] && !cutCells[q]) { occ[q] = 1; if (label[q] < 0 || vol[pi] < vol[label[q]]) label[q] = pi; } });
  // Gaussian blend (separable)
  const rad = Math.ceil(SIG / VOX * 3), ker = []; let ks = 0; for (let d = -rad; d <= rad; d++) { const w = Math.exp(-0.5 * (d * VOX / SIG) ** 2); ker.push(w); ks += w; } for (let d = 0; d < ker.length; d++) ker[d] /= ks;
  let f = occ, g = new Float32Array(N);
  const strides = [1, nx, nx * ny], dims = [nx, ny, nz];
  for (let ax = 0; ax < 3; ax++) { const st = strides[ax], L = dims[ax];
    for (let q = 0; q < N; q++) { const c = ax === 0 ? q % nx : ax === 1 ? Math.floor(q / nx) % ny : Math.floor(q / (nx * ny)); let s = 0;
      for (let d = -rad; d <= rad; d++) { const cc = c + d; if (cc < 0 || cc >= L) continue; s += f[q + d * st] * ker[d + rad]; } g[q] = s; }
    [f, g] = [g, f]; }
  // surface nets at iso 0.5
  const ISO = 0.5, vid = new Int32Array(N).fill(-1), V = [], lab = [];
  const corner = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]], edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const val = corner.map(c => f[at(i + c[0], j + c[1], k + c[2])]); let inside = 0; for (const x of val) if (x > ISO) inside++;
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) { if ((val[a] > ISO) === (val[b] > ISO)) continue; const t = (ISO - val[a]) / (val[b] - val[a]);
      sx += corner[a][0] + t * (corner[b][0] - corner[a][0]); sy += corner[a][1] + t * (corner[b][1] - corner[a][1]); sz += corner[a][2] + t * (corner[b][2] - corner[a][2]); cnt++; }
    vid[at(i, j, k)] = V.length / 3; V.push(o[0] + (i + sx / cnt) * VOX, o[1] + (j + sy / cnt) * VOX, o[2] + (k + sz / cnt) * VOX);
    // nearest labelled voxel among the cell corners (inside ones first)
    let best = -1, bv = -1; for (const c of corner) { const q = at(i + c[0], j + c[1], k + c[2]); if (label[q] >= 0 && f[q] > bv) { bv = f[q]; best = label[q]; } }
    if (best < 0) { // search a small neighbourhood
      outer: for (let r = 1; r < 6; r++) for (let dk = -r; dk <= r; dk++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj, kk = k + dk; if (ii < 0 || jj < 0 || kk < 0 || ii >= nx || jj >= ny || kk >= nz) continue; const q = at(ii, jj, kk); if (label[q] >= 0) { best = label[q]; break outer; } } }
    lab.push(best);
  }
  const I = [];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const q = at(i, j, k), inQ = f[q] > ISO;
    // edges along +x, +y, +z from this grid point; the 4 cells around each edge
    const tests = [[at(i + 1, j, k), [[0,-1,-1],[0,0,-1],[0,0,0],[0,-1,0]]], [at(i, j + 1, k), [[-1,0,-1],[-1,0,0],[0,0,0],[0,0,-1]]], [at(i, j, k + 1), [[-1,-1,0],[0,-1,0],[0,0,0],[-1,0,0]]]];
    for (const [q2, cs] of tests) { if (inQ === (f[q2] > ISO)) continue;
      const ids = cs.map(c => vid[at(i + c[0], j + c[1], k + c[2])]); if (ids.some(x => x < 0)) continue;
      if (inQ) I.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]); else I.push(ids[0], ids[2], ids[1], ids[0], ids[3], ids[2]); }
  }
  // Taubin smoothing
  const nv = V.length / 3, nb = Array.from({ length: nv }, () => new Set());
  for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = I[t + e], b = I[t + (e + 1) % 3]; nb[a].add(b); nb[b].add(a); }
  const nbA = nb.map(s => [...s]);
  for (let it = 0; it < 45; it++) for (const lam of [0.5, -0.53]) { const P = V.slice();
    for (let a = 0; a < nv; a++) { const L = nbA[a]; if (!L.length) continue; let cx = 0, cy = 0, cz = 0; for (const b of L) { cx += P[b * 3]; cy += P[b * 3 + 1]; cz += P[b * 3 + 2]; }
      V[a * 3] += lam * (cx / L.length - P[a * 3]); V[a * 3 + 1] += lam * (cy / L.length - P[a * 3 + 1]); V[a * 3 + 2] += lam * (cz / L.length - P[a * 3 + 2]); } }
  return { vertices: V.map(x => Math.round(x * 1000) / 1000), indices: I, labels: lab.map(l => parts[l] ? parts[l].part : parts[0].part) };
}
const CFG = JSON.parse(fs.readFileSync(new URL('./models.json', import.meta.url)))[id.replace(/-.*/, '')] || {};
// Fuse groups: parts listed together in CFG.fuse[material] fuse into their own surface (an arm that only meets the torso at the shoulder),
// the rest of that material fuses into one.
const groups = [];
const cuts = src.parts.filter(p => p.material === 'cut');
const byMat = {}; for (const p of src.parts) if (p.material !== 'cut') (byMat[p.material] ||= []).push(p);
for (const [mat, parts] of Object.entries(byMat)) {
  const sets = (CFG.fuse?.[mat] || []).map(list => parts.filter(p => list.includes(p.part))).filter(g => g.length);
  const used = new Set(sets.flat());
  const rest = parts.filter(p => !used.has(p));
  for (const g of [rest, ...sets]) if (g.length) groups.push([mat, g]);
}
const out = [];
for (const [mat, parts] of groups) { const t0 = Date.now(), shell = SHELLS.has(mat) || parts.every(p => (CFG.shells || []).includes(p.part)), r = fuse(parts, shell, cuts);
  out.push({ part: mat === 'hair' ? 'head' : parts[0].part, material: mat, vertices: r.vertices, indices: r.indices, labels: r.labels });
  console.log(mat, parts.map(p => p.part).join('+').slice(0, 60), '->', r.vertices.length / 3, 'verts', Date.now() - t0, 'ms'); }
fs.writeFileSync(OUT + id + '-fused.json', JSON.stringify({ id, parts: out }));
