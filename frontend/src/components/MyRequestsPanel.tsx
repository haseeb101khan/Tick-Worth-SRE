import { useEffect, useState } from 'react';
import { StockRequest } from '../types';
import { cancelMyRequest, getMyRequests } from '../services/stockRequestService';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { StatusBadge } from './StatusBadge';

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'OPEN',
  FULFILLED: 'AVAILABLE',
  DECLINED: 'DECLINED',
  CANCELLED: 'CANCELLED',
};

export function MyRequestsPanel() {
  const toast = useToast();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyRequests()
      .then(setRequests)
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCancel(id: string) {
    try {
      const updated = await cancelMyRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      toast.success('Request cancelled');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  if (loading || requests.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Pre-bookings & requests</h2>
      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-4 shadow-sm">
            <div>
              <p className="font-medium">
                {r.product ? `${r.product.brand} ${r.product.name}` : r.productId}
                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {r.type === 'PREBOOK' ? 'Pre-booking' : 'Request'} × {r.quantity}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleString()}
                {r.status === 'FULFILLED' && ' · now available in store — order now!'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={STATUS_LABEL[r.status] ?? r.status} />
              {r.status === 'OPEN' && (
                <button
                  type="button"
                  onClick={() => handleCancel(r.id)}
                  className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
