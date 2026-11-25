// About, size guide, shipping, FAQ, contact, legal, 404, and the shared footer.
import { app, esc, type Page } from '../app';
import { brand, products } from '../data';
import { shot } from '../gl/engine';

export const footer = () => `<footer class="foot"><div class="foot-grid">
  <div><h2 class="micro">Shop</h2><ul><li><a href="#shop">All tees</a></li><li><a href="#c-core">Core</a></li><li><a href="#c-drops">Drops</a></li><li><a href="#wishlist">Wishlist</a></li></ul></div>
  <div><h2 class="micro">Help</h2><ul><li><a href="#size-guide">Size guide</a></li><li><a href="#shipping">Shipping and returns</a></li><li><a href="#faq">FAQ</a></li><li><a href="#contact">Contact</a></li></ul></div>
  <div><h2 class="micro">Pale Room</h2><ul><li><a href="#about">About</a></li><li><a href="#account">Account</a></li><li><a href="#privacy">Privacy</a></li><li><a href="#terms">Terms</a></li></ul></div>
  <form class="news-f" novalidate><label class="micro" for="nl">New drops by email</label><div class="news"><input id="nl" type="email" autocomplete="email" placeholder="you@example.com"><button type="submit">Join</button></div><p class="buy-note" aria-live="polite"></p></form>
  </div><p class="foot-word" aria-hidden="true">Pale Room</p></footer>`;

// newsletter has nowhere to send yet: say so instead of pretending
document.addEventListener('submit', (e) => {
  const f = (e.target as HTMLElement).closest('.news-f'); if (!f) return;
  e.preventDefault();
  const i = f.querySelector('input')!, n = f.querySelector('.buy-note')!;
  n.textContent = i.checkValidity() && i.value ? 'Saved here. Email sign-up is not connected yet.' : 'Enter a valid email.';
});

const prose = (title: string, body: string, description?: string): Page => ({
  title, description,
  html: `<div class="page"><header class="page-head"><h1 class="display">${esc(title)}</h1></header><div class="narrow prose">${body}</div></div>${footer()}`,
  mount() { app.engine.setMode({ kind: 'none' }); },
});

export const about = () => prose('About', `
  <p>Pale Room is a placeholder brand for a small t-shirt label based in ${brand.city}. Ten tees, two collections, no seasons.</p>
  <h2>Why 3D</h2><p>A flat photo hides the weight of a shirt. Here every tee is a 3D model lit like a studio product shot, so you can turn it over, slow it down and take it apart before you buy it.</p>
  <h2>Credits</h2><p>T-shirt model: <a href="https://sketchfab.com/3d-models/t-shirt-00daf5abf6d44db9a310b8264ad0e834" rel="noopener">“T-shirt” by Sirenko</a>, licensed <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener license">CC BY 4.0</a>. Cut into panels and recoloured for this site.</p>
  <h2>How they are made</h2><p>Combed and organic cotton jerseys from 200 to 300 gsm, cut and sewn in small runs, screen printed by hand. Every fact on this site is a placeholder until the real label replaces it.</p>`);

export const sizeGuide = () => prose('Size guide', `
  <p>Measure a tee you already like, flat, armpit to armpit. Measurements below are for the boxy cut, in centimetres.</p>
  <div style="overflow-x:auto"><table><thead><tr><th>Size</th><th>Chest</th><th>Length</th><th>Sleeve</th></tr></thead><tbody>
  ${[['XS', 50, 66, 21], ['S', 53, 68, 22], ['M', 56, 70, 23], ['L', 59, 72, 24], ['XL', 62, 74, 25], ['XXL', 65, 76, 26]].map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>
  <h2>Between sizes</h2><p>Boxy and oversized cuts are wide on purpose: take your usual size. Regular fit is true to size. Heavyweight cotton shrinks about 2% on the first warm wash.</p>
  <p><span class="ph">placeholder measurements</span></p>`);

export const shipping = () => prose('Shipping and returns', `
  <h2>Shipping</h2><p>Orders leave within two working days. Standard delivery across India takes 4 to 6 days. Shipping is free over ₹2,999, otherwise ₹99.</p>
  <h2>Returns</h2><p>Unworn and unwashed tees can come back within 14 days for a refund or a different size. Drops are final sale once worn.</p>
  <p><span class="ph">placeholder policy</span></p>`);

export const faq = (): Page => ({
  title: 'FAQ',
  html: `<div class="page"><header class="page-head"><h1 class="display">FAQ</h1></header><div class="narrow">
    ${[['Will the colour fade?', 'Garment-dyed colours fade slowly toward a softer tone. Wash cold and inside out to slow it down.'],
      ['Do drops come back?', 'No. When a drop sells out the pattern is retired.'],
      ['Can I change my order?', 'Within two hours of placing it. Write to us with the order number.'],
      ['Is the 3D model accurate?', 'The shape, weight and colour are close. The print artwork on each model is a placeholder.'],
      ['Do you ship outside India?', 'Not yet.']].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
    <p><span class="ph">placeholder answers</span></p></div></div>${footer()}`,
  mount() { app.engine.setMode({ kind: 'none' }); },
});

export const contact = (): Page => ({
  title: 'Contact',
  html: `<div class="page"><header class="page-head"><h1 class="display">Contact</h1><p>Write to ${brand.email} or use the form. The form is not connected yet.</p></header>
    <div class="narrow"><form class="form" novalidate data-ct>
      <div class="field"><label class="micro" for="cn">Name</label><input id="cn" autocomplete="name" required></div>
      <div class="field"><label class="micro" for="ce">Email</label><input id="ce" type="email" autocomplete="email" required></div>
      <div class="field"><label class="micro" for="cm">Message</label><textarea id="cm" required></textarea></div>
      <p class="buy-note" aria-live="polite" data-err></p><div style="margin-top:18px"><button class="cta" type="submit">Send</button></div>
    </form></div></div>${footer()}`,
  mount() {
    app.engine.setMode({ kind: 'none' });
    const f = document.querySelector<HTMLFormElement>('[data-ct]')!;
    f.addEventListener('submit', (e) => { e.preventDefault(); f.querySelector('[data-err]')!.textContent = f.checkValidity() ? 'Not sent: the contact form is not connected yet. Please email us.' : 'Fill in every field with a valid email.'; });
  },
});

export const privacy = () => prose('Privacy', `<p>This placeholder store keeps your bag, wishlist, sign-in name and orders in your own browser's storage. Nothing is sent to a server. Clearing your browser data removes it.</p><p><span class="ph">placeholder policy, replace before launch</span></p>`);
export const terms = () => prose('Terms', `<p>Prices are in Indian rupees and include GST. Products, prices and stock on this site are placeholders and cannot be bought yet.</p><p><span class="ph">placeholder terms, replace before launch</span></p>`);

export const notFound = (): Page => ({
  title: 'Not found',
  html: `<div class="page" style="display:grid;place-items:center;text-align:center;align-content:center;padding-bottom:12vh"><span class="micro">404</span><h1 class="display" style="font-size:clamp(64px,11vw,170px)">Page not found</h1><p style="color:var(--muted);font-weight:400">This shirt is on inside out, and this page does not exist.</p><div style="margin-top:20px"><a class="cta" href="#shop">Back to shop</a></div></div>`,
  mount() {
    app.engine.setMode({ kind: 'showcase', slug: products[2].slug, offsetX: 0, insideOut: true });
    app.engine.setShot(shot({ frame: 2600, polar: 10, targetY: 700 }));
  },
});
