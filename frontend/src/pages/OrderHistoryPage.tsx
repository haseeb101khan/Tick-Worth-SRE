import { useEffect, useState } from 'react';
import { Order, Product } from '../types';
import { getMyOrders, cancelOrder } from '../services/orderService';
import { getProducts } from '../services/productService';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { deliveryLabel, formatMoney } from '../utils/format';
import { downloadReceipt } from '../utils/receipt';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { MyRequestsPanel } from '../components/MyRequestsPanel';

const CANCELLABLE = ['PENDING', 'PAID'];

export function OrderHistoryPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyOrders(), getProducts()])
      .then(([os, ps]: [Order[], Product[]]) => {
        setOrders(os);
        setNames(Object.fromEntries(ps.map((p) => [p.id, `${p.brand} ${p.name}`])));
      })
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCancel(id: string) {
    try {
      const updated = await cancelOrder(id);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      toast.success('Order cancelled — stock restored');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-28 sm:px-8">
      <MyRequestsPanel />
      <h1 className="mb-8 font-serif text-4xl font-light text-ink">My Orders</h1>
      {loading && <p className="text-stone">Loading…</p>}
      {!loading && orders.length === 0 && <p className="text-stone">No orders yet.</p>}

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-gray-500">
                  <span className="font-mono font-semibold text-gray-700">{order.orderNumber}</span> ·{' '}
                  {new Date(order.createdAt).toLocaleString()}
                </p>
                <p className="font-semibold">{formatMoney(order.totalCents)}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={order.status} />
                <button
                  type="button"
                  onClick={() =>
                    downloadReceipt(order, names, user ? { name: user.name, email: user.email } : null)
                  }
                  className="rounded border border-ink/20 px-3 py-1 text-xs text-ink hover:bg-ink/5"
                >
                  Receipt
                </button>
                {CANCELLABLE.includes(order.status) && (
                  <button
                    type="button"
                    onClick={() => handleCancel(order.id)}
                    className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Cancel order
                  </button>
                )}
              </div>
            </div>
            <div className="divide-y rounded border text-sm">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between px-3 py-2">
                  <span>
                    {names[item.productId] ?? item.productId} × {item.quantity}
                    {item.color && <span className="text-gray-500"> · {item.color}</span>}
                  </span>
                  <span>{formatMoney(item.unitPriceCents * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>{deliveryLabel(order.deliveryMethod)}</span>
              {order.courier && (order.status === 'DISPATCHED' || order.status === 'DELIVERED') && (
                <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">
                  🚚 {order.status === 'DELIVERED' ? 'Delivered by' : 'Out for delivery with'}{' '}
                  <b>{order.courier.name}</b> · {order.courier.phone}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
