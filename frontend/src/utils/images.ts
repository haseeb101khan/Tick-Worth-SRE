// Curated, load-verified watch photography (Unsplash CDN). In production these
// would be swapped for the retailer's own brand-accurate product shots.
const unsplash = (id: string, w = 800) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// Specific photo per seeded product.
const BY_NAME: Record<string, string> = {
  'Submariner Date': '1523275335684-37898b6baf30',
  'Speedmaster Pro': '1533139502658-0198f920d8e8',
  'Tank Louis': '1612817159949-195b6eb9e31a',
  'Nautilus 5711': '1547996160-81dfa63595aa',
  'Khaki Field': '1524805444758-089113d48a6d',
  'Seamaster 300': '1495704907664-81f74a7efd9b',
};

// Fallback pool for any other product (e.g. ones created by staff).
const POOL = [
  '1434056886845-dac89ffe9b56',
  '1611591437281-460bfbe1220a',
  '1542496658-e33a6d0d50f6',
  '1526045431048-f857369baa09',
  '1551816230-ef5deaed4a26',
  '1548171915-e79a380a2a4b',
  '1455218873509-8097305ee378',
  '1509048191080-d2984bad6ae5',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function productImage(name: string, w = 800): string {
  const id = BY_NAME[name] ?? POOL[hash(name) % POOL.length];
  return unsplash(id, w);
}

// Editorial / scene imagery for the landing page.
export const heroImage = unsplash('1620625515032-6ed0c1790c75', 2000);
export const storyImage = unsplash('1587836374828-4dbafa94cf0e', 1300);
export const ctaImage = unsplash('1508057198894-247b23fe5ade', 1600);

// Representative image per category card.
export function categoryImage(category: string, w = 800): string {
  const map: Record<string, string> = {
    Diver: '1495704907664-81f74a7efd9b',
    Chronograph: '1533139502658-0198f920d8e8',
    Dress: '1612817159949-195b6eb9e31a',
    'Luxury Sport': '1547996160-81dfa63595aa',
    Field: '1524805444758-089113d48a6d',
  };
  return unsplash(map[category] ?? POOL[hash(category) % POOL.length], w);
}
