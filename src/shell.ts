// Persistent UI: nav with Index dropdown, bag drawer, search overlay.
import { app, esc } from './app';
import { products, bySlug, inr } from './data';
import { state, onChange, count, setQty, subtotal, shipping } from './store';

const nav = document.getElementById('nav')!;
const bag = document.getElementById('bag')!;
const search = document.getElementById('search')!;
const scrim = document.createElement('div'); scrim.className = 'scrim'; document.body.append(scrim);
let lastFocus: HTMLElement | null = null;

const caret = `<svg width="9" height="6" viewBox="0 0 9 6" aria-hidden="true"><path d="M1 1l3.5 3.5L8 1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
const l = (href: string, label: string, cur: boolean, cls = '') => `<a class="nl ${cls}" href="${href}"${cur ? ' aria-current="page"' : ''}><span class="u">${label}</span></a>`;

export function renderNav(active?: string) {
  nav.innerHTML = `
    <nav class="nav-c" aria-label="Main">
      <a class="mark" href="#home" aria-label="Pale Room, home">Pale Room</a>
      ${l('#shop', 'Shop', active === 'shop')}
      ${l('#collections', 'Collections', active === 'collections', 'hide-m')}
      <div class="idx">
        <button class="nl idx-btn" type="button" aria-expanded="false" aria-controls="idx-panel">Index ${caret}</button>
        <div class="idx-panel" id="idx-panel">
          ${products.map((p) => `<a class="idx-row" href="#p-${p.slug}" data-slug="${p.slug}" aria-current="${p.slug === app.current}"><span>${esc(p.name)}</span><span>${inr(p.price)}</span></a>`).join('')}
        </div>
      </div>
    </nav>
    <div class="nav-r">
      <button class="nl hide-m" type="button" data-search><span class="u">Search</span></button>
      <a class="nl hide-m" href="#account"><span class="u">${state.user ? 'Account' : 'Sign in'}</span></a>
      <button class="nl" type="button" data-bag aria-haspopup="dialog"><span class="u">Bag (<span data-count>${count()}</span>)</span></button>
    </div>`;
  const btn = nav.querySelector<HTMLButtonElement>('.idx-btn')!, panel = nav.querySelector<HTMLElement>('.idx-panel')!;
  const set = (o: boolean) => { btn.setAttribute('aria-expanded', String(o)); panel.classList.toggle('open', o); if (o) panel.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' }); };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); btn.focus(); } });
  nav.querySelector('[data-bag]')!.addEventListener('click', openBag);
  nav.querySelector('[data-search]')!.addEventListener('click', openSearch);
}

// ---- bag drawer ------------------------------------------------------------------------------------
export function lineItems(editable = true) {
  if (!state.bag.length) return `<p class="empty">Your bag is empty.</p>`;
  return state.bag.map((i) => {
    const p = bySlug(i.slug)!;
    return `<div class="line-item"><i class="swatch" style="background:${p.colour}"></i>
      <div><a class="nm" href="#p-${p.slug}" style="text-decoration:none">${esc(p.name)}</a><div class="micro">Size ${i.size} · ${esc(p.colourName)}</div>
      ${editable ? `<div class="qty"><button type="button" data-q="${p.slug}|${i.size}|${i.qty - 1}" aria-label="One less ${esc(p.name)}">−</button><span aria-label="Quantity">${i.qty}</span><button type="button" data-q="${p.slug}|${i.size}|${i.qty + 1}" aria-label="One more ${esc(p.name)}">+</button></div><button class="rm" type="button" data-q="${p.slug}|${i.size}|0">Remove</button>` : `<div class="micro">Qty ${i.qty}</div>`}</div>
      <span class="val">${inr(p.price * i.qty)}</span></div>`;
  }).join('');
}
export function totals() {
  const sub = subtotal(), ship = shipping(sub);
  return `<div class="total"><span>Subtotal</span><span>${inr(sub)}</span></div>
    <div class="total"><span>Shipping</span><span>${sub === 0 ? '·' : ship === 0 ? 'Free' : inr(ship)}</span></div>
    <div class="total big"><span>Total</span><span>${inr(sub + ship)}</span></div>`;
}
export function bindQty(root: HTMLElement) {
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-q]'); if (!b) return;
    const [slug, size, q] = b.dataset.q!.split('|');
    setQty(slug, size as never, Number(q));
  });
}

export function renderBag() {
  bag.innerHTML = `<div class="bag-head"><h2 class="display">Bag</h2><button class="nl" type="button" data-close>Close</button></div>
    <div class="bag-items">${lineItems()}</div>
    ${state.bag.length ? `${totals()}<a class="cta" href="#checkout">Checkout</a><a class="link" href="#bag" style="text-align:center;font-size:13px">View bag</a>` : `<a class="cta" href="#shop">Shop tees</a>`}`;
  bag.querySelector('[data-close]')!.addEventListener('click', closeAll);
  nav.querySelector('[data-count]') && (nav.querySelector('[data-count]')!.textContent = String(count()));
}
bindQty(bag);
onChange(renderBag);

export function openBag() {
  lastFocus = document.activeElement as HTMLElement;
  bag.hidden = false;
  requestAnimationFrame(() => { bag.classList.add('open'); scrim.classList.add('on'); bag.querySelector<HTMLElement>('[data-close]')?.focus(); });
  app.lenis.stop?.();
}
app.openBag = openBag;

// ---- search -------------------------------------------------------------------------------------
export function openSearch() {
  lastFocus = document.activeElement as HTMLElement;
  search.hidden = false;
  search.innerHTML = `<button class="close nl" type="button" data-close>Close</button>
    <label class="micro" for="q">Search tees</label>
    <input id="q" type="search" autocomplete="off" placeholder="Type a colour" />
    <ul class="list" id="results" style="margin-top:24px"></ul>`;
  const q = search.querySelector<HTMLInputElement>('#q')!, out = search.querySelector('#results')!;
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    const hits = products.filter((p) => !t || [p.name, p.colourName, p.fit, p.fabric, p.collection].join(' ').toLowerCase().includes(t));
    out.innerHTML = hits.length ? hits.map(row).join('') : `<li class="empty">Nothing matches “${esc(q.value)}”.</li>`;
  };
  q.addEventListener('input', draw);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') out.querySelector<HTMLAnchorElement>('a')?.click(); });
  search.querySelector('[data-close]')!.addEventListener('click', closeAll);
  draw(); q.focus();
  app.lenis.stop?.();
}
export const row = (p: (typeof products)[number]) => `<li><a href="#p-${p.slug}" data-slug="${p.slug}"><span class="micro hm">${String(products.indexOf(p) + 1).padStart(2, '0')}</span><span class="nm">${esc(p.name)}</span><span class="val hm">${esc(p.colourName)} · ${esc(p.fit)}</span><span class="val hm">${p.gsm} gsm</span><span class="val pr">${inr(p.price)}</span></a></li>`;

export function closeAll() {
  const wasOpen = !bag.hidden || !search.hidden;
  bag.classList.remove('open'); scrim.classList.remove('on');
  setTimeout(() => { if (!bag.classList.contains('open')) bag.hidden = true; }, 600);
  search.hidden = true; search.innerHTML = '';
  if (wasOpen) { app.lenis.start?.(); lastFocus?.focus?.({ preventScroll: true }); }
}
scrim.addEventListener('click', closeAll);
document.addEventListener('pointerdown', (e) => {
  if (nav.contains(e.target as Node)) return;
  nav.querySelector('.idx-panel')?.classList.remove('open'); nav.querySelector('.idx-btn')?.setAttribute('aria-expanded', 'false');
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
