export type BookStatus = 'read' | 'reading' | 'want_to_read';
export type BookCategory = 'fiction' | 'nonfiction';

export interface Book {
  id: string;
  createdAt: string;
  updatedAt: string;
  goodreadsId: string | null;
  title: string;
  author: string;
  isbn: string | null;
  isbn13: string | null;
  coverUrl: string | null;
  status: BookStatus;
  category: BookCategory | null;
  dateStarted: string | null;
  dateFinished: string | null;
  dateAdded: string;
  myRating: number | null;
  notes: string | null;
  nextUpOrder: number | null;
  publisher: string | null;
  binding: string | null;
  pages: number | null;
  yearPublished: number | null;
  originalPublicationYear: number | null;
  averageRating: number | null;
}

export interface CreateBookInput {
  title: string;
  author: string;
  status: BookStatus;
  category?: BookCategory | null;
  isbn?: string | null;
  isbn13?: string | null;
  coverUrl?: string | null;
  dateStarted?: string | null;
  dateFinished?: string | null;
  myRating?: number | null;
  notes?: string | null;
  nextUpOrder?: number | null;
}

export interface UpdateBookInput extends Partial<CreateBookInput> {
  id: string;
}
