// A pen line drawn around the tee in focus, like circling a shirt on a contact sheet.
// Built once (every tee shares one mesh and one hover pose), then moved each frame by a single
// CSS matrix, so hovering costs three projected points per frame and nothing else.
import * as THREE from 'three';
import type { Engine } from './engine';
import type { Tee } from './tee';

const CELL = 4; // px per raster cell
const v = new THREE.Vector3();
const REFS = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(300, 0, 0), new THREE.Vector3(0, 300, 0)];

export interface Outline { d: string; refs: [number, number][] }

const toScreen = (p: THREE.Vector3, m: THREE.Matrix4, cam: THREE.Camera): [number, number] => {
  v.copy(p).applyMatrix4(m).project(cam);
  return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
};

// exact squared Euclidean distance transform, one axis (Felzenszwalb & Huttenlocher)
function edt1(f: Float32Array, n: number, d: Float32Array, z: Float32Array, k: Int32Array) {
  let q = 0, j = 0; k[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[k[j]] + k[j] * k[j])) / (2 * q - 2 * k[j]);
    while (s <= z[j]) { j--; s = ((f[q] + q * q) - (f[k[j]] + k[j] * k[j])) / (2 * q - 2 * k[j]); }
    j++; k[j] = q; z[j] = s; z[j + 1] = Infinity;
  }
  for (q = 0, j = 0; q < n; q++) { while (z[j + 1] < q) j++; d[q] = (q - k[j]) * (q - k[j]) + f[k[j]]; }
}

// marching squares; numeric edge keys, longest closed loop
function trace(val: Float32Array, nx: number, ny: number): [number, number][] {
  const W = nx + 1, at = (i: number, j: number) => val[j * W + i];
  const next = new Map<number, number>(), pos = new Map<number, [number, number]>();
  const pt = (i: number, j: number, h: number): number => {
    const key = (j * W + i) * 2 + h;
    if (!pos.has(key)) {
      const a = at(i, j), b = h ? at(i + 1, j) : at(i, j + 1), t = a / (a - b);
      pos.set(key, h ? [i + t, j] : [i, j + t]);
    }
    return key;
  };
  const S: Record<number, number[]> = { 1: [0, 1], 2: [1, 2], 3: [0, 2], 4: [2, 3], 5: [0, 3, 2, 1], 6: [1, 3], 7: [0, 3], 8: [3, 0], 9: [3, 1], 10: [3, 2, 1, 0], 11: [3, 2], 12: [2, 0], 13: [2, 1], 14: [1, 0] };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = (at(i, j) < 0 ? 1 : 0) | (at(i + 1, j) < 0 ? 2 : 0) | (at(i + 1, j + 1) < 0 ? 4 : 0) | (at(i, j + 1) < 0 ? 8 : 0);
    if (c === 0 || c === 15) continue;
    const e = [pt(i, j, 0), pt(i, j, 1), pt(i + 1, j, 0), pt(i, j + 1, 1)]; // L, B, R, T
    const s = S[c];
    for (let q = 0; q < s.length; q += 2) next.set(e[s[q]], e[s[q + 1]]);
  }
  let best: [number, number][] = [];
  const seen = new Set<number>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: [number, number][] = [];
    let k: number | undefined = start;
    while (k !== undefined && !seen.has(k)) { seen.add(k); loop.push(pos.get(k)!); k = next.get(k); }
    if (loop.length > best.length) best = loop;
  }
  return best;
}

// Build the outline for the centre tee in its hover pose. Path coordinates are relative to `origin`.
export function buildOutline(e: Engine, tee: Tee, origin: DOMRect, gap: number): Outline | null {
  const g = tee.group, cam = e.settledCamera(); // independent of any camera ease in progress
  const saved = { p: g.position.clone(), r: g.rotation.clone(), s: g.scale.clone(), vis: g.visible };
  g.position.set(0, 20, 0); g.rotation.set(0.3, -0.35, 0.12); g.scale.setScalar(1.04); // engine's centre + hover pose
  g.updateMatrixWorld(true);
  try {
    // 1. project the panels (the print and rib sit inside their silhouette)
    const shapes: { s: Float32Array; idx: ArrayLike<number> }[] = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const part of tee.parts) {
      if (part.def.mat === 'print') continue;
      const geo = part.obj.geometry, p = geo.attributes.position, idx = geo.index;
      if (!idx) continue;
      const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(part.obj.matrixWorld), me = m.elements;
      const s = new Float32Array(p.count * 2), W = innerWidth, H = innerHeight;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const w = me[3] * x + me[7] * y + me[11] * z + me[15];
        const sx = ((me[0] * x + me[4] * y + me[8] * z + me[12]) / w * 0.5 + 0.5) * W;
        const sy = (-(me[1] * x + me[5] * y + me[9] * z + me[13]) / w * 0.5 + 0.5) * H;
        s[i * 2] = sx; s[i * 2 + 1] = sy;
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
      }
      shapes.push({ s, idx: idx.array });
    }
    if (!isFinite(x0) || x1 - x0 < 20) return null;
    const pad = gap + CELL * 3;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const nx = Math.ceil((x1 - x0) / CELL), ny = Math.ceil((y1 - y0) / CELL), W = nx + 1, H = ny + 1;

    // 2. rasterise straight into the grid (cell centres inside any triangle); no canvas, no GPU readback
    const INF = 1e12, grid = new Float32Array(W * H).fill(INF), n = Math.max(W, H);
    for (const { s, idx } of shapes) for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 2, b = idx[t + 1] * 2, d0 = idx[t + 2] * 2;
      const ax = (s[a] - x0) / CELL, ay = (s[a + 1] - y0) / CELL, bx = (s[b] - x0) / CELL, by = (s[b + 1] - y0) / CELL, cx = (s[d0] - x0) / CELL, cy = (s[d0 + 1] - y0) / CELL;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-9) continue;
      const sg = area > 0 ? 1 : -1; // either winding counts as inside
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(nx, Math.ceil(Math.max(ax, bx, cx)));
      const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), j1 = Math.min(ny, Math.ceil(Math.max(ay, by, cy)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (grid[j * W + i] === 0) continue;
        const w0 = sg * ((bx - ax) * (j - ay) - (by - ay) * (i - ax));
        const w1 = sg * ((cx - bx) * (j - by) - (cy - by) * (i - bx));
        const w2 = sg * ((ax - cx) * (j - cy) - (ay - cy) * (i - cx));
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) grid[j * W + i] = 0;
      }
    }

    // 3. distance from the shirt, in px, minus the gap: a smooth field whose zero line is the outline
    const f = new Float32Array(n), d = new Float32Array(n), z = new Float32Array(n + 1), k = new Int32Array(n);
    for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = grid[y * W + x]; edt1(f, H, d, z, k); for (let y = 0; y < H; y++) grid[y * W + x] = d[y]; }
    for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = grid[y * W + x]; edt1(f, W, d, z, k); for (let x = 0; x < W; x++) grid[y * W + x] = Math.sqrt(d[x]) * CELL - gap; }

    // 4. trace, back to px, clockwise on screen
    let loop = trace(grid, nx, ny).map(([i, j]) => [x0 + i * CELL, y0 + j * CELL] as [number, number]);
    if (loop.length < 12) return null;
    let area = 0;
    for (let i = 0; i < loop.length; i++) { const [ax, ay] = loop[i], [bx, by] = loop[(i + 1) % loop.length]; area += ax * by - bx * ay; }
    if (area < 0) loop = loop.reverse();

    // 5. resample evenly from a stable start above the left shoulder
    let cx = 0, cy = 0;
    for (const [x, y] of loop) { cx += x; cy += y; }
    cx /= loop.length; cy /= loop.length;
    let start = 0, bestA = Infinity;
    loop.forEach(([x, y], i) => { const a = Math.abs(Math.atan2(y - cy, x - cx) + 2.0); if (a < bestA) { bestA = a; start = i; } });
    loop = [...loop.slice(start), ...loop.slice(0, start)];
    const len = [0];
    for (let i = 1; i <= loop.length; i++) { const [ax, ay] = loop[i - 1], [bx, by] = loop[i % loop.length]; len.push(len[i - 1] + Math.hypot(bx - ax, by - ay)); }
    const total = len[len.length - 1], N = 120;
    const at = (u: number): [number, number] => {
      const dd = (((u % 1) + 1) % 1) * total;
      let lo = 1, hi = len.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (len[mid] < dd) lo = mid + 1; else hi = mid; }
      const t = (dd - len[lo - 1]) / (len[lo] - len[lo - 1] || 1), [ax, ay] = loop[lo - 1], [bx, by] = loop[lo % loop.length];
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    };

    // 6. the hand: a slow wobble, and a pen that overshoots its start and drifts out
    const pts: [number, number][] = [];
    for (let q = 0; q <= N * 1.09; q++) {
      const u = q / N, [x, y] = at(u), [ax, ay] = at(u - 0.004), [bx, by] = at(u + 0.004);
      let nxv = by - ay, nyv = -(bx - ax); const nl = Math.hypot(nxv, nyv) || 1; nxv /= nl; nyv /= nl;
      const wob = Math.sin(u * 13.1 + 0.6) * 3.2 + Math.sin(u * 29.7 + 2.1) * 1.6 + Math.sin(u * 5.3 + 4) * 2.4;
      const drift = u * 7 + Math.max(0, u - 1) * 160;
      pts.push([x + nxv * (wob + drift), y + nyv * (wob + drift)]);
    }

    // 7. Catmull-Rom through the points as cubic Béziers
    const o = (p: [number, number]) => `${(p[0] - origin.left).toFixed(1)} ${(p[1] - origin.top).toFixed(1)}`;
    let path = `M${o(pts[0])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      path += `C${o([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${o([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${o(p2)}`;
    }
    const refs = REFS.map((r) => { const [x, y] = toScreen(r, g.matrixWorld, cam); return [x - origin.left, y - origin.top] as [number, number]; });
    return { d: path, refs };
  } finally {
    g.position.copy(saved.p); g.rotation.copy(saved.r); g.scale.copy(saved.s); g.visible = saved.vis;
    g.updateMatrixWorld(true);
  }
}

// CSS matrix that carries the stored outline onto where the tee is drawn right now
export function followMatrix(e: Engine, tee: Tee, o: Outline, origin: DOMRect): string {
  const [s0, s1, s2] = o.refs;
  const [d0, d1, d2] = REFS.map((r) => { const [x, y] = toScreen(r, tee.group.matrixWorld, e.camera); return [x - origin.left, y - origin.top]; });
  const a1 = s1[0] - s0[0], b1 = s1[1] - s0[1], a2 = s2[0] - s0[0], b2 = s2[1] - s0[1];
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-6) return 'none';
  const p1 = d1[0] - d0[0], q1 = d1[1] - d0[1], p2 = d2[0] - d0[0], q2 = d2[1] - d0[1];
  // M * [a1 a2; b1 b2] = [p1 p2; q1 q2]
  const ma = (p1 * b2 - p2 * b1) / det, mc = (p2 * a1 - p1 * a2) / det;
  const mb = (q1 * b2 - q2 * b1) / det, md = (q2 * a1 - q1 * a2) / det;
  const me = d0[0] - (ma * s0[0] + mc * s0[1]), mf = d0[1] - (mb * s0[0] + md * s0[1]);
  return `matrix(${ma.toFixed(4)},${mb.toFixed(4)},${mc.toFixed(4)},${md.toFixed(4)},${me.toFixed(2)},${mf.toFixed(2)})`;
}
