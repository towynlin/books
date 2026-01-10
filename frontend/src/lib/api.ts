import { Book, BookStatus, BookCategory, CreateBookInput } from '../types/book';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

// Get auth token from localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
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
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/api/import/goodreads`, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Import failed' }));
      throw new Error(error.error || `Import failed with status ${response.status}`);
    }

    return response.json();
  },
};

export interface User {
  id: string;
  username: string;
}

export interface AuthResponse {
  verified: boolean;
  token: string;
  user: User;
}

export const authAPI = {
  // Check if a user exists
  checkStatus: async (): Promise<{ hasUser: boolean }> => {
    const response = await fetch(`${API_URL}/api/auth/status`);
    return response.json();
  },

  // Get registration options
  getRegistrationOptions: async (username: string): Promise<PublicKeyCredentialCreationOptionsJSON> => {
    return fetchAPI<PublicKeyCredentialCreationOptionsJSON>('/api/auth/register/options', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  },

  // Verify registration
  verifyRegistration: async (username: string, credential: RegistrationResponseJSON): Promise<AuthResponse> => {
    return fetchAPI<AuthResponse>('/api/auth/register/verify', {
      method: 'POST',
      body: JSON.stringify({ username, credential }),
    });
  },

  // Get login options
  getLoginOptions: async (username: string): Promise<PublicKeyCredentialRequestOptionsJSON> => {
    return fetchAPI<PublicKeyCredentialRequestOptionsJSON>('/api/auth/login/options', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  },

  // Verify login
  verifyLogin: async (username: string, credential: AuthenticationResponseJSON): Promise<AuthResponse> => {
    return fetchAPI<AuthResponse>('/api/auth/login/verify', {
      method: 'POST',
      body: JSON.stringify({ username, credential }),
    });
  },

  // Verify token
  verifyToken: async (token: string): Promise<{ valid: boolean; user: User }> => {
    return fetchAPI<{ valid: boolean; user: User }>('/api/auth/verify-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
};
