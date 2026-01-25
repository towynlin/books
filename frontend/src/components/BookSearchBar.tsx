import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { searchAPI, SearchResult, booksAPI } from '../lib/api';
import { BookStatus, BookCategory } from '../types/book';

interface BookSearchBarProps {
  onBookAdded?: () => void;
}

export function BookSearchBar({ onBookAdded }: BookSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus>('want_to_read');
  const [selectedCategory, setSelectedCategory] = useState<BookCategory | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await searchAPI.searchBooks(query);
        setResults(response.results);
        setIsOpen(true);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const addBookMutation = useMutation({
    mutationFn: async (book: SearchResult) => {
      return booksAPI.createBook({
        title: book.title,
        author: book.author,
        status: selectedStatus,
        category: selectedCategory,
        isbn: book.isbn || null,
        isbn13: book.isbn13 || null,
        coverUrl: book.coverUrl || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setQuery('');
      setResults([]);
      setIsOpen(false);
      onBookAdded?.();
    },
    onError: (error) => {
      console.error('Failed to add book:', error);
      alert('Failed to add book. Please try again.');
    },
  });

  const handleAddBook = (book: SearchResult) => {
    addBookMutation.mutate(book);
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for books to add..."
          className="w-full px-4 py-3 pr-10 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-3">
            <div className="flex gap-2 text-sm">
              <label className="flex items-center gap-1">
                <span className="text-gray-600">Add as:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as BookStatus)}
                  className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="want_to_read">Want to Read</option>
                  <option value="reading">Currently Reading</option>
                  <option value="read">Read</option>
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span className="text-gray-600">Category:</span>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value ? e.target.value as BookCategory : null)}
                  className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="">None</option>
                  <option value="fiction">Fiction</option>
                  <option value="nonfiction">Nonfiction</option>
                </select>
              </label>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {results.map((book) => (
              <button
                key={book.id}
                onClick={() => handleAddBook(book)}
                disabled={addBookMutation.isPending}
                className="w-full p-3 flex gap-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-12 h-16 object-cover rounded shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                    No Cover
                  </div>
                )}
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">{book.title}</div>
                  <div className="text-sm text-gray-600">{book.author}</div>
                  {book.year && (
                    <div className="text-xs text-gray-500 mt-1">{book.year}</div>
                  )}
                </div>
                <div className="flex items-center">
                  <span className="text-blue-600 text-sm font-medium">+ Add</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.trim().length >= 2 && results.length === 0 && !isSearching && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl p-4 text-center text-gray-500">
          No books found for "{query}"
        </div>
      )}
    </div>
  );
}
