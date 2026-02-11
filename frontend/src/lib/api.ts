import { Book, BookStatus, BookCategory, CreateBookInput } from '../types/book';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser';

const API_URL = (import.meta as any).env?.VITE_API_URL !== undefined
  ? (import.meta as any).env.VITE_API_URL
  : 'http://localhost:3000';

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

  // 204 No Content has no body to parse
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const booksAPI = {
  // Get all books with optional filters
  getBooks: async (filters?: {
    status?: BookStatus;
    category?: BookCategory;
    nextUp?: boolean;
    sort?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<Book[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.nextUp) params.append('nextUp', 'true');
    if (filters?.sort) params.append('sort', filters.sort);
    if (filters?.sortDir) params.append('sortDir', filters.sortDir);

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

  // Add book to next-up list
  addToNextUp: async (id: string): Promise<Book> => {
    return fetchAPI<Book>(`/api/books/${id}/add-to-next-up`, {
      method: 'POST',
    });
  },

  // Remove book from next-up list
  removeFromNextUp: async (id: string): Promise<Book> => {
    return fetchAPI<Book>(`/api/books/${id}/remove-from-next-up`, {
      method: 'POST',
    });
  },

  // Populate cover URLs for books missing them
  populateCovers: async (): Promise<{ success: boolean; updated: number; message: string }> => {
    return fetchAPI<{ success: boolean; updated: number; message: string }>('/api/books/populate-covers', {
      method: 'POST',
    });
  },
};

export interface SearchResult {
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

export const searchAPI = {
  // Search for books using Open Library API
  searchBooks: async (query: string): Promise<{ total: number; results: SearchResult[] }> => {
    const params = new URLSearchParams();
    params.append('q', query);
    return fetchAPI<{ total: number; results: SearchResult[] }>(`/api/search?${params.toString()}`);
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
  recoveryCodes?: string[]; // Only present on registration
}

export const authAPI = {
  // Check if a user exists and if registration requires invitation
  checkStatus: async (): Promise<{ hasUser: boolean; requiresInvitation: boolean }> => {
    const response = await fetch(`${API_URL}/api/auth/status`);
    return response.json();
  },

  // Get registration options
  getRegistrationOptions: async (username: string, invitationToken?: string): Promise<PublicKeyCredentialCreationOptionsJSON> => {
    return fetchAPI<PublicKeyCredentialCreationOptionsJSON>('/api/auth/register/options', {
      method: 'POST',
      body: JSON.stringify({ username, invitationToken }),
    });
  },

  // Verify registration
  verifyRegistration: async (username: string, credential: RegistrationResponseJSON, invitationToken?: string): Promise<AuthResponse> => {
    return fetchAPI<AuthResponse>('/api/auth/register/verify', {
      method: 'POST',
      body: JSON.stringify({ username, credential, invitationToken }),
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

  // Login with recovery code
  loginWithRecoveryCode: async (username: string, recoveryCode: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_URL}/api/auth/login/recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, recoveryCode }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || `Login failed with status ${response.status}`);
    }
    return response.json();
  },

  // List user's passkeys
  listPasskeys: async (): Promise<{ passkeys: Array<{ id: string; createdAt: string; deviceName: string }> }> => {
    return fetchAPI<{ passkeys: Array<{ id: string; createdAt: string; deviceName: string }> }>('/api/auth/passkeys');
  },

  // Get options to add a new passkey
  getAddPasskeyOptions: async (): Promise<PublicKeyCredentialCreationOptionsJSON> => {
    return fetchAPI<PublicKeyCredentialCreationOptionsJSON>('/api/auth/passkeys/add-options', {
      method: 'POST',
    });
  },

  // Verify and add new passkey
  addPasskey: async (credential: RegistrationResponseJSON, deviceName?: string): Promise<{ success: boolean; message: string }> => {
    return fetchAPI<{ success: boolean; message: string }>('/api/auth/passkeys/add-verify', {
      method: 'POST',
      body: JSON.stringify({ credential, deviceName }),
    });
  },

  // Delete a passkey
  deletePasskey: async (id: string): Promise<{ success: boolean; message: string }> => {
    return fetchAPI<{ success: boolean; message: string }>(`/api/auth/passkeys/${id}`, {
      method: 'DELETE',
    });
  },

  // Generate setup token
  generateSetupToken: async (): Promise<{ token: string; expiresAt: string; setupUrl: string }> => {
    return fetchAPI<{ token: string; expiresAt: string; setupUrl: string }>('/api/auth/setup-token/generate', {
      method: 'POST',
    });
  },

  // Validate setup token
  validateSetupToken: async (token: string): Promise<{ valid: boolean; username: string; expiresAt: string }> => {
    const response = await fetch(`${API_URL}/api/auth/setup-token/validate/${token}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed with status ${response.status}`);
    }
    return response.json();
  },

  // Get registration options using setup token
  getSetupRegistrationOptions: async (token: string): Promise<PublicKeyCredentialCreationOptionsJSON> => {
    const response = await fetch(`${API_URL}/api/auth/setup-token/register-options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed with status ${response.status}`);
    }
    return response.json();
  },

  // Complete setup with token
  completeSetup: async (token: string, credential: RegistrationResponseJSON, deviceName?: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_URL}/api/auth/setup-token/register-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, credential, deviceName }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed with status ${response.status}`);
    }
    return response.json();
  },

  // Generate invitation link
  generateInvitation: async (): Promise<{ token: string; expiresAt: string; inviteUrl: string }> => {
    return fetchAPI<{ token: string; expiresAt: string; inviteUrl: string }>('/api/auth/invitation/generate', {
      method: 'POST',
    });
  },

  // Validate invitation token
  validateInvitation: async (token: string): Promise<{ valid: boolean; expiresAt?: string }> => {
    const response = await fetch(`${API_URL}/api/auth/invitation/validate/${token}`);
    if (!response.ok) {
      return { valid: false };
    }
    return response.json();
  },
};
