import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { CreateStockRequestInput } from '../utils/validators';
import { notifyIfLowStock } from './notification.service';

const ORDER_ADMIN_ROLES = ['SHOPKEEPER', 'OWNER'];

async function qtyAt(tx: Prisma.TransactionClient, productId: string, location: string) {
  const stock = await tx.stock.findUnique({
    where: { productId_location: { productId, location } },
  });
  return stock?.quantity ?? 0;
}

// Attach product (+ customer for staff views) since StockRequest has no Prisma relations.
async function decorate(requests: { productId: string; customerId: string }[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(requests.map((r) => r.productId))] } },
  });
  const customers = await prisma.user.findMany({
    where: { id: { in: [...new Set(requests.map((r) => r.customerId))] } },
    select: { id: true, name: true, email: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const customerById = new Map(customers.map((c) => [c.id, c]));
  return requests.map((r) => ({
    ...r,
    product: productById.get(r.productId) ?? null,
    customer: customerById.get(r.customerId) ?? null,
  }));
}

/**
 * Customer raises demand for an out-of-stock watch. The type is decided here,
 * not by the client: PREBOOK when the warehouse can supply it, REQUEST otherwise.
 */
export async function createStockRequest(customerId: string, input: CreateStockRequestInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundError('Product not found');

    const shop = await qtyAt(tx, input.productId, 'SHOP');
    if (shop >= input.quantity) {
      throw new BadRequestError('This watch is in stock — add it to your cart instead');
    }

    // Block duplicate open demand from the same customer for the same product.
    const existing = await tx.stockRequest.findFirst({
      where: { customerId, productId: input.productId, status: 'OPEN' },
    });
    if (existing) throw new ConflictError('You already have an open request for this watch');

    const warehouse = await qtyAt(tx, input.productId, 'WAREHOUSE');
    const type = warehouse >= input.quantity ? 'PREBOOK' : 'REQUEST';

    const request = await tx.stockRequest.create({
      data: {
        productId: input.productId,
        customerId,
        quantity: input.quantity,
        type,
        note: input.note,
      },
    });

    // Notify the customer-facing staff that there's demand to act on.
    const customer = await tx.user.findUnique({ where: { id: customerId } });
    const staff = await tx.user.findMany({ where: { role: { in: ORDER_ADMIN_ROLES } } });
    if (staff.length > 0) {
      const verb = type === 'PREBOOK' ? 'pre-booked' : 'requested';
      await tx.notification.createMany({
        data: staff.map((u) => ({
          userId: u.id,
          type: 'STOCK_REQUEST',
          message: `${customer?.name ?? 'A customer'} ${verb} "${product.name}" (x${input.quantity}).`,
        })),
      });
    }

    return request;
  });
}

export async function listMyRequests(customerId: string) {
  const requests = await prisma.stockRequest.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });
  return decorate(requests);
}

export async function listAllRequests() {
  const requests = await prisma.stockRequest.findMany({ orderBy: { createdAt: 'desc' } });
  return decorate(requests);
}

export async function cancelMyRequest(customerId: string, id: string) {
  // Guarded so a customer can only cancel their OWN still-open request.
  const res = await prisma.stockRequest.updateMany({
    where: { id, customerId, status: 'OPEN' },
    data: { status: 'CANCELLED' },
  });
  if (res.count === 0) throw new NotFoundError('Open request not found');
  return prisma.stockRequest.findUnique({ where: { id } });
}

/**
 * Staff resolution. DECLINE just closes it. FULFILL makes the watch buyable:
 * if the shop is short, it pulls the shortfall from the warehouse (guarded
 * TRANSFER) — failing if the warehouse can't cover it — then notifies the customer.
 */
export async function resolveStockRequest(
  id: string,
  action: 'FULFILL' | 'DECLINE',
  staffId: string,
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.stockRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundError('Request not found');
    if (request.status !== 'OPEN') throw new ConflictError('Request is already resolved');

    const product = await tx.product.findUnique({ where: { id: request.productId } });

    if (action === 'FULFILL') {
      const shop = await qtyAt(tx, request.productId, 'SHOP');
      const shortfall = request.quantity - shop;
      if (shortfall > 0) {
        // Pull just the shortfall from the warehouse (guarded against oversell).
        const res = await tx.stock.updateMany({
          where: {
            productId: request.productId,
            location: 'WAREHOUSE',
            quantity: { gte: shortfall },
          },
          data: { quantity: { decrement: shortfall } },
        });
        if (res.count === 0) {
          throw new BadRequestError('Not enough warehouse stock to fulfil — receive stock first');
        }
        await tx.stock.upsert({
          where: { productId_location: { productId: request.productId, location: 'SHOP' } },
          update: { quantity: { increment: shortfall } },
          create: { productId: request.productId, location: 'SHOP', quantity: shortfall, reorderLevel: 3 },
        });
        await tx.stockMovement.create({
          data: {
            productId: request.productId,
            type: 'TRANSFER',
            fromLocation: 'WAREHOUSE',
            toLocation: 'SHOP',
            quantity: shortfall,
            referenceId: request.id,
            performedBy: staffId,
          },
        });
        await notifyIfLowStock(tx, request.productId, 'WAREHOUSE', shortfall);
      }

      await tx.notification.create({
        data: {
          userId: request.customerId,
          type: 'STOCK_REQUEST',
          message: `Good news — "${product?.name ?? 'your watch'}" is now available in store. Order now before it sells out.`,
        },
      });
    } else {
      await tx.notification.create({
        data: {
          userId: request.customerId,
          type: 'STOCK_REQUEST',
          message: `Your request for "${product?.name ?? 'a watch'}" could not be fulfilled right now.`,
        },
      });
    }

    await tx.stockRequest.update({
      where: { id },
      data: { status: action === 'FULFILL' ? 'FULFILLED' : 'DECLINED' },
    });

    return tx.stockRequest.findUnique({ where: { id } });
  });
}
