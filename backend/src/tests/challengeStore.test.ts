import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({
  query: vi.fn(),
}));

import { query } from '../db';
import { extractChallenge, consumeChallenge, createChallenge } from '../utils/challengeStore';

const mockedQuery = vi.mocked(query);

function credentialWithClientData(clientData: unknown) {
  return {
    response: {
      clientDataJSON: Buffer.from(JSON.stringify(clientData)).toString('base64url'),
    },
  };
}

describe('extractChallenge', () => {
  it('returns the challenge echoed in clientDataJSON', () => {
    const credential = credentialWithClientData({
      type: 'webauthn.get',
      challenge: 'abc123_-',
      origin: 'https://example.com',
    });
    expect(extractChallenge(credential)).toBe('abc123_-');
  });

  it('returns null when clientDataJSON is missing', () => {
    expect(extractChallenge({})).toBeNull();
    expect(extractChallenge({ response: {} })).toBeNull();
  });

  it('returns null when clientDataJSON is not a string', () => {
    expect(extractChallenge({ response: { clientDataJSON: 42 } })).toBeNull();
  });

  it('returns null for malformed base64/JSON', () => {
    expect(extractChallenge({ response: { clientDataJSON: '!!!not-base64!!!' } })).toBeNull();
  });

  it('returns null when the challenge field is absent or empty', () => {
    expect(extractChallenge(credentialWithClientData({ type: 'webauthn.get' }))).toBeNull();
    expect(extractChallenge(credentialWithClientData({ challenge: '' }))).toBeNull();
    expect(extractChallenge(credentialWithClientData({ challenge: 123 }))).toBeNull();
  });
});

describe('consumeChallenge', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('returns true when a row was deleted', async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'x' }] } as any);
    await expect(consumeChallenge('login:alice', 'chal')).resolves.toBe(true);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM webauthn_challenges'),
      ['login:alice', 'chal']
    );
  });

  it('returns false when nothing matched (expired, wrong scope, or already used)', async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);
    await expect(consumeChallenge('login:alice', 'chal')).resolves.toBe(false);
  });
});

describe('createChallenge', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedQuery.mockResolvedValue({ rowCount: 0, rows: [] } as any);
  });

  it('cleans up expired rows and inserts the new challenge with an expiry', async () => {
    await createChallenge('registration:alice', 'chal');
    expect(mockedQuery).toHaveBeenCalledWith(
      'DELETE FROM webauthn_challenges WHERE expires_at < NOW()'
    );
    const insertCall = mockedQuery.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO webauthn_challenges')
    );
    expect(insertCall).toBeDefined();
    const [, params] = insertCall!;
    expect(params![0]).toBe('registration:alice');
    expect(params![1]).toBe('chal');
    expect(params![2]).toBeInstanceOf(Date);
    expect((params![2] as Date).getTime()).toBeGreaterThan(Date.now());
  });
});
