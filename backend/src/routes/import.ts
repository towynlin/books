import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import { prisma } from '../index';
import { BookStatus } from '@prisma/client';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

function parseISBN(isbn: string): string | null {
  if (!isbn || isbn === '=""' || isbn === '=""""""') {
    return null;
  }
  // Remove ="" and quotes
  return isbn.replace(/^=""|"$/g, '').replace(/^"|"$/g, '') || null;
}

function parseDate(dateStr: string): Date | null {
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

function mapStatus(exclusiveShelf: string): BookStatus {
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

function combineNotes(review: string, privateNotes: string): string | null {
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
router.post('/goodreads', upload.single('file'), async (req, res) => {
  try {
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

        const book = await prisma.book.create({
          data: {
            goodreadsId: row['Book Id'] || null,
            title: row['Title'],
            author: row['Author'],
            isbn: parseISBN(row['ISBN']),
            isbn13: parseISBN(row['ISBN13']),
            coverUrl: null, // Will be populated later via API
            status: mapStatus(row['Exclusive Shelf']),
            category: null, // User will categorize manually or use auto-guesser
            dateStarted: null, // User fills in manually
            dateFinished: parseDate(row['Date Read']),
            myRating: myRating && myRating > 0 ? myRating : null,
            notes: combineNotes(row['My Review'], row['Private Notes']),
            nextUpOrder: null,
            publisher: row['Publisher'] || null,
            binding: row['Binding'] || null,
            pages: parseIntOrNull(row['Number of Pages']),
            yearPublished: parseIntOrNull(row['Year Published']),
            originalPublicationYear: parseIntOrNull(row['Original Publication Year']),
            averageRating: parseFloatOrNull(row['Average Rating'])
          }
        });

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
    res.status(500).json({
      error: 'Failed to import Goodreads data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
