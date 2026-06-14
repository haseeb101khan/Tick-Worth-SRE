import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Product } from '../types';
import { getProducts } from '../services/productService';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { matchesQuery } from '../utils/search';
import { ProductCard } from '../components/ProductCard';
import { Reveal } from '../components/Reveal';

export function ProductsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // Search and category live in the URL so links (e.g. the homepage search) and
  // browser history work; brand is a local dropdown.
  const search = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? '';
  const [brand, setBrand] = useState('');

  // Fetch the whole catalogue once, then filter entirely on the client. With a
  // catalogue this size that keeps search instant and lets us match across
  // name/brand/category case- and punctuation-insensitively.
  useEffect(() => {
    setLoading(true);
    getProducts()
      .then(setProducts)
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allBrands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort(), [products]);
  const allCategories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          matchesQuery(p, search) &&
          (!brand || p.brand === brand) &&
          (!category || p.category === category),
      ),
    [products, search, brand, category],
  );

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  const activeFilters = [brand, category, search].filter(Boolean).length;

  return (
    <div className="bg-ivory">
      {/* Page header */}
      <header className="bg-ink pb-16 pt-36 text-center text-ivory">
        <div className="section">
          <span className="eyebrow">The Collection</span>
          <h1 className="mt-5 font-serif text-5xl font-light sm:text-6xl">Every Watch We Offer</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ivory/60">
            Browse our complete catalogue of authenticated luxury and Swiss timepieces.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="sticky top-[60px] z-20 border-b border-ink/10 bg-ivory/95 backdrop-blur">
        <div className="section flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
          <input
            placeholder="Search by name, brand or style…"
            value={search}
            onChange={(e) => setParam('search', e.target.value)}
            className="input-luxe lg:max-w-xs"
            aria-label="Search watches"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="input-luxe w-auto"
              aria-label="Filter by brand"
            >
              <option value="">All Maisons</option>
              {allBrands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setParam('category', e.target.value)}
              className="input-luxe w-auto"
              aria-label="Filter by category"
            >
              <option value="">All Disciplines</option>
              {allCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBrand('');
                  setSearchParams({}, { replace: true });
                }}
                className="text-[0.7rem] uppercase tracking-wide2 text-stone hover:text-gold"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <section className="section py-16">
        {loading && <p className="text-center text-stone">Loading the collection…</p>}
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 80}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
        {!loading && filtered.length === 0 && (
          <p className="py-20 text-center text-stone">No watches match your selection.</p>
        )}
      </section>
    </div>
  );
}
