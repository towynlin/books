import { useState, useRef, useEffect } from 'react';
import { Book } from '../types/book';
import { useAddToNextUp, useRemoveFromNextUp, useDeleteBook, useUpdateBook } from '../hooks/useBooks';
import { getBookCoverUrl } from '../lib/bookCovers';

interface BookCardProps {
  book: Book;
  onClick?: () => void;
}

export function BookCard({ book, onClick }: BookCardProps) {
  const addToNextUp = useAddToNextUp();
  const removeFromNextUp = useRemoveFromNextUp();
  const deleteBook = useDeleteBook();
  const updateBook = useUpdateBook();
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
    ? 'bg-soft-peach text-terracotta'
    : book.category === 'nonfiction'
    ? 'bg-forest-green/10 text-forest-green'
    : 'bg-soft-peach text-charcoal';

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

  const handleSetCategory = (e: React.MouseEvent, category: 'fiction' | 'nonfiction') => {
    e.stopPropagation();
    setMenuOpen(false);
    updateBook.mutate({ id: book.id, data: { category } });
  };

  const isInNextUp = book.nextUpOrder !== null && book.nextUpOrder !== undefined;

  // Use stored coverUrl, or fall back to generating from ISBN
  const coverUrl = book.coverUrl || getBookCoverUrl(book.isbn13, book.isbn);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all p-4 cursor-pointer relative hover:-translate-y-1 border border-soft-peach/20"
    >
      {/* Three-dots menu */}
      <div ref={menuRef} className="absolute top-2 right-2">
        <button
          onClick={handleMenuToggle}
          className="p-1 text-charcoal/40 hover:text-charcoal rounded hover:bg-soft-peach/50"
          aria-label="Book options"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border-2 border-soft-peach py-1 z-10">
            {book.category !== 'fiction' && (
              <button
                onClick={(e) => handleSetCategory(e, 'fiction')}
                className="w-full px-4 py-2 text-left text-sm text-charcoal hover:bg-soft-peach/30"
              >
                Mark as Fiction
              </button>
            )}
            {book.category !== 'nonfiction' && (
              <button
                onClick={(e) => handleSetCategory(e, 'nonfiction')}
                className="w-full px-4 py-2 text-left text-sm text-charcoal hover:bg-soft-peach/30"
              >
                Mark as Nonfiction
              </button>
            )}
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm text-terracotta hover:bg-soft-peach"
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
              className="w-20 h-28 object-cover rounded-xl"
            />
          ) : (
            <div className="w-20 h-28 bg-soft-peach rounded-xl flex items-center justify-center text-terracotta text-xs text-center p-2">
              No cover
            </div>
          )}
        </div>

        {/* Book info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold font-serif text-lg text-forest-green truncate">{book.title}</h3>
          <p className="text-terracotta text-sm truncate">{book.author}</p>

          {/* Category badge */}
          {book.category && (
            <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-semibold ${categoryBadgeColor}`}>
              {book.category}
            </span>
          )}

          {/* Rating */}
          {book.myRating && (
            <div className="mt-2 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < book.myRating! ? 'text-terracotta' : 'text-soft-peach'}>
                  ★
                </span>
              ))}
            </div>
          )}

          {/* Dates */}
          <div className="mt-2 text-xs text-charcoal/60">
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
        <div className="mt-3 text-sm text-charcoal/80 line-clamp-2">
          {book.notes}
        </div>
      )}

      {/* Next Up controls - not shown for currently reading books */}
      {book.status !== 'reading' && (
        <div className="mt-3 pt-3 border-t-2 border-soft-peach/50">
          {isInNextUp ? (
            <button
              onClick={handleRemoveFromNextUp}
              disabled={removeFromNextUp.isPending}
              className="w-full px-3 py-2 text-sm font-semibold text-terracotta bg-soft-peach rounded-full hover:bg-terracotta hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {removeFromNextUp.isPending ? 'Removing...' : 'Remove from Next Up'}
            </button>
          ) : (
            <button
              onClick={handleAddToNextUp}
              disabled={addToNextUp.isPending}
              className="w-full px-3 py-2 text-sm font-semibold text-white bg-forest-green rounded-full hover:bg-forest-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addToNextUp.isPending ? 'Adding...' : 'Add to Next Up'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
