// One engine, one fixed canvas, one clock (GSAP ticker drives update()).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { Tee } from './tee';
import { products, type Product } from '../data';

export interface Shot { frame: number; polar: number; azimuth: number; offsetX: number; offsetY: number; targetY: number; explode: number; timeScale: number; curY: number; nextY: number }
export const shot = (s: Partial<Shot>): Shot => ({ frame: 1300, polar: 6, azimuth: 0, offsetX: 0, offsetY: 0, targetY: 0, explode: 0, timeScale: 1, curY: 0, nextY: -4000, ...s });
export function mixShot(a: Shot, b: Shot, t: number): Shot {
  const o = {} as Shot;
  for (const k of Object.keys(a) as (keyof Shot)[]) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}

type Mode = { kind: 'carousel' } | { kind: 'product'; slug: string; next: string } | { kind: 'showcase'; slug: string; offsetX: number; insideOut?: boolean } | { kind: 'none' };

// Studio panel: an emissive rectangle that only exists to be reflected and baked into the environment.
function panel(scene: THREE.Scene, w: number, h: number, power: number, pos: number[]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(power), side: THREE.DoubleSide }));
  m.position.fromArray(pos); m.lookAt(0, 0, 0); scene.add(m);
}

// Keeps the background pixel-exact #f2f2f2 after tone mapping: copy coverage (alpha) before bloom.
class SaveAlpha extends Pass {
  rt = new THREE.WebGLRenderTarget(1, 1);
  quad = new FullScreenQuad(new THREE.ShaderMaterial(CopyShader));
  constructor() { super(); this.needsSwap = false; }
  setSize(w: number, h: number) { this.rt.setSize(w, h); }
  render(r: THREE.WebGLRenderer, _w: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    (this.quad.material as THREE.ShaderMaterial).uniforms.tDiffuse.value = read.texture;
    r.setRenderTarget(this.rt); this.quad.render(r);
  }
}

const Finish = {
  uniforms: { tDiffuse: { value: null }, tMask: { value: null }, uTime: { value: 0 }, uExposure: { value: 1 }, uBg: { value: new THREE.Vector3(0.949, 0.949, 0.949) }, uGrain: { value: 0.024 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tMask; uniform float uTime, uExposure, uGrain; uniform vec3 uBg; varying vec2 vUv;
    vec3 fit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
    vec3 aces(vec3 c){
      const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
      const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
      return clamp(O * fit(I * (c * uExposure / 0.6)), 0., 1.);
    }
    vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4))-0.055, step(0.0031308, c)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){
      vec3 col = srgb(aces(texture2D(tDiffuse, vUv).rgb));
      float a = texture2D(tMask, vUv).a;
      col = mix(uBg, col, a);
      col += (hash(gl_FragCoord.xy) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.);
    }`,
};

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, 1, 10, 30000);
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  finish: ShaderPass;
  saveAlpha = new SaveAlpha();
  tees = new Map<string, Tee>();
  mode: Mode = { kind: 'none' };
  shot = shot({});
  cur = shot({});
  carouselTarget = 0;
  carouselPos = 0;
  time = 0;
  timeScale = 1;
  pointer = new THREE.Vector2();
  pointerEased = new THREE.Vector2();
  hover = 0;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  blueprintOn = false;
  onBeat: (() => void) | null = null;
  private lastBeat = 0;
  private dpr: number;
  private fps = { frames: 0, t: 0, low: 0 };
  private camPos = new THREE.Vector3(0, 0, 4000);
  private camLook = new THREE.Vector3();
  private still = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    const phone = matchMedia('(pointer: coarse)').matches;
    this.dpr = Math.min(devicePixelRatio, phone ? 1.75 : 2);
    this.renderer.setPixelRatio(this.dpr);

    // photo studio, baked into the environment
    const studio = new THREE.Scene();
    studio.background = new THREE.Color(0.16, 0.16, 0.17);
    panel(studio, 22, 14, 9, [-22, 20, 20]); // key softbox, off-axis
    panel(studio, 2.4, 34, 7, [30, 4, 12]); // strip, right edge line
    panel(studio, 2.4, 34, 5, [-30, 2, -10]); // strip, left edge line
    panel(studio, 40, 40, 1.6, [0, 40, 0]); // soft top fill so pale fabric stays pale
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(studio, 0.03).texture;
    this.scene.environmentIntensity = 1.15;
    const key = new THREE.DirectionalLight('#ffffff', 1.1); key.position.set(-1.2, 1.6, 1.4); this.scene.add(key);

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.saveAlpha);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.35, 1.35); // high threshold: print glints only
    this.composer.addPass(this.bloom);
    this.finish = new ShaderPass(Finish);
    this.finish.uniforms.tMask.value = this.saveAlpha.rt.texture;
    this.composer.addPass(this.finish);

    for (const p of products) this.addTee(p);
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', (e) => this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
  }

  private addTee(p: Product) {
    const t = new Tee(p);
    t.group.visible = false;
    t.group.position.set(0, -3000, 0);
    this.scene.add(t.group);
    this.tees.set(p.slug, t);
  }

  async warm() {
    for (const t of this.tees.values()) t.group.visible = true;
    await this.renderer.compileAsync(this.scene, this.camera);
    this.composer.render();
    for (const t of this.tees.values()) t.group.visible = false;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.dpr);
    this.composer.setSize(w, h);
    this.saveAlpha.setSize(w * this.dpr, h * this.dpr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.still = 0;
  }

  setMode(m: Mode) {
    for (const t of this.tees.values()) {
      const inside = m.kind === 'showcase' && !!m.insideOut && t.product.slug === m.slug;
      t.mats.forEach((mt) => { mt.side = inside ? THREE.BackSide : THREE.DoubleSide; mt.needsUpdate = true; });
    }
    this.mode = m;
    this.still = 0;
    if (this.reduced) this.snap = true;
  }
  snap = false;
  setShot(s: Shot) { this.shot = s; this.still = 0; }
  blueprint(on: boolean) { this.blueprintOn = on; for (const t of this.tees.values()) t.blueprint(on); this.still = 0; }

  // the screen position of a 3D point on a tee, in CSS px
  project(v: THREE.Vector3, obj: THREE.Object3D) {
    const p = v.clone().applyMatrix4(obj.matrixWorld).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, z: p.z };
  }

  // camera: frame by size, not distance, so a cue works on a phone and a monitor
  placeCamera(cam: THREE.PerspectiveCamera, s: Shot) {
    const aspect = innerWidth / innerHeight;
    const half = THREE.MathUtils.degToRad(cam.fov / 2);
    const dist = (s.frame / 2 / Math.tan(half)) / Math.min(1, aspect * 1.1);
    const pol = THREE.MathUtils.degToRad(s.polar), az = THREE.MathUtils.degToRad(s.azimuth);
    this.camPos.set(Math.sin(az) * Math.cos(pol) * dist, s.targetY + Math.sin(pol) * dist, Math.cos(az) * Math.cos(pol) * dist);
    this.camLook.set(0, s.targetY, 0);
    cam.position.copy(this.camPos); cam.lookAt(this.camLook);
    const W = innerWidth, H = innerHeight;
    cam.setViewOffset(W, H, -s.offsetX * W, s.offsetY * H, W, H);
  }

  // where the camera will be once the current shot has settled (for work that should not wait for the ease)
  settledCamera() {
    const cam = this.camera.clone();
    cam.aspect = innerWidth / innerHeight;
    this.placeCamera(cam, this.shot);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    return cam;
  }

  update(dt: number) {
    dt = Math.min(dt, 0.05);
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 5);
    const fast = this.snap ? 1 : 1 - Math.exp(-dt * 9);
    this.pointerEased.lerp(this.pointer, this.reduced ? 1 : 1 - Math.exp(-dt * 3));
    const s = this.cur = mixShot(this.cur, this.shot, k);
    this.timeScale = s.timeScale;
    this.time += dt * this.timeScale; // slow motion is one multiply
    this.carouselPos += (this.carouselTarget - this.carouselPos) * fast;
    if (Math.round(this.carouselPos) !== this.lastBeat) { this.lastBeat = Math.round(this.carouselPos); this.onBeat?.(); }

    const idle = this.reduced ? 0 : 1;
    const m = this.mode;
    let any = false;
    for (const t of this.tees.values()) {
      const g = t.group, slug = t.product.slug, i = products.indexOf(t.product);
      let tx = 0, ty = -3200, tz = 0, rx = 0, ry = 0, rz = 0, sc = 1, ex = 0, vis = false;
      if (m.kind === 'carousel') {
        const n = products.length;
        let d = i - this.carouselPos;
        d = ((d % n) + n * 1.5) % n - n / 2; // wrap so the arc loops forever
        if (Math.abs(d) < 2.6) {
          vis = true;
          const near = Math.max(0, 1 - Math.abs(d));
          tx = d * 860; ty = d * 470 + 20; tz = -Math.abs(d) * 380;
          rx = 0.3 + idle * Math.sin(this.time * 0.7 + i) * 0.03;
          ry = -0.5 + d * 0.06 + idle * near * Math.sin(this.time * 0.5) * 0.08 + near * this.hover * 0.15;
          rz = 0.12; sc = 1 + near * this.hover * 0.04;
        }
      } else if (m.kind === 'product') {
        if (slug === m.slug) { vis = true; ty = s.curY; ry = idle * Math.sin(this.time * 0.6) * 0.06; ex = s.explode; }
        else if (slug === m.next && s.nextY > -3000) { vis = true; ty = s.nextY; rx = 0.25; ry = -0.4; }
      } else if (m.kind === 'showcase' && slug === m.slug) {
        vis = true; ty = 0; ry = (m.insideOut ? Math.PI : 0) + idle * Math.sin(this.time * 0.5) * 0.25; rx = 0.12;
      }
      if (vis && !g.visible) { g.visible = true; if (g.position.y < -2500) g.position.set(tx, ty - 900, tz); }
      g.position.lerp(new THREE.Vector3(tx, ty, tz), vis ? k : Math.min(1, k * 2));
      g.rotation.x += (rx - g.rotation.x) * k; g.rotation.y += (ry - g.rotation.y) * k; g.rotation.z += (rz - g.rotation.z) * k;
      g.scale.setScalar(g.scale.x + (sc - g.scale.x) * k);
      const e = (t as unknown as { _e?: number });
      e._e = (e._e ?? 0) + (ex - (e._e ?? 0)) * k;
      t.explode(e._e);
      if (!vis && g.position.y < -2400) g.visible = false;
      if (g.visible) any = true;
    }

    this.placeCamera(this.camera, s);

    // cursor (or tilt) rotates the studio
    this.scene.environmentRotation.set(this.pointerEased.y * 0.45, -this.pointerEased.x * 0.8, 0);

    if (!any && m.kind === 'none') { if (this.still++ > 2) return; }
    this.finish.uniforms.uTime.value = this.time % 100;
    this.composer.render(dt);
    this.snap = false;
    this.adapt(dt);
  }

  // adaptive quality: under 40 fps, step resolution down, then drop bloom
  private adapt(dt: number) {
    if (location.search.includes('hq')) return; // QA screenshots in a software renderer
    const f = this.fps; f.frames++; f.t += dt;
    if (f.t < 1) return;
    const fps = f.frames / f.t; f.frames = 0; f.t = 0;
    if (document.hidden) return;
    f.low = fps < 40 ? f.low + 1 : 0;
    if (f.low < 2) return;
    f.low = 0;
    if (this.dpr > 0.8) { this.dpr = Math.max(0.75, this.dpr - 0.25); this.resize(); }
    else this.bloom.enabled = false;
  }
}
