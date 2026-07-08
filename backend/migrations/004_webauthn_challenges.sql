-- WebAuthn challenge persistence
-- Moves passkey ceremony challenges out of process memory into Postgres so
-- login/registration ceremonies survive server restarts and deploys, and so
-- the options call and verify call don't have to hit the same instance.

CREATE TABLE webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scope TEXT NOT NULL,        -- e.g. 'login:<username>', 'registration:<username>', 'add:<user_id>', 'setup:<token>'
  challenge TEXT NOT NULL,    -- base64url challenge exactly as sent in the ceremony options
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_webauthn_challenges_scope_challenge ON webauthn_challenges(scope, challenge);
CREATE INDEX idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at);
