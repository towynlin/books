import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeOLDescription, fetchOpenLibraryDescription } from '../utils/openLibrary';
import { findWikipediaArticle, stripHtml } from '../utils/wikipedia';
import { fetchNytReviews } from '../utils/nytBooks';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('normalizeOLDescription', () => {
  it('handles plain string descriptions', () => {
    expect(normalizeOLDescription('A great book.')).toBe('A great book.');
  });

  it('handles {type, value} object descriptions', () => {
    expect(
      normalizeOLDescription({ type: '/type/text', value: 'A great book.' })
    ).toBe('A great book.');
  });

  it('returns null for undefined', () => {
    expect(normalizeOLDescription(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeOLDescription('')).toBeNull();
  });

  it('strips markdown separator noise and link references', () => {
    const raw =
      'The story of a hobbit.\n----------\n[1]: https://example.com';
    expect(normalizeOLDescription(raw)).toBe('The story of a hobbit.');
  });

  it('converts inline reference links to their text', () => {
    expect(normalizeOLDescription('See [the source][1] for more.')).toBe(
      'See the source for more.'
    );
  });
});

describe('fetchOpenLibraryDescription', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when no ISBN is available', async () => {
    expect(await fetchOpenLibraryDescription(null, null)).toBeNull();
  });

  it('uses the edition description when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          description: 'Edition-level description.',
          works: [{ key: '/works/OL1W' }],
        })
      )
    );

    const result = await fetchOpenLibraryDescription('9780000000001', null);
    expect(result).toEqual({
      description: 'Edition-level description.',
      workUrl: 'https://openlibrary.org/works/OL1W',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the work description', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ works: [{ key: '/works/OL1W' }] }))
        .mockResolvedValueOnce(
          jsonResponse({ description: { type: '/type/text', value: 'Work-level description.' } })
        )
    );

    const result = await fetchOpenLibraryDescription('9780000000001', null);
    expect(result).toEqual({
      description: 'Work-level description.',
      workUrl: 'https://openlibrary.org/works/OL1W',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://openlibrary.org/works/OL1W.json',
      expect.anything()
    );
  });

  it('returns null when neither edition nor work has a description', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ works: [{ key: '/works/OL1W' }] }))
        .mockResolvedValueOnce(jsonResponse({ title: 'No description here' }))
    );

    expect(await fetchOpenLibraryDescription('9780000000001', null)).toBeNull();
  });

  it('returns null for an unknown ISBN (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 404)));
    expect(await fetchOpenLibraryDescription('9780000000001', null)).toBeNull();
  });

  it('throws on server errors so callers can retry later', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    await expect(fetchOpenLibraryDescription('9780000000001', null)).rejects.toThrow();
  });
});

describe('findWikipediaArticle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const hobbitSummary = {
    type: 'standard',
    title: 'The Hobbit',
    description: '1937 fantasy novel by J. R. R. Tolkien',
    extract: 'The Hobbit is a children’s fantasy novel by J. R. R. Tolkien.',
    content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/The_Hobbit' } },
  };

  it('prefers the "(novel)" candidate when it validates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ ...hobbitSummary, title: 'The Hobbit (novel)' }))
    );

    const result = await findWikipediaArticle('The Hobbit', 'J. R. R. Tolkien');
    expect(result?.pageTitle).toBe('The Hobbit (novel)');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('The%20Hobbit%20(novel)');
  });

  it('rejects disambiguation pages and falls through to later candidates', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ type: 'disambiguation', title: 'The Hobbit (novel)' }))
        .mockResolvedValueOnce(jsonResponse({}, 404))
        .mockResolvedValueOnce(jsonResponse(hobbitSummary))
    );

    const result = await findWikipediaArticle('The Hobbit', 'J. R. R. Tolkien');
    expect(result?.pageTitle).toBe('The Hobbit');
    expect(result?.url).toBe('https://en.wikipedia.org/wiki/The_Hobbit');
  });

  it('rejects articles about a different subject (e.g., a film)', async () => {
    const filmSummary = {
      type: 'standard',
      title: 'Solaris',
      description: '1972 Soviet science fiction film',
      extract: 'Solaris is a 1972 film directed by Andrei Tarkovsky.',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // candidate summaries: (novel), (book), plain title
        .mockResolvedValueOnce(jsonResponse({}, 404))
        .mockResolvedValueOnce(jsonResponse({}, 404))
        .mockResolvedValueOnce(jsonResponse(filmSummary))
        // search fallback returns no results
        .mockResolvedValueOnce(jsonResponse({ query: { search: [] } }))
    );

    // Author "Stanisław Lem" does not appear in the film summary
    const result = await findWikipediaArticle('Solaris', 'Stanisław Lem');
    expect(result).toBeNull();
  });

  it('falls back to search and validates the hits', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}, 404))
        .mockResolvedValueOnce(jsonResponse({}, 404))
        .mockResolvedValueOnce(jsonResponse({}, 404))
        .mockResolvedValueOnce(
          jsonResponse({ query: { search: [{ title: 'The Hobbit' }] } })
        )
        .mockResolvedValueOnce(jsonResponse(hobbitSummary))
    );

    const result = await findWikipediaArticle('Hobbit', 'J. R. R. Tolkien');
    expect(result?.pageTitle).toBe('The Hobbit');
  });
});

describe('stripHtml', () => {
  it('removes tags, citations, and collapses whitespace', () => {
    const html =
      '<p>Critics <b>praised</b> the book.<sup id="cite_ref-1"><a href="#">[1]</a></sup>\n' +
      'It was a <i>bestseller</i>.</p>';
    expect(stripHtml(html)).toBe('Critics praised the book. It was a bestseller.');
  });

  it('removes style and table blocks', () => {
    const html = '<style>.a{color:red}</style><table><tr><td>cells</td></tr></table><p>Text.</p>';
    expect(stripHtml(html)).toBe('Text.');
  });

  it('decodes common entities', () => {
    expect(stripHtml('Praise &amp; criticism &quot;abounded&quot;')).toBe(
      'Praise & criticism "abounded"'
    );
  });
});

describe('fetchNytReviews', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns null when NYT_API_KEY is unset', async () => {
    vi.stubEnv('NYT_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchNytReviews('9780000000001', null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when the book has no ISBN', async () => {
    vi.stubEnv('NYT_API_KEY', 'test-key');
    expect(await fetchNytReviews(null, null)).toBeNull();
  });

  it('maps results to review objects', async () => {
    vi.stubEnv('NYT_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          num_results: 1,
          results: [
            {
              url: 'https://www.nytimes.com/review',
              byline: 'JANET MASLIN',
              summary: 'A sweeping epic.',
              publication_dt: '2020-01-15',
            },
          ],
        })
      )
    );

    expect(await fetchNytReviews('9780000000001', null)).toEqual([
      {
        url: 'https://www.nytimes.com/review',
        byline: 'JANET MASLIN',
        summary: 'A sweeping epic.',
        publication_dt: '2020-01-15',
      },
    ]);
  });

  it('returns an empty array when there are no reviews', async () => {
    vi.stubEnv('NYT_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ num_results: 0, results: [] }))
    );

    expect(await fetchNytReviews('9780000000001', null)).toEqual([]);
  });

  it('throws on server errors so callers can retry later', async () => {
    vi.stubEnv('NYT_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));

    await expect(fetchNytReviews('9780000000001', null)).rejects.toThrow();
  });
});
