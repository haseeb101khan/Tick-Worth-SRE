import { prisma } from '../prisma';
import { NotFoundError } from '../utils/errors';
import { audit } from '../utils/logger';

export interface ProductFilters {
  brand?: string;
  category?: string;
  search?: string;
}

export async function listProducts(filters: ProductFilters) {
  // Postgres `contains`/`equals` are case-SENSITIVE by default, so we opt into
  // `mode: 'insensitive'` for the free-text search (e.g. "rolex" matches "Rolex").
  const products = await prisma.product.findMany({
    where: {
      archived: false, // retired watches never appear in the storefront
      brand: filters.brand ? { equals: filters.brand, mode: 'insensitive' } : undefined,
      category: filters.category ? { equals: filters.category, mode: 'insensitive' } : undefined,
      name: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
    },
    include: { stock: true },
    orderBy: { createdAt: 'desc' },
  });

  // Attach the rating summary (one grouped query for the whole page) so cards can
  // show stars without an extra request per product.
  const agg = await prisma.review.groupBy({
    by: ['productId'],
    where: { productId: { in: products.map((p) => p.id) } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const byId = new Map(agg.map((a) => [a.productId, a]));

  return products.map((p) => {
    const a = byId.get(p.id);
    return {
      ...p,
      ratingAverage: a?._avg.rating != null ? Math.round(a._avg.rating * 10) / 10 : null,
      ratingCount: a?._count._all ?? 0,
    };
  });
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { stock: true, variants: { orderBy: { position: 'asc' } } },
  });
  if (!product) throw new NotFoundError('Product not found');

  // Attach the same rating summary listProducts exposes, so the detail page has it without a
  // second request and product payloads keep a consistent shape across both reads.
  const agg = await prisma.review.aggregate({
    where: { productId: id },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return {
    ...product,
    ratingAverage: agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null,
    ratingCount: agg._count._all,
  };
}

export async function createProduct(data: {
  name: string;
  brand: string;
  category: string;
  description?: string;
  priceCents: number;
  imageUrl?: string;
}) {
  return prisma.product.create({
    data: {
      ...data,
      // New products start with empty stock rows at every location.
      stock: {
        create: [
          { location: 'WAREHOUSE', quantity: 0, reorderLevel: 5 },
          { location: 'SHOP', quantity: 0, reorderLevel: 3 },
          { location: 'REPAIR', quantity: 0, reorderLevel: 0 },
        ],
      },
    },
    include: { stock: true },
  });
}

// Replace a product's full set of colour variants in one shot (the catalog colour manager edits
// the whole list at once). Array order becomes display position; 0 is the primary colour.
export async function setVariants(
  productId: string,
  variants: { color: string; imageUrl: string }[],
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundError('Product not found');

    await tx.productVariant.deleteMany({ where: { productId } });
    if (variants.length > 0) {
      await tx.productVariant.createMany({
        data: variants.map((v, i) => ({ productId, color: v.color, imageUrl: v.imageUrl, position: i })),
      });
    }
    return tx.productVariant.findMany({ where: { productId }, orderBy: { position: 'asc' } });
  });
}

export async function updateProduct(
  id: string,
  data: {
    name?: string;
    brand?: string;
    category?: string;
    description?: string;
    priceCents?: number;
    imageUrl?: string | null; // null clears the image back to the fallback art
  },
) {
  await getProduct(id); // throws NotFoundError if the product is gone
  return prisma.product.update({
    where: { id },
    data,
    include: { stock: true },
  });
}

/** Staff: list retired (archived) products so they can be restored from the dashboard. */
export async function listArchivedProducts() {
  return prisma.product.findMany({
    where: { archived: true },
    include: { stock: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Remove a product from the catalogue.
 *
 * If the watch has EVER been part of an order, we cannot truly delete it without
 * corrupting order history / receipts / reports — so we ARCHIVE it (hide from the
 * storefront, keep the row). If it has never been ordered (e.g. a mistaken entry), we
 * permanently delete it along with its related rows.
 *
 * Returns which path was taken so the UI can tell the user what happened.
 */
export async function deleteProduct(id: string, actorId: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true, archived: true },
  });
  if (!product) throw new NotFoundError('Product not found');

  const orderedCount = await prisma.orderItem.count({ where: { productId: id } });

  if (orderedCount > 0) {
    // Has order history — soft delete to preserve receipts/reports.
    if (!product.archived) {
      await prisma.product.update({ where: { id }, data: { archived: true } });
    }
    audit('product.archived', { productId: id, name: product.name, by: actorId, orderedCount });
    return { mode: 'archived' as const, name: product.name };
  }

  // Never ordered — safe to permanently remove. ProductVariant cascades on delete; the
  // other tables reference productId without a foreign key, so clear them explicitly.
  // Stock has a FK with no cascade, so it must go before the product row.
  await prisma.$transaction([
    prisma.review.deleteMany({ where: { productId: id } }),
    prisma.stockMovement.deleteMany({ where: { productId: id } }),
    prisma.stockRequest.deleteMany({ where: { productId: id } }),
    prisma.restockRequest.deleteMany({ where: { productId: id } }),
    prisma.damageReport.deleteMany({ where: { productId: id } }),
    prisma.stock.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  audit('product.deleted', { productId: id, name: product.name, by: actorId });
  return { mode: 'deleted' as const, name: product.name };
}

/** Staff: bring a retired product back into the catalogue. */
export async function restoreProduct(id: string, actorId: string) {
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!product) throw new NotFoundError('Product not found');
  const restored = await prisma.product.update({
    where: { id },
    data: { archived: false },
    include: { stock: true },
  });
  audit('product.restored', { productId: id, name: product.name, by: actorId });
  return restored;
}
