import express from 'express';
import { z } from 'zod';
import { query, getClient } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getBookCoverUrl } from '../utils/bookCovers';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Type for book status
type BookStatus = 'read' | 'reading' | 'want_to_read';
type BookCategory = 'fiction' | 'nonfiction';

// Validation schemas
const createBookSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  status: z.enum(['read', 'reading', 'want_to_read']),
  category: z.enum(['fiction', 'nonfiction']).nullable().optional(),
  isbn: z.string().nullable().optional(),
  isbn13: z.string().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  dateStarted: z.string().datetime().nullable().optional(),
  dateFinished: z.string().datetime().nullable().optional(),
  myRating: z.number().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  nextUpOrder: z.number().nullable().optional(),
});

const updateBookSchema = createBookSchema.partial();

// GET /api/books - List all books with optional filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status, category, nextUp } = req.query;

    const conditions: string[] = [`user_id = $1`];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (nextUp === 'true') {
      conditions.push('next_up_order IS NOT NULL');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const sql = `
      SELECT * FROM books
      ${whereClause}
      ORDER BY next_up_order ASC NULLS LAST, date_added DESC
    `;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// GET /api/books/:id - Get single book
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const result = await query('SELECT * FROM books WHERE id = $1 AND user_id = $2', [req.params.id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// POST /api/books - Create new book
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const data = createBookSchema.parse(req.body);

    const result = await query(
      `INSERT INTO books (
        user_id, title, author, status, category, isbn, isbn13, cover_url,
        date_started, date_finished, my_rating, notes, next_up_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        userId,
        data.title,
        data.author,
        data.status,
        data.category || null,
        data.isbn || null,
        data.isbn13 || null,
        data.coverUrl || null,
        data.dateStarted ? new Date(data.dateStarted) : null,
        data.dateFinished ? new Date(data.dateFinished) : null,
        data.myRating || null,
        data.notes || null,
        data.nextUpOrder || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating book:', error);
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// PATCH /api/books/:id - Update book
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const data = updateBookSchema.parse(req.body);

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      params.push(data.title);
    }
    if (data.author !== undefined) {
      setClauses.push(`author = $${paramIndex++}`);
      params.push(data.author);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }
    if (data.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      params.push(data.category);
    }
    if (data.isbn !== undefined) {
      setClauses.push(`isbn = $${paramIndex++}`);
      params.push(data.isbn);
    }
    if (data.isbn13 !== undefined) {
      setClauses.push(`isbn13 = $${paramIndex++}`);
      params.push(data.isbn13);
    }
    if (data.coverUrl !== undefined) {
      setClauses.push(`cover_url = $${paramIndex++}`);
      params.push(data.coverUrl);
    }
    if (data.dateStarted !== undefined) {
      setClauses.push(`date_started = $${paramIndex++}`);
      params.push(data.dateStarted ? new Date(data.dateStarted) : null);
    }
    if (data.dateFinished !== undefined) {
      setClauses.push(`date_finished = $${paramIndex++}`);
      params.push(data.dateFinished ? new Date(data.dateFinished) : null);
    }
    if (data.myRating !== undefined) {
      setClauses.push(`my_rating = $${paramIndex++}`);
      params.push(data.myRating);
    }
    if (data.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      params.push(data.notes);
    }
    if (data.nextUpOrder !== undefined) {
      setClauses.push(`next_up_order = $${paramIndex++}`);
      params.push(data.nextUpOrder);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    params.push(userId);

    const sql = `
      UPDATE books
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error updating book:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// DELETE /api/books/:id - Delete book
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const result = await query('DELETE FROM books WHERE id = $1 AND user_id = $2', [req.params.id, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// POST /api/books/:id/add-to-next-up - Add book to next-up list
router.post('/:id/add-to-next-up', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get the current max next_up_order for this user's books
    const maxOrderResult = await query(
      'SELECT COALESCE(MAX(next_up_order), -1) as max_order FROM books WHERE next_up_order IS NOT NULL AND user_id = $1',
      [userId]
    );
    const nextOrder = maxOrderResult.rows[0].max_order + 1;

    // Update the book with the new order (only if it belongs to this user)
    const result = await query(
      'UPDATE books SET next_up_order = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [nextOrder, req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding book to next-up:', error);
    res.status(500).json({ error: 'Failed to add book to next-up list' });
  }
});

// POST /api/books/:id/remove-from-next-up - Remove book from next-up list
router.post('/:id/remove-from-next-up', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get the book's current order (only if it belongs to this user)
    const bookResult = await query(
      'SELECT next_up_order FROM books WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (bookResult.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const removedOrder = bookResult.rows[0].next_up_order;

    // Use transaction to update orders
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Remove from next-up list
      await client.query(
        'UPDATE books SET next_up_order = NULL WHERE id = $1 AND user_id = $2',
        [req.params.id, userId]
      );

      // Reorder remaining books for this user (decrement orders greater than the removed one)
      if (removedOrder !== null) {
        await client.query(
          'UPDATE books SET next_up_order = next_up_order - 1 WHERE next_up_order > $1 AND user_id = $2',
          [removedOrder, userId]
        );
      }

      await client.query('COMMIT');

      // Fetch and return updated book
      const result = await query('SELECT * FROM books WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error removing book from next-up:', error);
    res.status(500).json({ error: 'Failed to remove book from next-up list' });
  }
});

// POST /api/books/populate-covers - Populate cover URLs for books missing them
router.post('/populate-covers', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Find books with ISBN but no cover URL for this user
    const booksResult = await query(
      `SELECT id, isbn, isbn13 FROM books
       WHERE cover_url IS NULL
       AND (isbn IS NOT NULL OR isbn13 IS NOT NULL)
       AND user_id = $1`,
      [userId]
    );

    const updated: string[] = [];

    for (const book of booksResult.rows) {
      const coverUrl = getBookCoverUrl(book.isbn13, book.isbn);
      if (coverUrl) {
        await query(
          'UPDATE books SET cover_url = $1 WHERE id = $2 AND user_id = $3',
          [coverUrl, book.id, userId]
        );
        updated.push(book.id);
      }
    }

    res.json({
      success: true,
      updated: updated.length,
      message: `Populated cover URLs for ${updated.length} books`
    });
  } catch (error) {
    console.error('Error populating covers:', error);
    res.status(500).json({ error: 'Failed to populate cover URLs' });
  }
});

// POST /api/books/reorder-next-up - Reorder next-up lists
router.post('/reorder-next-up', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { bookIds } = req.body as { bookIds: string[] };

    if (!Array.isArray(bookIds)) {
      return res.status(400).json({ error: 'bookIds must be an array' });
    }

    // Validate that all bookIds belong to this user
    if (bookIds.length > 0) {
      const validationResult = await query(
        `SELECT COUNT(*) FROM books WHERE id = ANY($1) AND user_id = $2`,
        [bookIds, userId]
      );
      if (parseInt(validationResult.rows[0].count) !== bookIds.length) {
        return res.status(403).json({ error: 'Some books do not belong to this user' });
      }
    }

    // Update all books in transaction
    const client = await getClient();
    try {
      await client.query('BEGIN');

      for (let i = 0; i < bookIds.length; i++) {
        await client.query(
          'UPDATE books SET next_up_order = $1 WHERE id = $2 AND user_id = $3',
          [i, bookIds[i], userId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering books:', error);
    res.status(500).json({ error: 'Failed to reorder books' });
  }
});

export default router;
