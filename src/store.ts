// Bag, wishlist and orders, kept in this browser only. shortcut: localStorage, swap for a real cart API when checkout goes live.
import { bySlug, type Size } from './data';

export interface Item { slug: string; size: Size; qty: number }
export interface Order { id: string; items: Item[]; total: number; name: string; city: string; date: string }

const read = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem('pr:' + k) ?? '') as T; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem('pr:' + k, JSON.stringify(v)); } catch { /* private mode: keep in memory */ } };

const subs = new Set<() => void>();
export const onChange = (f: () => void) => { subs.add(f); return () => subs.delete(f); };
const emit = () => subs.forEach((f) => f());

export const state = {
  bag: read<Item[]>('bag', []).filter((i) => bySlug(i.slug)),
  wish: read<string[]>('wish', []).filter((s) => bySlug(s)),
  orders: read<Order[]>('orders', []),
  user: read<string | null>('user', null),
};

const save = () => { write('bag', state.bag); write('wish', state.wish); write('orders', state.orders); write('user', state.user); emit(); };

export const SHIPPING_FREE_FROM = 2999; // placeholder policy
export const SHIPPING = 99;

export function add(slug: string, size: Size) {
  const p = bySlug(slug);
  if (!p || !p.sizes[size]) return false;
  const it = state.bag.find((i) => i.slug === slug && i.size === size);
  if (it) it.qty = Math.min(it.qty + 1, p.sizes[size]); else state.bag.push({ slug, size, qty: 1 });
  save(); return true;
}
export function setQty(slug: string, size: Size, qty: number) {
  const p = bySlug(slug); if (!p) return;
  state.bag = state.bag.map((i) => (i.slug === slug && i.size === size ? { ...i, qty: Math.max(0, Math.min(qty, p.sizes[size])) } : i)).filter((i) => i.qty > 0);
  save();
}
export const count = () => state.bag.reduce((n, i) => n + i.qty, 0);
export const subtotal = (items = state.bag) => items.reduce((n, i) => n + (bySlug(i.slug)?.price ?? 0) * i.qty, 0);
export const shipping = (sub: number) => (sub === 0 || sub >= SHIPPING_FREE_FROM ? 0 : SHIPPING);
export function toggleWish(slug: string) { state.wish = state.wish.includes(slug) ? state.wish.filter((s) => s !== slug) : [...state.wish, slug]; save(); }
export function placeOrder(name: string, city: string): Order {
  const sub = subtotal();
  const o: Order = { id: 'PR-' + Date.now().toString(36).toUpperCase().slice(-6), items: state.bag, total: sub + shipping(sub), name, city, date: new Date().toISOString().slice(0, 10) };
  state.orders = [o, ...state.orders]; state.bag = []; save(); return o;
}
export function signIn(name: string) { state.user = name; save(); }
export function signOut() { state.user = null; save(); }

// self-check: money maths
console.assert(shipping(0) === 0 && shipping(1490) === SHIPPING && shipping(2999) === 0, 'shipping rule');
