import { prisma } from '../prisma';
import { ConflictError } from '../utils/errors';
import { TransferInput } from '../utils/validators';
import { notifyIfLowStock } from './notification.service';

// Matches the seed defaults when a destination stock row doesn't exist yet.
const DEFAULT_REORDER: Record<string, number> = { WAREHOUSE: 5, SHOP: 3, REPAIR: 0 };

/**
 * Atomic stock transfer (warehouse→shop, shop→repair, repair→shop, ...):
 * guarded decrement of `from`, increment of `to`, one TRANSFER ledger row.
 */
export async function transferStock(input: TransferInput, performedBy: string) {
  return prisma.$transaction(async (tx) => {
    const res = await tx.stock.updateMany({
      where: { productId: input.productId, location: input.from, quantity: { gte: input.qty } },
      data: { quantity: { decrement: input.qty } },
    });
    if (res.count === 0) {
      throw new ConflictError(`Insufficient stock at ${input.from} for this transfer`);
    }

    await tx.stock.upsert({
      where: { productId_location: { productId: input.productId, location: input.to } },
      update: { quantity: { increment: input.qty } },
      create: {
        productId: input.productId,
        location: input.to,
        quantity: input.qty,
        reorderLevel: DEFAULT_REORDER[input.to] ?? 0,
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: 'TRANSFER',
        fromLocation: input.from,
        toLocation: input.to,
        quantity: input.qty,
        performedBy,
      },
    });

    await notifyIfLowStock(tx, input.productId, input.from, input.qty);
    return movement;
  });
}
