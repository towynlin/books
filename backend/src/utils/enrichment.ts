/**
 * Book enrichment: fetches and caches a plot synopsis (Open Library, with a
 * Wikipedia fallback), a Wikipedia "Reception" excerpt, and NYT critic
 * reviews for a book. All lookups happen server-side and results are stored
 * on the books row, so each external source is contacted at most once per
 * book (a fetched_at stamp with a NULL value means "nothing found — don't
 * retry"; transient errors leave the stamp unset so the lookup retries on
 * the next visit).
 */

import { query } from '../db';
import { fetchOpenLibraryDescription } from './openLibrary';
import { findWikipediaArticle, fetchReceptionExcerpt, WikipediaArticle } from './wikipedia';
import { fetchNytReviews } from './nytBooks';

interface EnrichableBook {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  isbn13: string | null;
  description_fetched_at: Date | null;
  wikipedia_fetched_at: Date | null;
  nyt_fetched_at: Date | null;
}

/**
 * Enrich a book in place and return the updated row (or the current row when
 * everything is already cached). Each source group fails independently.
 */
export async function enrichBook(
  bookId: string,
  userId: string,
  force = false
): Promise<Record<string, unknown> | null> {
  const bookResult = await query('SELECT * FROM books WHERE id = $1 AND user_id = $2', [
    bookId,
    userId,
  ]);

  if (bookResult.rows.length === 0) {
    return null;
  }

  const book = bookResult.rows[0] as EnrichableBook;
  const updates: Record<string, unknown> = {};

  // The Wikipedia article lookup is shared between the synopsis fallback and
  // the reception excerpt; memoize so it runs at most once per enrichment.
  let wikiArticlePromise: Promise<WikipediaArticle | null> | null = null;
  const getWikiArticle = () =>
    (wikiArticlePromise ??= findWikipediaArticle(book.title, book.author));

  const fetchDescription = async () => {
    if (book.description_fetched_at && !force) {
      return;
    }

    const olResult = await fetchOpenLibraryDescription(book.isbn13, book.isbn);
    if (olResult) {
      updates.description = olResult.description;
      updates.description_source = 'openlibrary';
      updates.description_url = olResult.workUrl;
    } else {
      const article = await getWikiArticle();
      if (article?.extract) {
        updates.description = article.extract;
        updates.description_source = 'wikipedia';
        updates.description_url = article.url;
      }
    }
    updates.description_fetched_at = new Date();
  };

  const fetchReception = async () => {
    if (book.wikipedia_fetched_at && !force) {
      return;
    }

    const article = await getWikiArticle();
    if (article) {
      updates.wikipedia_url = article.url;
      updates.wikipedia_reception = await fetchReceptionExcerpt(article.pageTitle);
    }
    updates.wikipedia_fetched_at = new Date();
  };

  const fetchNyt = async () => {
    if (book.nyt_fetched_at && !force) {
      return;
    }

    const reviews = await fetchNytReviews(book.isbn13, book.isbn);
    // null means unconfigured (no API key) or no ISBN — leave the stamp
    // unset so the lookup happens automatically once a key is configured
    if (reviews !== null) {
      updates.nyt_reviews = JSON.stringify(reviews);
      updates.nyt_fetched_at = new Date();
    }
  };

  const results = await Promise.allSettled([
    fetchDescription(),
    fetchReception(),
    fetchNyt(),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Enrichment source failed:', result.reason);
    }
  }

  if (Object.keys(updates).length === 0) {
    return bookResult.rows[0];
  }

  const columns = Object.keys(updates);
  const setClauses = columns.map((column, i) => `${column} = $${i + 1}`);
  const params = [...Object.values(updates), bookId, userId];

  const updateResult = await query(
    `UPDATE books
     SET ${setClauses.join(', ')}
     WHERE id = $${columns.length + 1} AND user_id = $${columns.length + 2}
     RETURNING *`,
    params
  );

  return updateResult.rows[0] ?? null;
}
