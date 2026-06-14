import { useEffect, useState } from 'react';
import { RestockRequest, StockRow } from '../../types';
import { getInventory } from '../../services/inventoryService';
import { getRestockRequests, resolveRestockRequest } from '../../services/restockRequestService';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';
import { StatusBadge } from '../StatusBadge';

/**
 * Warehouse manager / owner view: the shop's restock asks. Pick how many units to send
 * (capped at what's in the warehouse), then fulfil — that moves WAREHOUSE→SHOP and notifies
 * the shopkeeper — or decline.
 */
export function RestockQueuePanel({ onStockChange }: { onStockChange: () => void }) {
  const toast = useToast();
  const [inventory, setInventory] = useState<StockRow[]>([]);
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [sendQty, setSendQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    Promise.all([getInventory(), getRestockRequests()])
      .then(([inv, reqs]) => {
        setInventory(inv);
        setRequests(reqs);
      })
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  const warehouseQty = new Map<string, number>();
  for (const row of inventory) {
    if (row.location === 'WAREHOUSE') warehouseQty.set(row.productId, row.quantity);
  }

  async function fulfil(r: RestockRequest) {
    const qty = sendQty[r.id] ?? r.quantity;
    setBusy(r.id);
    try {
      await resolveRestockRequest(r.id, 'FULFILL', qty);
      toast.success(`Sent ${qty} unit${qty === 1 ? '' : 's'} to the shop`);
      refresh();
      onStockChange();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function decline(r: RestockRequest) {
    setBusy(r.id);
    try {
      await resolveRestockRequest(r.id, 'DECLINE');
      toast.success('Request declined — shop notified');
      refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-gray-500">Loading restock requests…</p>;

  const open = requests.filter((r) => r.status === 'OPEN');
  const resolved = requests.filter((r) => r.status !== 'OPEN');

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Restock asks from the shop floor. Choose how many to send (the shop suggested a quantity);
        fulfilling moves the units <b>warehouse → shop</b> and notifies the shopkeeper.
      </p>

      <div>
        <h3 className="mb-2 font-semibold">Open ({open.length})</h3>
        {open.length === 0 && <p className="text-sm text-gray-500">Nothing waiting.</p>}
        <div className="space-y-3">
          {open.map((r) => {
            const available = warehouseQty.get(r.productId) ?? 0;
            const qty = sendQty[r.id] ?? r.quantity;
            return (
              <div key={r.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {r.product ? `${r.product.brand} ${r.product.name}` : r.productId}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      requested × {r.quantity}
                    </span>
                  </p>
                  <span className={`text-xs ${available === 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    In warehouse: {available}
                  </span>
                </div>
                <p className="mb-3 text-sm text-gray-600">
                  Asked by {r.requestedByName ?? 'the shop'}
                  {r.note && <span className="block text-xs italic text-gray-400">“{r.note}”</span>}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-gray-500">Send</label>
                  <input
                    type="number"
                    min={1}
                    max={available || undefined}
                    value={qty}
                    onChange={(ev) =>
                      setSendQty((prev) => ({ ...prev, [r.id]: Math.max(1, Number(ev.target.value)) }))
                    }
                    className="w-20 rounded border px-2 py-1 text-center text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => fulfil(r)}
                    disabled={busy === r.id || available === 0}
                    className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    title={available === 0 ? 'No warehouse stock — receive stock first' : 'Move stock to the shop'}
                  >
                    Fulfil (send to shop)
                  </button>
                  <button
                    type="button"
                    onClick={() => decline(r)}
                    disabled={busy === r.id}
                    className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {resolved.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">Resolved</h3>
          <div className="space-y-2">
            {resolved.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-4 py-2 text-sm text-gray-600 shadow-sm"
              >
                <span>
                  {r.product ? `${r.product.brand} ${r.product.name}` : r.productId} × {r.quantity}
                  {r.status === 'FULFILLED' && r.movedQty != null && (
                    <span className="ml-2 text-xs text-emerald-700">{r.movedQty} sent</span>
                  )}
                  {r.resolvedByName && <span className="ml-2 text-xs text-gray-400">· {r.resolvedByName}</span>}
                </span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
