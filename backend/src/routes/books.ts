import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { BookStatus, BookCategory } from '@prisma/client';

const router = express.Router();

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
router.get('/', async (req, res) => {
  try {
    const { status, category, nextUp } = req.query;

    const where: any = {};

    if (status) {
      where.status = status as BookStatus;
    }

    if (category) {
      where.category = category as BookCategory;
    }

    if (nextUp === 'true') {
      where.nextUpOrder = { not: null };
    }

    const books = await prisma.book.findMany({
      where,
      orderBy: [
        { nextUpOrder: 'asc' },
        { dateAdded: 'desc' }
      ]
    });

    res.json(books);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// GET /api/books/:id - Get single book
router.get('/:id', async (req, res) => {
  try {
    const book = await prisma.book.findUnique({
      where: { id: req.params.id }
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(book);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// POST /api/books - Create new book
router.post('/', async (req, res) => {
  try {
    const data = createBookSchema.parse(req.body);

    const book = await prisma.book.create({
      data: {
        ...data,
        dateStarted: data.dateStarted ? new Date(data.dateStarted) : null,
        dateFinished: data.dateFinished ? new Date(data.dateFinished) : null,
      }
    });

    res.status(201).json(book);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating book:', error);
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// PATCH /api/books/:id - Update book
router.patch('/:id', async (req, res) => {
  try {
    const data = updateBookSchema.parse(req.body);

    const updateData: any = { ...data };

    if (data.dateStarted !== undefined) {
      updateData.dateStarted = data.dateStarted ? new Date(data.dateStarted) : null;
    }

    if (data.dateFinished !== undefined) {
      updateData.dateFinished = data.dateFinished ? new Date(data.dateFinished) : null;
    }

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json(book);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error updating book:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// DELETE /api/books/:id - Delete book
router.delete('/:id', async (req, res) => {
  try {
    await prisma.book.delete({
      where: { id: req.params.id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// POST /api/books/reorder-next-up - Reorder next-up lists
router.post('/reorder-next-up', async (req, res) => {
  try {
    const { bookIds } = req.body as { bookIds: string[] };

    if (!Array.isArray(bookIds)) {
      return res.status(400).json({ error: 'bookIds must be an array' });
    }

    // Update all books in transaction
    await prisma.$transaction(
      bookIds.map((id, index) =>
        prisma.book.update({
          where: { id },
          data: { nextUpOrder: index }
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering books:', error);
    res.status(500).json({ error: 'Failed to reorder books' });
  }
});

export default router;
