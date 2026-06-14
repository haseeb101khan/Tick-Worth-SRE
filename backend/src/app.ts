import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
import { errorMiddleware } from './middleware/error.middleware';
import { logger } from './utils/logger';

export const app = express();

app.use(cors());
app.use(express.json());

// Health check — used by the frontend walking skeleton and by hosting platforms.
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
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
  const PORT = Number(process.env.PORT) || 5000;
  app.listen(PORT, () => logger.info(`API running on http://localhost:${PORT}`));
}
