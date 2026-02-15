/**
 * Book cover image utilities using Open Library Covers API and Google Books API
 * Open Library docs: https://covers.openlibrary.org/
 * Google Books docs: https://developers.google.com/books/docs/v1/using
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

interface GoogleBooksResponse {
  totalItems: number;
  items?: Array<{
    volumeInfo: {
      imageLinks?: {
        smallThumbnail?: string;
        thumbnail?: string;
      };
    };
  }>;
}

/**
 * Fetch a book cover URL from the Google Books API.
 * Used as a fallback when Open Library doesn't have a cover.
 *
 * @param isbn13 - ISBN-13 identifier (preferred)
 * @param isbn - ISBN-10 identifier (fallback)
 * @returns Cover URL or null if not found
 */
export async function fetchGoogleBooksCoverUrl(
  isbn13: string | null,
  isbn: string | null
): Promise<string | null> {
  const isbnToUse = isbn13 || isbn;

  if (!isbnToUse) {
    return null;
  }

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbnToUse}&fields=items(volumeInfo/imageLinks)`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GoogleBooksResponse;

    if (!data.items || data.items.length === 0) {
      return null;
    }

    const imageLinks = data.items[0].volumeInfo.imageLinks;
    if (!imageLinks?.thumbnail) {
      return null;
    }

    // Upgrade to HTTPS and request a larger image (zoom=0 instead of zoom=1)
    return imageLinks.thumbnail
      .replace('http://', 'https://')
      .replace('zoom=1', 'zoom=0');
  } catch {
    return null;
  }
}
