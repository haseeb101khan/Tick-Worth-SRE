// Cold-start UX. Our backend (Render free tier) sleeps after ~15 min idle and takes
// 10–30s to wake. This module detects that: when any API request stays in flight
// longer than SLOW_MS, we surface a "waking up" banner so customers wait instead of
// assuming the site is broken. It auto-clears once the server responds.

type Listener = (waking: boolean) => void;

const listeners = new Set<Listener>();
let pendingSlow = 0; // number of in-flight requests that have crossed SLOW_MS
let waking = false;

// A warm server answers in well under a second, so this only ever trips on a cold
// backend — normal browsing never shows the banner.
const SLOW_MS = 3500;

function emit() {
  const next = pendingSlow > 0;
  if (next !== waking) {
    waking = next;
    listeners.forEach((l) => l(waking));
  }
}

/** Subscribe to waking-state changes. Returns an unsubscribe fn. */
export function onWakeChange(listener: Listener): () => void {
  listeners.add(listener);
  listener(waking); // push current state immediately
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Call when a request starts; call the returned fn when it settles (success OR error).
 * Wired into the axios interceptors in services/api.ts.
 */
export function trackRequest(): () => void {
  let counted = false;
  const timer = setTimeout(() => {
    counted = true;
    pendingSlow += 1;
    emit();
  }, SLOW_MS);

  return () => {
    clearTimeout(timer);
    if (counted) {
      pendingSlow -= 1;
      emit();
    }
  };
}

/**
 * Fire-and-forget ping to wake the backend as soon as the app loads — by the time the
 * user navigates to login/checkout the server is usually already up. Uses fetch (not
 * the api instance) so this silent ping never triggers the banner itself.
 */
export function warmUp(): void {
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
  const healthUrl = apiBase.replace(/\/api\/?$/, '') + '/health';
  fetch(healthUrl).catch(() => {
    /* ignore — this is best-effort */
  });
}
