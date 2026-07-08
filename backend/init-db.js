const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// This runs as the Fly.io release_command on every deploy, in a fresh
// machine. A cold or just-waking Postgres can drop the first connection
// attempts, and a failed release command aborts the entire deploy — so
// every attempt here must tolerate transient connection errors.
const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 5000;

async function initDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    // Check if tables already exist
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'books'
      );
    `);

    if (result.rows[0].exists) {
      console.log('Database tables already exist. Skipping initialization.');
      // Purely additive tables can still be created idempotently so a deploy
      // that introduces them never races a hand-applied migration.
      await client.query(`
        CREATE TABLE IF NOT EXISTS webauthn_challenges (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          scope TEXT NOT NULL,
          challenge TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_scope_challenge ON webauthn_challenges(scope, challenge);
        CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at);
      `);
      console.log('Ensured webauthn_challenges table exists.');
      return;
    }

    console.log('Reading schema file...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    console.log('Executing schema...');
    await client.query(schema);

    console.log('Database initialized successfully!');
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await initDatabase();
      return;
    } catch (error) {
      console.error(
        `Database init attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}`
      );
      if (attempt === MAX_ATTEMPTS) {
        console.error('Error initializing database:', error);
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

main();
