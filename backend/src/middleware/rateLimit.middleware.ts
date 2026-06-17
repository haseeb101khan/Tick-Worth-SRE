import rateLimit from 'express-rate-limit';

// Generous catch-all limiter for the whole API — stops runaway clients / scraping
// without getting in the way of normal browsing.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down and try again shortly.' },
});

// Strict limiter for auth endpoints (login / register / verify / resend) to blunt
// brute-force and email-spam attempts. Keyed by IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please wait a few minutes and try again.' },
});
