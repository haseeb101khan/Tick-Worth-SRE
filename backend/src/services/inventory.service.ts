import { prisma } from '../prisma';
import { NotFoundError } from '../utils/errors';

/**
 * Receive new stock from a supplier (purchase-in): increment WAREHOUSE quantity
 * and write a PURCHASE_IN ledger row, atomically. This is how inventory enters
 * the system outside of the seed.
 */
export async function receiveStock(productId: string, quantity: number, performedBy: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    await tx.stock.upsert({
      where: { productId_location: { productId, location: 'WAREHOUSE' } },
      update: { quantity: { increment: quantity } },
      create: { productId, location: 'WAREHOUSE', quantity, reorderLevel: 5 },
    });

    return tx.stockMovement.create({
      data: {
        productId,
        type: 'PURCHASE_IN',
        toLocation: 'WAREHOUSE',
        quantity,
        performedBy,
      },
    });
  });
}

export async function listStock(location?: string) {
  return prisma.stock.findMany({
    where: location ? { location } : undefined,
    include: { product: true },
    orderBy: [{ location: 'asc' }],
  });
}

/**
 * Low-stock = quantity <= reorderLevel. Prisma can't compare two columns in a
 * where clause, so filter in JS (the catalog is small). REPAIR is a holding
 * location (reorderLevel 0), so it's excluded from alerts.
 */
export async function listLowStock() {
  const stock = await prisma.stock.findMany({
    where: { location: { not: 'REPAIR' } },
    include: { product: true },
  });
  return stock.filter((s) => s.quantity <= s.reorderLevel);
}
