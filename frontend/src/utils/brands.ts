import { Product } from '../types';

// URL-safe slug for a brand name. "Patek Philippe" -> "patek-philippe".
export function brandSlug(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// One-line positioning per brand for the storefront. Brands without an entry
// fall back to a generic line — staff can flesh these out later.
const TAGLINES: Record<string, string> = {
  Rolex: 'A crown for every achievement',
  'Audemars Piguet': 'Masters of the luxury sports watch',
  'Patek Philippe': 'Heirlooms for the next generation',
  Hublot: 'The art of fusion',
  Tissot: 'Swiss watchmaking since 1853',
  Seastar: 'Built for the deep',
  Benyar: 'Aviation-inspired chronographs',
  Sveston: 'Motorsport on the wrist',
  Matturi: 'Statement timepieces, dressed with intent',
  'Universe Point': 'Fashion-forward by design',
  Bestwin: 'Clean, versatile, everyday',
  Forsinning: 'The mechanical art of the skeleton dial',
  Fitron: 'Quiet, dependable charm',
  Successway: 'Sharp lines for the ambitious wrist',
  'X-TL.OK': 'Sporty, resilient, ready for anything',
  Reward: 'Stripped to the essentials',
  Curren: 'Elegant, on-trend detail',
  Guess: 'Everyday glamour',
  IEKE: 'Delicate and refined',
  Jarvinia: 'Grace for the modern woman',
  Swister: 'Playful, contemporary character',
  SKMEI: 'Digital function, sporty spirit',
  'Al-Fajr': 'Trusted prayer-time timepieces',
};

export interface BrandSummary {
  name: string;
  slug: string;
  tagline: string;
  image?: string; // representative model image
  modelCount: number;
}

// Build the brand directory from the product list: one entry per brand, using
// its first model's image as the cover and counting how many models it offers.
export function summariseBrands(products: Product[]): BrandSummary[] {
  const map = new Map<string, BrandSummary>();
  for (const p of products) {
    const existing = map.get(p.brand);
    if (existing) {
      existing.modelCount += 1;
      if (!existing.image && p.imageUrl) existing.image = p.imageUrl;
    } else {
      map.set(p.brand, {
        name: p.brand,
        slug: brandSlug(p.brand),
        tagline: TAGLINES[p.brand] ?? 'Distinctive timepieces, honestly priced',
        image: p.imageUrl,
        modelCount: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
