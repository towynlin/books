import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { query, getClient } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

// Helper to validate invitation tokens
// Returns { valid: true, id: string } or { valid: false, error: string }
async function validateInvitationToken(token: string): Promise<
  | { valid: true; id: string }
  | { valid: false; error: string }
> {
  const result = await query(
    `SELECT id, expires_at, used FROM invitation_tokens WHERE token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return { valid: false, error: 'Invalid invitation token' };
  }

  const tokenData = result.rows[0];
  if (tokenData.used) {
    return { valid: false, error: 'This invitation has already been used' };
  }
  if (new Date(tokenData.expires_at) < new Date()) {
    return { valid: false, error: 'This invitation has expired' };
  }

  return { valid: true, id: tokenData.id };
}

const router = express.Router();

// Relying Party configuration
const rpName = process.env.RP_NAME || 'Books Tracker';
const rpID = process.env.RP_ID || 'localhost';
const rpOrigin = process.env.RP_ORIGIN || 'http://localhost:5173';
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Temporary storage for challenges (in production, use Redis or similar)
const challenges = new Map<string, string>();

// POST /api/auth/register/options - Get registration options
router.post('/register/options', async (req, res) => {
  try {
    const { username, invitationToken } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check if any users exist
    const userCountResult = await query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCountResult.rows[0].count);

    // If users exist, require valid invitation token
    if (userCount > 0) {
      if (!invitationToken) {
        return res.status(403).json({ error: 'Registration requires an invitation' });
      }

      const validation = await validateInvitationToken(invitationToken);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }
    }

    // Check if username already exists
    const existingUserResult = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: username,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        // Enable cross-device authentication (QR code scanning)
        authenticatorAttachment: undefined, // Allow both platform and cross-platform authenticators
      },
      supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
    });

    // Store challenge temporarily (include invitation token in key if present)
    const challengeKey = invitationToken ? `${username}:${invitationToken}` : username;
    challenges.set(challengeKey, options.challenge);

    res.json(options);
  } catch (error) {
    console.error('Error generating registration options:', error);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

// POST /api/auth/register/verify - Verify registration
router.post('/register/verify', async (req, res) => {
  try {
    const { username, credential, invitationToken } = req.body as {
      username: string;
      credential: RegistrationResponseJSON;
      invitationToken?: string;
    };

    if (!username || !credential) {
      return res.status(400).json({ error: 'Username and credential are required' });
    }

    // Check if any users exist (to determine if this is the first user)
    const userCountResult = await query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCountResult.rows[0].count);
    const isFirstUser = userCount === 0;

    // If not the first user, require valid invitation token
    let invitationId: string | null = null;
    if (!isFirstUser) {
      if (!invitationToken) {
        return res.status(403).json({ error: 'Registration requires an invitation' });
      }

      const validation = await validateInvitationToken(invitationToken);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }
      invitationId = validation.id;
    }

    // Get stored challenge (check both with and without invitation token)
    const challengeKey = invitationToken ? `${username}:${invitationToken}` : username;
    const expectedChallenge = challenges.get(challengeKey);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No registration in progress' });
    }

    // Verify the credential
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    // In v10+, credentialID is a base64url string (not Uint8Array)
    const { id: credentialID, publicKey: credentialPublicKey, counter } = verification.registrationInfo.credential;

    // Get transports from the response
    const transports = credential.response.transports || [];

    // Use transaction for all database operations
    const client = await getClient();
    let user: { id: string; username: string };
    const recoveryCodes: string[] = [];

    try {
      await client.query('BEGIN');

      // Create user (mark as initial user if first)
      const userResult = await client.query(
        'INSERT INTO users (username, is_initial_user) VALUES ($1, $2) RETURNING id, username',
        [username, isFirstUser]
      );
      user = userResult.rows[0];

      // Create passkey credential
      await client.query(
        'INSERT INTO passkey_credentials (user_id, credential_id, public_key, counter, transports) VALUES ($1, $2, $3, $4, $5)',
        [
          user.id,
          credentialID,
          Buffer.from(credentialPublicKey),
          counter,
          transports,
        ]
      );

      // Mark invitation as used if applicable
      if (invitationId) {
        await client.query(
          'UPDATE invitation_tokens SET used = TRUE, used_at = NOW(), used_by = $1 WHERE id = $2',
          [user.id, invitationId]
        );
      }

      // Generate and store 10 recovery codes (hashed)
      for (let i = 0; i < 10; i++) {
        const code = [
          crypto.randomBytes(2).toString('hex').toUpperCase(),
          crypto.randomBytes(2).toString('hex').toUpperCase(),
          crypto.randomBytes(2).toString('hex').toUpperCase(),
          crypto.randomBytes(2).toString('hex').toUpperCase(),
        ].join('-');
        recoveryCodes.push(code);

        const hashedCode = await bcrypt.hash(code, 10);
        await client.query(
          'INSERT INTO recovery_codes (user_id, code) VALUES ($1, $2)',
          [user.id, hashedCode]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Clean up challenge (after successful transaction)
    challenges.delete(challengeKey);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      verified: true,
      token,
      user: {
        id: user.id,
        username: user.username,
      },
      recoveryCodes,
    });
  } catch (error) {
    console.error('Error verifying registration:', error);
    res.status(500).json({ error: 'Failed to verify registration' });
  }
});

// POST /api/auth/login/options - Get login options
router.post('/login/options', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Find user and their credentials
    const userResult = await query(
      'SELECT id, username FROM users WHERE username = $1',
      [username]
    );

    const user = userResult.rows.length > 0 ? userResult.rows[0] : null;

    let allowCredentials: { id: string; type: 'public-key'; transports: any[] }[] = [];
    if (user) {
      const credentialsResult = await query(
        'SELECT credential_id, transports FROM passkey_credentials WHERE user_id = $1',
        [user.id]
      );
      allowCredentials = credentialsResult.rows.map((cred: any) => ({
        id: cred.credential_id,
        type: 'public-key' as const,
        transports: cred.transports || [],
      }));
    }

    // Generate authentication options even for non-existent users
    // to prevent username enumeration via response differences
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    // Store challenge (will fail at verify step for non-existent users)
    challenges.set(username, options.challenge);

    res.json(options);
  } catch (error) {
    console.error('Error generating login options:', error);
    res.status(500).json({ error: 'Failed to generate login options' });
  }
});

// POST /api/auth/login/verify - Verify login
router.post('/login/verify', async (req, res) => {
  try {
    const { username, credential } = req.body as {
      username: string;
      credential: AuthenticationResponseJSON;
    };

    if (!username || !credential) {
      return res.status(400).json({ error: 'Username and credential are required' });
    }

    // Get stored challenge
    const expectedChallenge = challenges.get(username);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No login in progress' });
    }

    // Find user and credential — use generic error to prevent enumeration
    const userResult = await query(
      'SELECT id, username FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Authentication failed' });
    }

    const user = userResult.rows[0];

    // credential.rawId from browser is base64url, stored credential_id is also base64url
    const credentialResult = await query(
      'SELECT id, credential_id, public_key, counter FROM passkey_credentials WHERE user_id = $1 AND credential_id = $2',
      [user.id, credential.rawId]
    );

    if (credentialResult.rows.length === 0) {
      return res.status(400).json({ error: 'Authentication failed' });
    }

    const dbCredential = credentialResult.rows[0];

    // Verify the authentication
    // credential_id is stored as base64url, use it directly
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      credential: {
        id: dbCredential.credential_id,
        publicKey: dbCredential.public_key,
        counter: Number(dbCredential.counter),
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    // Update counter
    await query(
      'UPDATE passkey_credentials SET counter = $1 WHERE id = $2',
      [verification.authenticationInfo.newCounter, dbCredential.id]
    );

    // Clean up challenge
    challenges.delete(username);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      verified: true,
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Error verifying login:', error);
    res.status(500).json({ error: 'Failed to verify login' });
  }
});

// POST /api/auth/login/recovery - Login with recovery code
router.post('/login/recovery', async (req, res) => {
  try {
    const { username, recoveryCode } = req.body;

    if (!username || !recoveryCode) {
      return res.status(400).json({ error: 'Username and recovery code are required' });
    }

    // Find user — use generic error to prevent username enumeration
    const userResult = await query(
      'SELECT id, username FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid username or recovery code' });
    }

    const user = userResult.rows[0];

    // Find matching recovery code by comparing against all unused hashes
    const codesResult = await query(
      'SELECT id, code, used FROM recovery_codes WHERE user_id = $1 AND used = FALSE',
      [user.id]
    );

    const normalizedInput = recoveryCode.trim().toUpperCase();
    let matchedCodeId: string | null = null;
    for (const row of codesResult.rows) {
      if (await bcrypt.compare(normalizedInput, row.code)) {
        matchedCodeId = row.id;
        break;
      }
    }

    if (!matchedCodeId) {
      return res.status(400).json({ error: 'Invalid username or recovery code' });
    }

    // Mark recovery code as used
    await query(
      'UPDATE recovery_codes SET used = TRUE, used_at = NOW() WHERE id = $1',
      [matchedCodeId]
    );

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      verified: true,
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Error logging in with recovery code:', error);
    res.status(500).json({ error: 'Failed to login with recovery code' });
  }
});

// GET /api/auth/status - Check if a user exists and if registration requires invitation
router.get('/status', async (req, res) => {
  try {
    const userCountResult = await query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCountResult.rows[0].count);
    res.json({
      hasUser: userCount > 0,
      requiresInvitation: userCount > 0,
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: 'Failed to check auth status' });
  }
});

// POST /api/auth/verify-token - Verify JWT token
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      username: string;
    };

    const userResult = await query(
      'SELECT id, username FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ===== Passkey Management Endpoints (Authenticated) =====

// GET /api/auth/passkeys - List user's passkeys
router.get('/passkeys', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await query(
      'SELECT id, created_at, device_name FROM passkey_credentials WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      passkeys: result.rows.map(row => ({
        id: row.id,
        createdAt: row.created_at,
        deviceName: row.device_name || 'Unnamed Device',
      })),
    });
  } catch (error) {
    console.error('Error fetching passkeys:', error);
    res.status(500).json({ error: 'Failed to fetch passkeys' });
  }
});

// POST /api/auth/passkeys/add-options - Get options to add a new passkey
router.post('/passkeys/add-options', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const username = req.user?.username;
    if (!userId || !username) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get existing credentials to exclude them
    const existingCreds = await query(
      'SELECT credential_id FROM passkey_credentials WHERE user_id = $1',
      [userId]
    );

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: username,
      attestationType: 'none',
      excludeCredentials: existingCreds.rows.map((cred: any) => ({
        id: cred.credential_id,
        type: 'public-key' as const,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: undefined,
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    // Store challenge with user ID instead of username for add operations
    challenges.set(`add-${userId}`, options.challenge);

    res.json(options);
  } catch (error) {
    console.error('Error generating add passkey options:', error);
    res.status(500).json({ error: 'Failed to generate add passkey options' });
  }
});

// POST /api/auth/passkeys/add-verify - Verify and add new passkey
router.post('/passkeys/add-verify', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { credential, deviceName } = req.body as {
      credential: RegistrationResponseJSON;
      deviceName?: string;
    };

    if (!credential) {
      return res.status(400).json({ error: 'Credential is required' });
    }

    // Get stored challenge
    const expectedChallenge = challenges.get(`add-${userId}`);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No add passkey operation in progress' });
    }

    // Verify the credential
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    // In v10+, credentialID is a base64url string (not Uint8Array)
    const { id: credentialID, publicKey: credentialPublicKey, counter } = verification.registrationInfo.credential;

    // Get transports from the response
    const transports = credential.response.transports || [];

    // Add credential to database
    // credentialID is already a base64url string, store it directly
    await query(
      'INSERT INTO passkey_credentials (user_id, credential_id, public_key, counter, device_name, transports) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        userId,
        credentialID,
        Buffer.from(credentialPublicKey),
        counter,
        deviceName || null,
        transports,
      ]
    );

    // Clean up challenge
    challenges.delete(`add-${userId}`);

    res.json({ success: true, message: 'Passkey added successfully' });
  } catch (error) {
    console.error('Error adding passkey:', error);
    res.status(500).json({ error: 'Failed to add passkey' });
  }
});

// DELETE /api/auth/passkeys/:id - Delete a passkey
router.delete('/passkeys/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const passkeyId = req.params.id;

    // Check how many passkeys the user has
    const countResult = await query(
      'SELECT COUNT(*) FROM passkey_credentials WHERE user_id = $1',
      [userId]
    );
    const passkeyCount = parseInt(countResult.rows[0].count);

    if (passkeyCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete your only passkey' });
    }

    // Delete the passkey (only if it belongs to this user)
    const result = await query(
      'DELETE FROM passkey_credentials WHERE id = $1 AND user_id = $2',
      [passkeyId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Passkey not found' });
    }

    res.json({ success: true, message: 'Passkey deleted successfully' });
  } catch (error) {
    console.error('Error deleting passkey:', error);
    res.status(500).json({ error: 'Failed to delete passkey' });
  }
});

// ===== Setup Token Endpoints (for adding devices) =====

// POST /api/auth/setup-token/generate - Generate a setup token (authenticated)
router.post('/setup-token/generate', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');

    // Token expires in 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Store token in database
    await query(
      'INSERT INTO setup_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );

    res.json({
      token,
      expiresAt: expiresAt.toISOString(),
      setupUrl: `${rpOrigin}/setup?token=${token}`,
    });
  } catch (error) {
    console.error('Error generating setup token:', error);
    res.status(500).json({ error: 'Failed to generate setup token' });
  }
});

// GET /api/auth/setup-token/validate/:token - Validate a setup token (public)
router.get('/setup-token/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await query(
      `SELECT st.id, st.user_id, st.expires_at, st.used, u.username
       FROM setup_tokens st
       JOIN users u ON st.user_id = u.id
       WHERE st.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid setup token' });
    }

    const tokenData = result.rows[0];

    if (tokenData.used) {
      return res.status(400).json({ error: 'This setup token has already been used' });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This setup token has expired' });
    }

    res.json({
      valid: true,
      username: tokenData.username,
      expiresAt: tokenData.expires_at,
    });
  } catch (error) {
    console.error('Error validating setup token:', error);
    res.status(500).json({ error: 'Failed to validate setup token' });
  }
});

// POST /api/auth/setup-token/register-options - Get registration options using setup token (public)
router.post('/setup-token/register-options', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Validate token
    const result = await query(
      `SELECT st.id, st.user_id, st.expires_at, st.used, u.username
       FROM setup_tokens st
       JOIN users u ON st.user_id = u.id
       WHERE st.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid setup token' });
    }

    const tokenData = result.rows[0];

    if (tokenData.used) {
      return res.status(400).json({ error: 'This setup token has already been used' });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This setup token has expired' });
    }

    // Get existing credentials to exclude them
    const existingCreds = await query(
      'SELECT credential_id FROM passkey_credentials WHERE user_id = $1',
      [tokenData.user_id]
    );

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: tokenData.username,
      attestationType: 'none',
      excludeCredentials: existingCreds.rows.map((cred: any) => ({
        id: cred.credential_id,
        type: 'public-key' as const,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: undefined,
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    // Store challenge with token
    challenges.set(`setup-${token}`, options.challenge);

    res.json(options);
  } catch (error) {
    console.error('Error generating setup registration options:', error);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

// ===== Invitation Endpoints =====

// POST /api/auth/invitation/generate - Generate invitation token (authenticated)
router.post('/invitation/generate', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Generate a random 64-character token
    const token = crypto.randomBytes(32).toString('hex');

    // Token expires in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Store token in database
    await query(
      'INSERT INTO invitation_tokens (created_by, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );

    res.json({
      token,
      expiresAt: expiresAt.toISOString(),
      inviteUrl: `${rpOrigin}/auth?invite=${token}`,
    });
  } catch (error) {
    console.error('Error generating invitation:', error);
    res.status(500).json({ error: 'Failed to generate invitation' });
  }
});

// GET /api/auth/invitation/validate/:token - Validate invitation token (public)
router.get('/invitation/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await query(
      `SELECT id, expires_at, used FROM invitation_tokens WHERE token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.json({ valid: false });
    }

    const tokenData = result.rows[0];

    if (tokenData.used) {
      return res.json({ valid: false });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return res.json({ valid: false });
    }

    res.json({
      valid: true,
      expiresAt: tokenData.expires_at,
    });
  } catch (error) {
    console.error('Error validating invitation:', error);
    res.status(500).json({ error: 'Failed to validate invitation' });
  }
});

// POST /api/auth/setup-token/register-verify - Complete setup with passkey registration (public)
router.post('/setup-token/register-verify', async (req, res) => {
  try {
    const { token, credential, deviceName } = req.body as {
      token: string;
      credential: RegistrationResponseJSON;
      deviceName?: string;
    };

    if (!token || !credential) {
      return res.status(400).json({ error: 'Token and credential are required' });
    }

    // Validate token
    const tokenResult = await query(
      `SELECT st.id, st.user_id, st.expires_at, st.used, u.username
       FROM setup_tokens st
       JOIN users u ON st.user_id = u.id
       WHERE st.token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid setup token' });
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.used) {
      return res.status(400).json({ error: 'This setup token has already been used' });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This setup token has expired' });
    }

    // Get stored challenge
    const expectedChallenge = challenges.get(`setup-${token}`);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No registration in progress' });
    }

    // Verify the credential
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    // In v10+, credentialID is a base64url string (not Uint8Array)
    const { id: credentialID, publicKey: credentialPublicKey, counter } = verification.registrationInfo.credential;

    // Add credential to database
    // credentialID is already a base64url string, store it directly
    await query(
      'INSERT INTO passkey_credentials (user_id, credential_id, public_key, counter, device_name) VALUES ($1, $2, $3, $4, $5)',
      [
        tokenData.user_id,
        credentialID,
        Buffer.from(credentialPublicKey),
        counter,
        deviceName || null,
      ]
    );

    // Mark token as used
    await query(
      'UPDATE setup_tokens SET used = TRUE, used_at = NOW() WHERE id = $1',
      [tokenData.id]
    );

    // Clean up challenge
    challenges.delete(`setup-${token}`);

    // Generate JWT for auto-login
    const jwtToken = jwt.sign(
      { userId: tokenData.user_id, username: tokenData.username },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      verified: true,
      token: jwtToken,
      user: {
        id: tokenData.user_id,
        username: tokenData.username,
      },
    });
  } catch (error) {
    console.error('Error completing setup:', error);
    res.status(500).json({ error: 'Failed to complete setup' });
  }
});

export default router;
