import { Link } from 'react-router-dom';
import { Product } from '../types';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatMoney, stockAt } from '../utils/format';
import { WatchImage } from './WatchImage';
import { StarRating } from './StarRating';
import { OutOfStockActions } from './OutOfStockActions';
import { STAFF_ROLES } from './ProtectedRoute';

export function ProductCard({ product }: { product: Product }) {
  const { addItem, items } = useCart();
  const { user } = useAuth();
  const toast = useToast();

  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const available = stockAt(product, 'SHOP');
  const inCart = items.find((i) => i.product.id === product.id)?.quantity ?? 0;
  const atCap = inCart >= available;

  function handleAdd() {
    const ok = addItem(product);
    if (ok) toast.success(`${product.name} added to your bag`);
    else toast.error(`That's the most of this piece we can add to your bag right now`);
  }

  return (
    <div className="card-lift flex flex-col text-center">
      <Link to={`/shop/${product.id}`} className="img-zoom block">
        <WatchImage
          name={product.name}
          brand={product.brand}
          imageUrl={product.imageUrl}
          className="aspect-[4/5]"
        />
      </Link>

      <div className="flex flex-1 flex-col pt-5">
        <p className="eyebrow-muted">{product.brand}</p>
        <Link to={`/shop/${product.id}`}>
          <h3 className="mt-1 font-serif text-xl text-ink transition-colors hover:text-gold">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1 text-sm tracking-wide text-ink/70">{formatMoney(product.priceCents)}</p>

        {!!product.ratingCount && product.ratingAverage != null && (
          <div className="mt-1.5 flex items-center justify-center gap-1.5">
            <StarRating value={product.ratingAverage} size="sm" />
            <span className="text-[0.65rem] text-stone">({product.ratingCount})</span>
          </div>
        )}

        {/* Customers never see exact stock counts — only staff do. Out-of-stock is
            still surfaced so the pre-book / request flow makes sense. */}
        <p className={`mt-2 text-[0.7rem] uppercase tracking-wide2 ${available > 0 ? 'text-stone' : 'text-gold-dark'}`}>
          {available > 0
            ? isStaff
              ? `${available} available${inCart > 0 ? ` · ${inCart} in bag` : ''}`
              : inCart > 0
                ? `${inCart} in bag`
                : ' '
            : 'Out of stock'}
        </p>

        <div className="mt-4">
          {!isStaff &&
            (available > 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                disabled={atCap}
                className="btn-dark w-full"
              >
                {atCap ? 'Max in bag' : 'Add to bag'}
              </button>
            ) : (
              <OutOfStockActions product={product} />
            ))}
        </div>
      </div>
    </div>
  );
}
