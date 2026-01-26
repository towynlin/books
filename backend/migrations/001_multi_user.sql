-- Multi-user migration
-- Transforms from single-user to multi-user with invitation-based registration

-- Add is_initial_user to users table
ALTER TABLE users ADD COLUMN is_initial_user BOOLEAN NOT NULL DEFAULT FALSE;

-- Add user_id to books table
ALTER TABLE books ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create invitation_tokens table
CREATE TABLE invitation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_invitation_tokens_token ON invitation_tokens(token);

-- Migrate existing data: assign books to first user, mark as initial
DO $$
DECLARE first_user_id UUID;
BEGIN
  SELECT id INTO first_user_id FROM users ORDER BY created_at ASC LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE users SET is_initial_user = TRUE WHERE id = first_user_id;
    UPDATE books SET user_id = first_user_id WHERE user_id IS NULL;
  END IF;
END $$;

-- Make user_id NOT NULL after migration
ALTER TABLE books ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX idx_books_user_id ON books(user_id);
