/**
 * Book description (synopsis) lookup using the Open Library API
 * API docs: https://openlibrary.org/developers/api
 *
 * Lookup chain: ISBN → Edition API → work key → Works API → description.
 * Stays entirely within Open Library — no third-party services involved.
 */

const FETCH_TIMEOUT_MS = 8000;

// Open Library API etiquette asks for a descriptive User-Agent
const OPEN_LIBRARY_HEADERS = {
  'User-Agent': 'books-tracker (self-hosted personal book tracker)',
};

interface OpenLibraryDescription {
  type?: string;
  value: string;
}

interface OpenLibraryEdition {
  description?: string | OpenLibraryDescription;
  works?: Array<{ key: string }>;
}

interface OpenLibraryWork {
  description?: string | OpenLibraryDescription;
}

/**
 * Open Library descriptions are either a plain string or a {type, value}
 * object. Some also carry trailing markdown noise (horizontal-rule
 * separators followed by link references) that we strip.
 */
export function normalizeOLDescription(
  description: string | OpenLibraryDescription | undefined
): string | null {
  if (!description) {
    return null;
  }

  let text = typeof description === 'string' ? description : description.value;
  if (!text) {
    return null;
  }

  // Cut at markdown horizontal-rule separators (used before source link lists)
  text = text.split(/\n-{4,}/)[0];
  // Drop markdown link reference definitions like "[1]: https://..."
  text = text.replace(/^\s*\[\d+\]:\s+\S+.*$/gm, '');
  // Convert inline reference links "[source][1]" to their text
  text = text.replace(/\[([^\]]+)\]\[\d+\]/g, '$1');

  text = text.trim();
  return text || null;
}

/**
 * Fetch a book description from Open Library by ISBN.
 * Tries the edition record first, then falls back to its work record.
 *
 * Returns null when Open Library has no description for the book ("confirmed
 * absent"); throws on network errors and unexpected responses so callers can
 * retry later.
 */
export async function fetchOpenLibraryDescription(
  isbn13: string | null,
  isbn: string | null
): Promise<{ description: string; workUrl: string } | null> {
  const isbnToUse = isbn13 || isbn;

  if (!isbnToUse) {
    return null;
  }

  const editionResponse = await fetch(
    `https://openlibrary.org/isbn/${isbnToUse}.json`,
    { headers: OPEN_LIBRARY_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  );

  if (editionResponse.status === 404) {
    return null;
  }
  if (!editionResponse.ok) {
    throw new Error(`Open Library edition lookup failed: ${editionResponse.status}`);
  }

  const edition = (await editionResponse.json()) as OpenLibraryEdition;
  const workKey = edition.works?.[0]?.key ?? null;
  const workUrl = workKey
    ? `https://openlibrary.org${workKey}`
    : `https://openlibrary.org/isbn/${isbnToUse}`;

  const editionDescription = normalizeOLDescription(edition.description);
  if (editionDescription) {
    return { description: editionDescription, workUrl };
  }

  if (!workKey) {
    return null;
  }

  const workResponse = await fetch(`https://openlibrary.org${workKey}.json`, {
    headers: OPEN_LIBRARY_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (workResponse.status === 404) {
    return null;
  }
  if (!workResponse.ok) {
    throw new Error(`Open Library work lookup failed: ${workResponse.status}`);
  }

  const work = (await workResponse.json()) as OpenLibraryWork;
  const workDescription = normalizeOLDescription(work.description);

  return workDescription ? { description: workDescription, workUrl } : null;
}
