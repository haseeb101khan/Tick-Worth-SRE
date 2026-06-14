import { Link } from 'react-router-dom';
import { Order } from '../types';
import { formatMoney } from '../utils/format';
import { SHOP, downloadReceipt, paymentLabel, receiptDeliveryLabel } from '../utils/receipt';

interface Props {
  order: Order;
  productNames: Record<string, string>; // productId → display name (from the cart at checkout time)
  customer?: { name: string; email: string } | null;
  onClose: () => void;
}

export function ReceiptModal({ order, productNames, customer, onClose }: Props) {
  const deliveryLabel = receiptDeliveryLabel(order);
  const subtotalCents = order.totalCents - order.deliveryFeeCents;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg overflow-hidden border border-ink/10 bg-white shadow-2xl">
        {/* Branded header */}
        <div className="border-b-2 border-ink bg-ivory px-8 py-6 text-center">
          <p className="font-serif text-3xl tracking-[0.3em] text-ink">{SHOP.name}</p>
          <p className="eyebrow-muted mt-1">{SHOP.tagline}</p>
        </div>

        <div className="px-8 py-6">
          <div className="text-center">
            <span className="inline-block rounded-sm border border-gold px-3 py-1 text-[0.65rem] uppercase tracking-wide2 text-gold-dark">
              Order confirmed
            </span>
            <p className="mt-3 text-sm text-stone">
              Order <span className="font-mono font-semibold text-ink">{order.orderNumber}</span> ·{' '}
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Billed to */}
          {customer && (
            <div className="mt-5 border-t border-ink/10 pt-4 text-sm">
              <p className="text-[0.6rem] uppercase tracking-wide2 text-stone">Billed to</p>
              <p className="mt-1 text-ink">{customer.name}</p>
              <p className="text-stone">{customer.email}</p>
            </div>
          )}

          {/* Items */}
          <div className="mt-6 border-y border-ink/15">
            <div className="flex justify-between py-2 text-[0.6rem] uppercase tracking-wide2 text-stone">
              <span>Item</span>
              <span>Amount</span>
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between border-t border-ink/10 py-2.5 text-sm">
                <span className="text-ink">
                  {productNames[item.productId] ?? item.productId}
                  <span className="text-stone"> × {item.quantity}</span>
                  {item.color && <span className="block text-xs text-stone">Colour: {item.color}</span>}
                </span>
                <span className="text-ink">{formatMoney(item.unitPriceCents * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="ml-auto mt-4 w-full space-y-1.5 sm:w-64">
            <div className="flex justify-between text-sm text-stone">
              <span>Subtotal</span>
              <span>{formatMoney(subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone">
              <span>{deliveryLabel}</span>
              <span>{order.deliveryFeeCents === 0 ? 'Free' : formatMoney(order.deliveryFeeCents)}</span>
            </div>
            <div className="flex justify-between border-t border-ink/20 pt-2 font-serif text-lg text-ink">
              <span>Total</span>
              <span>{formatMoney(order.totalCents)}</span>
            </div>
          </div>

          {/* Details */}
          <div className="mt-5 space-y-1 border-t border-ink/10 pt-4 text-sm text-stone">
            <p>
              <span className="text-ink">Payment:</span>{' '}
              {paymentLabel(order.paymentMethod)}
              {order.paymentConfirmed ? ' · confirmed' : ' · pending confirmation'}
            </p>
            {order.deliveryMethod === 'PICKUP' ? (
              <p>
                <span className="text-ink">Collection:</span> Collect in store once payment is confirmed.
              </p>
            ) : (
              order.shippingAddress && (
                <p>
                  <span className="text-ink">Ship to:</span> {order.shippingAddress}
                </p>
              )
            )}
          </div>

          {/* Actions */}
          <button
            type="button"
            onClick={() => downloadReceipt(order, productNames, customer)}
            className="btn-gold mt-6 w-full"
          >
            Download receipt (PDF)
          </button>
          <div className="mt-2 flex gap-2">
            <Link
              to="/orders"
              onClick={onClose}
              className="flex-1 border border-ink/20 py-2 text-center text-sm text-ink hover:bg-ink/5"
            >
              View my orders
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-ink/20 py-2 text-sm text-ink hover:bg-ink/5"
            >
              Keep shopping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
