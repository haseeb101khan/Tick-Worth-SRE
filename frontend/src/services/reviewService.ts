import { api } from './api';
import { ReviewState, ReviewSummary } from '../types';

// Public: a product's rating summary + the list of reviews.
export async function getReviews(productId: string): Promise<ReviewSummary> {
  const { data } = await api.get<ReviewSummary>(`/products/${productId}/reviews`);
  return data;
}

// Logged-in customer: whether they may review this product (and their existing review).
export async function getReviewState(productId: string): Promise<ReviewState> {
  const { data } = await api.get<ReviewState>(`/products/${productId}/reviews/me`);
  return data;
}

// Logged-in customer: leave or update a review.
export async function submitReview(
  productId: string,
  input: { rating: number; comment?: string },
): Promise<void> {
  await api.post(`/products/${productId}/reviews`, input);
}
