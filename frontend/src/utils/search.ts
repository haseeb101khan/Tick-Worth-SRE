import { Product } from '../types';

// Case- and punctuation-insensitive product search. A query matches if every
// word in it is found in the product's name, brand, or category — either as
// written ("al-fajr") or with punctuation/spacing stripped ("ALFAJR", "al fajr").
export function matchesQuery(p: Pick<Product, 'name' | 'brand' | 'category'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const hay = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
  const hayCompact = hay.replace(/[^a-z0-9]/g, ''); // "al-fajr" -> "alfajr"

  return q.split(/\s+/).every((token) => {
    const compact = token.replace(/[^a-z0-9]/g, '');
    return hay.includes(token) || (compact.length > 0 && hayCompact.includes(compact));
  });
}
