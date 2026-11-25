import './style.css';
import gsap from 'gsap';
import Lenis from 'lenis';
import { Engine } from './gl/engine';
import { loadTee } from './gl/tee';
import { app, type Page } from './app';
import { products } from './data';
import { sound } from './sound';
import { renderNav, renderBag, openSearch, closeAll } from './shell';
import { route } from './routes';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const main = $('#main');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- smooth scroll on the one clock -----------------------------------------------------------
const lenis = new Lenis({ autoRaf: false, lerp: 0.11 });
if (reduced) lenis.destroy();
app.lenis = lenis;

// ---- toast ---------------------------------------------------------------------------------------
const toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.append(toastEl);
let tt = 0;
app.toast = (m) => { toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(tt); tt = window.setTimeout(() => toastEl.classList.remove('on'), 2200); };

// ---- router: #name only (the hosting frame passes nothing else) -----------------------------------
let page: Page | null = null;
let unmount: (() => void) | void;
let busy = false;
let first = true;

async function go() {
  if (busy) return;
  busy = true;
  closeAll();
  const hash = location.hash.slice(1);
  const next = route(hash);
  if (!first && !reduced) await gsap.to(main, { opacity: 0, duration: 0.28, ease: 'power2.in' });
  unmount?.(); unmount = undefined;
  page = next;
  document.title = next.title + ' · Pale Room';
  document.querySelector('meta[name="description"]')?.setAttribute('content', next.description ?? 'Pale Room makes heavy cotton t-shirts you can turn over in 3D.');
  main.innerHTML = next.html;
  scrollTo(0, 0); if (!reduced) lenis.scrollTo(0, { immediate: true, force: true });
  renderNav(next.nav);
  unmount = next.mount?.();
  gsap.set(main, { clearProps: 'opacity,transform' }); // a transform would trap position:fixed children
  if (!first && !reduced) gsap.from(main, { opacity: 0, duration: 0.5, ease: 'power2.out', clearProps: 'opacity' });
  if (!first) main.focus({ preventScroll: true });
  first = false;
  busy = false;
  if (location.hash.slice(1) !== hash) go(); // a click landed mid-transition
}

// ---- reveals from scroll position (observers skip beats on heavy GPU frames) -------------------
function reveals() {
  const vh = innerHeight;
  for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]:not(.in)')) if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add('in');
}

// ---- boot -----------------------------------------------------------------------------------------
let lastY = 0;
async function boot() {
  const loader = $('#loader'), n = loader.querySelector('.loader-n')!;
  let shown = 0;
  const bump = (v: number) => { shown = Math.max(shown, v); n.textContent = String(Math.round(shown)); };
  bump(8);
  await Promise.race([document.fonts.load('150px "Instrument Serif"'), new Promise((r) => setTimeout(r, 1500))]);
  bump(35);
  let engine: Engine | null = null;
  try { await loadTee(); bump(55); engine = new Engine($('#gl')); } catch { document.documentElement.classList.add('no-gl'); }
  bump(70);
  if (engine) { app.engine = engine; await Promise.race([engine.warm().catch(() => {}), new Promise((r) => setTimeout(r, 2200))]); } // loader never outlives 2.6 s
  else app.engine = new Proxy({}, { get: () => () => {} }) as Engine; // no WebGL: pages still work
  bump(100);

  engine && (engine.onBeat = () => sound.swish());
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((_t, ms) => {
    const dt = ms / 1000;
    if (!reduced) lenis.raf(performance.now());
    page?.tick?.(dt);
    engine?.update(dt);
    reveals();
    // corner UI steps aside while scrolling down, returns on the way up
    const y = scrollY; document.body.classList.toggle('aside', y > 80 && y > lastY); document.body.classList.toggle('scrolled', y > 10); if (y !== lastY) lastY = y;
  });

  renderBag();
  addEventListener('hashchange', go);
  await go();
  if (reduced) loader.remove();
  else gsap.to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'power3.inOut', delay: 0.15, onComplete: () => loader.remove() });

  const snd = $('#sound');
  snd.addEventListener('click', async () => {
    const on = await sound.toggle();
    snd.setAttribute('aria-pressed', String(on));
    snd.textContent = on ? 'Sound on' : 'Tap for sound';
  });
  $('.skip').addEventListener('click', () => main.focus());
  addEventListener('keydown', (e) => {
    if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); openSearch(); }
  });
  // phone tilt drives the studio the same way the cursor does (only after the sound tap unlocks it)
  addEventListener('deviceorientation', (e) => {
    if (e.gamma == null || e.beta == null || !engine) return;
    engine.pointer.set(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (e.beta - 45) / 30)));
  });
}

app.setCurrent = (slug) => { app.current = slug; document.querySelectorAll<HTMLElement>('.idx-row').forEach((r) => r.setAttribute('aria-current', String(r.dataset.slug === slug))); };
app.current = products[0].slug;
(window as unknown as { __pr: typeof app }).__pr = app; // QA handle
boot();
