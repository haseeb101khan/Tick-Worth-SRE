import 'dotenv/config';
import { env } from './config/env'; // validates configuration at startup (fail-fast)
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRoutes } from './routes/auth.routes';
import { productRoutes } from './routes/product.routes';
import { orderRoutes } from './routes/order.routes';
import { inventoryRoutes } from './routes/inventory.routes';
import { transferRoutes } from './routes/transfer.routes';
import { damageRoutes } from './routes/damage.routes';
import { reportRoutes } from './routes/report.routes';
import { notificationRoutes } from './routes/notification.routes';
import { userRoutes } from './routes/user.routes';
import { courierRoutes } from './routes/courier.routes';
import { stockRequestRoutes } from './routes/stockRequest.routes';
import { restockRequestRoutes } from './routes/restockRequest.routes';
import { uploadRoutes } from './routes/upload.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { requestLogger } from './middleware/requestLog.middleware';
import { apiLimiter, authLimiter } from './middleware/rateLimit.middleware';
import { logger } from './utils/logger';

export const app = express();

// Behind a proxy (hosting platforms) so rate-limit / IPs read the real client address.
app.set('trust proxy', 1);

// --- Security + observability middleware (order matters) ---
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // security headers

// CORS allow-list: the configured app URL + any CORS_ORIGIN entries, plus any localhost
// port for local dev. Non-browser callers (no Origin header) are allowed.
const allowedOrigins = new Set(
  [env.APP_URL, ...(env.CORS_ORIGIN?.split(',') ?? [])].map((s) => s.trim()).filter(Boolean),
);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);

app.use(requestLogger); // structured per-request logging
app.use('/api', apiLimiter); // generous global rate limit

// Image uploads carry a base64 data URL, which exceeds express.json's default 100kb limit —
// give this route a larger parser, mounted before the global (default-limit) json parser.
app.use('/api/uploads', express.json({ limit: '12mb' }), uploadRoutes);

app.use(express.json());

// Health check — used by the frontend walking skeleton and by hosting platforms.
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Strict rate limit on auth endpoints (brute-force / email-spam protection).
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/damage-reports', damageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/stock-requests', stockRequestRoutes);
app.use('/api/restock-requests', restockRequestRoutes);

// Error handler must be registered LAST.
app.use(errorMiddleware);

// Only start the server when run directly (so tests can import `app` without binding a port).
if (require.main === module) {
  app.listen(env.PORT, () => logger.info(`API running on http://localhost:${env.PORT}`));
}
