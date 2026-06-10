/**
 * Wikipedia lookups for book enrichment, using Wikimedia (non-profit) APIs:
 *  - REST summary API for article matching + synopsis fallback
 *  - Action API (action=parse) for "Reception" section excerpts
 *
 * Wikipedia text is CC BY-SA licensed; the frontend shows attribution links.
 */

import sanitizeHtml from 'sanitize-html';

const FETCH_TIMEOUT_MS = 8000;

// Wikimedia API etiquette asks for a descriptive User-Agent
const WIKI_HEADERS = {
  'User-Agent': 'books-tracker (self-hosted personal book tracker)',
};

export interface WikipediaArticle {
  pageTitle: string;
  url: string;
  extract: string | null;
}

interface WikipediaSummary {
  type?: string;
  title?: string;
  description?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

/**
 * Accept an article only if it looks like it's about the book and not a
 * film/band/disambiguation page: the summary must be a standard article and
 * mention the author's last name or describe itself as a book.
 */
function validateSummary(summary: WikipediaSummary, author: string): boolean {
  if (summary.type !== 'standard') {
    return false;
  }

  const lastName = author.trim().split(/\s+/).pop()?.toLowerCase();
  const haystack = `${summary.description ?? ''} ${summary.extract ?? ''}`.toLowerCase();

  if (lastName && haystack.includes(lastName)) {
    return true;
  }
  return /\b(novel|novella|book|memoir|nonfiction|non-fiction|biography|autobiography|short story|essay)\b/i.test(
    summary.description ?? ''
  );
}

async function fetchSummary(pageTitle: string): Promise<WikipediaSummary | null> {
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
    { headers: WIKI_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Wikipedia summary lookup failed: ${response.status}`);
  }

  return (await response.json()) as WikipediaSummary;
}

function summaryToArticle(summary: WikipediaSummary): WikipediaArticle {
  const pageTitle = summary.title ?? '';
  return {
    pageTitle,
    url:
      summary.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
    extract: summary.extract?.trim() || null,
  };
}

/**
 * Find the Wikipedia article for a book by trying likely page titles
 * ("Title (novel)", "Title (book)", "Title"), then falling back to a search.
 * Returns null when no confidently-matching article exists.
 */
export async function findWikipediaArticle(
  title: string,
  author: string
): Promise<WikipediaArticle | null> {
  const baseTitles = [title.trim()];
  // Also try the title without a subtitle ("Title: A Subtitle" → "Title")
  const shortTitle = title.split(':')[0].trim();
  if (shortTitle && shortTitle !== baseTitles[0]) {
    baseTitles.push(shortTitle);
  }

  const candidates = baseTitles.flatMap((base) => [
    `${base} (novel)`,
    `${base} (book)`,
    base,
  ]);

  for (const candidate of candidates) {
    const summary = await fetchSummary(candidate);
    if (summary && validateSummary(summary, author)) {
      return summaryToArticle(summary);
    }
  }

  // Fallback: full-text search by title + author, validate top hits
  const searchParams = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: `${title} ${author}`,
    srlimit: '3',
    format: 'json',
  });
  const searchResponse = await fetch(
    `https://en.wikipedia.org/w/api.php?${searchParams}`,
    { headers: WIKI_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  );

  if (!searchResponse.ok) {
    throw new Error(`Wikipedia search failed: ${searchResponse.status}`);
  }

  const searchData = (await searchResponse.json()) as {
    query?: { search?: Array<{ title: string }> };
  };

  for (const result of searchData.query?.search ?? []) {
    const summary = await fetchSummary(result.title);
    if (summary && validateSummary(summary, author)) {
      return summaryToArticle(summary);
    }
  }

  return null;
}

/**
 * Strip HTML to plain text. Tag removal is delegated to sanitize-html;
 * non-prose elements — headings, tables, styling, and <sup>
 * citation markers — are dropped along with their content.
 */
export function stripHtml(html: string): string {
  // Insert a space before each tag so adjacent text doesn't run together
  // when the tags are removed
  let text = sanitizeHtml(html.replace(/</g, ' <'), {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: [
      'style',
      'script',
      'textarea',
      'option',
      'noscript',
      'table',
      'sup',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ],
  });

  // sanitize-html returns text with &, < and > entity-encoded;
  // decode for plain-text storage.
  // The escape character (&) is unescaped last so a pre-encoded
  // sequence like &amp;lt; can't be double-unescaped into <
  text = text
    .replace(/\u00a0/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  // Leftover citation markers and section [edit] links
  text = text.replace(/\[\d+\]/g, '').replace(/\[edit\]/gi, '');

  // Collapse whitespace and drop the spaces that tag-stripping leaves
  // before punctuation
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

const RECEPTION_HEADING = /^(critical\s+)?(reception|response|reviews)$/i;
const MAX_EXCERPT_LENGTH = 1200;

/**
 * Fetch a plain-text excerpt of an article's "Reception" (or similar)
 * section. Returns null when the article has no such section.
 */
export async function fetchReceptionExcerpt(pageTitle: string): Promise<string | null> {
  const sectionsParams = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    prop: 'sections',
    redirects: '1',
    format: 'json',
  });
  const sectionsResponse = await fetch(
    `https://en.wikipedia.org/w/api.php?${sectionsParams}`,
    { headers: WIKI_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  );

  if (!sectionsResponse.ok) {
    throw new Error(`Wikipedia sections lookup failed: ${sectionsResponse.status}`);
  }

  const sectionsData = (await sectionsResponse.json()) as {
    parse?: { sections?: Array<{ line: string; index: string }> };
  };

  const section = sectionsData.parse?.sections?.find((s) =>
    RECEPTION_HEADING.test(stripHtml(s.line))
  );
  if (!section) {
    return null;
  }

  const textParams = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    section: section.index,
    prop: 'text',
    redirects: '1',
    format: 'json',
  });
  const textResponse = await fetch(
    `https://en.wikipedia.org/w/api.php?${textParams}`,
    { headers: WIKI_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  );

  if (!textResponse.ok) {
    throw new Error(`Wikipedia section text lookup failed: ${textResponse.status}`);
  }

  const textData = (await textResponse.json()) as {
    parse?: { text?: { '*': string } };
  };

  const html = textData.parse?.text?.['*'];
  if (!html) {
    return null;
  }

  // stripHtml drops the section's own heading along with other non-prose tags
  let text = stripHtml(html);
  if (!text) {
    return null;
  }

  if (text.length > MAX_EXCERPT_LENGTH) {
    const truncated = text.slice(0, MAX_EXCERPT_LENGTH);
    // Cut at the last sentence boundary to avoid trailing fragments
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('." '),
      truncated.lastIndexOf('.” ')
    );
    text = lastSentenceEnd > 0 ? truncated.slice(0, lastSentenceEnd + 1) : `${truncated}…`;
  }

  return text;
}
