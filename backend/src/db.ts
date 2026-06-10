import { Pool, PoolClient, types } from 'pg';

// pg returns NUMERIC columns (e.g. books.average_rating) as strings to avoid
// precision loss; our numerics are small ratings, so parse them to numbers.
types.setTypeParser(types.builtins.NUMERIC, (value) => parseFloat(value));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.LOG_QUERIES === 'true') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }
  return res;
};

export const getClient = (): Promise<PoolClient> => {
  return pool.connect();
};

export const endPool = async () => {
  await pool.end();
};

export default pool;
