/**
 * Book cover image utilities using Open Library Covers API
 * API docs: https://covers.openlibrary.org/
 */

export type CoverSize = 'S' | 'M' | 'L';

/**
 * Generate a book cover URL from ISBN using the Open Library Covers API
 * Prefers ISBN-13 when available as it has better coverage
 *
 * @param isbn13 - ISBN-13 identifier (preferred)
 * @param isbn - ISBN-10 identifier (fallback)
 * @param size - Cover size: 'S' (small), 'M' (medium), 'L' (large)
 * @returns Cover URL or null if no ISBN available
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
