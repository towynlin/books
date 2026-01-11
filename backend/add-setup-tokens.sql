-- Migration to add setup_tokens table

-- Setup tokens table for time-limited device setup links
CREATE TABLE IF NOT EXISTS setup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_setup_tokens_token ON setup_tokens(token);
CREATE INDEX IF NOT EXISTS idx_setup_tokens_user_id ON setup_tokens(user_id);
