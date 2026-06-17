import { prisma } from '../prisma';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { PlaceOrderInput } from '../utils/validators';
import { notifyIfLowStock } from './notification.service';
import { audit } from '../utils/logger';

// Delivery options + their fees (server-side — never trust a fee from the client).
// Fees are in paisa (PKR minor units). EXPRESS default = Rs 500 — adjust to your real rate.
export const DELIVERY_OPTIONS: Record<string, { feeCents: number; label: string }> = {
  STANDARD: { feeCents: 25000, label: 'Delivery (Rs 250)' }, // flat Rs 250 delivery charge
  EXPRESS: { feeCents: 50000, label: 'Express delivery (next day)' },
  PICKUP: { feeCents: 0, label: 'Collect in store' },
};

// Order line items also include the courier so every read can show who is delivering.
const ORDER_INCLUDE = {
  items: true,
  courier: { select: { id: true, name: true, phone: true, email: true } },
} as const;

/**
 * Place an order. THIS IS THE REFERENCE PATTERN for every stock change in the app:
 *   1. Do all reads + writes inside prisma.$transaction so they commit together.
 *   2. Decrement stock with a GUARDED updateMany (quantity >= qty). If count === 0,
 *      someone else took the last unit — throw and the whole transaction rolls back.
 *   3. Write a StockMovement ledger row for every change.
 *
 * Online orders decrement SHOP stock immediately and start as PENDING.
 * Store orders are created straight as PAID + DELIVERED.
 */
// Remote Postgres (Neon) adds network latency to every query, so this multi-step
// transaction can exceed Prisma's default 5s interactive-transaction window. Give it
// room (and a longer maxWait to acquire a pooled connection) so checkout is reliable.
const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

export async function placeOrder(customerId: string, input: PlaceOrderInput) {
  return prisma.$transaction(async (tx) => {
    // Snapshot current prices (never trust prices from the client).
    const products = await tx.product.findMany({
      where: { id: { in: input.items.map((i) => i.productId) } },
    });
    const priceById = new Map(products.map((p) => [p.id, p.priceCents]));

    let subtotalCents = 0;
    for (const item of input.items) {
      const price = priceById.get(item.productId);
      if (price === undefined) throw new NotFoundError(`Product ${item.productId} not found`);
      subtotalCents += price * item.quantity;
    }

    const isStore = input.channel === 'STORE';
    // In-store purchases are collected on the spot; online orders use the chosen
    // method (the schema defaults it to STANDARD; the ?? guards direct callers).
    const deliveryMethod = isStore ? 'PICKUP' : (input.deliveryMethod ?? 'STANDARD');
    const deliveryFeeCents = DELIVERY_OPTIONS[deliveryMethod].feeCents;
    const totalCents = subtotalCents + deliveryFeeCents;

    // Human-readable, sequential order number. NOTE: on Postgres a count-based
    // sequence can race under truly concurrent checkouts (two orders read the same
    // count). The @unique constraint on orderNumber is the safety net — a collision
    // makes one transaction roll back (a retryable conflict). Before high concurrent
    // traffic, replace this with a dedicated DB sequence.
    const orderNumber = `TW-${String((await tx.order.count()) + 1).padStart(6, '0')}`;

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        channel: input.channel,
        paymentMethod: input.paymentMethod,
        deliveryMethod,
        deliveryFeeCents,
        shippingAddress: input.shippingAddress,
        status: isStore ? 'DELIVERED' : 'PENDING',
        // Online (EasyPaisa) payments are NOT auto-confirmed — the shopkeeper verifies
        // the uploaded screenshot, then marks the order PAID. Only in-store sales are
        // confirmed on the spot.
        paymentConfirmed: isStore,
        paymentProofUrl: input.paymentProofUrl,
        paymentSenderName: input.paymentSenderName,
        paymentReference: input.paymentReference,
        totalCents,
        items: {
          create: input.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPriceCents: priceById.get(i.productId)!,
            color: i.color,
          })),
        },
      },
      include: ORDER_INCLUDE,
    });

    // Decrement SHOP stock atomically + log a SALE movement per line.
    for (const item of input.items) {
      const res = await tx.stock.updateMany({
        where: { productId: item.productId, location: 'SHOP', quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } },
      });
      if (res.count === 0) {
        // Rolls back the order + any earlier decrements in this transaction.
        throw new ConflictError(`Insufficient shop stock for product ${item.productId}`);
      }

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'SALE',
          fromLocation: 'SHOP',
          quantity: item.quantity,
          referenceId: order.id,
          performedBy: customerId,
        },
      });

      await notifyIfLowStock(tx, item.productId, 'SHOP', item.quantity);
    }

    return order;
  }, TX_OPTIONS);
}

// Forward-only lifecycle. CANCELLED is reached via cancelOrder (it restores stock).
const STATUS_FLOW: Record<string, string[]> = {
  PENDING: ['PAID'],
  PAID: ['DISPATCHED'],
  DISPATCHED: ['DELIVERED'],
};

export async function updateOrderStatus(
  orderId: string,
  status: 'PAID' | 'DISPATCHED' | 'DELIVERED',
  courierId?: string,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order not found');
  if (!STATUS_FLOW[order.status]?.includes(status)) {
    throw new ConflictError(`Cannot change order status ${order.status} → ${status}`);
  }

  const data: { status: string; paymentConfirmed?: boolean; courierId?: string } = { status };
  if (status === 'PAID') data.paymentConfirmed = true;

  // Dispatching a delivery order requires an active courier; pickups don't.
  if (status === 'DISPATCHED' && order.deliveryMethod !== 'PICKUP') {
    const assignedId = courierId ?? order.courierId ?? undefined;
    if (!assignedId) throw new BadRequestError('Assign a courier before dispatching this order');
    const courier = await prisma.courier.findUnique({ where: { id: assignedId } });
    if (!courier) throw new NotFoundError('Courier not found');
    if (!courier.active) throw new BadRequestError('Selected courier is not available');
    data.courierId = assignedId;
  }

  // Guarded update: if another request changed the status since we read it, count = 0.
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: order.status },
    data,
  });
  if (res.count === 0) throw new ConflictError('Order status changed concurrently — retry');

  audit('order.status_changed', { orderId, from: order.status, to: status });
  return prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
}

/**
 * Cancel an order (staff, or the customer who owns it) — only before DISPATCHED.
 * Restores SHOP stock and writes a RETURN movement per line, atomically. Records who
 * cancelled (their role) and an optional reason so the order-status report can show
 * whether the customer or staff cancelled it.
 */
export async function cancelOrder(
  orderId: string,
  user: { id: string; role: string },
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundError('Order not found');

    // A customer may cancel only their own order; among staff, order admin
    // (shopkeeper/owner) may cancel — the warehouse manager has no order access.
    if (user.role === 'CUSTOMER') {
      if (order.customerId !== user.id) {
        throw new ForbiddenError('You can only cancel your own orders');
      }
    } else if (!['SHOPKEEPER', 'OWNER'].includes(user.role)) {
      throw new ForbiddenError('Your role cannot manage orders');
    }

    // Guarded flip blocks double-cancel and cancel-after-dispatch under concurrency.
    const res = await tx.order.updateMany({
      where: { id: orderId, status: { in: ['PENDING', 'PAID'] } },
      data: { status: 'CANCELLED', cancelledBy: user.role, cancelReason: reason ?? null },
    });
    if (res.count === 0) {
      throw new ConflictError(`Order can no longer be cancelled (status: ${order.status})`);
    }

    for (const item of order.items) {
      await tx.stock.upsert({
        where: { productId_location: { productId: item.productId, location: 'SHOP' } },
        update: { quantity: { increment: item.quantity } },
        create: { productId: item.productId, location: 'SHOP', quantity: item.quantity, reorderLevel: 3 },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'RETURN',
          toLocation: 'SHOP',
          quantity: item.quantity,
          referenceId: order.id,
          performedBy: user.id,
        },
      });
    }

    return tx.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  }, TX_OPTIONS);
}

export async function listMyOrders(customerId: string) {
  return prisma.order.findMany({
    where: { customerId },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function listAllOrders() {
  return prisma.order.findMany({
    include: { ...ORDER_INCLUDE, customer: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
