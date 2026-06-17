import { prisma } from '../prisma';
import { NotFoundError } from '../utils/errors';

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
