import { FormEvent, useEffect, useState } from 'react';
import { ReviewState, ReviewSummary } from '../types';
import { getReviews, getReviewState, submitReview } from '../services/reviewService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { StarRating } from './StarRating';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Reviews for one product: rating summary, the list of customer reviews, and — for a
// signed-in customer who has received the watch — a form to leave or edit their review.
export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const isCustomer = user?.role === 'CUSTOMER';

  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [state, setState] = useState<ReviewState | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function loadSummary() {
    getReviews(productId).then(setSummary).catch(() => undefined);
  }

  useEffect(() => {
    setSummary(null);
    setState(null);
    setRating(0);
    setComment('');
    loadSummary();
    if (isCustomer) {
      getReviewState(productId)
        .then((s) => {
          setState(s);
          if (s.myReview) {
            setRating(s.myReview.rating);
            setComment(s.myReview.comment ?? '');
          }
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, isCustomer]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast.error('Please choose a star rating');
      return;
    }
    setSubmitting(true);
    try {
      // Mirror the server's normalization (trimmed; empty → null) so the optimistic
      // state and pre-filled form match what was actually persisted.
      const trimmed = comment.trim();
      await submitReview(productId, { rating, comment: trimmed || undefined });
      toast.success(state?.myReview ? 'Your review was updated' : 'Thank you for your review');
      loadSummary();
      setComment(trimmed);
      setState((prev) => ({ canReview: true, myReview: { id: prev?.myReview?.id ?? 'me', rating, comment: trimmed || null } }));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-20 border-t border-ink/10 pt-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-serif text-3xl font-light text-ink">Customer Reviews</h2>
        {summary && summary.count > 0 && (
          <div className="flex items-center gap-3">
            <StarRating value={summary.average} />
            <span className="text-sm text-stone">
              {summary.average.toFixed(1)} · {summary.count} review{summary.count > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Review form — only for a customer who has received this watch */}
      {isCustomer && state?.canReview && (
        <form onSubmit={handleSubmit} className="mt-8 border border-ink/10 bg-cream/40 p-6">
          <p className="text-[0.7rem] uppercase tracking-wide2 text-stone">
            {state.myReview ? 'Edit your review' : 'Share your experience'}
          </p>
          <div className="mt-3">
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell other collectors what you think of this timepiece…"
            rows={3}
            maxLength={1000}
            className="input-luxe mt-4 resize-none"
          />
          <button type="submit" disabled={submitting} className="btn-gold mt-4">
            {submitting ? 'Saving…' : state.myReview ? 'Update review' : 'Submit review'}
          </button>
        </form>
      )}

      {/* Gentle nudge for signed-in customers who haven't received it yet */}
      {isCustomer && state && !state.canReview && (
        <p className="mt-6 text-sm text-stone">
          You can review this watch once your order for it has been delivered.
        </p>
      )}

      {/* Review list */}
      <div className="mt-10 space-y-8">
        {summary && summary.count === 0 && (
          <p className="text-sm text-stone">No reviews yet — be the first to share your impressions.</p>
        )}
        {summary?.reviews.map((r) => (
          <div key={r.id} className="border-b border-ink/5 pb-8 last:border-0">
            <div className="flex items-center justify-between">
              <StarRating value={r.rating} size="sm" />
              <span className="text-[0.7rem] uppercase tracking-wide2 text-stone">{formatDate(r.createdAt)}</span>
            </div>
            <p className="mt-2 font-serif text-lg text-ink">{r.customerName}</p>
            {r.comment && <p className="mt-2 text-sm leading-relaxed text-ink/70">{r.comment}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
