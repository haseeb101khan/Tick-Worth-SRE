import { FormEvent, useState } from 'react';
import { Location, Product } from '../../types';
import { createTransfer } from '../../services/transferService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';

const LOCATIONS: Location[] = ['WAREHOUSE', 'SHOP', 'REPAIR'];

export function TransferPanel({ products, onDone }: { products: Product[]; onDone: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [from, setFrom] = useState<Location>('WAREHOUSE');
  const [to, setTo] = useState<Location>('SHOP');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const canMoveFromWarehouse = user?.role === 'WAREHOUSE_MANAGER' || user?.role === 'OWNER';
  // Shopkeepers can't source transfers from the warehouse, so don't even offer it.
  const fromOptions = canMoveFromWarehouse ? LOCATIONS : LOCATIONS.filter((l) => l !== 'WAREHOUSE');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (from === to) {
      toast.error('Source and destination must differ');
      return;
    }
    setBusy(true);
    try {
      await createTransfer({ productId, from, to, qty });
      toast.success(`Moved ${qty} unit(s) ${from} → ${to}`);
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded-lg border bg-white p-5 shadow-sm">
      <h3 className="font-semibold">Transfer stock</h3>
      <p className="text-xs text-gray-500">
        Covers warehouse→shop restock, shop→repair, repair→shop.
        {!canMoveFromWarehouse && ' (Transfers OUT of the warehouse need the warehouse manager or owner.)'}
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium">Product</label>
        <select
          required
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        >
          <option value="">Select a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.brand} {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">From</label>
          <select value={from} onChange={(e) => setFrom(e.target.value as Location)} className="w-full rounded border px-3 py-2 text-sm">
            {fromOptions.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">To</label>
          <select value={to} onChange={(e) => setTo(e.target.value as Location)} className="w-full rounded border px-3 py-2 text-sm">
            {LOCATIONS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Qty</label>
          <input
            type="number"
            min={1}
            required
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {busy ? 'Transferring…' : 'Transfer'}
      </button>
    </form>
  );
}
