import { prisma } from '../prisma';
import { ForbiddenError, NotFoundError } from '../utils/errors';

// A customer may review a watch only once they have actually received it — i.e. they
// have a DELIVERED order containing that product. This is the "verified purchase" gate.
async function hasReceived(customerId: string, productId: string): Promise<boolean> {
  const line = await prisma.orderItem.findFirst({
    where: { productId, order: { customerId, status: 'DELIVERED' } },
    select: { id: true },
  });
  return !!line;
}

// Public: the rating summary + the list of reviews for a product, newest first,
// each decorated with the reviewer's name (Reviews have no Prisma relation, mirroring
// stockRequest/restockRequest — so names are attached with a second lookup).
export async function listReviews(productId: string) {
  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
  });

  const names = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: [...new Set(reviews.map((r) => r.customerId))] } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name]),
  );

  const count = reviews.length;
  const average = count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

  return {
    average: Math.round(average * 10) / 10,
    count,
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      customerName: names.get(r.customerId) ?? 'A customer',
      createdAt: r.createdAt,
    })),
  };
}

// For the logged-in customer: may they review this product, and have they already?
// Drives whether the detail page shows the review form (and pre-fills it for editing).
export async function getReviewState(customerId: string, productId: string) {
  const [canReview, myReview] = await Promise.all([
    hasReceived(customerId, productId),
    prisma.review.findUnique({ where: { productId_customerId: { productId, customerId } } }),
  ]);
  return {
    canReview,
    myReview: myReview && { id: myReview.id, rating: myReview.rating, comment: myReview.comment },
  };
}

// Create or update the customer's review for a product (one per customer/product).
export async function upsertReview(
  customerId: string,
  productId: string,
  input: { rating: number; comment?: string },
) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new NotFoundError('Product not found');

  if (!(await hasReceived(customerId, productId))) {
    throw new ForbiddenError('You can review a watch only after your order for it has been delivered');
  }

  return prisma.review.upsert({
    where: { productId_customerId: { productId, customerId } },
    update: { rating: input.rating, comment: input.comment ?? null },
    create: { productId, customerId, rating: input.rating, comment: input.comment ?? null },
  });
}
