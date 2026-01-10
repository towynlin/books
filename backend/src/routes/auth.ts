import express from 'express';
import jwt from 'jsonwebtoken';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server/script/deps';
import { prisma } from '../index';

const router = express.Router();

// Relying Party configuration
const rpName = process.env.RP_NAME || 'Books Tracker';
const rpID = process.env.RP_ID || 'localhost';
const rpOrigin = process.env.RP_ORIGIN || 'http://localhost:5173';
const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';

// Temporary storage for challenges (in production, use Redis or similar)
const challenges = new Map<string, string>();

// POST /api/auth/register/options - Get registration options
router.post('/register/options', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check if any users exist (single-user mode)
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(403).json({ error: 'A user already exists. This is a single-user application.' });
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
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
      },
    });

    // Store challenge temporarily
    challenges.set(username, options.challenge);

    res.json(options);
  } catch (error) {
    console.error('Error generating registration options:', error);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

// POST /api/auth/register/verify - Verify registration
router.post('/register/verify', async (req, res) => {
  try {
    const { username, credential } = req.body as {
      username: string;
      credential: RegistrationResponseJSON;
    };

    if (!username || !credential) {
      return res.status(400).json({ error: 'Username and credential are required' });
    }

    // Check if any users exist (single-user mode)
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(403).json({ error: 'A user already exists. This is a single-user application.' });
    }

    // Get stored challenge
    const expectedChallenge = challenges.get(username);
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

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    // Create user and credential
    const user = await prisma.user.create({
      data: {
        username,
        credentials: {
          create: {
            credentialId: Buffer.from(credentialID).toString('base64'),
            publicKey: Buffer.from(credentialPublicKey),
            counter: BigInt(counter),
          },
        },
      },
    });

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
    const user = await prisma.user.findUnique({
      where: { username },
      include: { credentials: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: user.credentials.map((cred: any) => ({
        id: Buffer.from(cred.credentialId, 'base64'),
        type: 'public-key' as const,
      })),
      userVerification: 'preferred',
    });

    // Store challenge
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

    // Find user and credential
    const user = await prisma.user.findUnique({
      where: { username },
      include: { credentials: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const credentialIdBase64 = Buffer.from(credential.rawId, 'base64').toString('base64');
    const dbCredential = user.credentials.find(
      (cred: any) => cred.credentialId === credentialIdBase64
    );

    if (!dbCredential) {
      return res.status(400).json({ error: 'Credential not found' });
    }

    // Verify the authentication
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(dbCredential.credentialId, 'base64') as any,
        credentialPublicKey: Buffer.from(dbCredential.publicKey) as any,
        counter: Number(dbCredential.counter),
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    // Update counter
    await prisma.passkeyCredential.update({
      where: { id: dbCredential.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

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

// GET /api/auth/status - Check if a user exists
router.get('/status', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      hasUser: userCount > 0,
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

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

export default router;
