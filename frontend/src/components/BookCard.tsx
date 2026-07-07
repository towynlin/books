import { useState } from 'react';
import { Book } from '../types/book';
import { getBookCoverUrl } from '../lib/bookCovers';
import { BookActionsMenu } from './BookActionsMenu';

interface BookCardProps {
  book: Book;
  onClick?: () => void;
}

export function BookCard({ book, onClick }: BookCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const categoryBadgeColor = book.category === 'fiction'
    ? 'bg-soft-peach text-terracotta'
    : book.category === 'nonfiction'
    ? 'bg-forest-green/10 text-forest-green'
    : 'bg-soft-peach text-charcoal';

  // Use stored coverUrl, or fall back to generating from ISBN
  const coverUrl = book.coverUrl || getBookCoverUrl(book.isbn13, book.isbn);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-md hover:shadow-xl transition-all p-4 cursor-pointer relative hover:-translate-y-1 border border-soft-peach/20${menuOpen ? ' z-10' : ''}`}
    >
      {/* Three-dots menu */}
      <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
        <BookActionsMenu book={book} onMenuOpenChange={setMenuOpen} />
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
    </div>
  );
}
