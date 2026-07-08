const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initDatabase();
