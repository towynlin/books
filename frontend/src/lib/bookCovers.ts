/**
 * Book cover image utilities using Open Library Covers API
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
