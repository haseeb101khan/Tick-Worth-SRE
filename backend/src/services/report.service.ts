import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { NotFoundError } from '../utils/errors';
import { MonthlyReportInput } from '../utils/validators';

const REVENUE_STATUSES = ['PAID', 'DISPATCHED', 'DELIVERED'];

const ORDER_STATUSES = ['PENDING', 'PAID', 'DISPATCHED', 'DELIVERED', 'CANCELLED'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthBounds(year: number, month: number) {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function fmtDay(d: Date) {
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

function reportTitle(start: Date, end: Date) {
  const month = MONTHS_SHORT[end.getUTCMonth()];
  const year = end.getUTCFullYear();
  const sameDay =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCDate() === end.getUTCDate();
  const range = sameDay ? fmtDay(end) : `${fmtDay(start)} – ${fmtDay(end)}`;
  return `${month} ${year} report (${range})`;
}

// Look up display names ("Brand Model") for a set of product ids in one query.
async function productNamesById(ids: string[]) {
  const products = await prisma.product.findMany({ where: { id: { in: ids } } });
  return new Map(products.map((p) => [p.id, `${p.brand} ${p.name}`]));
}

// Count orders by status, with every known status pre-seeded to 0.
function tallyStatuses(orders: { status: string }[]) {
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const o of orders) {
    if (o.status in counts) counts[o.status as OrderStatus] += 1;
  }
  return counts;
}

// ── Owner live views (revenue is owner-only; order-status is order-admin) ────────────────

/**
 * Order-status report: EVERY order in the month (not just revenue ones) with its current
 * status, so the shopkeeper can see each order's record — ordered → confirmed → dispatched →
 * delivered, plus cancellations (and whether the customer or staff cancelled). Carries no
 * revenue figures, so it is safe to expose to the shopkeeper (revenue stays owner-only).
 */
export async function orderStatusReport({ year, month }: MonthlyReportInput) {
  const { start, end } = monthBounds(year, month);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: { items: true, customer: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const statusCounts = tallyStatuses(orders);

  const rows = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    status: o.status,
    totalCents: o.totalCents,
    customerName: o.customer?.name ?? 'Customer',
    itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    cancelledBy: o.cancelledBy,
    cancelReason: o.cancelReason,
  }));

  return { year, month, total: orders.length, statusCounts, orders: rows };
}

/**
 * Monthly revenue report: only orders that actually produced revenue
 * (PAID / DISPATCHED / DELIVERED) within the calendar month (UTC).
 */
export async function monthlyReport({ year, month }: MonthlyReportInput) {
  const { start, end } = monthBounds(year, month);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: REVENUE_STATUSES },
      createdAt: { gte: start, lt: end },
    },
    include: { items: true },
  });

  // totalCents includes the delivery fee, so track delivery separately. The figures then
  // reconcile: totalRevenueCents = (sum of product line revenue) + deliveryRevenueCents.
  const totalRevenueCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const deliveryRevenueCents = orders.reduce((sum, o) => sum + o.deliveryFeeCents, 0);

  // Top products + per-day revenue, aggregated from OrderItem price snapshots.
  const byProduct = new Map<string, { quantity: number; revenueCents: number }>();
  const byDay = new Map<number, number>();
  for (const order of orders) {
    const day = order.createdAt.getUTCDate();
    byDay.set(day, (byDay.get(day) ?? 0) + order.totalCents);
    for (const item of order.items) {
      const entry = byProduct.get(item.productId) ?? { quantity: 0, revenueCents: 0 };
      entry.quantity += item.quantity;
      entry.revenueCents += item.quantity * item.unitPriceCents;
      byProduct.set(item.productId, entry);
    }
  }

  const nameById = await productNamesById([...byProduct.keys()]);

  const topProducts = [...byProduct.entries()]
    .map(([productId, v]) => ({ productId, name: nameById.get(productId) ?? productId, ...v }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 10);

  const dailyRevenue = [...byDay.entries()]
    .map(([day, revenueCents]) => ({ day, revenueCents }))
    .sort((a, b) => a.day - b.day);

  return { year, month, orderCount: orders.length, totalRevenueCents, deliveryRevenueCents, topProducts, dailyRevenue };
}

// ── Persisted reports (snapshot + archive) ──────────────────────────────────────────────

function kindForRole(role: string) {
  return role === 'WAREHOUSE_MANAGER' ? 'WAREHOUSE' : 'SHOPKEEPER';
}

/** Each report covers everything since the sender's previous report (gap-free). The very
 *  first one is anchored to the start of the current month. */
async function computePeriod(kind: string) {
  // Anchor the gap-free timeline per report KIND (not per sender): all SHOPKEEPER reports share
  // one continuous timeline, as do all WAREHOUSE reports. This stops two staff of the same role
  // each covering — and the owner double-counting — the same orders/movements.
  const last = await prisma.report.findFirst({
    where: { kind },
    orderBy: { periodEnd: 'desc' },
  });
  const now = new Date();
  const periodStart = last ? new Date(last.periodEnd.getTime() + 1) : startOfMonth(now);
  return { periodStart, periodEnd: now };
}

// Shopkeeper report data: each item sold (when + to whom) + order-status counts + cancellations.
async function buildShopkeeperData(start: Date, end: Date) {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { items: true, customer: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
  const nameById = await productNamesById(productIds);

  const statusCounts = tallyStatuses(orders);
  let revenueCents = 0;
  const sales = [];
  const cancellations = [];

  for (const o of orders) {
    const isSale = REVENUE_STATUSES.includes(o.status);
    if (isSale) revenueCents += o.totalCents;
    // "Items sold" must reflect actual sales — skip pending/cancelled orders, whose items
    // were never sold (cancellations are listed separately below).
    if (isSale) {
      for (const it of o.items) {
        sales.push({
          date: o.createdAt.toISOString(),
          orderNumber: o.orderNumber,
          productName: nameById.get(it.productId) ?? it.productId,
          color: it.color ?? null,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          lineTotalCents: it.unitPriceCents * it.quantity,
          customerName: o.customer?.name ?? 'Customer',
          customerEmail: o.customer?.email ?? '',
          status: o.status,
        });
      }
    }
    if (o.status === 'CANCELLED') {
      cancellations.push({
        orderNumber: o.orderNumber,
        date: o.createdAt.toISOString(),
        cancelledBy: o.cancelledBy,
        cancelReason: o.cancelReason,
      });
    }
  }

  return { statusCounts, totalOrders: orders.length, revenueCents, sales, cancellations };
}

// Warehouse report data: stock received / sent to shop, restock asks handled, items sent for
// repair, repaired, scrapped (unable to repair), and the full per-period stock-movement log.
async function buildWarehouseData(start: Date, end: Date) {
  const inRange = { gte: start, lte: end };
  const [movements, damages, restocks] = await Promise.all([
    prisma.stockMovement.findMany({ where: { createdAt: inRange }, orderBy: { createdAt: 'asc' } }),
    prisma.damageReport.findMany({
      where: { OR: [{ createdAt: inRange }, { updatedAt: inRange }] },
      orderBy: { createdAt: 'asc' },
    }),
    // Scope to requests RAISED this period so each lands in exactly one report (counted once,
    // with an in-window requestedAt); a request's resolution shows in the movement ledger below.
    prisma.restockRequest.findMany({
      where: { createdAt: inRange },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const productIds = [
    ...new Set([
      ...movements.map((m) => m.productId),
      ...damages.map((d) => d.productId),
      ...restocks.map((r) => r.productId),
    ]),
  ];
  const nameById = await productNamesById(productIds);
  const name = (id: string) => nameById.get(id) ?? id;
  const within = (d: Date) => d >= start && d <= end;

  const received = movements
    .filter((m) => m.type === 'PURCHASE_IN')
    .map((m) => ({ date: m.createdAt.toISOString(), productName: name(m.productId), quantity: m.quantity }));

  const sentToShop = movements
    .filter((m) => m.type === 'TRANSFER' && m.fromLocation === 'WAREHOUSE' && m.toLocation === 'SHOP')
    .map((m) => ({ date: m.createdAt.toISOString(), productName: name(m.productId), quantity: m.quantity }));

  const restockRequests = restocks.map((r) => ({
    productName: name(r.productId),
    quantity: r.quantity,
    status: r.status,
    requestedAt: r.createdAt.toISOString(),
    resolvedAt: r.status === 'OPEN' ? null : r.updatedAt.toISOString(),
    movedQty: r.movedQty,
  }));

  const sentToRepair = damages
    .filter((d) => within(d.createdAt))
    .map((d) => ({
      date: d.createdAt.toISOString(),
      productName: name(d.productId),
      quantity: d.quantity,
      description: d.description,
      status: d.status,
    }));

  const repaired = damages
    .filter((d) => d.status === 'REPAIRED' && within(d.updatedAt))
    .map((d) => ({ date: d.updatedAt.toISOString(), productName: name(d.productId), quantity: d.quantity }));

  const scrapped = damages
    .filter((d) => d.status === 'SCRAPPED' && within(d.updatedAt))
    .map((d) => ({
      date: d.updatedAt.toISOString(),
      productName: name(d.productId),
      quantity: d.quantity,
      description: d.description,
    }));

  const movementLog = movements.map((m) => ({
    date: m.createdAt.toISOString(),
    type: m.type,
    productName: name(m.productId),
    quantity: m.quantity,
    from: m.fromLocation,
    to: m.toLocation,
  }));

  const sum = (rows: { quantity: number }[]) => rows.reduce((s, x) => s + x.quantity, 0);
  const summary = {
    received: sum(received),
    sentToShop: sum(sentToShop),
    sentToRepair: sum(sentToRepair),
    repaired: sum(repaired),
    scrapped: sum(scrapped),
    restockRequests: restockRequests.length,
    movements: movementLog.length,
  };

  return { received, sentToShop, restockRequests, sentToRepair, repaired, scrapped, movements: movementLog, summary };
}

async function buildDataFor(kind: string, start: Date, end: Date) {
  return kind === 'WAREHOUSE' ? buildWarehouseData(start, end) : buildShopkeeperData(start, end);
}

/** Build the report a staff member would send right now — WITHOUT persisting it (preview). */
export async function previewReport(user: { id: string; role: string }) {
  const kind = kindForRole(user.role);
  const { periodStart, periodEnd } = await computePeriod(kind);
  const data = await buildDataFor(kind, periodStart, periodEnd);
  return { kind, title: reportTitle(periodStart, periodEnd), periodStart, periodEnd, data };
}

/** Persist a frozen snapshot for the pending period and notify the owner(s). */
export async function createReport(user: { id: string; role: string }) {
  const kind = kindForRole(user.role);
  const { periodStart, periodEnd } = await computePeriod(kind);
  const data = await buildDataFor(kind, periodStart, periodEnd);
  const title = reportTitle(periodStart, periodEnd);
  const sender = await prisma.user.findUnique({ where: { id: user.id } });

  const report = await prisma.report.create({
    data: {
      kind,
      senderId: user.id,
      senderName: sender?.name ?? 'Staff',
      senderRole: user.role,
      title,
      periodStart,
      periodEnd,
      data: data as unknown as Prisma.InputJsonValue,
    },
  });

  const owners = await prisma.user.findMany({ where: { role: 'OWNER' } });
  if (owners.length > 0) {
    await prisma.notification.createMany({
      data: owners.map((o) => ({
        userId: o.id,
        type: 'REPORT',
        message: `New ${kind === 'WAREHOUSE' ? 'warehouse' : 'shop'} report from ${sender?.name ?? 'staff'}: ${title}.`,
      })),
    });
  }

  return report;
}

/** Owner archive list — metadata only. Selects every column EXCEPT the heavy `data` snapshot,
 *  which is loaded on demand by getSentReport when a row is expanded or downloaded. */
export async function listSentReports() {
  return prisma.report.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      kind: true,
      senderName: true,
      senderRole: true,
      title: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
    },
  });
}

/** Owner archive detail — the full frozen snapshot. */
export async function getSentReport(id: string) {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw new NotFoundError('Report not found');
  return report;
}

/** A sender's own report history (full rows, so they can re-download). */
export async function listMyReports(senderId: string) {
  return prisma.report.findMany({ where: { senderId }, orderBy: { createdAt: 'desc' } });
}

/** Owner removes an accidental/unwanted report from the archive. */
export async function deleteReport(id: string) {
  const res = await prisma.report.deleteMany({ where: { id } });
  if (res.count === 0) throw new NotFoundError('Report not found');
  return { deleted: true, id };
}
