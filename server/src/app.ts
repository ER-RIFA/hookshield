import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { isDBConnected } from './config/database';
import endpointRoutes from './routes/endpoint.routes';
import eventRoutes from './routes/event.routes';
import deliveryRoutes from './routes/delivery.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));

// Body parsing — capture raw body for HMAC signing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check — no auth required
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: isDBConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Guard DB routes with friendly message if DB is not connected
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (!isDBConnected()) {
    res.status(503).json({
      success: false,
      error: 'Database unavailable',
      message: `MongoDB is not connected. Please ensure MongoDB is running at ${env.MONGODB_URI}`,
    });
    return;
  }
  next();
});

// API routes
app.use('/api/endpoints', endpointRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/deliveries', deliveryRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Global error handler
app.use(errorHandler);

export default app;
