import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { endPool } from './db';
import bookRoutes from './routes/books';
import importRoutes from './routes/import';
import authRoutes from './routes/auth';
import searchRoutes from './routes/search';

dotenv.config({ quiet: true });

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin && process.env.NODE_ENV === 'production') {
  throw new Error('CORS_ORIGIN environment variable is required in production');
}
app.use(cors({
  origin: corsOrigin || true,
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — stricter for auth, lighter for general API
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/books', apiLimiter, bookRoutes);
app.use('/api/import', apiLimiter, importRoutes);
app.use('/api/search', apiLimiter, searchRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the public directory
  app.use(express.static(path.join(__dirname, '../public')));

  // Serve index.html for all non-API routes (SPA routing)
  app.get('{*splat}', apiLimiter, (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await endPool();
  process.exit(0);
});
