/**
 * Professional critic reviews via the New York Times Books API
 * API docs: https://developer.nytimes.com/docs/books-product/1/overview
 *
 * Requires an optional NYT_API_KEY (free tier: 500 requests/day). Results
 * are cached in the database so each book is looked up at most once. The
 * call is made server-side only — the browser never contacts the NYT.
 */

const FETCH_TIMEOUT_MS = 8000;

export interface NytReview {
  url: string;
  byline: string;
  summary: string;
  // snake_case is kept so the frontend's key transformer camelizes it
  publication_dt: string | null;
}

interface NytReviewsResponse {
  num_results?: number;
  results?: Array<{
    url?: string;
    byline?: string;
    summary?: string;
    publication_dt?: string;
  }>;
}

/**
 * Fetch NYT reviews for a book by ISBN.
 * Returns null when the feature is unconfigured (no NYT_API_KEY) or the book
 * has no ISBN — callers should not cache that as "no reviews". Returns []
 * when the NYT has no reviews for the book ("confirmed absent").
 */
export async function fetchNytReviews(
  isbn13: string | null,
  isbn: string | null
): Promise<NytReview[] | null> {
  const apiKey = process.env.NYT_API_KEY;
  const isbnToUse = isbn13 || isbn;

  if (!apiKey || !isbnToUse) {
    return null;
  }

  const params = new URLSearchParams({ isbn: isbnToUse, 'api-key': apiKey });
  const response = await fetch(
    `https://api.nytimes.com/svc/books/v3/reviews.json?${params}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  );

  if (!response.ok) {
    throw new Error(`NYT Books API lookup failed: ${response.status}`);
  }

  const data = (await response.json()) as NytReviewsResponse;

  if (!data.results || data.num_results === 0) {
    return [];
  }

  return data.results
    .filter((result) => result.url)
    .map((result) => ({
      url: result.url!,
      byline: result.byline ?? '',
      summary: result.summary ?? '',
      publication_dt: result.publication_dt ?? null,
    }));
}
