import { describe, it, expect, vi } from 'vitest';
import { parseISBN, parseDate, mapStatus, combineNotes } from '../routes/import';
import { getBookCoverUrl, fetchGoogleBooksCoverUrl } from '../utils/bookCovers';

describe('parseISBN', () => {
  it('handles Goodreads CSV format with = and quotes', () => {
    expect(parseISBN('="9780679762881"')).toBe('9780679762881');
  });

  it('handles plain ISBN', () => {
    expect(parseISBN('9780679762881')).toBe('9780679762881');
  });

  it('returns null for empty string', () => {
    expect(parseISBN('')).toBeNull();
  });

  it('handles whitespace', () => {
    expect(parseISBN('  9780679762881  ')).toBe('9780679762881');
  });
});

describe('parseDate', () => {
  it('parses Goodreads date format YYYY/MM/DD', () => {
    const result = parseDate('2023/06/15');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getUTCFullYear()).toBe(2023);
    expect(result?.getUTCMonth()).toBe(5); // 0-indexed
    expect(result?.getUTCDate()).toBe(15);
  });

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
  });

  it('returns null for whitespace', () => {
    expect(parseDate('   ')).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });
});

describe('mapStatus', () => {
  it('maps "read" to "read"', () => {
    expect(mapStatus('read')).toBe('read');
  });

  it('maps "currently-reading" to "reading"', () => {
    expect(mapStatus('currently-reading')).toBe('reading');
  });

  it('maps "to-read" to "want_to_read"', () => {
    expect(mapStatus('to-read')).toBe('want_to_read');
  });

  it('defaults unknown status to "want_to_read"', () => {
    expect(mapStatus('some-custom-shelf')).toBe('want_to_read');
  });
});

describe('combineNotes', () => {
  it('combines review and private notes', () => {
    const result = combineNotes('Great book!', 'My secret thoughts');
    expect(result).toBe('Great book!\n\nPrivate notes: My secret thoughts');
  });

  it('returns just review if no private notes', () => {
    expect(combineNotes('Great book!', '')).toBe('Great book!');
  });

  it('returns just private notes if no review', () => {
    expect(combineNotes('', 'My notes')).toBe('Private notes: My notes');
  });

  it('returns null if both empty', () => {
    expect(combineNotes('', '')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(combineNotes('  Review  ', '  Notes  ')).toBe('Review\n\nPrivate notes: Notes');
  });
});

describe('getBookCoverUrl', () => {
  it('prefers ISBN-13 when available', () => {
    const url = getBookCoverUrl('9780679762881', '0679762884');
    expect(url).toBe('https://covers.openlibrary.org/b/isbn/9780679762881-L.jpg');
  });

  it('falls back to ISBN-10 when ISBN-13 is null', () => {
    const url = getBookCoverUrl(null, '0679762884');
    expect(url).toBe('https://covers.openlibrary.org/b/isbn/0679762884-L.jpg');
  });

  it('returns null when both ISBNs are null', () => {
    expect(getBookCoverUrl(null, null)).toBeNull();
  });

  it('respects size parameter', () => {
    const url = getBookCoverUrl('9780679762881', null, 'S');
    expect(url).toBe('https://covers.openlibrary.org/b/isbn/9780679762881-S.jpg');
  });
});

describe('fetchGoogleBooksCoverUrl', () => {
  it('returns null when both ISBNs are null', async () => {
    expect(await fetchGoogleBooksCoverUrl(null, null)).toBeNull();
  });

  it('prefers ISBN-13 when available', async () => {
    const mockResponse = {
      totalItems: 1,
      items: [{
        volumeInfo: {
          imageLinks: {
            thumbnail: 'http://books.google.com/books/content?id=abc123&printsec=frontcover&img=1&zoom=1',
          },
        },
      }],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const url = await fetchGoogleBooksCoverUrl('9780679762881', '0679762884');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('isbn:9780679762881')
    );
    expect(url).toBe('https://books.google.com/books/content?id=abc123&printsec=frontcover&img=1&zoom=0');

    vi.restoreAllMocks();
  });

  it('falls back to ISBN-10 when ISBN-13 is null', async () => {
    const mockResponse = {
      totalItems: 1,
      items: [{
        volumeInfo: {
          imageLinks: {
            thumbnail: 'http://books.google.com/books/content?id=xyz789&printsec=frontcover&img=1&zoom=1',
          },
        },
      }],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const url = await fetchGoogleBooksCoverUrl(null, '0679762884');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('isbn:0679762884')
    );
    expect(url).toBe('https://books.google.com/books/content?id=xyz789&printsec=frontcover&img=1&zoom=0');

    vi.restoreAllMocks();
  });

  it('returns null when API returns no items', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ totalItems: 0 }),
    } as Response);

    expect(await fetchGoogleBooksCoverUrl('9780000000000', null)).toBeNull();

    vi.restoreAllMocks();
  });

  it('returns null when API returns item without imageLinks', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        totalItems: 1,
        items: [{ volumeInfo: {} }],
      }),
    } as Response);

    expect(await fetchGoogleBooksCoverUrl('9780000000000', null)).toBeNull();

    vi.restoreAllMocks();
  });

  it('returns null when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    expect(await fetchGoogleBooksCoverUrl('9780679762881', null)).toBeNull();

    vi.restoreAllMocks();
  });

  it('returns null when API returns non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
    } as Response);

    expect(await fetchGoogleBooksCoverUrl('9780679762881', null)).toBeNull();

    vi.restoreAllMocks();
  });

  it('upgrades HTTP to HTTPS in thumbnail URL', async () => {
    const mockResponse = {
      totalItems: 1,
      items: [{
        volumeInfo: {
          imageLinks: {
            thumbnail: 'http://books.google.com/books/content?id=test&zoom=1',
          },
        },
      }],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const url = await fetchGoogleBooksCoverUrl('9780679762881', null);
    expect(url).toMatch(/^https:\/\//);

    vi.restoreAllMocks();
  });
});
