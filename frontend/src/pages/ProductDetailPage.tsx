import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Product } from '../types';
import { getProduct } from '../services/productService';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { formatMoney, stockAt } from '../utils/format';
import { brandSlug } from '../utils/brands';
import { WatchImage } from '../components/WatchImage';
import { ProductReviews } from '../components/ProductReviews';
import { OutOfStockActions } from '../components/OutOfStockActions';
import { STAFF_ROLES } from '../components/ProtectedRoute';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, items } = useCart();
  const { user } = useAuth();
  const toast = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setActiveImage(0);
    getProduct(id)
      .then(setProduct)
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <p className="section pt-40 text-center text-stone">Loading…</p>;
  }
  if (!product) {
    return (
      <div className="section pt-40 text-center">
        <p className="text-stone">This watch could not be found.</p>
        <Link to="/shop" className="btn-outline mt-6 border-ink/30 text-ink hover:bg-ink hover:text-ivory">
          Back to the collection
        </Link>
      </div>
    );
  }

  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const available = stockAt(product, 'SHOP');
  // Colour options for this model. Fall back to the primary image as a single
  // colour if a product predates the variant data.
  const variants =
    product.variants && product.variants.length > 0
      ? product.variants
      : [{ id: 'primary', productId: product.id, color: 'Standard', imageUrl: product.imageUrl ?? '', position: 0 }];
  const activeColor = variants[activeImage] ?? variants[0];
  const heroImage = activeColor?.imageUrl ?? product.imageUrl;
  const inCart = items.find((i) => i.product.id === product.id)?.quantity ?? 0;
  const maxAddable = Math.max(0, available - inCart);

  function handleAdd() {
    if (!product) return;
    // Only record a colour when the model actually offers colourways (not the
    // synthetic single-image "Standard" fallback).
    const chosenColor = product.variants && product.variants.length > 0 ? activeColor?.color : undefined;
    const ok = addItem(product, qty, chosenColor);
    if (ok) toast.success(`${product.name} added to your bag`);
    else toast.error(`That's the most of this piece we can add to your bag right now`);
  }

  const specs: [string, string][] = [
    ['Maison', product.brand],
    ['Discipline', product.category],
    ['Reference', product.id.slice(-8).toUpperCase()],
    ['Colourways', `${variants.length} available`],
    // Customers see only in/out of stock; staff see the exact boutique count.
    ['Availability', available > 0 ? (isStaff ? `${available} in the boutique` : 'In stock') : 'Currently unavailable'],
  ];

  return (
    <div className="bg-ivory pt-[60px]">
      <div className="section py-12">
        <Link to="/shop" className="text-[0.7rem] uppercase tracking-wide2 text-stone hover:text-gold">
          ← Back to collection
        </Link>

        <div className="mt-8 grid gap-12 lg:grid-cols-2">
          {/* Gallery — one image per colourway */}
          <div className="flex flex-col gap-4">
            <WatchImage
              key={heroImage}
              name={product.name}
              brand={product.brand}
              imageUrl={heroImage}
              width={1100}
              className="aspect-[4/5] w-full"
            />
            {variants.length > 1 && (
              <div>
                <p className="mb-3 text-[0.7rem] uppercase tracking-wide2 text-stone">
                  Colour — <span className="text-ink">{activeColor?.color}</span>
                </p>
                <div className="grid grid-cols-5 gap-3 sm:grid-cols-6">
                  {variants.map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      title={v.color}
                      className={`aspect-square overflow-hidden border transition-colors ${
                        i === activeImage ? 'border-gold' : 'border-ink/10 hover:border-ink/30'
                      }`}
                      aria-label={`View ${v.color}`}
                    >
                      <img src={v.imageUrl} alt={`${product.name} — ${v.color}`} loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col">
            <Link to={`/brand/${brandSlug(product.brand)}`} className="eyebrow-muted hover:text-gold">
              {product.brand}
            </Link>
            <h1 className="mt-2 font-serif text-4xl font-light text-ink sm:text-5xl">{product.name}</h1>
            <p className="mt-4 text-2xl font-light text-ink">{formatMoney(product.priceCents)}</p>
            <div className="rule-gold mt-6" />

            <p className="mt-6 text-sm leading-relaxed text-ink/70">
              {product.description ??
                `An exceptional ${product.category.toLowerCase()} timepiece by ${product.brand}, authenticated and ready for its next chapter.`}
            </p>

            {/* Purchase */}
            <div className="mt-8">
              {isStaff ? (
                <p className="text-sm text-stone">Sign in as a customer to purchase.</p>
              ) : available > 0 ? (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center border border-ink/20">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="h-12 w-12 text-lg hover:bg-ink/5"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.min(maxAddable || 1, q + 1))}
                      disabled={qty >= maxAddable}
                      className="h-12 w-12 text-lg hover:bg-ink/5 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={maxAddable === 0}
                    className="btn-gold flex-1"
                  >
                    {maxAddable === 0 ? 'Max in bag' : 'Add to bag'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleAdd();
                      navigate('/cart');
                    }}
                    disabled={maxAddable === 0}
                    className="btn-dark flex-1"
                  >
                    Buy now
                  </button>
                </div>
              ) : (
                <div className="max-w-xs">
                  <p className="mb-3 text-sm text-gold-dark">
                    This piece is currently out of stock in the boutique.
                  </p>
                  <OutOfStockActions product={product} />
                </div>
              )}
            </div>

            {/* Specs */}
            <dl className="mt-10 divide-y divide-ink/10 border-t border-ink/10">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between py-3 text-sm">
                  <dt className="text-stone">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            {/* Assurances */}
            <div className="mt-8 grid grid-cols-3 gap-3 text-center">
              {['Certified Authentic', 'Insured Delivery', '2-Year Warranty'].map((a) => (
                <div key={a} className="border border-ink/10 px-2 py-4 text-[0.65rem] uppercase tracking-wide2 text-stone">
                  {a}
                </div>
              ))}
            </div>
          </div>
        </div>

        <ProductReviews productId={product.id} />
      </div>
    </div>
  );
}
