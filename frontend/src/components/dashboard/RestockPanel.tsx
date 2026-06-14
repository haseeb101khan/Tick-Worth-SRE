import { useEffect, useState } from 'react';
import { RestockRequest, StockRow } from '../../types';
import { getInventory } from '../../services/inventoryService';
import {
  RestockLine,
  cancelRestockRequest,
  createRestockRequests,
  getRestockRequests,
} from '../../services/restockRequestService';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';
import { StatusBadge } from '../StatusBadge';

interface NeedRow {
  productId: string;
  name: string;
  shop: number;
  warehouse: number;
  reorderLevel: number;
}

/**
 * Shopkeeper view: every shop item that's low or out of stock, with a one-click
 * "Request restock for all" plus per-item asks. The warehouse approves & sends.
 */
export function RestockPanel({ onStockChange }: { onStockChange: () => void }) {
  const toast = useToast();
  const [inventory, setInventory] = useState<StockRow[]>([]);
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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

  // Fold the per-location stock rows into one row per product.
  const byProduct = new Map<string, NeedRow>();
  for (const row of inventory) {
    const entry = byProduct.get(row.productId) ?? {
      productId: row.productId,
      name: `${row.product.brand} ${row.product.name}`,
      shop: 0,
      warehouse: 0,
      reorderLevel: 3,
    };
    if (row.location === 'SHOP') {
      entry.shop = row.quantity;
      entry.reorderLevel = row.reorderLevel;
    }
    if (row.location === 'WAREHOUSE') entry.warehouse = row.quantity;
    byProduct.set(row.productId, entry);
  }

  // Low = at/under reorder level; that naturally includes out-of-stock (0) and
  // pre-booked items (out in the shop, waiting on a warehouse pull).
  const needs = [...byProduct.values()].sort((a, b) => a.shop - b.shop).filter((e) => e.shop <= e.reorderLevel);
  const openByProduct = new Set(requests.filter((r) => r.status === 'OPEN').map((r) => r.productId));

  // Suggest topping the shop up to ~2× its reorder level (at least 1 unit).
  const suggestedQty = (e: NeedRow) => Math.max(e.reorderLevel * 2 - e.shop, 1);
  const qtyFor = (e: NeedRow) => qtyById[e.productId] ?? suggestedQty(e);

  async function send(lines: RestockLine[]) {
    if (lines.length === 0) {
      toast.error('Nothing to request');
      return;
    }
    setBusy(true);
    try {
      await createRestockRequests(lines);
      toast.success(`Restock requested for ${lines.length} item${lines.length === 1 ? '' : 's'}`);
      refresh();
      onStockChange();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function requestAll() {
    const lines = needs
      .filter((e) => !openByProduct.has(e.productId))
      .map((e) => ({ productId: e.productId, quantity: qtyFor(e) }));
    send(lines);
  }

  async function cancel(id: string) {
    try {
      await cancelRestockRequest(id);
      toast.success('Request withdrawn');
      refresh();
      onStockChange();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  if (loading) return <p className="text-gray-500">Loading stock…</p>;

  const open = requests.filter((r) => r.status === 'OPEN');
  const resolved = requests.filter((r) => r.status !== 'OPEN');
  const pendingCount = needs.filter((e) => !openByProduct.has(e.productId)).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Items that are <b>low or out of stock</b> on the shop floor. Ask the warehouse to refill
        them — all at once, or one at a time. The warehouse manager approves and sends the stock.
      </p>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Needs restock ({needs.length})</h3>
          {needs.length > 0 && (
            <button
              type="button"
              onClick={requestAll}
              disabled={busy || pendingCount === 0}
              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              title={pendingCount === 0 ? 'Everything low is already requested' : 'Request a restock for every item below'}
            >
              📦 Request restock for all ({pendingCount})
            </button>
          )}
        </div>

        {needs.length === 0 ? (
          <p className="rounded-lg border bg-white p-4 text-sm text-gray-500 shadow-sm">
            Shop stock is healthy — nothing needs a restock right now.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-center">In shop</th>
                  <th className="px-4 py-3 text-center">In warehouse</th>
                  <th className="px-4 py-3 text-center">Request qty</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {needs.map((e) => {
                  const alreadyOpen = openByProduct.has(e.productId);
                  return (
                    <tr key={e.productId}>
                      <td className="px-4 py-3 font-medium">
                        {e.name}
                        {e.shop === 0 && (
                          <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Out of stock</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold ${e.shop === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {e.shop}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {e.warehouse > 0 ? e.warehouse : <span className="text-red-500">0</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={qtyFor(e)}
                          disabled={alreadyOpen}
                          onChange={(ev) =>
                            setQtyById((prev) => ({
                              ...prev,
                              [e.productId]: Math.max(1, Number(ev.target.value)),
                            }))
                          }
                          className="w-20 rounded border px-2 py-1 text-center text-sm disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {alreadyOpen ? (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Requested
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => send([{ productId: e.productId, quantity: qtyFor(e) }])}
                            disabled={busy}
                            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
                          >
                            Request
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-semibold">My restock requests</h3>
        {open.length === 0 && resolved.length === 0 && (
          <p className="text-sm text-gray-500">No restock requests yet.</p>
        )}

        <div className="space-y-2">
          {open.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-4 py-2 text-sm shadow-sm"
            >
              <span>
                <span className="font-medium">
                  {r.product ? `${r.product.brand} ${r.product.name}` : r.productId}
                </span>{' '}
                × {r.quantity}
              </span>
              <span className="flex items-center gap-3">
                <StatusBadge status={r.status} />
                <button
                  type="button"
                  onClick={() => cancel(r.id)}
                  className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Cancel
                </button>
              </span>
            </div>
          ))}

          {resolved.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-4 py-2 text-sm text-gray-600 shadow-sm"
            >
              <span>
                {r.product ? `${r.product.brand} ${r.product.name}` : r.productId} × {r.quantity}
                {r.status === 'FULFILLED' && r.movedQty != null && (
                  <span className="ml-2 text-xs text-emerald-700">{r.movedQty} sent to shop</span>
                )}
              </span>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
