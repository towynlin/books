-- Books tracking database schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS passkey_credentials CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS books CASCADE;

-- Drop existing types if they exist
DROP TYPE IF EXISTS book_status CASCADE;
DROP TYPE IF EXISTS book_category CASCADE;

-- Create enums
CREATE TYPE book_status AS ENUM ('read', 'reading', 'want_to_read');
CREATE TYPE book_category AS ENUM ('fiction', 'nonfiction');

-- Books table
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Book identification
  goodreads_id TEXT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT,
  isbn13 TEXT,
  cover_url TEXT,

  -- Reading status and categorization
  status book_status NOT NULL,
  category book_category,

  -- Reading dates
  date_started TIMESTAMPTZ,
  date_finished TIMESTAMPTZ,
  date_added TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User data
  my_rating INTEGER CHECK (my_rating >= 1 AND my_rating <= 5),
  notes TEXT,

  -- Next up list positioning
  next_up_order INTEGER,

  -- Additional metadata from Goodreads
  publisher TEXT,
  binding TEXT,
  pages INTEGER,
  year_published INTEGER,
  original_publication_year INTEGER,
  average_rating NUMERIC(3, 2)
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  username TEXT NOT NULL UNIQUE
);

-- Passkey credentials table
CREATE TABLE passkey_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_name TEXT
);

-- Setup tokens table for time-limited device setup links
CREATE TABLE setup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ
);

-- Recovery codes table for account recovery
CREATE TABLE recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_category ON books(category);
CREATE INDEX idx_books_next_up_order ON books(next_up_order) WHERE next_up_order IS NOT NULL;
CREATE INDEX idx_passkey_credentials_user_id ON passkey_credentials(user_id);
CREATE INDEX idx_setup_tokens_token ON setup_tokens(token);
CREATE INDEX idx_setup_tokens_user_id ON setup_tokens(user_id);
CREATE INDEX idx_recovery_codes_code ON recovery_codes(code);
CREATE INDEX idx_recovery_codes_user_id ON recovery_codes(user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_passkey_credentials_updated_at BEFORE UPDATE ON passkey_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
