import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Product, StockRow } from '../../types';
import { getInventory, receiveStock } from '../../services/inventoryService';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';

interface Wh {
  qty: number;
  reorder: number;
}

/**
 * Warehouse manager / owner: restock the WAREHOUSE by receiving supplier stock (purchase-in).
 * Surfaces what's low or out first, marks those items in the picker, and pre-fills a suggested
 * quantity so a restock is one click away.
 */
export function ReceiveStockPanel({ products, onDone }: { products: Product[]; onDone: () => void }) {
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [inventory, setInventory] = useState<StockRow[]>([]);

  const loadInventory = useCallback(() => {
    getInventory('WAREHOUSE').then(setInventory).catch(() => undefined);
  }, []);

  useEffect(loadInventory, [loadInventory]);

  // Warehouse quantity + reorder level per product (missing row ⇒ 0 on hand).
  const whByProduct = new Map<string, Wh>();
  for (const row of inventory) whByProduct.set(row.productId, { qty: row.quantity, reorder: row.reorderLevel });
  const info = (id: string): Wh => whByProduct.get(id) ?? { qty: 0, reorder: 5 };

  // 0 = out, 1 = low (at/under reorder), 2 = healthy.
  const rank = (w: Wh) => (w.qty === 0 ? 0 : w.qty <= w.reorder ? 1 : 2);
  const suggested = (w: Wh) => Math.max(w.reorder * 2 - w.qty, 1);

  const ranked = [...products]
    .map((p) => ({ p, w: info(p.id) }))
    .sort((a, b) => {
      if (rank(a.w) !== rank(b.w)) return rank(a.w) - rank(b.w);
      if (a.w.qty !== b.w.qty) return a.w.qty - b.w.qty;
      return `${a.p.brand} ${a.p.name}`.localeCompare(`${b.p.brand} ${b.p.name}`);
    });
  const needsRestock = ranked.filter((x) => rank(x.w) < 2);
  const healthy = ranked.filter((x) => rank(x.w) === 2);

  // Picking a product (from the list or the dropdown) pre-fills a sensible restock quantity.
  function selectProduct(id: string) {
    setProductId(id);
    if (id) setQuantity(suggested(info(id)));
  }

  function optionLabel(p: Product, w: Wh) {
    const marker = w.qty === 0 ? '✕ OUT' : w.qty <= w.reorder ? '⚠ LOW' : '';
    return `${marker ? `${marker} — ` : ''}${p.brand} ${p.name} · ${w.qty} in warehouse`;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await receiveStock(productId, quantity);
      toast.success(`Received ${quantity} unit(s) into the warehouse`);
      setQuantity(1);
      setProductId('');
      loadInventory();
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const selected = productId ? info(productId) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* What needs restocking, surfaced first. */}
      <div className="rounded-lg border bg-white p-5 shadow-sm">
        <h3 className="mb-1 font-semibold">Low / out of warehouse stock ({needsRestock.length})</h3>
        <p className="mb-3 text-xs text-gray-500">
          Running low (⚠) or empty (✕) in the warehouse. Hit “Restock” to load it into the form with
          a suggested quantity, then confirm.
        </p>
        {needsRestock.length === 0 ? (
          <p className="text-sm text-gray-500">Warehouse stock is healthy — nothing to restock.</p>
        ) : (
          <ul className="space-y-2">
            {needsRestock.map(({ p, w }) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {p.brand} {p.name}
                  </span>
                  <span
                    className={`ml-2 rounded px-2 py-0.5 text-xs ${
                      w.qty === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {w.qty === 0 ? '✕ Out' : `⚠ ${w.qty} left`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => selectProduct(p.id)}
                  className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
                >
                  Restock
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Receive form — picker marks low/out items and groups them at the top. */}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Receive supplier stock</h3>
        <p className="text-xs text-gray-500">
          Adds incoming inventory to the WAREHOUSE and records a PURCHASE_IN ledger movement.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium">Product</label>
          <select
            required
            value={productId}
            onChange={(e) => selectProduct(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            title="Product to receive"
          >
            <option value="">Select a product…</option>
            {needsRestock.length > 0 && (
              <optgroup label="⚠ Needs restock">
                {needsRestock.map(({ p, w }) => (
                  <option key={p.id} value={p.id}>
                    {optionLabel(p, w)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="In stock">
              {healthy.map(({ p, w }) => (
                <option key={p.id} value={p.id}>
                  {optionLabel(p, w)}
                </option>
              ))}
            </optgroup>
          </select>
          {selected && (
            <p className="mt-1 text-xs text-gray-500">
              Currently <b>{selected.qty}</b> in warehouse (reorder level {selected.reorder}).
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Quantity received</label>
          <input
            type="number"
            min={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-40 rounded border px-3 py-2 text-sm"
            title="Quantity received"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {busy ? 'Receiving…' : 'Receive into warehouse'}
        </button>
      </form>
    </div>
  );
}
