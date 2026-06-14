export type Role = 'CUSTOMER' | 'SHOPKEEPER' | 'WAREHOUSE_MANAGER' | 'OWNER';
export type Location = 'WAREHOUSE' | 'SHOP' | 'REPAIR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// Owner's view of an internal account (from /api/users — never includes the hash).
export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface Stock {
  id: string;
  productId: string;
  location: Location;
  quantity: number;
  reorderLevel: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  color: string;
  imageUrl: string;
  position: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  description?: string;
  priceCents: number;
  imageUrl?: string;
  images?: string[]; // legacy gallery shots (superseded by variants)
  variants?: ProductVariant[]; // colour options for this model
  stock?: Stock[];
  ratingAverage?: number | null; // mean star rating (null if no reviews yet)
  ratingCount?: number; // number of reviews
}

export interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  customerName: string;
  createdAt: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
  reviews: Review[];
}

// What the logged-in customer can do on a product's review form.
export interface ReviewState {
  canReview: boolean;
  myReview?: { id: string; rating: number; comment?: string | null } | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  color?: string; // chosen colourway (from the product detail page)
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  color?: string | null;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type DeliveryMethod = 'STANDARD' | 'EXPRESS' | 'PICKUP';

export interface Courier {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  active: boolean;
  createdAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  channel: 'ONLINE' | 'STORE';
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  deliveryFeeCents: number;
  courierId?: string | null;
  courier?: Pick<Courier, 'id' | 'name' | 'phone' | 'email'> | null;
  totalCents: number;
  paymentMethod: string;
  paymentConfirmed: boolean;
  shippingAddress?: string;
  cancelledBy?: string | null; // role of canceller: CUSTOMER | SHOPKEEPER | OWNER
  cancelReason?: string | null;
  items: OrderItem[];
  createdAt: string;
  customer?: { name: string; email: string };
}

// Customer-facing delivery options (labels/fees mirror the server config).
export const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string; feeCents: number; blurb: string }[] = [
  { value: 'STANDARD', label: 'Standard delivery', feeCents: 0, blurb: 'Free · 3–5 business days' },
  { value: 'EXPRESS', label: 'Express delivery', feeCents: 5000, blurb: 'Next business day' },
  { value: 'PICKUP', label: 'Collect in store', feeCents: 0, blurb: 'Free · ready when paid' },
];

export interface StockRow extends Stock {
  product: Product;
}

export type RepairStatus = 'REPORTED' | 'IN_REPAIR' | 'REPAIRED' | 'SCRAPPED';

export interface DamageReport {
  id: string;
  productId: string;
  quantity: number;
  description: string;
  status: RepairStatus;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
  product?: Product | null;
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type StockRequestType = 'REQUEST' | 'PREBOOK';
export type StockRequestStatus = 'OPEN' | 'FULFILLED' | 'DECLINED' | 'CANCELLED';

export interface StockRequest {
  id: string;
  productId: string;
  customerId: string;
  quantity: number;
  type: StockRequestType;
  status: StockRequestStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product | null;
  customer?: { id: string; name: string; email: string } | null;
}

export interface MonthlyReport {
  year: number;
  month: number;
  orderCount: number;
  totalRevenueCents: number;
  topProducts: { productId: string; name: string; quantity: number; revenueCents: number }[];
  dailyRevenue: { day: number; revenueCents: number }[];
}

// Internal restock ask raised by the shop and fulfilled by the warehouse.
export type RestockRequestStatus = 'OPEN' | 'FULFILLED' | 'DECLINED' | 'CANCELLED';

export interface RestockRequest {
  id: string;
  productId: string;
  quantity: number;
  status: RestockRequestStatus;
  note?: string | null;
  requestedBy: string;
  resolvedBy?: string | null;
  movedQty?: number | null;
  createdAt: string;
  updatedAt: string;
  product?: Product | null;
  requestedByName?: string | null;
  resolvedByName?: string | null;
}

// ── Persisted reports (snapshot + archive) ──────────────────────────────────────────────
export type ReportKind = 'SHOPKEEPER' | 'WAREHOUSE';

export interface ShopkeeperReportData {
  statusCounts: Record<OrderStatus, number>;
  totalOrders: number;
  revenueCents: number;
  sales: {
    date: string;
    orderNumber: string;
    productName: string;
    color?: string | null;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    customerName: string;
    customerEmail: string;
    status: OrderStatus;
  }[];
  cancellations: {
    orderNumber: string;
    date: string;
    cancelledBy?: string | null;
    cancelReason?: string | null;
  }[];
}

export interface WarehouseReportData {
  received: { date: string; productName: string; quantity: number }[];
  sentToShop: { date: string; productName: string; quantity: number }[];
  restockRequests: {
    productName: string;
    quantity: number;
    status: string;
    requestedAt: string;
    resolvedAt?: string | null;
    movedQty?: number | null;
  }[];
  sentToRepair: { date: string; productName: string; quantity: number; description: string; status: string }[];
  repaired: { date: string; productName: string; quantity: number }[];
  scrapped: { date: string; productName: string; quantity: number; description: string }[];
  movements: { date: string; type: string; productName: string; quantity: number; from?: string | null; to?: string | null }[];
  summary: {
    received: number;
    sentToShop: number;
    sentToRepair: number;
    repaired: number;
    scrapped: number;
    restockRequests: number;
    movements: number;
  };
}

export type ReportData = ShopkeeperReportData | WarehouseReportData;

// Live preview of the pending report (not yet persisted).
export interface ReportPreview {
  kind: ReportKind;
  title: string;
  periodStart: string;
  periodEnd: string;
  data: ReportData;
}

// A persisted report row (full snapshot) — what /reports/sent/:id and /reports/mine return.
export interface FullReport {
  id: string;
  kind: ReportKind;
  senderId: string;
  senderName: string;
  senderRole: Role;
  title: string;
  periodStart: string;
  periodEnd: string;
  data: ReportData;
  createdAt: string;
}

// Lightweight archive-list row (metadata + at-a-glance summary).
export interface SentReportSummary {
  id: string;
  kind: ReportKind;
  senderName: string;
  senderRole: Role;
  title: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  summary: Record<string, number>;
}

// Order-status report — every order in the month with its current status (no revenue,
// so the shopkeeper may see it). Mirrors the backend orderStatusReport() shape.
export interface OrderStatusReport {
  year: number;
  month: number;
  total: number;
  statusCounts: Record<OrderStatus, number>;
  orders: {
    id: string;
    orderNumber: string;
    createdAt: string;
    status: OrderStatus;
    totalCents: number;
    customerName: string;
    itemCount: number;
    cancelledBy?: string | null;
    cancelReason?: string | null;
  }[];
}
