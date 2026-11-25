// All store content. Every product is a placeholder until real stock exists.
export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
export interface Product {
  slug: string;
  name: string;
  collection: 'core' | 'drops';
  price: number; // INR, whole rupees
  colour: string; // fabric hex
  colourName: string;
  ink: string; // print hex
  fabric: string;
  gsm: number;
  fit: string;
  sizes: Record<Size, number>; // stock per size
  tagline: string[]; // words for the torn band
  print: string[]; // lines printed on the shirt
  description: string;
  designer: string;
  placeholder: true;
}

const stock = (sold: Size[] = []): Record<Size, number> =>
  Object.fromEntries((['XS', 'S', 'M', 'L', 'XL', 'XXL'] as Size[]).map((s) => [s, sold.includes(s) ? 0 : 12])) as Record<Size, number>;

export const brand = {
  name: 'Pale Room',
  wordmark: 'PALE ROOM',
  currency: 'INR',
  city: 'Silchar',
  email: 'hello@paleroom.example',
};

export const products: Product[] = [
  { slug: 'salt', name: 'Salt', collection: 'core', price: 1490, colour: '#ece9e2', colourName: 'Bone', ink: '#1a1a1a', fabric: 'Combed cotton jersey', gsm: 240, fit: 'Boxy', sizes: stock(['XS']), tagline: ['Plain', 'is a', 'decision'], print: ['PALE', 'ROOM', 'Nº 01'], description: 'The base layer of the whole room. Heavy combed jersey, cut boxy, dropped at the shoulder so it hangs instead of clings.', designer: 'Studio', placeholder: true },
  { slug: 'ash', name: 'Ash', collection: 'core', price: 1490, colour: '#9a9893', colourName: 'Ash grey', ink: '#f2f2f2', fabric: 'Combed cotton jersey', gsm: 240, fit: 'Boxy', sizes: stock(), tagline: ['Grey', 'goes with', 'everything'], print: ['ASH', 'Nº 02'], description: 'Melange grey with a small chest print. Washes soft after the third cycle and keeps its collar.', designer: 'Studio', placeholder: true },
  { slug: 'ink', name: 'Ink', collection: 'core', price: 1590, colour: '#1b1c1f', colourName: 'Off black', ink: '#ece9e2', fabric: 'Combed cotton jersey', gsm: 260, fit: 'Boxy', sizes: stock(['XXL']), tagline: ['Black', 'never', 'apologises'], print: ['INK', 'ROOM', 'Nº 03'], description: 'Garment-dyed off black, so it fades slowly toward charcoal instead of brown.', designer: 'Studio', placeholder: true },
  { slug: 'moss', name: 'Moss', collection: 'core', price: 1590, colour: '#59604a', colourName: 'Moss', ink: '#e6e1cf', fabric: 'Organic cotton jersey', gsm: 220, fit: 'Regular', sizes: stock(), tagline: ['Grown', 'slow', 'on purpose'], print: ['MOSS', 'Nº 04'], description: 'Organic jersey in a damp green. Regular fit for the people who find boxy too much.', designer: 'Studio', placeholder: true },
  { slug: 'brick', name: 'Brick', collection: 'drops', price: 1790, colour: '#9c3d2b', colourName: 'Brick red', ink: '#f0d9b5', fabric: 'Heavyweight cotton', gsm: 300, fit: 'Oversized', sizes: stock(['XS', 'S']), tagline: ['Built', 'like a', 'wall'], print: ['BRICK', 'BY', 'BRICK'], description: 'Our heaviest knit. Three hundred grams of cotton that stands up on its own on the table.', designer: 'Guest edition', placeholder: true },
  { slug: 'tide', name: 'Tide', collection: 'drops', price: 1690, colour: '#2f4a63', colourName: 'Deep tide', ink: '#d7e3ea', fabric: 'Combed cotton jersey', gsm: 240, fit: 'Boxy', sizes: stock(), tagline: ['Comes in', 'goes', 'out'], print: ['TIDE', 'HIGH', 'LOW'], description: 'A blue that reads black at night and navy at noon. Tonal print on the chest.', designer: 'Studio', placeholder: true },
  { slug: 'dune', name: 'Dune', collection: 'drops', price: 1690, colour: '#c8ab7e', colourName: 'Dune', ink: '#3b2a17', fabric: 'Organic cotton jersey', gsm: 220, fit: 'Regular', sizes: stock(['XXL']), tagline: ['Sand', 'keeps', 'moving'], print: ['DUNE', 'Nº 07'], description: 'Warm sand dyed with low-impact pigment. Lighter weight for long hot afternoons.', designer: 'Studio', placeholder: true },
  { slug: 'plum', name: 'Plum', collection: 'drops', price: 1790, colour: '#4d2b3b', colourName: 'Plum', ink: '#efc9d6', fabric: 'Heavyweight cotton', gsm: 300, fit: 'Oversized', sizes: stock(), tagline: ['Dark', 'and', 'sweet'], print: ['PLUM', 'ROOM'], description: 'A deep fruit tone on our heaviest knit, with a large back-of-neck print.', designer: 'Guest edition', placeholder: true },
  { slug: 'chalk', name: 'Chalk', collection: 'core', price: 1390, colour: '#f7f6f1', colourName: 'Chalk white', ink: '#9c3d2b', fabric: 'Combed cotton jersey', gsm: 200, fit: 'Regular', sizes: stock(), tagline: ['Write', 'on it', 'again'], print: ['CHALK', 'Nº 09'], description: 'Our lightest tee. A clean white with a red chest mark that softens with every wash.', designer: 'Studio', placeholder: true },
  { slug: 'rust', name: 'Rust', collection: 'drops', price: 1790, colour: '#b0592a', colourName: 'Rust', ink: '#1b1c1f', fabric: 'Heavyweight cotton', gsm: 300, fit: 'Oversized', sizes: stock(['M']), tagline: ['Time', 'leaves', 'colour'], print: ['RUST', 'NEVER', 'SLEEPS'], description: 'Oxidised orange on heavy cotton. Gets better the more it fades.', designer: 'Guest edition', placeholder: true },
];

export const bySlug = (s: string) => products.find((p) => p.slug === s);
export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
export const collections = {
  core: { name: 'Core', text: 'Six colours we will always make. Same patterns, same mills, restocked every season.' },
  drops: { name: 'Drops', text: 'Short runs in heavier fabric and louder colour. When a drop sells out it does not come back.' },
};
