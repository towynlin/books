import { Book, BookStatus, BookCategory, CreateBookInput, UpdateBookInput } from '../types/book';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const booksAPI = {
  // Get all books with optional filters
  getBooks: async (filters?: {
    status?: BookStatus;
    category?: BookCategory;
    nextUp?: boolean;
  }): Promise<Book[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.nextUp) params.append('nextUp', 'true');

    const query = params.toString();
    return fetchAPI<Book[]>(`/api/books${query ? `?${query}` : ''}`);
  },

  // Get single book
  getBook: async (id: string): Promise<Book> => {
    return fetchAPI<Book>(`/api/books/${id}`);
  },

  // Create book
  createBook: async (data: CreateBookInput): Promise<Book> => {
    return fetchAPI<Book>('/api/books', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update book
  updateBook: async (id: string, data: Partial<CreateBookInput>): Promise<Book> => {
    return fetchAPI<Book>(`/api/books/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Delete book
  deleteBook: async (id: string): Promise<void> => {
    return fetchAPI<void>(`/api/books/${id}`, {
      method: 'DELETE',
    });
  },

  // Reorder next-up list
  reorderNextUp: async (bookIds: string[]): Promise<{ success: boolean }> => {
    return fetchAPI<{ success: boolean }>('/api/books/reorder-next-up', {
      method: 'POST',
      body: JSON.stringify({ bookIds }),
    });
  },
};

export const importAPI = {
  // Import Goodreads CSV
  importGoodreads: async (file: File): Promise<{
    success: boolean;
    imported: number;
    errors: number;
    details: {
      imported: Array<{ id: string; title: string; author: string }>;
      errors: Array<{ title: string; error: string }>;
    };
  }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/import/goodreads`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Import failed' }));
      throw new Error(error.error || `Import failed with status ${response.status}`);
    }

    return response.json();
  },
};
