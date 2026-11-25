// Shop, collections, bag, checkout, order, account, wishlist.
import { app, esc, type Page } from '../app';
import { products, collections, inr, bySlug, type Product } from '../data';
import { shot } from '../gl/engine';
import { state, onChange, placeOrder, subtotal, signIn, signOut, toggleWish } from '../store';
import { row, lineItems, totals, bindQty } from '../shell';
import { footer } from './info';

// a list where hovering a row shows that tee live beside it
function liveList(items: Product[]) {
  return `<ul class="list" data-live>${items.length ? items.map(row).join('') : '<li class="empty">No tees match these filters.</li>'}</ul>`;
}
function bindLive(root: HTMLElement, items: () => Product[]) {
  const e = app.engine;
  const showcase = (slug: string) => { app.setCurrent(slug); e.setMode({ kind: 'showcase', slug, offsetX: 0.28 }); e.setShot(shot({ frame: innerWidth < 860 ? 2600 : 1900, polar: 6, offsetX: innerWidth < 860 ? 0 : 0.3, targetY: innerWidth < 860 ? -500 : 260 })); };
  if (innerWidth < 860) { e.setMode({ kind: 'none' }); return; } // phones: the list is the page, no tee over the filters
  const first = items()[0];
  if (first) showcase(first.slug); else e.setMode({ kind: 'none' });
  const on = (ev: Event) => { const a = (ev.target as HTMLElement).closest<HTMLElement>('[data-slug]'); if (a) showcase(a.dataset.slug!); };
  root.addEventListener('pointerover', on); root.addEventListener('focusin', on);
}

function shopPage(title: string, intro: string, base: Product[], nav: Page['nav']): Page {
  return {
    title, nav,
    description: intro,
    html: `<div class="page"><header class="page-head"><h1 class="display">${esc(title)}</h1><p>${esc(intro)}</p></header>
      <div class="filters" role="group" aria-label="Filter tees">
        <fieldset><legend class="micro">Fit</legend>${['All', 'Boxy', 'Regular', 'Oversized'].map((f, i) => `<button type="button" data-fit="${f}" aria-pressed="${i === 0}">${f}</button>`).join('')}</fieldset>
        <fieldset><legend class="micro">Size</legend>${['Any', 'XS', 'S', 'M', 'L', 'XL', 'XXL'].map((f, i) => `<button type="button" data-sz="${f}" aria-pressed="${i === 0}">${f}</button>`).join('')}</fieldset>
        <fieldset><legend class="micro">Sort</legend>${['Index', 'Price ↑', 'Price ↓'].map((f, i) => `<button type="button" data-sort="${i}" aria-pressed="${i === 0}">${f}</button>`).join('')}</fieldset>
      </div>
      <div class="shop-layout"><div data-out>${liveList(base)}</div><div aria-hidden="true"></div></div>
    </div>${footer()}`,
    mount() {
      const root = document.querySelector<HTMLElement>('.page')!, out = root.querySelector<HTMLElement>('[data-out]')!;
      const f = { fit: 'All', sz: 'Any', sort: 0 };
      const items = () => {
        const r = base.filter((p) => (f.fit === 'All' || p.fit === f.fit) && (f.sz === 'Any' || (p.sizes as Record<string, number>)[f.sz] > 0));
        return f.sort ? [...r].sort((a, b) => (f.sort === 1 ? a.price - b.price : b.price - a.price)) : r;
      };
      root.querySelector('.filters')!.addEventListener('click', (ev) => {
        const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
        const key = b.dataset.fit !== undefined ? 'fit' : b.dataset.sz !== undefined ? 'sz' : 'sort';
        b.parentElement!.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        if (key === 'fit') f.fit = b.dataset.fit!; else if (key === 'sz') f.sz = b.dataset.sz!; else f.sort = Number(b.dataset.sort);
        out.innerHTML = liveList(items());
        const first = items()[0]; if (innerWidth >= 860) first ? (app.setCurrent(first.slug), app.engine.setMode({ kind: 'showcase', slug: first.slug, offsetX: 0.28 })) : app.engine.setMode({ kind: 'none' });
      });
      bindLive(out, items);
    },
  };
}

export const shop = () => shopPage('Shop', 'Every tee we make, in one list. Hover a row to see it turn.', products, 'shop');
export const collection = (key: 'core' | 'drops') => shopPage(collections[key].name, collections[key].text, products.filter((p) => p.collection === key), 'collections');

export const collectionsPage = (): Page => ({
  title: 'Collections', nav: 'collections',
  html: `<div class="page"><header class="page-head"><h1 class="display">Collections</h1></header><div class="wrap" style="border-top:1px solid #000">
    ${(['core', 'drops'] as const).map((k) => `<a class="coll" href="#c-${k}"><span class="nm"><span class="u">${collections[k].name}</span></span><p>${esc(collections[k].text)}</p><span class="val">${products.filter((p) => p.collection === k).length} tees</span></a>`).join('')}
  </div></div>${footer()}`,
  mount() { app.engine.setMode({ kind: 'none' }); },
});

export const bagPage = (): Page => ({
  title: 'Bag',
  html: `<div class="page"><header class="page-head"><h1 class="display">Bag</h1></header><div class="narrow" data-bag-page></div></div>${footer()}`,
  mount() {
    app.engine.setMode({ kind: 'none' });
    const el = document.querySelector<HTMLElement>('[data-bag-page]')!;
    const draw = () => { el.innerHTML = lineItems() + (state.bag.length ? totals() + `<div style="text-align:center;margin-top:28px"><a class="cta" href="#checkout">Checkout</a></div>` : `<div style="text-align:center"><a class="cta" href="#shop">Shop tees</a></div>`); };
    draw(); bindQty(el);
    const off = onChange(draw);
    return () => { off(); };
  },
});

export const checkout = (): Page => ({
  title: 'Checkout',
  html: `<div class="page"><header class="page-head"><h1 class="display">Checkout</h1><p>Payments are not connected yet. Placing an order here only saves it in this browser.</p></header>
    <div class="co">
      <form class="form" novalidate data-co>
        <fieldset class="group"><legend class="micro">Contact</legend>
          ${field('email', 'Email', 'email', 'email')}${field('phone', 'Phone', 'tel', 'tel')}</fieldset>
        <fieldset class="group"><legend class="micro">Shipping address</legend>
          ${field('name', 'Full name', 'text', 'name')}${field('line1', 'Address', 'text', 'address-line1')}${field('city', 'City', 'text', 'address-level2')}${field('pin', 'PIN code', 'text', 'postal-code', 'inputmode="numeric" pattern="[0-9]{6}"')}</fieldset>
        <fieldset class="group"><legend class="micro">Delivery</legend>
          <label class="radio"><input type="radio" name="ship" value="std" checked> Standard, 4 to 6 days</label>
          <label class="radio"><input type="radio" name="ship" value="exp"> Express, 2 days <span class="ph">placeholder</span></label></fieldset>
        <fieldset class="group"><legend class="micro">Payment</legend>
          <label class="radio"><input type="radio" name="pay" value="cod" checked> Cash on delivery</label>
          <label class="radio"><input type="radio" name="pay" value="online" disabled> UPI and cards (not connected yet)</label></fieldset>
        <p class="buy-note" aria-live="polite" data-err style="margin-top:14px"></p>
        <div style="margin-top:18px"><button class="cta" type="submit">Place order</button></div>
      </form>
      <aside class="summary" aria-label="Order summary"><h2 class="micro">Summary</h2><div data-sum></div></aside>
    </div></div>`,
  mount() {
    app.engine.setMode({ kind: 'none' });
    const sum = document.querySelector<HTMLElement>('[data-sum]')!;
    sum.innerHTML = lineItems(false) + (state.bag.length ? totals() : '');
    const form = document.querySelector<HTMLFormElement>('[data-co]')!, err = form.querySelector('[data-err]')!;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!state.bag.length) { err.textContent = 'Your bag is empty.'; return; }
      let bad: HTMLInputElement | null = null;
      form.querySelectorAll<HTMLInputElement>('input[required]').forEach((i) => { const ok = i.checkValidity(); i.closest('.field')!.classList.toggle('err', !ok); i.setAttribute('aria-invalid', String(!ok)); if (!ok && !bad) bad = i; });
      if (bad) { err.textContent = 'Check the highlighted fields.'; (bad as HTMLInputElement).focus(); return; }
      const d = new FormData(form);
      placeOrder(String(d.get('name')), String(d.get('city')));
      location.hash = 'order';
    });
  },
});
const field = (id: string, label: string, type: string, ac: string, extra = '') =>
  `<div class="field"><label class="micro" for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" autocomplete="${ac}" required ${extra}></div>`;

export const orderPage = (): Page => {
  const o = state.orders[0];
  if (!o) return { title: 'Order', html: `<div class="page"><header class="page-head"><h1 class="display">No order yet</h1><p><a class="link" href="#shop">Go to the shop</a></p></header></div>`, mount: () => app.engine.setMode({ kind: 'none' }) };
  return {
    title: 'Order placed',
    html: `<div class="page"><header class="page-head"><span class="micro">Order ${esc(o.id)}</span><h1 class="display">Thank you</h1><p>${esc(o.name)}, your order is saved. Payments are not connected yet, so nothing was charged.</p></header>
      <div class="narrow">${o.items.map((i) => { const p = bySlug(i.slug)!; return `<div class="line-item"><i class="swatch" style="background:${p.colour}"></i><div><span class="nm">${esc(p.name)}</span><div class="micro">Size ${i.size} · Qty ${i.qty}</div></div><span class="val">${inr(p.price * i.qty)}</span></div>`; }).join('')}
      <div class="total big"><span>Paid on delivery</span><span>${inr(o.total)}</span></div>
      <p style="text-align:center;margin-top:28px"><a class="cta" href="#shop">Keep shopping</a></p></div></div>`,
    mount() { const s = o.items[0]?.slug; if (s) { app.engine.setMode({ kind: 'showcase', slug: s, offsetX: 0 }); app.engine.setShot(shot({ frame: 2400, targetY: 900 })); } },
  };
};

export const account = (): Page => ({
  title: state.user ? 'Account' : 'Sign in',
  html: `<div class="page"><header class="page-head"><h1 class="display">${state.user ? 'Account' : 'Sign in'}</h1><p>Accounts are a placeholder. Your name and orders stay in this browser only.</p></header><div class="narrow" data-acct></div></div>${footer()}`,
  mount() {
    app.engine.setMode({ kind: 'none' });
    const el = document.querySelector<HTMLElement>('[data-acct]')!;
    const draw = () => {
      if (!state.user) {
        el.innerHTML = `<form class="form" novalidate data-in><div class="field"><label class="micro" for="nm">Name</label><input id="nm" autocomplete="name" required></div>
          <div class="field"><label class="micro" for="em">Email</label><input id="em" type="email" autocomplete="email" required></div>
          <p class="buy-note" aria-live="polite" data-err></p><div style="margin-top:18px"><button class="cta" type="submit">Sign in</button></div></form>`;
        el.querySelector('form')!.addEventListener('submit', (ev) => {
          ev.preventDefault();
          const nm = el.querySelector<HTMLInputElement>('#nm')!, em = el.querySelector<HTMLInputElement>('#em')!;
          if (!nm.value.trim() || !em.checkValidity()) { el.querySelector('[data-err]')!.textContent = 'Enter your name and a valid email.'; return; }
          signIn(nm.value.trim()); location.hash = 'account'; draw();
        });
      } else {
        el.innerHTML = `<p class="micro">Signed in as</p><p class="display" style="font-size:44px">${esc(state.user)}</p>
          <h2 class="micro" style="margin-top:40px">Orders</h2>
          ${state.orders.length ? state.orders.map((o) => `<div class="total"><span>${esc(o.id)} · ${esc(o.date)}</span><span>${inr(o.total)}</span></div>`).join('') : '<p class="empty">No orders yet.</p>'}
          <p style="margin-top:28px"><a class="link" href="#wishlist">Wishlist (${state.wish.length})</a> · <button class="link" type="button" data-out>Sign out</button></p>`;
        el.querySelector('[data-out]')!.addEventListener('click', () => { signOut(); draw(); });
      }
    };
    draw();
  },
});

export const wishlist = (): Page => ({
  title: 'Wishlist',
  html: `<div class="page"><header class="page-head"><h1 class="display">Wishlist</h1></header><div class="shop-layout"><div data-w></div><div aria-hidden="true"></div></div></div>${footer()}`,
  mount() {
    const el = document.querySelector<HTMLElement>('[data-w]')!;
    const items = () => state.wish.map((s) => bySlug(s)!).filter(Boolean);
    const draw = () => { el.innerHTML = items().length ? `<ul class="list">${items().map((p) => row(p).replace('</a></li>', `</a><button class="rm" type="button" data-unwish="${p.slug}" style="margin:0 0 8px">Remove ${esc(p.name)}</button></li>`)).join('')}</ul>` : `<p class="empty">Nothing saved yet. <a class="link" href="#shop">Browse the shop</a></p>`; };
    draw(); bindLive(el, items);
    el.addEventListener('click', (ev) => { const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-unwish]'); if (b) { toggleWish(b.dataset.unwish!); draw(); } });
    void subtotal;
  },
});
