// Shared singletons for pages. Filled in by main.ts at boot.
import type Lenis from 'lenis';
import type { Engine } from './gl/engine';

export interface Page {
  title: string;
  description?: string;
  nav?: 'home' | 'shop' | 'collections';
  html: string;
  mount?: () => (() => void) | void;
  tick?: (dt: number) => void; // runs on the one clock while the page is open
}

export const app = {
  engine: null as unknown as Engine,
  lenis: null as unknown as Lenis,
  toast: (_msg: string) => {},
  openBag: () => {},
  current: '' as string, // slug of the tee in focus, for the Index highlight
  setCurrent: (_slug: string) => {},
};

// Escape text that ends up inside HTML strings.
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const diamonds = `<i class="diamond" style="left:var(--pad);top:52%"></i><i class="diamond" style="right:var(--pad);top:52%"></i>`;
