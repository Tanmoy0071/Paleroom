// The t-shirt comes from t-shirt.glb ("T-shirt" by Sirenko, CC BY 4.0). It is read once, smoothed with
// Phong tessellation, then cut into the same parts the site animates: collar, hem, sleeves, front,
// back and a print decal on the chest. Units: mm, y up, front facing +z.
import * as THREE from 'three';
import type { Product } from '../data';
import teeUrl from '../../t-shirt.glb?url';

type V3 = [number, number, number];

// --- a minimal GLB reader: geometry only, the baked textures are never decoded ------------------
interface Raw { pos: number[]; nor: number[]; uv: number[]; idx: number[] }
function readGlb(buf: ArrayBuffer): Raw {
  const dv = new DataView(buf);
  const jsonLen = dv.getUint32(12, true);
  const j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const read = (ai: number, n: number) => {
    const a = j.accessors[ai], bv = j.bufferViews[a.bufferView];
    const base = binStart + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const ct = a.componentType, size = ct === 5126 || ct === 5125 ? 4 : ct === 5123 ? 2 : 1;
    const stride = bv.byteStride ?? size * n, out: number[] = [];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) {
      const o = base + i * stride + k * size;
      out.push(ct === 5126 ? dv.getFloat32(o, true) : ct === 5125 ? dv.getUint32(o, true) : ct === 5123 ? dv.getUint16(o, true) : dv.getUint8(o));
    }
    return out;
  };
  // world matrix of the first mesh node (the export is z-up under a y-up root)
  type Node = { matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; mesh?: number; children?: number[] };
  const local = (n: Node) => n.matrix
    ? new THREE.Matrix4().fromArray(n.matrix)
    : new THREE.Matrix4().compose(new THREE.Vector3().fromArray(n.translation ?? [0, 0, 0]), new THREE.Quaternion().fromArray(n.rotation ?? [0, 0, 0, 1]), new THREE.Vector3().fromArray(n.scale ?? [1, 1, 1]));
  let world: THREE.Matrix4 | null = null, meshIndex = 0;
  const walk = (ni: number, m: THREE.Matrix4) => {
    const n: Node = j.nodes[ni], w = m.clone().multiply(local(n));
    if (n.mesh !== undefined && !world) { world = w; meshIndex = n.mesh; }
    (n.children ?? []).forEach((c) => walk(c, w));
  };
  ((j.scenes?.[j.scene ?? 0]?.nodes ?? [0]) as number[]).forEach((root) => walk(root, new THREE.Matrix4()));
  const prim = j.meshes[meshIndex].primitives[0];
  const pos = read(prim.attributes.POSITION, 3), nor = read(prim.attributes.NORMAL, 3), uv = read(prim.attributes.TEXCOORD_0, 2), idx = read(prim.indices, 1);
  const m: THREE.Matrix4 = world ?? new THREE.Matrix4(), nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
  for (let i = 0; i < pos.length; i += 3) {
    v.fromArray(pos, i).applyMatrix4(m).toArray(pos, i);
    v.fromArray(nor, i).applyMatrix3(nm).normalize().toArray(nor, i);
  }
  return { pos, nor, uv, idx };
}

// --- clean-up: consistent winding, outward normals, centred on the old shirt's frame ---------------
function prepare(r: Raw) {
  const P = (i: number) => new THREE.Vector3().fromArray(r.pos, i * 3), N = (i: number) => new THREE.Vector3().fromArray(r.nor, i * 3);
  const box = new THREE.Box3();
  for (let i = 0; i < r.pos.length / 3; i++) box.expandByPoint(P(i));
  // same frame as the code-built shirt: centred in x and z, body spanning about y -400..370
  const shift = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -15 - (box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
  for (let i = 0; i < r.pos.length / 3; i++) P(i).add(shift).toArray(r.pos, i * 3);
  // winding follows the authored normals, so double and back side shading stay correct
  let outward = 0;
  for (let t = 0; t < r.idx.length; t += 3) {
    const a = r.idx[t], b = r.idx[t + 1], c = r.idx[t + 2];
    const g = P(b).sub(P(a)).cross(P(c).sub(P(a)));
    const n = N(a).add(N(b)).add(N(c));
    if (g.dot(n) < 0) { r.idx[t + 1] = c; r.idx[t + 2] = b; }
    const cen = P(a).add(P(b)).add(P(c)).divideScalar(3);
    if (Math.abs(cen.x) < 200) outward += Math.sign(n.x * cen.x + n.z * cen.z);
  }
  if (outward < 0) {
    for (let i = 0; i < r.nor.length; i++) r.nor[i] = -r.nor[i];
    for (let t = 0; t < r.idx.length; t += 3) { const b = r.idx[t + 1]; r.idx[t + 1] = r.idx[t + 2]; r.idx[t + 2] = b; }
  }
}

// Phong tessellation: split every edge, pull the midpoint onto the curved surface the normals imply.
function tessellate(r: Raw): Raw {
  const pos = [...r.pos], nor = [...r.nor], uv = [...r.uv], idx: number[] = [];
  const cache = new Map<string, number>();
  const mid = (a: number, b: number) => {
    const k = a < b ? a + '_' + b : b + '_' + a;
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    const pa = new THREE.Vector3().fromArray(pos, a * 3), pb = new THREE.Vector3().fromArray(pos, b * 3);
    const na = new THREE.Vector3().fromArray(nor, a * 3), nb = new THREE.Vector3().fromArray(nor, b * 3);
    const p = pa.clone().add(pb).multiplyScalar(0.5);
    const qa = p.clone().addScaledVector(na, -p.clone().sub(pa).dot(na));
    const qb = p.clone().addScaledVector(nb, -p.clone().sub(pb).dot(nb));
    p.lerp(qa.add(qb).multiplyScalar(0.5), 0.75);
    const m = pos.length / 3;
    pos.push(p.x, p.y, p.z);
    const nm = na.add(nb).normalize();
    nor.push(nm.x, nm.y, nm.z);
    uv.push((uv[a * 2] + uv[b * 2]) / 2, (uv[a * 2 + 1] + uv[b * 2 + 1]) / 2);
    cache.set(k, m);
    return m;
  };
  for (let t = 0; t < r.idx.length; t += 3) {
    const a = r.idx[t], b = r.idx[t + 1], c = r.idx[t + 2];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    idx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  return { pos, nor, uv, idx };
}

// --- the shared base shirt (loaded once, reused by every product) -----------------------------
export interface PartDef { name: string; label: string; geo: THREE.BufferGeometry; lines: THREE.BufferGeometry; mat: 'fabric' | 'rib' | 'print'; order: number; lift: THREE.Vector3; anchor: THREE.Vector3 }
let base: PartDef[] | null = null;

export async function loadTee() {
  if (base) return;
  const res = await fetch(teeUrl);
  if (!res.ok) throw new Error('t-shirt.glb: ' + res.status);
  const raw = readGlb(await res.arrayBuffer());
  prepare(raw);
  base = build(tessellate(tessellate(raw)));
}

export function baseParts(): PartDef[] {
  if (!base) throw new Error('loadTee() must finish before a Tee is made');
  return base;
}

function build(r: Raw): PartDef[] {
  const n = r.pos.length / 3, T = r.idx.length / 3;
  const P = (i: number): V3 => [r.pos[i * 3], r.pos[i * 3 + 1], r.pos[i * 3 + 2]];
  const tri = (t: number) => [r.idx[t * 3], r.idx[t * 3 + 1], r.idx[t * 3 + 2]];

  // texture space in mm, so the knit and rib maps keep the density they had on the code-built shirt
  let l3 = 0, l2 = 0;
  for (let t = 0; t < T; t++) for (let e = 0; e < 3; e++) {
    const v = tri(t), a = v[e], b = v[(e + 1) % 3], pa = P(a), pb = P(b);
    l3 += Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
    l2 += Math.hypot(r.uv[a * 2] - r.uv[b * 2], r.uv[a * 2 + 1] - r.uv[b * 2 + 1]);
  }
  const uvScale = l3 / (l2 || 1);

  // openings: edges used by a single triangle once uv seams are welded shut
  const weld = new Map<string, number>(), W = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = P(i).map((v) => v.toFixed(2)).join(','); if (!weld.has(k)) weld.set(k, i); W[i] = weld.get(k)!; }
  const edges = new Map<string, number>();
  for (let t = 0; t < T; t++) for (let e = 0; e < 3; e++) {
    const v = tri(t), a = W[v[e]], b = W[v[(e + 1) % 3]], k = a < b ? a + '_' + b : b + '_' + a;
    edges.set(k, (edges.get(k) ?? 0) + 1);
  }
  const neck: [V3, V3][] = [], hemRim: [V3, V3][] = [];
  for (const [k, c] of edges) {
    if (c !== 1) continue;
    const [a, b] = k.split('_').map(Number), pa = P(a), pb = P(b), my = (pa[1] + pb[1]) / 2, mx = Math.abs(pa[0] + pb[0]) / 2;
    if (my > 150 && mx < 200) neck.push([pa, pb]);
    else if (my < -300 && mx < 300) hemRim.push([pa, pb]);
  }
  // distance to an opening's rim, measured to its edges so the seam runs smooth, not beaded
  const rimDist = (p: V3, rim: [V3, V3][]) => {
    let best = Infinity;
    for (const [a, b] of rim) {
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], q = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
      const h = Math.max(0, Math.min(1, (q[0] * d[0] + q[1] * d[1] + q[2] * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1)));
      best = Math.min(best, (q[0] - d[0] * h) ** 2 + (q[1] - d[1] * h) ** 2 + (q[2] - d[2] * h) ** 2);
    }
    return Math.sqrt(best);
  };

  // front / back split at the middle of the body's depth, interpolated by height
  const bins = new Map<number, [number, number]>();
  for (let i = 0; i < n; i++) {
    const [x, y, z] = P(i);
    if (Math.abs(x) > 200) continue;
    const b = Math.round(y / 40), m = bins.get(b) ?? [Infinity, -Infinity];
    bins.set(b, [Math.min(m[0], z), Math.max(m[1], z)]);
  }
  const keys = [...bins.keys()].sort((a, b) => a - b), mids = keys.map((k) => (bins.get(k)![0] + bins.get(k)![1]) / 2);
  const midZ = (y: number) => {
    const f = y / 40;
    if (f <= keys[0]) return mids[0];
    for (let i = 1; i < keys.length; i++) if (f <= keys[i]) { const t = (f - keys[i - 1]) / (keys[i] - keys[i - 1]); return mids[i - 1] + (mids[i] - mids[i - 1]) * t; }
    return mids[mids.length - 1];
  };

  // cut the surface along each seam in turn: a triangle that straddles a seam is split exactly on it
  type Vx = { id: number; p: THREE.Vector3; n: THREE.Vector3; u: THREE.Vector2 };
  type Tri = [Vx, Vx, Vx];
  let ids = 0;
  const verts = Array.from({ length: n }, (_, i): Vx => ({ id: ids++, p: new THREE.Vector3().fromArray(r.pos, i * 3), n: new THREE.Vector3().fromArray(r.nor, i * 3), u: new THREE.Vector2(r.uv[i * 2] * uvScale, r.uv[i * 2 + 1] * uvScale) }));
  const vx = (i: number) => verts[i];
  const clip = (list: Tri[], f: (p: V3) => number) => {
    // one split vertex per cut edge, shared by both triangles on that edge
    const cache = new Map<string, Vx>();
    const lerpV = (a: Vx, b: Vx, t: number): Vx => {
      if (a.id > b.id) { [a, b] = [b, a]; t = 1 - t; }
      const k = a.id + '_' + b.id;
      let v = cache.get(k);
      if (!v) { v = { id: ids++, p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), u: a.u.clone().lerp(b.u, t) }; cache.set(k, v); }
      return v;
    };
    const inside: Tri[] = [], outside: Tri[] = [];
    for (const t of list) {
      const d = t.map((v) => f(v.p.toArray() as V3));
      const neg = d.map((x) => x < 0);
      const count = neg.filter(Boolean).length;
      if (count === 3) { inside.push(t); continue; }
      if (count === 0) { outside.push(t); continue; }
      // rotate so the lone vertex (the one on its own side) comes first, keeping the winding
      const lone = neg.findIndex((x) => (count === 1 ? x : !x));
      const a = t[lone], b = t[(lone + 1) % 3], c = t[(lone + 2) % 3];
      const da = d[lone], db = d[(lone + 1) % 3], dc = d[(lone + 2) % 3];
      const ab = lerpV(a, b, da / (da - db)), ac = lerpV(a, c, da / (da - dc));
      const tip: Tri[] = [[a, ab, ac]], quad: Tri[] = [[ab, b, c], [ab, c, ac]];
      if (count === 1) { inside.push(...tip); outside.push(...quad); } else { outside.push(...tip); inside.push(...quad); }
    }
    return [inside, outside];
  };
  let rest: Tri[] = Array.from({ length: T }, (_, t) => tri(t).map(vx) as Tri);
  let collar: Tri[], hem: Tri[], sleeveL: Tri[], sleeveR: Tri[], front: Tri[], back: Tri[];
  [collar, rest] = clip(rest, (p) => rimDist(p, neck) - 24);
  [hem, rest] = clip(rest, (p) => rimDist(p, hemRim) - 22);
  [sleeveL, rest] = clip(rest, (p) => p[0] + 235);
  [sleeveR, rest] = clip(rest, (p) => 235 - p[0]);
  [back, front] = clip(rest, (p) => p[2] - midZ(p[1]));
  const tris = { collar, hem, sleeveL, sleeveR, front, back };

  const geometry = (list: Tri[], mapPos?: (p: THREE.Vector3, nrm: THREE.Vector3) => void, mapUv?: (p: THREE.Vector3) => [number, number]) => {
    const remap = new Map<Vx, number>(), pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
    for (const t of list) for (const v of t) {
      let j = remap.get(v);
      if (j === undefined) {
        j = remap.size; remap.set(v, j);
        const p = v.p.clone(), nr = v.n.clone();
        const u = mapUv ? mapUv(p) : [v.u.x, v.u.y];
        mapPos?.(p, nr);
        pos.push(p.x, p.y, p.z); nor.push(nr.x, nr.y, nr.z); uv.push(u[0], u[1]);
      }
      idx.push(j);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  };

  // print: the chest triangles, lifted a hair off the fabric and mapped flat from the front
  const neckFront = neck.flat().filter((p) => p[2] > 0);
  const neckY = neckFront.length ? Math.min(...neckFront.map((p) => p[1])) : 260;
  // centred where the close-up camera cue looks (y 120), lowered only if the neckline is in the way
  const PS = 250, pcx = 0, pcy = Math.min(120, neckY - 40 - PS / 2);
  const printTris = front.filter((t) => {
    const nz = (t[0].n.z + t[1].n.z + t[2].n.z) / 3;
    return nz > 0.2 && t.some((v) => Math.abs(v.p.x - pcx) < PS / 2 + 8 && Math.abs(v.p.y - pcy) < PS / 2 + 8);
  });
  const print = geometry(printTris, (p, nr) => { p.addScaledVector(nr, 1.5); }, (p) => [(p.x - pcx) / PS + 0.5, (p.y - pcy) / PS + 0.5]);

  // label anchors: the surface point of each part nearest where the labels pointed before
  const anchorOf = (g: THREE.BufferGeometry, x: number, y: number, side: number) => {
    const a = g.attributes.position, best = new THREE.Vector3();
    let bd = Infinity;
    for (let i = 0; i < a.count; i++) {
      const d = (a.getX(i) - x) ** 2 + (a.getY(i) - y) ** 2 - side * a.getZ(i) * 40;
      if (d < bd) { bd = d; best.set(a.getX(i), a.getY(i), a.getZ(i)); }
    }
    return best;
  };

  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const part = (name: string, label: string, geo: THREE.BufferGeometry, mat: PartDef['mat'], order: number, lift: THREE.Vector3, ax: number, ay: number, side: number): PartDef =>
    ({ name, label, geo, lines: new THREE.EdgesGeometry(geo, 35), mat, order, lift, anchor: anchorOf(geo, ax, ay, side) });
  const g = {
    collar: geometry(tris.collar), hem: geometry(tris.hem), front: geometry(tris.front), back: geometry(tris.back),
    sleeveL: geometry(tris.sleeveL), sleeveR: geometry(tris.sleeveR),
  };
  return [
    part('print', 'Print / plastisol', print, 'print', 1, V(0, 40, 320), pcx + 90, pcy + 80, 1),
    part('collar', 'Collar / 1x1 rib', g.collar, 'rib', 0.9, V(0, 230, 140), -70, neckY + 20, 1),
    part('front', 'Front panel', g.front, 'fabric', 0.7, V(0, 0, 170), -160, -120, 1),
    part('sleeveL', 'Left sleeve', g.sleeveL, 'fabric', 0.55, V(-230, 40, 0), -330, 180, 1),
    part('sleeveR', 'Right sleeve', g.sleeveR, 'fabric', 0.55, V(230, 40, 0), 330, 180, 1),
    part('hem', 'Hem / twin needle', g.hem, 'rib', 0.35, V(0, -200, 60), 150, -380, 1),
    part('back', 'Back panel', g.back, 'fabric', 0.1, V(0, 0, -190), 200, -260, -1),
  ];
}

// --- textures made at boot -------------------------------------------------------------------
function normalFromHeight(h: (x: number, y: number) => number, size: number, strength: number) {
  const data = new Uint8Array(size * size * 4);
  const H = (x: number, y: number) => h(((x % size) + size) % size, ((y % size) + size) % size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const n = new THREE.Vector3(-dx, -dy, 1).normalize(), i = (y * size + x) * 4;
    data[i] = (n.x * 0.5 + 0.5) * 255; data[i + 1] = (n.y * 0.5 + 0.5) * 255; data[i + 2] = (n.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
// jersey: rows of little V loops
export const knitMap = normalFromHeight((x, y) => { const u = (x / 32) * 2 * Math.PI, v = (y / 32) * 2 * Math.PI; return Math.abs(Math.sin(u + Math.abs(Math.sin(v * 2)) * 1.2)) * (0.6 + 0.4 * Math.cos(v * 2)); }, 64, 1.6);
export const ribMap = normalFromHeight((x) => Math.abs(Math.sin((x / 64) * Math.PI * 4)), 64, 2.2);
ribMap.repeat.set(1 / 12, 1 / 12); // uvs are in mm: about 3 mm per rib

export function printTexture(p: Product) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = p.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = p.print;
  const size = lines.length > 2 ? 118 : 150;
  g.font = `400 ${size}px "Instrument Serif", serif`;
  lines.forEach((l, i) => {
    const y = 256 + (i - (lines.length - 1) / 2) * size * 0.92;
    g.save(); g.translate(256, y); g.scale(Math.min(1, 470 / g.measureText(l).width), 1); g.fillText(l, 0, 0); g.restore();
  });
  // worn ink: knock random specks out so the print reads as plastisol, not a sticker
  g.globalCompositeOperation = 'destination-out';
  let s = p.slug.length * 9301;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 900; i++) { g.globalAlpha = rnd() * 0.6; g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// --- one shirt for one product ----------------------------------------------------------------
export interface Part { def: PartDef; obj: THREE.Mesh; lines: THREE.LineSegments; base: THREE.Vector3 }
export class Tee {
  group = new THREE.Group();
  parts: Part[] = [];
  mats: THREE.MeshPhysicalMaterial[] = [];
  constructor(public product: Product) {
    const col = new THREE.Color(product.colour);
    const sheen = col.clone().lerp(new THREE.Color('#ffffff'), 0.35);
    // the model is a single shell, so every surface is double sided (the inside shows at the neck)
    const fabric = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.93, sheen: 1, sheenRoughness: 0.55, sheenColor: sheen, normalMap: knitMap, normalScale: new THREE.Vector2(0.45, 0.45), side: THREE.DoubleSide });
    fabric.normalMap!.repeat.set(1 / 7, 1 / 7);
    const edge = fabric.clone(); edge.roughness = 0.8; edge.sheenRoughness = 0.35; // kept so mats[] indices stay stable
    const rib = new THREE.MeshPhysicalMaterial({ color: col.clone().multiplyScalar(0.92), roughness: 0.9, sheen: 1, sheenRoughness: 0.45, sheenColor: sheen, normalMap: ribMap, normalScale: new THREE.Vector2(0.7, 0.7), side: THREE.DoubleSide });
    const print = new THREE.MeshPhysicalMaterial({ map: printTexture(product), transparent: true, alphaTest: 0.35, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this.mats = [fabric, edge, rib, print];
    const line = new THREE.LineBasicMaterial({ color: '#111111', transparent: true, opacity: 0.85 });
    for (const def of baseParts()) {
      const obj = new THREE.Mesh(def.geo, this.matFor(def));
      const lines = new THREE.LineSegments(def.lines, line); lines.visible = false; obj.add(lines);
      this.group.add(obj);
      this.parts.push({ def, obj, lines, base: new THREE.Vector3() });
    }
  }
  private matFor(def: PartDef) { return def.mat === 'print' ? this.mats[3] : def.mat === 'rib' ? this.mats[2] : this.mats[0]; }
  explode(e: number) {
    const ease = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
    for (const p of this.parts) {
      const delay = (1 - p.def.order) * 0.42; // top parts leave first, come back last
      p.obj.position.copy(p.base).addScaledVector(p.def.lift, ease((e - delay) / 0.58));
    }
  }
  blueprint(on: boolean) { for (const p of this.parts) { p.lines.visible = on; p.obj.material = on ? hidden : this.matFor(p.def); } }
  flipInsideOut() { for (const m of this.mats) m.side = THREE.BackSide; }
}
const hidden = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
