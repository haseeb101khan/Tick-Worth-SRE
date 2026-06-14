import { useState } from 'react';

interface Props {
  /** Current rating (0–5). Supports halves for display (e.g. 4.3 → 4 filled + partial). */
  value: number;
  /** When set, stars become clickable and call back with 1–5. */
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' };

// A five-star rating. Read-only by default (renders fractional fills for averages);
// pass `onChange` to make it an interactive picker for the review form.
export function StarRating({ value, onChange, size = 'md', className = '' }: Props) {
  const [hover, setHover] = useState(0);
  const interactive = !!onChange;
  const shown = hover || value;

  return (
    <div className={`inline-flex items-center ${SIZES[size]} ${className}`} role={interactive ? 'radiogroup' : 'img'} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        // Fractional fill for read-only averages (e.g. 4.3 partially fills the 5th star).
        const fill = Math.max(0, Math.min(1, shown - (star - 1)));
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => interactive && setHover(star)}
            onMouseLeave={() => interactive && setHover(0)}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            className={`relative leading-none ${interactive ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}`}
          >
            <span className="text-ink/15">★</span>
            <span className="absolute inset-0 overflow-hidden text-gold" style={{ width: `${fill * 100}%` }}>
              ★
            </span>
          </button>
        );
      })}
    </div>
  );
}
