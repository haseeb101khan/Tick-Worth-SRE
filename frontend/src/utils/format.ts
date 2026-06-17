import { Product } from '../types';

// Money is stored as integer minor units (paisa) on the backend. Format for display only —
// Pakistani Rupee, shown as whole rupees (Rs) since paisa aren't used in practice.
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// ISO timestamp → locale date / date-time. Shared so report views and lists format alike.
export const formatDate = (iso: string): string => new Date(iso).toLocaleDateString();
export const formatDateTime = (iso: string): string => new Date(iso).toLocaleString();

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
