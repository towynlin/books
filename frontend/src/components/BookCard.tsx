import { useState, useRef, useEffect } from 'react';
import { Book } from '../types/book';
import { useAddToNextUp, useRemoveFromNextUp, useDeleteBook } from '../hooks/useBooks';
import { getBookCoverUrl } from '../lib/bookCovers';

interface BookCardProps {
  book: Book;
  onClick?: () => void;
}

export function BookCard({ book, onClick }: BookCardProps) {
  const addToNextUp = useAddToNextUp();
  const removeFromNextUp = useRemoveFromNextUp();
  const deleteBook = useDeleteBook();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const categoryBadgeColor = book.category === 'fiction'
    ? 'bg-purple-100 text-purple-800'
    : book.category === 'nonfiction'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-gray-100 text-gray-800';

  const handleAddToNextUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToNextUp.mutate(book.id);
  };

  const handleRemoveFromNextUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromNextUp.mutate(book.id);
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (confirm('Are you sure you want to delete this book?')) {
      deleteBook.mutate(book.id);
    }
  };

  const isInNextUp = book.nextUpOrder !== null && book.nextUpOrder !== undefined;

  // Use stored coverUrl, or fall back to generating from ISBN
  const coverUrl = book.coverUrl || getBookCoverUrl(book.isbn13, book.isbn);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer relative"
    >
      {/* Three-dots menu */}
      <div ref={menuRef} className="absolute top-2 right-2">
        <button
          onClick={handleMenuToggle}
          className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
          aria-label="Book options"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {/* Cover thumbnail */}
        <div className="flex-shrink-0">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`${book.title} cover`}
              className="w-20 h-28 object-cover rounded"
            />
          ) : (
            <div className="w-20 h-28 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs text-center p-2">
              No cover
            </div>
          )}
        </div>

        {/* Book info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{book.title}</h3>
          <p className="text-gray-600 text-sm truncate">{book.author}</p>

          {/* Category badge */}
          {book.category && (
            <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${categoryBadgeColor}`}>
              {book.category}
            </span>
          )}

          {/* Rating */}
          {book.myRating && (
            <div className="mt-2 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < book.myRating! ? 'text-yellow-400' : 'text-gray-300'}>
                  ★
                </span>
              ))}
            </div>
          )}

          {/* Dates */}
          <div className="mt-2 text-xs text-gray-500">
            {book.dateStarted && (
              <div>Started: {new Date(book.dateStarted).toLocaleDateString()}</div>
            )}
            {book.dateFinished && (
              <div>Finished: {new Date(book.dateFinished).toLocaleDateString()}</div>
            )}
          </div>
        </div>
      </div>

      {/* Notes preview */}
      {book.notes && (
        <div className="mt-3 text-sm text-gray-600 line-clamp-2">
          {book.notes}
        </div>
      )}

      {/* Next Up controls */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        {isInNextUp ? (
          <button
            onClick={handleRemoveFromNextUp}
            disabled={removeFromNextUp.isPending}
            className="w-full px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {removeFromNextUp.isPending ? 'Removing...' : 'Remove from Next Up'}
          </button>
        ) : (
          <button
            onClick={handleAddToNextUp}
            disabled={addToNextUp.isPending}
            className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addToNextUp.isPending ? 'Adding...' : 'Add to Next Up'}
          </button>
        )}
      </div>
    </div>
  );
}
