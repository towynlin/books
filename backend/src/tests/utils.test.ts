import { describe, it, expect, vi } from 'vitest';
import { parseISBN, parseDate, mapStatus, combineNotes } from '../routes/import';
import { getBookCoverUrl, getBookCoverUrlByCoverId, fetchOpenLibraryCoverId } from '../utils/bookCovers';

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

describe('getBookCoverUrlByCoverId', () => {
  it('generates correct URL with default size', () => {
    const url = getBookCoverUrlByCoverId(8739161);
    expect(url).toBe('https://covers.openlibrary.org/b/id/8739161-L.jpg');
  });

  it('respects size parameter', () => {
    const url = getBookCoverUrlByCoverId(8739161, 'S');
    expect(url).toBe('https://covers.openlibrary.org/b/id/8739161-S.jpg');
  });
});

describe('fetchOpenLibraryCoverId', () => {
  it('returns null when both ISBNs are null', async () => {
    expect(await fetchOpenLibraryCoverId(null, null)).toBeNull();
  });

  it('returns first valid cover ID from edition API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ covers: [8739161, 1234567] }),
    } as Response);

    const coverId = await fetchOpenLibraryCoverId('9780140328721', null);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openlibrary.org/isbn/9780140328721.json'
    );
    expect(coverId).toBe(8739161);

    vi.restoreAllMocks();
  });

  it('prefers ISBN-13 over ISBN-10', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ covers: [111] }),
    } as Response);

    await fetchOpenLibraryCoverId('9780140328721', '0140328726');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openlibrary.org/isbn/9780140328721.json'
    );

    vi.restoreAllMocks();
  });

  it('falls back to ISBN-10 when ISBN-13 is null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ covers: [222] }),
    } as Response);

    await fetchOpenLibraryCoverId(null, '0140328726');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openlibrary.org/isbn/0140328726.json'
    );

    vi.restoreAllMocks();
  });

  it('skips negative cover IDs (deleted covers)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ covers: [-1, -5, 8739161] }),
    } as Response);

    const coverId = await fetchOpenLibraryCoverId('9780140328721', null);
    expect(coverId).toBe(8739161);

    vi.restoreAllMocks();
  });

  it('returns null when all cover IDs are negative', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ covers: [-1, -5] }),
    } as Response);

    expect(await fetchOpenLibraryCoverId('9780140328721', null)).toBeNull();

    vi.restoreAllMocks();
  });

  it('returns null when covers array is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ covers: [] }),
    } as Response);

    expect(await fetchOpenLibraryCoverId('9780140328721', null)).toBeNull();

    vi.restoreAllMocks();
  });

  it('returns null when edition has no covers field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isbn_13: ['9780140328721'] }),
    } as Response);

    expect(await fetchOpenLibraryCoverId('9780140328721', null)).toBeNull();

    vi.restoreAllMocks();
  });

  it('returns null when API returns non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    expect(await fetchOpenLibraryCoverId('9780000000000', null)).toBeNull();

    vi.restoreAllMocks();
  });

  it('returns null when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    expect(await fetchOpenLibraryCoverId('9780140328721', null)).toBeNull();

    vi.restoreAllMocks();
  });
});
