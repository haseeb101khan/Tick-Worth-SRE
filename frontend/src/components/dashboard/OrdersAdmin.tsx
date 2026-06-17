import { useEffect, useState } from 'react';
import { Courier, Order, Product } from '../../types';
import { cancelOrder, getAllOrders, updateOrderStatus } from '../../services/orderService';
import { getCouriers } from '../../services/courierService';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';
import { deliveryLabel, formatMoney } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

export function OrdersAdmin({ products, onStockChange }: { products: Product[]; onStockChange: () => void }) {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-order courier picked in the dispatch dropdown (orderId → courierId).
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const names = Object.fromEntries(products.map((p) => [p.id, `${p.brand} ${p.name}`]));

  useEffect(() => {
    Promise.all([getAllOrders(), getCouriers(true)])
      .then(([os, cs]) => {
        setOrders(os);
        setCouriers(cs);
      })
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function replace(updated: Order) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
  }

  async function handlePay(order: Order) {
    try {
      replace(await updateOrderStatus(order.id, 'PAID'));
      toast.success('Payment confirmed');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function handleDispatch(order: Order) {
    // Pickups need no courier; deliveries require one to be selected.
    const courierId = order.deliveryMethod === 'PICKUP' ? undefined : chosen[order.id];
    if (order.deliveryMethod !== 'PICKUP' && !courierId) {
      toast.error('Pick a courier to dispatch this delivery');
      return;
    }
    try {
      replace(await updateOrderStatus(order.id, 'DISPATCHED', courierId));
      toast.success(order.deliveryMethod === 'PICKUP' ? 'Marked ready for pickup' : 'Dispatched');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function handleDeliver(order: Order) {
    try {
      replace(await updateOrderStatus(order.id, 'DELIVERED'));
      toast.success('Marked delivered');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function handleCancel(order: Order) {
    // Optional reason so the order-status report can explain the cancellation.
    const reason = window.prompt('Reason for cancelling? (optional)')?.trim() || undefined;
    try {
      replace(await cancelOrder(order.id, reason));
      toast.success('Order cancelled — stock restored');
      onStockChange();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  if (loading) return <p className="text-gray-500">Loading orders…</p>;
  if (orders.length === 0) return <p className="text-gray-500">No orders yet.</p>;

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500">
                <span className="font-mono font-semibold text-gray-700">{order.orderNumber}</span> ·{' '}
                {new Date(order.createdAt).toLocaleString()} · {order.paymentMethod}
              </p>
              <p className="text-sm">
                <span className="font-medium">{order.customer?.name ?? 'Customer'}</span>
                {order.customer?.email && <span className="text-gray-500"> · {order.customer.email}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{formatMoney(order.totalCents)}</span>
              <StatusBadge status={order.status} />
            </div>
          </div>

          <div className="mb-3 text-sm text-gray-600">
            {order.items
              .map((i) => `${names[i.productId] ?? i.productId}${i.color ? ` (${i.color})` : ''} × ${i.quantity}`)
              .join(' · ')}
            <span className="mt-1 block text-xs text-gray-400">
              {deliveryLabel(order.deliveryMethod)}
              {order.deliveryMethod !== 'PICKUP' && order.shippingAddress
                ? ` · Ship to: ${order.shippingAddress}`
                : ''}
              {order.courier && ` · 🚚 ${order.courier.name} (${order.courier.phone})`}
            </span>
            {order.status === 'CANCELLED' && (
              <span className="mt-1 block text-xs text-gray-400">
                Cancelled {order.cancelledBy === 'CUSTOMER' ? 'by customer' : order.cancelledBy ? 'by staff' : ''}
                {order.cancelReason ? ` — “${order.cancelReason}”` : ''}
              </span>
            )}
          </div>

          {/* EasyPaisa payment proof — verify this before confirming an online payment. */}
          {order.paymentMethod === 'ONLINE' && !order.paymentConfirmed && (
            <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs">
              <p className="font-medium text-amber-800">EasyPaisa payment — verify before confirming</p>
              <p className="mt-1 text-gray-700">
                Sender: <span className="font-medium">{order.paymentSenderName || '—'}</span>
                {order.paymentReference ? ` · Ref: ${order.paymentReference}` : ''}
              </p>
              {order.paymentProofUrl ? (
                <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={order.paymentProofUrl}
                    alt="Payment screenshot"
                    className="mt-2 h-32 w-auto rounded border object-contain hover:opacity-90"
                  />
                  <span className="mt-1 block text-amber-700 underline">Open full screenshot</span>
                </a>
              ) : (
                <p className="mt-1 text-red-600">No screenshot was attached.</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {order.status === 'PENDING' && (
              <button
                type="button"
                onClick={() => handlePay(order)}
                className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
              >
                Confirm payment
              </button>
            )}

            {order.status === 'PAID' && (
              <>
                {order.deliveryMethod !== 'PICKUP' && (
                  <select
                    aria-label="Assign courier"
                    value={chosen[order.id] ?? ''}
                    onChange={(e) => setChosen((prev) => ({ ...prev, [order.id]: e.target.value }))}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    <option value="">Assign courier…</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.phone}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => handleDispatch(order)}
                  className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
                >
                  {order.deliveryMethod === 'PICKUP' ? 'Mark ready for pickup' : 'Dispatch'}
                </button>
              </>
            )}

            {order.status === 'DISPATCHED' && (
              <button
                type="button"
                onClick={() => handleDeliver(order)}
                className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
              >
                Mark delivered
              </button>
            )}

            {(order.status === 'PENDING' || order.status === 'PAID') && (
              <button
                type="button"
                onClick={() => handleCancel(order)}
                className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
