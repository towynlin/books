import { describe, it, expect, vi, beforeEach } from 'vitest';
import { object } from 'zod';

describe('OPEN_LIBRARY_HEADERS', () => {
    beforeEach(() => { vi.stubEnv('USER_AGENT_CONTACT', 'https://example.com; lars@example.com'); });

    it('incorporates the USER_AGENT_CONTACT env var', async () => {
        expect(process.env.USER_AGENT_CONTACT).toBeDefined();
        expect(process.env.USER_AGENT_CONTACT).not.toBeNull();
        expect(process.env.USER_AGENT_CONTACT).not.toEqual('');

        const { OPEN_LIBRARY_HEADERS } = await import('../utils/openLibraryHeaders.js');
        expect(OPEN_LIBRARY_HEADERS).toBeDefined();
        expect(OPEN_LIBRARY_HEADERS).toBeTypeOf('object');
        expect(OPEN_LIBRARY_HEADERS['User-Agent']).toBeDefined();
        expect(OPEN_LIBRARY_HEADERS['User-Agent']).toContain(process.env.USER_AGENT_CONTACT);
    });
});