import { prisma } from '../prisma';
import { ConflictError, NotFoundError } from '../utils/errors';
import { CreateDamageReportInput } from '../utils/validators';
import { notifyIfLowStock } from './notification.service';

/**
 * Report damaged units: guarded decrement of the source location, damaged
 * units move into REPAIR (so repair-complete can move them back out), one
 * DamageReport (REPORTED) + one DAMAGE ledger row — all atomic.
 */
export async function createDamageReport(input: CreateDamageReportInput, reportedBy: string) {
  return prisma.$transaction(async (tx) => {
    const res = await tx.stock.updateMany({
      where: { productId: input.productId, location: input.location, quantity: { gte: input.quantity } },
      data: { quantity: { decrement: input.quantity } },
    });
    if (res.count === 0) {
      throw new ConflictError(`Insufficient stock at ${input.location} to report as damaged`);
    }

    await tx.stock.upsert({
      where: { productId_location: { productId: input.productId, location: 'REPAIR' } },
      update: { quantity: { increment: input.quantity } },
      create: { productId: input.productId, location: 'REPAIR', quantity: input.quantity, reorderLevel: 0 },
    });

    const report = await tx.damageReport.create({
      data: {
        productId: input.productId,
        quantity: input.quantity,
        description: input.description,
        reportedBy,
      },
    });

    await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: 'DAMAGE',
        fromLocation: input.location,
        toLocation: 'REPAIR',
        quantity: input.quantity,
        referenceId: report.id,
        performedBy: reportedBy,
      },
    });

    await notifyIfLowStock(tx, input.productId, input.location, input.quantity);
    return report;
  });
}

// DamageReport has no Prisma relation to Product, so attach product info manually.
export async function listDamageReports() {
  const reports = await prisma.damageReport.findMany({ orderBy: { createdAt: 'desc' } });
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(reports.map((r) => r.productId))] } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  return reports.map((r) => ({
    ...r,
    product: productById.get(r.productId) ?? null,
  }));
}

const REPAIR_FLOW: Record<string, string[]> = {
  REPORTED: ['IN_REPAIR', 'SCRAPPED'],
  IN_REPAIR: ['REPAIRED', 'SCRAPPED'],
};

/**
 * Repair lifecycle: REPORTED → IN_REPAIR → REPAIRED (moves units REPAIR→SHOP,
 * REPAIR_DONE movement) or → SCRAPPED (units leave REPAIR, DAMAGE write-off movement).
 */
export async function updateDamageReport(
  id: string,
  status: 'IN_REPAIR' | 'REPAIRED' | 'SCRAPPED',
  performedBy: string,
) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.damageReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundError('Damage report not found');
    if (!REPAIR_FLOW[report.status]?.includes(status)) {
      throw new ConflictError(`Cannot change repair status ${report.status} → ${status}`);
    }

    const flip = await tx.damageReport.updateMany({
      where: { id, status: report.status },
      data: { status },
    });
    if (flip.count === 0) throw new ConflictError('Repair status changed concurrently — retry');

    if (status === 'REPAIRED' || status === 'SCRAPPED') {
      const res = await tx.stock.updateMany({
        where: { productId: report.productId, location: 'REPAIR', quantity: { gte: report.quantity } },
        data: { quantity: { decrement: report.quantity } },
      });
      if (res.count === 0) {
        throw new ConflictError('Insufficient stock at REPAIR for this update');
      }
    }

    if (status === 'REPAIRED') {
      await tx.stock.upsert({
        where: { productId_location: { productId: report.productId, location: 'SHOP' } },
        update: { quantity: { increment: report.quantity } },
        create: { productId: report.productId, location: 'SHOP', quantity: report.quantity, reorderLevel: 3 },
      });
      await tx.stockMovement.create({
        data: {
          productId: report.productId,
          type: 'REPAIR_DONE',
          fromLocation: 'REPAIR',
          toLocation: 'SHOP',
          quantity: report.quantity,
          referenceId: report.id,
          performedBy,
        },
      });
    } else if (status === 'SCRAPPED') {
      // Write-off: units leave REPAIR and don't land anywhere.
      await tx.stockMovement.create({
        data: {
          productId: report.productId,
          type: 'DAMAGE',
          fromLocation: 'REPAIR',
          quantity: report.quantity,
          referenceId: report.id,
          performedBy,
        },
      });
    }

    return tx.damageReport.findUnique({ where: { id } });
  });
}
