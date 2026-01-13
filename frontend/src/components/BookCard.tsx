import { Book } from '../types/book';
import { useAddToNextUp, useRemoveFromNextUp } from '../hooks/useBooks';

interface BookCardProps {
  book: Book;
  onClick?: () => void;
}

export function BookCard({ book, onClick }: BookCardProps) {
  const addToNextUp = useAddToNextUp();
  const removeFromNextUp = useRemoveFromNextUp();

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

  const isInNextUp = book.nextUpOrder !== null && book.nextUpOrder !== undefined;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="flex gap-4">
        {/* Cover thumbnail */}
        <div className="flex-shrink-0">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
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
