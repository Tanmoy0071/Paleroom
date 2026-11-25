// Product page: the reference's production page, with the tee taken apart on camera.
import * as THREE from 'three';
import { app, esc, diamonds, type Page } from '../app';
import { products, inr, type Product, type Size } from '../data';
import { shot, mixShot, type Shot } from '../gl/engine';
import { add, state, toggleWish } from '../store';
import { sound } from '../sound';

const darken = (hex: string, k: number) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#000'), k).getHexString();
function torn() {
  let d = 'M0 40 L0 22', s = 3;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let x = 0; x <= 100; x += 0.7 + r() * 1.6) d += ` L${x.toFixed(2)} ${(10 + r() * 24 + Math.sin(x * 0.2) * 5).toFixed(1)}`;
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="${d} L100 40 Z" fill="currentColor"/></svg>`;
}

export function product(p: Product): Page {
  const i = products.indexOf(p), next = products[(i + 1) % products.length];
  const sizes = Object.entries(p.sizes) as [Size, number][];
  const band = darken(p.colour, 0.55);
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: `${p.name} tee`, description: p.description, color: p.colourName, material: p.fabric, brand: { '@type': 'Brand', name: 'Pale Room' }, offers: { '@type': 'Offer', priceCurrency: 'INR', price: p.price, availability: 'https://schema.org/InStock' } };
  return {
    title: `${p.name} tee`,
    description: `${p.name}: ${p.gsm} gsm ${p.fabric.toLowerCase()}, ${p.fit.toLowerCase()} fit, ${inr(p.price)}. ${p.description}`,
    html: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
    <article>
      <section class="p-hero" data-cue="hero">
        <h1 class="display">${esc(p.name)}</h1>
        <div class="credits"><span><span class="micro">Designed by</span><span class="val">${esc(p.designer)}</span></span><span><span class="micro">Printed by</span><span class="val">Hand, screen print</span></span><span><span class="micro">Made in</span><span class="val">India</span></span></div>
        <dl class="ptable">
          <div class="row"><dt class="micro">Price</dt><dd class="val">${inr(p.price)}</dd></div>
          <div class="row"><dt class="micro">Fabric</dt><dd class="val">${esc(p.fabric)}</dd></div>
          <div class="row"><dt class="micro">Weight</dt><dd class="val">${p.gsm} gsm</dd></div>
          <div class="row"><dt class="micro">Fit</dt><dd class="val">${esc(p.fit)}</dd></div>
          <div class="row"><dt class="micro">Colour</dt><dd class="val"><i class="swatch" style="background:${p.colour}"></i>${esc(p.colourName)}</dd></div>
        </dl>
        ${diamonds}
        <form class="buy" novalidate>
          <fieldset style="border:0;padding:0;margin:0"><legend class="micro" style="margin:0 auto 8px">Size</legend>
            <div class="sizes">${sizes.map(([s, n]) => `<button type="button" data-size="${s}" aria-pressed="false" ${n ? '' : 'disabled aria-label="' + s + ', sold out"'}>${s}</button>`).join('')}</div>
          </fieldset>
          <button class="cta" type="submit">Add to bag</button>
          <p class="buy-note" aria-live="polite">Pick a size. <a class="link" href="#size-guide">Size guide</a></p>
          <button class="link" type="button" data-wish style="font-size:13px">${state.wish.includes(p.slug) ? 'Saved to wishlist' : 'Save to wishlist'}</button>
        </form>
      </section>

      <section class="chapter" data-cue="close" aria-labelledby="c1"><div class="sticky"><div class="note">
        <span class="micro">The print</span><h2 class="display" id="c1" data-reveal>Ink you can feel</h2>
        <p data-reveal>Screen printed in plastisol, cured once, then washed so it cracks a little from day one. Slowed down twelve times here.</p></div></div></section>

      <section class="chapter right" data-cue="apart" aria-labelledby="c2"><div class="sticky"><div class="note">
        <span class="micro">Seven parts</span><h2 class="display" id="c2" data-reveal>Taken apart</h2>
        <p data-reveal>Front and back panels, two set-in sleeves, a 1x1 rib collar, a twin-needle hem and the print.</p>
        <button class="bp" type="button" aria-pressed="false" data-bp>Show blueprint</button></div></div></section>

      <section class="chapter" data-cue="around" aria-labelledby="c3"><div class="sticky"><div class="note">
        <span class="micro">All the way round</span><h2 class="display" id="c3" data-reveal>${p.gsm} grams</h2>
        <p data-reveal>${esc(p.fabric)} at ${p.gsm} grams a square metre. Heavy enough that the shoulders hold their line.</p></div></div></section>

      <section class="band" data-cue="band" style="color:#f2f2f2;background:${band}" aria-label="${esc(p.tagline.join(' '))}">
        <div class="band-bg" style="background:${band};color:${band}">${torn()}</div>
        <div class="lines" aria-hidden="true">${p.tagline.map((w) => `<div class="ln"><span data-reveal style="display:inline-block">${esc(w)}</span></div>`).join('')}</div>
        <div class="band-foot"><p>${esc(p.description)}</p><a class="link" href="#size-guide">Size guide</a></div>
      </section>

      <section class="after" data-cue="after"><div class="info-grid">
        <div><h3 class="micro">Care</h3><p>Wash cold, inside out. Dry flat in the shade. Iron around the print, never on it.</p></div>
        <div><h3 class="micro">Shipping</h3><p>Ships in two working days. Free over ₹2,999. <a class="link" href="#shipping">Shipping and returns</a></p></div>
        <div><h3 class="micro">Fit note</h3><p>${p.fit === 'Regular' ? 'True to size.' : p.fit === 'Boxy' ? 'Wide and short. Take your usual size.' : 'Cut big on purpose. Size down for a regular look.'}</p></div>
      </div></section>

      <a class="next" href="#p-${next.slug}" data-cue="next">
        <span class="micro">Next tee</span>
        <span class="ln"><span class="u">Next</span></span>
        <span class="ln" style="display:block"><span class="u">${esc(next.name)}</span></span>
      </a>
    </article>
    <svg class="labels" aria-hidden="true"></svg>`,
    mount() {
      const e = app.engine;
      app.setCurrent(p.slug);
      e.setMode({ kind: 'product', slug: p.slug, next: next.slug });
      e.blueprint(false);
      const SH: Record<string, Shot> = {
        hero: shot({ frame: 1500, polar: 12, targetY: 0, curY: -1060 }),
        close: shot({ frame: 470, polar: 4, azimuth: -14, targetY: 120, offsetX: 0.17, timeScale: 1 / 12 }),
        apart: shot({ frame: 2100, polar: 16, azimuth: -30, targetY: 40, explode: 1, offsetX: -0.06 }),
        around: shot({ frame: 1350, polar: 8, azimuth: 360, offsetX: 0.15 }),
        band: shot({ frame: 1350, polar: 8, azimuth: 360, offsetX: 0.15 }),
        after: shot({ frame: 1500, polar: 8, azimuth: 360, curY: 2800 }),
        next: shot({ frame: 1500, polar: 8, azimuth: 360, curY: 2800, nextY: -420 }),
      };
      const secs = [...document.querySelectorAll<HTMLElement>('[data-cue]')];
      let tops: number[] = [];
      const measure = () => { tops = secs.map((s) => s.getBoundingClientRect().top + scrollY); };
      measure(); addEventListener('resize', measure);
      const ease = (t: number) => t * t * (3 - 2 * t);

      // labels: project 3D anchors, stack in two clean columns with leader lines
      const svg = document.querySelector<SVGSVGElement>('.labels')!;
      const tee = e.tees.get(p.slug)!;
      svg.innerHTML = tee.parts.map(() => `<g><line/><circle r="2.5"/><text/></g>`).join('');
      const groups = [...svg.querySelectorAll('g')];
      tee.parts.forEach((part, k) => (groups[k].querySelector('text')!.textContent = part.def.label));

      const form = document.querySelector<HTMLFormElement>('.buy')!, note = form.querySelector('.buy-note')!;
      let size: Size | null = null;
      form.querySelectorAll<HTMLButtonElement>('[data-size]').forEach((b) => b.addEventListener('click', () => {
        size = b.dataset.size as Size;
        form.querySelectorAll('[data-size]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        note.textContent = `Size ${size} selected.`;
      }));
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (!size) { note.textContent = 'Pick a size first.'; form.querySelector<HTMLElement>('[data-size]:not(:disabled)')?.focus(); return; }
        if (add(p.slug, size)) { sound.click(); app.toast(`${p.name}, size ${size}, added to bag`); app.openBag(); }
        else note.textContent = 'That size just sold out.';
      });
      const wish = form.querySelector<HTMLButtonElement>('[data-wish]')!;
      wish.addEventListener('click', () => { toggleWish(p.slug); wish.textContent = state.wish.includes(p.slug) ? 'Saved to wishlist' : 'Save to wishlist'; });
      const bp = document.querySelector<HTMLButtonElement>('[data-bp]')!;
      bp.addEventListener('click', () => { const on = bp.getAttribute('aria-pressed') !== 'true'; e.blueprint(on); bp.setAttribute('aria-pressed', String(on)); bp.textContent = on ? 'Show fabric' : 'Show blueprint'; });

      this.tick = () => {
        // camera script: hold each cue for the first 40% of its section, then blend to the next
        const y = scrollY + innerHeight * 0.35;
        let k = 0; while (k < tops.length - 1 && y >= tops[k + 1]) k++;
        const a = SH[secs[k].dataset.cue!], b = SH[secs[Math.min(k + 1, secs.length - 1)].dataset.cue!];
        const span = (tops[k + 1] ?? tops[k] + innerHeight) - tops[k];
        const t = Math.min(1, Math.max(0, (y - tops[k]) / span));
        e.setShot(mixShot(a, b, ease(Math.min(1, Math.max(0, (t - 0.4) / 0.6)))));

        const ex = e.cur.explode, op = Math.min(1, Math.max(0, (ex - 0.45) / 0.35));
        svg.style.opacity = String(op);
        if (op <= 0) return;
        const W = innerWidth, pts = tee.parts.map((part, k2) => ({ k: k2, ...e.project(part.def.anchor, part.obj) }));
        for (const side of [0, 1]) {
          const col = pts.filter((q) => (q.x > W / 2 ? 1 : 0) === side).sort((m, n) => m.y - n.y);
          let last = -Infinity;
          for (const q of col) {
            const ly = Math.max(q.y, last + 30); last = ly;
            const lx = side ? W * 0.86 : W * 0.14;
            const g = groups[q.k], ln = g.querySelector('line')!, c = g.querySelector('circle')!, tx = g.querySelector('text')!;
            ln.setAttribute('x1', String(side ? lx - 8 : lx + 8)); ln.setAttribute('y1', String(ly - 4)); ln.setAttribute('x2', String(q.x)); ln.setAttribute('y2', String(q.y));
            c.setAttribute('cx', String(q.x)); c.setAttribute('cy', String(q.y));
            tx.setAttribute('x', String(lx)); tx.setAttribute('y', String(ly)); tx.setAttribute('text-anchor', side ? 'start' : 'end');
          }
        }
      };
      return () => { removeEventListener('resize', measure); e.blueprint(false); };
    },
  };
}
