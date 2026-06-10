export type BookStatus = 'read' | 'reading' | 'want_to_read';
export type BookCategory = 'fiction' | 'nonfiction';
export type DescriptionSource = 'openlibrary' | 'wikipedia';

export interface NytReview {
  url: string;
  byline: string;
  summary: string;
  publicationDt: string | null;
}

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
  description: string | null;
  descriptionSource: DescriptionSource | null;
  descriptionUrl: string | null;
  descriptionFetchedAt: string | null;
  wikipediaUrl: string | null;
  wikipediaReception: string | null;
  wikipediaFetchedAt: string | null;
  nytReviews: NytReview[] | null;
  nytFetchedAt: string | null;
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
