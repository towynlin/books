import { useState, useEffect } from 'react';
import { Book, BookStatus } from '../types/book';
import { useUpdateBook } from '../hooks/useBooks';

interface StatusChangeModalProps {
  book: Book;
  targetStatus: BookStatus;
  isOpen: boolean;
  onClose: () => void;
}

const statusLabels: Record<BookStatus, string> = {
  want_to_read: 'Want to Read',
  reading: 'Currently Reading',
  read: 'Read',
};

export function StatusChangeModal({ book, targetStatus, isOpen, onClose }: StatusChangeModalProps) {
  const updateBook = useUpdateBook();
  const [rating, setRating] = useState<number | null>(book.myRating);
  const [notes, setNotes] = useState(book.notes || '');
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  // Reset form when modal opens with a different book
  useEffect(() => {
    if (isOpen) {
      setRating(book.myRating);
      setNotes(book.notes || '');
    }
  }, [isOpen, book.id, book.myRating, book.notes]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const now = new Date().toISOString();
    const updates: Parameters<typeof updateBook.mutate>[0]['data'] = {
      status: targetStatus,
    };

    // Set appropriate dates based on status transition
    if (targetStatus === 'reading' && !book.dateStarted) {
      updates.dateStarted = now;
    }

    if (targetStatus === 'read') {
      // Set dateFinished to now
      updates.dateFinished = now;
      // If no dateStarted, set it too
      if (!book.dateStarted) {
        updates.dateStarted = now;
      }
      // Include rating and notes
      updates.myRating = rating;
      updates.notes = notes || null;
    }

    // If moving back to want_to_read, clear dates
    if (targetStatus === 'want_to_read') {
      updates.dateStarted = null;
      updates.dateFinished = null;
    }

    updateBook.mutate(
      { id: book.id, data: updates },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const showRatingAndNotes = targetStatus === 'read';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-soft-peach/30 px-6 py-4 border-b border-soft-peach">
          <h2 className="text-xl font-serif font-semibold text-forest-green">
            {showRatingAndNotes ? 'Mark as Read' : `Move to ${statusLabels[targetStatus]}`}
          </h2>
          <p className="text-sm text-charcoal/70 mt-1 truncate">{book.title}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {showRatingAndNotes ? (
            <>
              {/* Rating */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-charcoal mb-2">
                  Your Rating
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star === rating ? null : star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(null)}
                      className="text-3xl transition-transform hover:scale-110 focus:outline-none"
                    >
                      <span
                        className={
                          (hoveredStar !== null ? star <= hoveredStar : star <= (rating || 0))
                            ? 'text-terracotta'
                            : 'text-soft-peach'
                        }
                      >
                        ★
                      </span>
                    </button>
                  ))}
                </div>
                {rating && (
                  <button
                    type="button"
                    onClick={() => setRating(null)}
                    className="text-xs text-charcoal/50 hover:text-charcoal mt-1"
                  >
                    Clear rating
                  </button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  Private Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Your thoughts, memorable quotes, key takeaways..."
                  rows={4}
                  className="w-full px-3 py-2 border-2 border-soft-peach rounded-xl focus:outline-none focus:border-forest-green transition-colors resize-none text-charcoal placeholder:text-charcoal/40"
                />
              </div>
            </>
          ) : (
            <p className="text-charcoal/80">
              {targetStatus === 'reading' ? (
                <>
                  Start reading <span className="font-medium">{book.title}</span>?
                  {!book.dateStarted && (
                    <span className="block text-sm text-charcoal/60 mt-2">
                      The start date will be set to today.
                    </span>
                  )}
                </>
              ) : targetStatus === 'want_to_read' ? (
                <>
                  Move <span className="font-medium">{book.title}</span> to your want-to-read list?
                </>
              ) : null}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-soft-peach/20 border-t border-soft-peach flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-charcoal hover:bg-soft-peach rounded-full transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={updateBook.isPending}
            className="px-5 py-2 text-sm font-semibold text-white bg-forest-green rounded-full hover:bg-forest-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateBook.isPending
              ? 'Saving...'
              : showRatingAndNotes
              ? 'Mark as Read'
              : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
