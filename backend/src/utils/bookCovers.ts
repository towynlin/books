/**
 * Book cover image utilities using Open Library Covers API
 * API docs: https://covers.openlibrary.org/
 *
 * Two lookup methods:
 * 1. By ISBN:     /b/isbn/{isbn}-{size}.jpg  (synchronous URL generation)
 * 2. By Cover ID: /b/id/{cover_id}-{size}.jpg (needs cover_id from search or Edition API)
 *
 * The Cover ID method has better coverage because Open Library may have
 * a cover image indexed under its internal ID but not by ISBN.
 */

export type CoverSize = 'S' | 'M' | 'L';

/**
 * Generate a book cover URL from ISBN using the Open Library Covers API
 * Prefers ISBN-13 when available as it has better coverage
 */
export function getBookCoverUrl(
  isbn13: string | null,
  isbn: string | null,
  size: CoverSize = 'L'
): string | null {
  const isbnToUse = isbn13 || isbn;

  if (!isbnToUse) {
    return null;
  }

  return `https://covers.openlibrary.org/b/isbn/${isbnToUse}-${size}.jpg`;
}

/**
 * Generate a book cover URL from an Open Library cover ID.
 * Cover IDs come from search results (cover_i field) or the Edition API (covers array).
 */
export function getBookCoverUrlByCoverId(
  coverId: number,
  size: CoverSize = 'L'
): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

interface OpenLibraryEdition {
  covers?: number[];
}

/**
 * Fetch a cover ID from the Open Library Edition API for a given ISBN.
 * This is a fallback for when the ISBN-based cover URL returns a placeholder.
 * Stays entirely within Open Library — no third-party services involved.
 */
export async function fetchOpenLibraryCoverId(
  isbn13: string | null,
  isbn: string | null
): Promise<number | null> {
  const isbnToUse = isbn13 || isbn;

  if (!isbnToUse) {
    return null;
  }

  try {
    const response = await fetch(
      `https://openlibrary.org/isbn/${isbnToUse}.json`
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as OpenLibraryEdition;

    if (!data.covers || data.covers.length === 0) {
      return null;
    }

    // covers array may contain negative IDs (indicating deleted covers); skip those
    const validCover = data.covers.find((id) => id > 0);
    return validCover ?? null;
  } catch {
    return null;
  }
}
