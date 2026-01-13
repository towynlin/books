import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { booksAPI } from '../lib/api';
import { BookStatus, BookCategory, CreateBookInput } from '../types/book';

export function useBooks(filters?: {
  status?: BookStatus;
  category?: BookCategory;
  nextUp?: boolean;
}) {
  return useQuery({
    queryKey: ['books', filters],
    queryFn: () => booksAPI.getBooks(filters),
  });
}

export function useBook(id: string) {
  return useQuery({
    queryKey: ['books', id],
    queryFn: () => booksAPI.getBook(id),
    enabled: !!id,
  });
}

export function useCreateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBookInput) => booksAPI.createBook(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useUpdateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBookInput> }) =>
      booksAPI.updateBook(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => booksAPI.deleteBook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useReorderNextUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookIds: string[]) => booksAPI.reorderNextUp(bookIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useAddToNextUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => booksAPI.addToNextUp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useRemoveFromNextUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => booksAPI.removeFromNextUp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
}
