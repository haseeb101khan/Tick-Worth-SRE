import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createStockRequest } from '../services/stockRequestService';
import { apiErrorMessage } from '../utils/apiError';
import { stockAt } from '../utils/format';

/**
 * Shown on a product card when the SHOP is out of stock.
 *  - Warehouse has it  → offer PRE-BOOK (the shop can pull a unit).
 *  - Warehouse empty   → offer REQUEST only (no promise it'll arrive).
 * The server makes the final REQUEST/PREBOOK decision; this just drives the label.
 */
export function OutOfStockActions({ product }: { product: Product }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const canPrebook = stockAt(product, 'WAREHOUSE') > 0;

  async function submit() {
    if (!user) {
      navigate('/login', { state: { from: '/' } });
      return;
    }
    setBusy(true);
    try {
      const req = await createStockRequest(product.id, 1);
      setDone(true);
      toast.success(
        req.type === 'PREBOOK'
          ? 'Pre-booked — we’ll notify you when it reaches the store'
          : 'Request sent to the shop — we’ll notify you if it comes back in stock',
      );
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="w-full border border-gold/40 bg-gold/5 py-3 text-center text-[0.7rem] uppercase tracking-wide2 text-gold-dark">
        {canPrebook ? 'Pre-booked ✓' : 'Request sent ✓'}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={busy}
      className={canPrebook ? 'btn-gold w-full' : 'btn-outline w-full border-ink/30 text-ink hover:bg-ink hover:text-ivory'}
      title={
        canPrebook
          ? 'In stock at the warehouse — pre-book to reserve interest'
          : 'Out at the warehouse too — send a request to the shop'
      }
    >
      {busy ? 'Sending…' : canPrebook ? 'Pre-book this watch' : 'Request from shop'}
    </button>
  );
}
