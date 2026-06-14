import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Product } from '../types';
import { getProducts } from '../services/productService';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { ProductCard } from '../components/ProductCard';
import { brandSlug, summariseBrands } from '../utils/brands';

// Middle tier of the Brand -> Model -> Colour hierarchy: every model offered by
// one brand. Picking a model opens its detail page with the colour options.
export function BrandPage() {
  const { slug } = useParams<{ slug: string }>();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProducts()
      .then(setProducts)
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const models = useMemo(
    () => products.filter((p) => brandSlug(p.brand) === slug),
    [products, slug],
  );
  const brand = useMemo(
    () => summariseBrands(products).find((b) => b.slug === slug),
    [products, slug],
  );

  if (loading) {
    return <p className="section pt-40 text-center text-stone">Loading…</p>;
  }
  if (!brand || models.length === 0) {
    return (
      <div className="section pt-40 text-center">
        <p className="text-stone">We don't carry this brand yet.</p>
        <Link to="/" className="btn-outline mt-6 border-ink/30 text-ink hover:bg-ink hover:text-ivory">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-ivory">
      {/* Brand header */}
      <header className="bg-ink pb-16 pt-36 text-center text-ivory">
        <div className="section">
          <Link to="/" className="text-[0.7rem] uppercase tracking-wide2 text-ivory/50 hover:text-gold">
            ← All brands
          </Link>
          <h1 className="mt-5 font-serif text-5xl font-light sm:text-6xl">{brand.name}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ivory/60">{brand.tagline}</p>
          <p className="mt-3 text-[0.7rem] uppercase tracking-wide2 text-gold/80">
            {models.length} {models.length > 1 ? 'models' : 'model'} available
          </p>
        </div>
      </header>

      {/* Models */}
      <section className="section py-16">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {models.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
