import { Request, Response } from 'express';
import * as reviewService from '../services/review.service';
import { createReviewSchema } from '../utils/validators';

// Public — anyone can read a product's reviews + rating summary.
export async function list(req: Request, res: Response) {
  const result = await reviewService.listReviews(req.params.id);
  res.json(result);
}

// Logged-in customer — whether they can review this product and their existing review.
export async function myState(req: Request, res: Response) {
  const state = await reviewService.getReviewState(req.user!.id, req.params.id);
  res.json(state);
}

// Logged-in customer — leave or update a review (verified-purchase gate in the service).
export async function create(req: Request, res: Response) {
  const input = createReviewSchema.parse(req.body);
  const review = await reviewService.upsertReview(req.user!.id, req.params.id, input);
  res.status(201).json(review);
}
