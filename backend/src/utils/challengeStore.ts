import { query } from '../db';

// WebAuthn challenges are single-use and short-lived. They live in Postgres
// rather than process memory so ceremonies survive server restarts and
// deploys, and so the options call and the verify call don't have to hit the
// same process.
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function createChallenge(scope: string, challenge: string): Promise<void> {
  // Opportunistic cleanup keeps the table tiny without a background job
  await query('DELETE FROM webauthn_challenges WHERE expires_at < NOW()');
  await query(
    'INSERT INTO webauthn_challenges (scope, challenge, expires_at) VALUES ($1, $2, $3)',
    [scope, challenge, new Date(Date.now() + CHALLENGE_TTL_MS)]
  );
}

// Atomically consume a challenge (single-use). Returns true only when the
// challenge existed under this scope and had not expired.
export async function consumeChallenge(scope: string, challenge: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM webauthn_challenges WHERE scope = $1 AND challenge = $2 AND expires_at >= NOW() RETURNING id',
    [scope, challenge]
  );
  return (result.rowCount ?? 0) > 0;
}

// The authenticator echoes the challenge back inside clientDataJSON
// (base64url-encoded JSON whose `challenge` field matches the base64url
// string the options call generated). Reading it from the response lets
// concurrent ceremonies for the same user coexist: each verify consumes
// exactly the challenge its own options call created.
export function extractChallenge(credential: {
  response?: { clientDataJSON?: unknown };
}): string | null {
  const clientDataJSON = credential?.response?.clientDataJSON;
  if (typeof clientDataJSON !== 'string') return null;
  try {
    const parsed = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8'));
    return typeof parsed.challenge === 'string' && parsed.challenge.length > 0
      ? parsed.challenge
      : null;
  } catch {
    return null;
  }
}
