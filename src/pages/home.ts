// Home: the tee carousel on a diagonal arc (the reference's disc carousel).
import gsap from 'gsap';
import { app, esc, type Page } from '../app';
import { products, inr } from '../data';
import { shot } from '../gl/engine';
import { buildOutline, followMatrix, type Outline } from '../gl/outline';

// a hand-drawn pen line around the tee in focus, traced from its silhouette
const scribble = () => `<svg class="scribble" aria-hidden="true"><path pathLength="1"/></svg>`;
let outline: (Outline & { key: string }) | null = null; // survives page changes; rebuilt only on resize

const specRows = (p = products[0]) => `
  <h2 class="display"><span class="swap"><span>${esc(p.name)}</span></span></h2>
  <dl class="rows">
    <div class="row"><dt class="micro">Fabric</dt><dd class="val"><span class="swap"><span>${esc(p.fabric)}</span></span></dd></div>
    <div class="row"><dt class="micro">Weight</dt><dd class="val"><span class="swap"><span>${p.gsm} gsm</span></span></dd></div>
    <div class="row"><dt class="micro">Fit</dt><dd class="val"><span class="swap"><span>${esc(p.fit)}</span></span></dd></div>
    <div class="row"><dt class="micro">Colour</dt><dd class="val"><span class="swap"><span>${esc(p.colourName)}</span></span></dd></div>
    <div class="row"><dt class="micro">Price</dt><dd class="val"><span class="swap"><span>${inr(p.price)}</span></span></dd></div>
  </dl>`;
// true product facts in the slots where the reference shows critic quotes; no invented reviews
const facts = (p = products[0]) => `
  <div class="fact"><span class="micro">The cloth</span><span class="display"><span class="swap"><span>${p.gsm} gsm<br>${esc(p.fabric.split(' ').slice(-2).join(' '))}</span></span></span></div>
  <div class="fact"><span class="micro">The cut</span><span class="display"><span class="swap"><span>${esc(p.fit)} fit<br>${esc(p.collection === 'drops' ? 'Limited drop' : 'Always in stock')}</span></span></span></div>`;

export function home(): Page {
  const start = Math.max(0, products.findIndex((p) => p.slug === app.current));
  return {
    title: 'Tees',
    nav: 'home',
    description: 'Ten heavy cotton tees, laid out like an archive. Scroll to turn through them, open one to take it apart.',
    html: `<section class="home" aria-label="Tee carousel">
      <h1 class="vh">Pale Room tees</h1>
      <div class="spec" aria-live="polite">${specRows(products[start])}</div>
      <a class="hit" href="#p-${products[start].slug}" aria-label="Open ${esc(products[start].name)}">${scribble()}</a>
      <div class="steps"><button type="button" data-step="-1" aria-label="Previous tee">←</button><span data-count>${String(start + 1).padStart(2, '0')} / ${products.length}</span><button type="button" data-step="1" aria-label="Next tee">→</button></div>
      <div class="facts">${facts(products[start])}</div>
      <p class="hint">Scroll or drag to browse</p>
    </section>`,
    mount() {
      const e = app.engine;
      e.setMode({ kind: 'carousel' });
      e.carouselTarget = e.carouselPos = start;
      e.setShot(shot({ frame: innerWidth < 860 ? 1150 : 1700, polar: 4, targetY: 40 }));
      app.lenis.stop?.();
      const root = document.querySelector<HTMLElement>('.home')!;
      const spec = root.querySelector<HTMLElement>('.spec')!, factsEl = root.querySelector<HTMLElement>('.facts')!;
      const hit = root.querySelector<HTMLAnchorElement>('.hit')!, num = root.querySelector('[data-count]')!;
      let index = start;

      const show = (i: number, dir: number) => {
        const n = products.length, p = products[((i % n) + n) % n];
        if (p.slug === app.current) return;
        app.setCurrent(p.slug);
        hit.href = `#p-${p.slug}`; hit.setAttribute('aria-label', `Open ${p.name}`);
        num.textContent = `${String(products.indexOf(p) + 1).padStart(2, '0')} / ${n}`;
        const swap = (el: HTMLElement, html: string) => {
          const old = el.querySelectorAll('.swap > span');
          gsap.to(old, { yPercent: -110 * dir, duration: 0.25, ease: 'power2.in', stagger: 0.02, onComplete: () => {
            el.innerHTML = html;
            gsap.from(el.querySelectorAll('.swap > span'), { yPercent: 110 * dir, duration: 0.5, ease: 'power3.out', stagger: 0.03 });
          } });
        };
        swap(spec, specRows(p)); swap(factsEl, facts(p));
      };
      const step = (d: number) => { index += d; e.carouselTarget = index; show(index, Math.sign(d)); };

      // wheel: one notch-group = one tee
      let acc = 0, lock = 0;
      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        if (performance.now() < lock) return;
        acc += Math.abs(ev.deltaY) > Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
        if (Math.abs(acc) > 40) { step(Math.sign(acc)); acc = 0; lock = performance.now() + 420; }
      };
      // drag / swipe: the arc follows the finger, then snaps
      let drag: { x: number; y: number; at: number; moved: boolean } | null = null;
      const down = (ev: PointerEvent) => { if ((ev.target as HTMLElement).closest('button, .spec')) return; drag = { x: ev.clientX, y: ev.clientY, at: e.carouselTarget, moved: false }; };
      const move = (ev: PointerEvent) => {
        if (!drag) return;
        const d = ((ev.clientX - drag.x) - (ev.clientY - drag.y)) / 520;
        if (Math.abs(d) > 0.03) drag.moved = true;
        e.carouselTarget = drag.at - d;
      };
      const up = () => {
        if (!drag) return;
        const target = Math.round(e.carouselTarget), d = target - index;
        drag.moved ? (d ? step(d) : (e.carouselTarget = index)) : (e.carouselTarget = index);
        drag = null;
      };
      const stopClickAfterDrag = (ev: MouseEvent) => { if (Math.abs(e.carouselTarget - e.carouselPos) > 0.2) ev.preventDefault(); };
      const key = (ev: KeyboardEvent) => {
        if ((ev.target as HTMLElement).closest('input, textarea, .idx-panel')) return;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); step(1); }
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); step(-1); }
      };
      root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.step))));
      // the outline is built once per viewport (every tee shares the mesh and the hover pose), in idle time;
      // per frame it only follows the tee with one CSS matrix, and only while the line is on screen
      const svg = hit.querySelector<SVGSVGElement>('.scribble')!, path = svg.querySelector('path')!;
      let hovering = false, visibleUntil = 0, rect = hit.getBoundingClientRect();
      const ensure = () => {
        const key = `${innerWidth}x${innerHeight}`;
        if (outline?.key !== key) {
          const tee = e.tees?.get(app.current);
          if (!tee) return null;
          rect = hit.getBoundingClientRect();
          const o = buildOutline(e, tee, rect, Math.max(14, Math.min(24, innerWidth * 0.014)));
          outline = o && { ...o, key };
        }
        if (outline && path.getAttribute('d') !== outline.d) path.setAttribute('d', outline.d);
        return outline;
      };
      let lastM = '';
      const follow = () => {
        const tee = e.tees?.get(app.current), o = ensure();
        if (tee && o) { const m = followMatrix(e, tee, o, rect); if (m !== lastM) svg.style.transform = lastM = m; }
      };
      // build ahead of the first hover, in idle time (it uses the settled camera, so no need to wait for the ease)
      const idle = (window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1))) as (f: () => void, o?: { timeout: number }) => number;
      let warm = 0;
      const tryWarm = () => idle(() => { if (!hovering) ensure(); }, { timeout: 800 });
      warm = window.setTimeout(tryWarm, 50);
      const onResize = () => { outline = null; clearTimeout(warm); warm = window.setTimeout(tryWarm, 250); };
      addEventListener('resize', onResize);
      this.tick = () => { if (hovering || performance.now() < visibleUntil) follow(); };
      const enter = () => { e.hover = 1; hovering = true; follow(); }, leave = () => { e.hover = 0; hovering = false; visibleUntil = performance.now() + 1200; };
      hit.addEventListener('pointerenter', enter); hit.addEventListener('pointerleave', leave);
      hit.addEventListener('focus', enter); hit.addEventListener('blur', leave);
      hit.addEventListener('click', stopClickAfterDrag);
      addEventListener('wheel', onWheel, { passive: false });
      root.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up);
      addEventListener('keydown', key);
      return () => {
        e.hover = 0; clearTimeout(warm); removeEventListener('resize', onResize);
        removeEventListener('wheel', onWheel); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('keydown', key);
        app.lenis.start?.();
      };
    },
  };
}
