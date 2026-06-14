import { Product } from '../types';

// Money is stored as integer cents on the backend. Format for display only.
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

const DELIVERY_LABELS: Record<string, string> = {
  STANDARD: 'Standard delivery',
  EXPRESS: 'Express delivery',
  PICKUP: 'Collect in store',
};

export function deliveryLabel(method: string): string {
  return DELIVERY_LABELS[method] ?? method;
}

// Plain-language names for the order lifecycle, matching how staff talk about orders:
// "ordered → confirmed → dispatched → delivered" (PENDING means a placed order awaiting
// payment confirmation). Used in the order-status report so it reads at a glance.
const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ordered',
  PAID: 'Confirmed',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

// Available units of a product at a given location (0 if the row is missing).
export function stockAt(product: Product, location: 'WAREHOUSE' | 'SHOP' | 'REPAIR'): number {
  return product.stock?.find((s) => s.location === location)?.quantity ?? 0;
}
