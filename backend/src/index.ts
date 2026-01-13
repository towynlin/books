import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { endPool } from './db';
import bookRoutes from './routes/books';
import importRoutes from './routes/import';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || true, // Allow specific origin or all origins
  credentials: true, // Allow credentials
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/books', bookRoutes);
app.use('/api/import', importRoutes);
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await endPool();
  process.exit(0);
});
