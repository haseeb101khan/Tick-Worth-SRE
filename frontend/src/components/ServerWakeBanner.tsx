import { useEffect, useState } from 'react';
import { onWakeChange } from '../utils/wake';
import { FEATURED_WATCHES } from '../utils/featuredWatches';

const ROTATE_MS = 3500;

/**
 * Cold-start showcase. While the backend wakes from sleep (a request running longer than
 * the slow threshold), this turns the wait into a curated boutique moment — a rotating
 * gallery of featured luxury pieces with descriptions, rather than a frozen spinner.
 * Images are served by the frontend host, so they display instantly even before the API
 * responds. Auto-hides the moment the server is back.
 */
export function ServerWakeBanner() {
  const [waking, setWaking] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => onWakeChange(setWaking), []);

  // Rotate featured pieces only while visible; start on a random one so it feels fresh.
  useEffect(() => {
    if (!waking) return;
    setIdx(Math.floor(Math.random() * FEATURED_WATCHES.length));
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % FEATURED_WATCHES.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [waking]);

  if (!waking) return null;

  const watch = FEATURED_WATCHES[idx];

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-3">
      <div className="promo-slidedown w-full max-w-xl overflow-hidden rounded-lg border border-gold/30 bg-ink/95 text-ivory shadow-2xl backdrop-blur">
        {/* Status strip */}
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 border-b border-white/10 px-4 py-2"
        >
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-ivory/30 border-t-gold" />
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.25em] text-gold">
            Preparing your boutique
          </span>
          <span className="ml-auto text-[0.65rem] text-ivory/50">just a few seconds…</span>
        </div>

        {/* Rotating featured watch — key forces the fade to replay on each change */}
        <div key={watch.slug} className="promo-fade flex items-center gap-4 p-4">
          <img
            src={`/watches/${watch.slug}/01.jpeg`}
            alt={watch.name}
            className="h-20 w-20 shrink-0 rounded object-cover sm:h-24 sm:w-24"
          />
          <div className="min-w-0">
            <p className="text-[0.6rem] font-medium uppercase tracking-[0.25em] text-gold/80">
              {watch.brand}
            </p>
            <h3 className="truncate font-serif text-lg font-light sm:text-xl">{watch.name}</h3>
            <p className="mt-1 text-xs leading-snug text-ivory/70 sm:text-sm">{watch.tagline}</p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-3">
          {FEATURED_WATCHES.map((w, i) => (
            <span
              key={w.slug}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === idx ? 'w-4 bg-gold' : 'w-1 bg-white/25'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
