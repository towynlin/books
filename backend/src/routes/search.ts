import express from 'express';
import { authenticate } from '../middleware/auth';
import { getBookCoverUrl } from '../utils/bookCovers';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  cover_edition_key?: string;
}

interface OpenLibraryResponse {
  numFound: number;
  start: number;
  docs: OpenLibraryDoc[];
}

interface SearchResult {
  id: string;
  title: string;
  author: string;
  year?: number;
  isbn?: string;
  isbn13?: string;
  coverUrl?: string;
  publisher?: string;
  pages?: number;
}

// GET /api/search?q=query - Search for books using Open Library API
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Call Open Library Search API
    const searchUrl = new URL('https://openlibrary.org/search.json');
    searchUrl.searchParams.append('q', q.trim());
    searchUrl.searchParams.append('limit', '10');
    searchUrl.searchParams.append('fields', 'key,title,author_name,first_publish_year,isbn,publisher,number_of_pages_median,cover_i,cover_edition_key');

    const response = await fetch(searchUrl.toString());

    if (!response.ok) {
      throw new Error(`Open Library API returned ${response.status}`);
    }

    const data: OpenLibraryResponse = await response.json();

    // Transform Open Library results to our format
    const results: SearchResult[] = data.docs.map((doc) => {
      // Get ISBN (prefer ISBN-13 if available)
      let isbn: string | undefined;
      let isbn13: string | undefined;

      if (doc.isbn && doc.isbn.length > 0) {
        // Find ISBN-13 (13 characters) and ISBN-10 (10 characters)
        const isbn13List = doc.isbn.filter(i => i.length === 13);
        const isbn10List = doc.isbn.filter(i => i.length === 10);

        isbn13 = isbn13List[0];
        isbn = isbn10List[0] || isbn13List[0];
      }

      // Generate cover URL using our existing utility
      let coverUrl: string | undefined;
      if (isbn13 || isbn) {
        coverUrl = getBookCoverUrl(isbn13 || null, isbn || null) || undefined;
      }

      return {
        id: doc.key, // e.g., "/works/OL45804W"
        title: doc.title,
        author: doc.author_name?.[0] || 'Unknown Author',
        year: doc.first_publish_year,
        isbn,
        isbn13,
        coverUrl,
        publisher: doc.publisher?.[0],
        pages: doc.number_of_pages_median,
      };
    });

    res.json({
      total: data.numFound,
      results,
    });
  } catch (error) {
    console.error('Error searching books:', error);
    res.status(500).json({ error: 'Failed to search books' });
  }
});

export default router;
