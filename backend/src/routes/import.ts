import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getBookCoverUrl } from '../utils/bookCovers';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// Apply authentication to all routes
router.use(authenticate);

// Type for book status
type BookStatus = 'read' | 'reading' | 'want_to_read';

interface GoodreadsRow {
  'Book Id': string;
  'Title': string;
  'Author': string;
  'ISBN': string;
  'ISBN13': string;
  'My Rating': string;
  'Average Rating': string;
  'Publisher': string;
  'Binding': string;
  'Number of Pages': string;
  'Year Published': string;
  'Original Publication Year': string;
  'Date Read': string;
  'Date Added': string;
  'Exclusive Shelf': string;
  'My Review': string;
  'Private Notes': string;
}

export function parseISBN(isbn: string): string | null {
  if (!isbn) {
    return null;
  }
  // Remove = and " characters from Goodreads CSV format (e.g., ="9780679762881")
  const cleaned = isbn.replace(/[="]/g, '').trim();
  return cleaned || null;
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }
  try {
    // Goodreads format: YYYY/MM/DD
    const date = new Date(dateStr.replace(/\//g, '-'));
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function mapStatus(exclusiveShelf: string): BookStatus {
  switch (exclusiveShelf) {
    case 'read':
      return 'read';
    case 'currently-reading':
      return 'reading';
    case 'to-read':
      return 'want_to_read';
    default:
      return 'want_to_read';
  }
}

export function combineNotes(review: string, privateNotes: string): string | null {
  const parts: string[] = [];

  if (review && review.trim()) {
    parts.push(review.trim());
  }

  if (privateNotes && privateNotes.trim()) {
    parts.push(`Private notes: ${privateNotes.trim()}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}

function parseIntOrNull(value: string): number | null {
  if (!value || value.trim() === '') {
    return null;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseFloatOrNull(value: string): number | null {
  if (!value || value.trim() === '') {
    return null;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

// POST /api/import/goodreads - Import Goodreads CSV
router.post('/goodreads', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records: GoodreadsRow[] = [];

    // Parse CSV
    const parser = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    for await (const record of parser) {
      records.push(record as GoodreadsRow);
    }

    // Import books
    const imported: any[] = [];
    const errors: any[] = [];

    for (const row of records) {
      try {
        const myRating = parseIntOrNull(row['My Rating']);
        const isbn = parseISBN(row['ISBN']);
        const isbn13 = parseISBN(row['ISBN13']);
        const coverUrl = getBookCoverUrl(isbn13, isbn);

        const result = await query(
          `INSERT INTO books (
            user_id, goodreads_id, title, author, isbn, isbn13, cover_url, status, category,
            date_started, date_finished, my_rating, notes, next_up_order,
            publisher, binding, pages, year_published, original_publication_year, average_rating
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          RETURNING id, title, author`,
          [
            userId,
            row['Book Id'] || null,
            row['Title'],
            row['Author'],
            isbn,
            isbn13,
            coverUrl,
            mapStatus(row['Exclusive Shelf']),
            null, // category - User will categorize manually or use auto-guesser
            null, // dateStarted - User fills in manually
            parseDate(row['Date Read']),
            myRating && myRating > 0 ? myRating : null,
            combineNotes(row['My Review'], row['Private Notes']),
            null, // nextUpOrder
            row['Publisher'] || null,
            row['Binding'] || null,
            parseIntOrNull(row['Number of Pages']),
            parseIntOrNull(row['Year Published']),
            parseIntOrNull(row['Original Publication Year']),
            parseFloatOrNull(row['Average Rating'])
          ]
        );

        const book = result.rows[0];
        imported.push({
          id: book.id,
          title: book.title,
          author: book.author
        });
      } catch (error) {
        errors.push({
          title: row['Title'],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      imported: imported.length,
      errors: errors.length,
      details: { imported, errors }
    });
  } catch (error) {
    console.error('Error importing Goodreads data:', error);
    res.status(500).json({ error: 'Failed to import Goodreads data' });
  }
});

export default router;
