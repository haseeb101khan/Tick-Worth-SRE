import { useEffect, useState } from 'react';
import { StockRequest } from '../../types';
import { getAllRequests, resolveStockRequest } from '../../services/stockRequestService';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';
import { stockAt } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'OPEN',
  FULFILLED: 'FULFILLED',
  DECLINED: 'DECLINED',
  CANCELLED: 'CANCELLED',
};

export function StockRequestsPanel({ onStockChange }: { onStockChange: () => void }) {
  const toast = useToast();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    getAllRequests()
      .then(setRequests)
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  async function handle(id: string, action: 'FULFILL' | 'DECLINE') {
    try {
      await resolveStockRequest(id, action);
      toast.success(action === 'FULFILL' ? 'Fulfilled — customer notified' : 'Request declined');
      refresh();
      if (action === 'FULFILL') onStockChange();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  if (loading) return <p className="text-gray-500">Loading requests…</p>;

  const open = requests.filter((r) => r.status === 'OPEN');
  const resolved = requests.filter((r) => r.status !== 'OPEN');

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Customer demand for out-of-stock watches. <b>Pre-bookings</b> can be fulfilled by pulling a
        unit from the warehouse; plain <b>requests</b> mean the warehouse is empty too — fulfil only
        after restocking, otherwise decline.
      </p>

      <div>
        <h3 className="mb-2 font-semibold">Open ({open.length})</h3>
        {open.length === 0 && <p className="text-sm text-gray-500">Nothing waiting.</p>}
        <div className="space-y-3">
          {open.map((r) => {
            const warehouse = r.product ? stockAt(r.product, 'WAREHOUSE') : 0;
            const shop = r.product ? stockAt(r.product, 'SHOP') : 0;
            return (
              <div key={r.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {r.product ? `${r.product.brand} ${r.product.name}` : r.productId} × {r.quantity}
                    <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {r.type === 'PREBOOK' ? 'Pre-booking' : 'Request'}
                    </span>
                  </p>
                  <span className="text-xs text-gray-500">
                    Shop: {shop} · Warehouse: {warehouse}
                  </span>
                </div>
                <p className="mb-2 text-sm text-gray-600">
                  {r.customer?.name ?? 'Customer'}
                  {r.customer?.email && <span className="text-gray-400"> · {r.customer.email}</span>}
                  {r.note && <span className="block text-xs italic text-gray-400">“{r.note}”</span>}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handle(r.id, 'FULFILL')}
                    className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
                    title={
                      warehouse >= r.quantity || shop >= r.quantity
                        ? 'Make available in store + notify customer'
                        : 'No stock available — will fail until you restock'
                    }
                  >
                    Fulfil (move to shop)
                  </button>
                  <button
                    type="button"
                    onClick={() => handle(r.id, 'DECLINE')}
                    className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
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
                className="flex items-center justify-between rounded-lg border bg-white px-4 py-2 text-sm shadow-sm"
              >
                <span>
                  {r.product ? `${r.product.brand} ${r.product.name}` : r.productId} ·{' '}
                  {r.customer?.name ?? 'Customer'}
                </span>
                <StatusBadge status={STATUS_LABEL[r.status] ?? r.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
