import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { NotFoundError } from '../utils/errors';

const STAFF_ROLES = ['SHOPKEEPER', 'WAREHOUSE_MANAGER', 'OWNER'];

export async function listMine(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function markRead(userId: string, id: string) {
  // updateMany with the userId guard so users can only touch their own notifications.
  const res = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  if (res.count === 0) throw new NotFoundError('Notification not found');
  return prisma.notification.findUnique({ where: { id } });
}

/**
 * Call inside the SAME transaction, right after a guarded stock decrement.
 * Emits a LOW_STOCK notification to every staff user when this decrement
 * CROSSED the reorder level (was above before, at/below now) — so staff get
 * one alert per crossing, not one per sale while already low.
 * REPAIR is a holding location and is excluded from alerts.
 */
export async function notifyIfLowStock(
  tx: Prisma.TransactionClient,
  productId: string,
  location: string,
  qtyRemoved: number,
) {
  if (location === 'REPAIR') return;
  const stock = await tx.stock.findUnique({
    where: { productId_location: { productId, location } },
  });
  if (!stock) return;
  const before = stock.quantity + qtyRemoved;
  const crossed = before > stock.reorderLevel && stock.quantity <= stock.reorderLevel;
  if (!crossed) return;

  const product = await tx.product.findUnique({ where: { id: productId } });
  const staff = await tx.user.findMany({ where: { role: { in: STAFF_ROLES } } });
  if (staff.length === 0) return;

  await tx.notification.createMany({
    data: staff.map((u) => ({
      userId: u.id,
      type: 'LOW_STOCK',
      message: `Low stock: "${product?.name ?? productId}" at ${location} is down to ${stock.quantity} (reorder level ${stock.reorderLevel}).`,
    })),
  });
}
