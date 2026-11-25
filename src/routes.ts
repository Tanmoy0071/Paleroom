import type { Page } from './app';
import { bySlug } from './data';
import { home } from './pages/home';
import { product } from './pages/product';
import { shop, collection, collectionsPage, bagPage, checkout, orderPage, account, wishlist } from './pages/store';
import { about, sizeGuide, shipping, faq, contact, privacy, terms, notFound } from './pages/info';

const pages: Record<string, () => Page> = {
  '': home, home, shop, collections: collectionsPage, 'c-core': () => collection('core'), 'c-drops': () => collection('drops'),
  bag: bagPage, checkout, order: orderPage, account, wishlist,
  about, 'size-guide': sizeGuide, shipping, faq, contact, privacy, terms,
};

export function route(hash: string): Page {
  if (hash.startsWith('p-')) { const p = bySlug(hash.slice(2)); return p ? product(p) : notFound(); }
  return (pages[hash] ?? notFound)();
}
