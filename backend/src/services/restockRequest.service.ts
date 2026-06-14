import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { CreateRestockRequestInput } from '../utils/validators';
import { notifyIfLowStock } from './notification.service';

// Who can SEND stock out of the warehouse (and therefore action a restock request).
const FULFIL_ROLES = ['WAREHOUSE_MANAGER', 'OWNER'];

// These transactions make several sequential round-trips; over a hosted (Neon)
// connection the default 5s ceiling can lapse mid-flight and throw P2028. Mirror
// order.service's headroom so warehouse actions commit reliably.
const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

async function qtyAt(tx: Prisma.TransactionClient, productId: string, location: string) {
  const stock = await tx.stock.findUnique({
    where: { productId_location: { productId, location } },
  });
  return stock?.quantity ?? 0;
}

// RestockRequest has no Prisma relations, so attach the product + the staff names
// (requester / resolver) the dashboards need — same approach as stockRequest.service.
async function decorate(
  requests: { productId: string; requestedBy: string; resolvedBy: string | null }[],
) {
  const userIds = [
    ...new Set(requests.flatMap((r) => [r.requestedBy, r.resolvedBy].filter(Boolean) as string[])),
  ];
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(requests.map((r) => r.productId))] } },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return requests.map((r) => ({
    ...r,
    product: productById.get(r.productId) ?? null,
    requestedByName: nameById.get(r.requestedBy) ?? null,
    resolvedByName: r.resolvedBy ? nameById.get(r.resolvedBy) ?? null : null,
  }));
}

/**
 * Shopkeeper/owner raises one or more restock asks (the "request all" button sends
 * several lines at once; a single line is a specific item). Collapses duplicates:
 * if an OPEN request already exists for a product, its quantity/note is updated
 * instead of creating a second row. Notifies the warehouse manager + owner once.
 */
export async function createRestockRequests(
  requesterId: string,
  input: CreateRestockRequestInput,
) {
  const touched = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const line of input.items) {
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new NotFoundError(`Product ${line.productId} not found`);

      const existing = await tx.restockRequest.findFirst({
        where: { productId: line.productId, status: 'OPEN' },
      });
      if (existing) {
        const updated = await tx.restockRequest.update({
          where: { id: existing.id },
          data: { quantity: line.quantity, note: input.note ?? existing.note, requestedBy: requesterId },
        });
        ids.push(updated.id);
      } else {
        const created = await tx.restockRequest.create({
          data: {
            productId: line.productId,
            quantity: line.quantity,
            note: input.note,
            requestedBy: requesterId,
          },
        });
        ids.push(created.id);
      }
    }

    // Tell whoever can fulfil it that there's a fresh ask waiting.
    const requester = await tx.user.findUnique({ where: { id: requesterId } });
    const fulfillers = await tx.user.findMany({ where: { role: { in: FULFIL_ROLES } } });
    if (fulfillers.length > 0) {
      const count = input.items.length;
      await tx.notification.createMany({
        data: fulfillers.map((u) => ({
          userId: u.id,
          type: 'RESTOCK_REQUEST',
          message: `${requester?.name ?? 'The shop'} requested a restock of ${count} item${count === 1 ? '' : 's'} from the warehouse.`,
        })),
      });
    }

    return ids;
  }, TX_OPTIONS);

  const rows = await prisma.restockRequest.findMany({ where: { id: { in: touched } } });
  return decorate(rows);
}

export async function listRestockRequests() {
  const requests = await prisma.restockRequest.findMany({ orderBy: { createdAt: 'desc' } });
  return decorate(requests);
}

/**
 * Warehouse manager/owner resolution. FULFILL pushes stock to the shop with a guarded
 * WAREHOUSE→SHOP transfer of `quantity` (default = the requested amount) and records a
 * TRANSFER ledger row; DECLINE just closes it. Either way the requester is notified.
 */
export async function resolveRestockRequest(
  id: string,
  action: 'FULFILL' | 'DECLINE',
  quantity: number | undefined,
  resolverId: string,
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.restockRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundError('Restock request not found');
    if (request.status !== 'OPEN') throw new ConflictError('Request is already resolved');

    const product = await tx.product.findUnique({ where: { id: request.productId } });

    if (action === 'FULFILL') {
      const qty = quantity ?? request.quantity;

      // Guarded decrement — fails (count 0) if the warehouse can't cover `qty`.
      const res = await tx.stock.updateMany({
        where: { productId: request.productId, location: 'WAREHOUSE', quantity: { gte: qty } },
        data: { quantity: { decrement: qty } },
      });
      if (res.count === 0) {
        const available = await qtyAt(tx, request.productId, 'WAREHOUSE');
        throw new BadRequestError(
          `Only ${available} in the warehouse — receive stock first or send ${available} or fewer.`,
        );
      }

      await tx.stock.upsert({
        where: { productId_location: { productId: request.productId, location: 'SHOP' } },
        update: { quantity: { increment: qty } },
        create: { productId: request.productId, location: 'SHOP', quantity: qty, reorderLevel: 3 },
      });

      await tx.stockMovement.create({
        data: {
          productId: request.productId,
          type: 'TRANSFER',
          fromLocation: 'WAREHOUSE',
          toLocation: 'SHOP',
          quantity: qty,
          referenceId: request.id,
          performedBy: resolverId,
        },
      });

      await notifyIfLowStock(tx, request.productId, 'WAREHOUSE', qty);

      await tx.notification.create({
        data: {
          userId: request.requestedBy,
          type: 'RESTOCK_REQUEST',
          message: `Restock sent: ${qty} × "${product?.name ?? 'item'}" moved to the shop.`,
        },
      });

      await tx.restockRequest.update({
        where: { id },
        data: { status: 'FULFILLED', resolvedBy: resolverId, movedQty: qty },
      });
    } else {
      await tx.notification.create({
        data: {
          userId: request.requestedBy,
          type: 'RESTOCK_REQUEST',
          message: `Restock request for "${product?.name ?? 'an item'}" was declined by the warehouse.`,
        },
      });

      await tx.restockRequest.update({
        where: { id },
        data: { status: 'DECLINED', resolvedBy: resolverId },
      });
    }

    return tx.restockRequest.findUnique({ where: { id } });
  }, TX_OPTIONS);
}

/** Shopkeeper/owner withdraws their own still-open request. */
export async function cancelMyRestockRequest(userId: string, id: string) {
  const res = await prisma.restockRequest.updateMany({
    where: { id, requestedBy: userId, status: 'OPEN' },
    data: { status: 'CANCELLED' },
  });
  if (res.count === 0) throw new NotFoundError('Open request not found');
  return prisma.restockRequest.findUnique({ where: { id } });
}
