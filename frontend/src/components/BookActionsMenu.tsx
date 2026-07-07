import { useState, useRef, useEffect } from 'react';
import { Book, BookStatus } from '../types/book';
import { useAddToNextUp, useRemoveFromNextUp, useDeleteBook, useUpdateBook } from '../hooks/useBooks';
import { StatusChangeModal } from './StatusChangeModal';

interface BookActionsMenuProps {
  book: Book;
  /** Called after the book is successfully deleted (e.g. to navigate away). */
  onDeleted?: () => void;
  /** Notifies the parent when the dropdown opens or closes (e.g. to raise z-index). */
  onMenuOpenChange?: (open: boolean) => void;
  /** Which side of the trigger button the dropdown aligns to. */
  align?: 'left' | 'right';
}

const statusLabels: Record<BookStatus, string> = {
  want_to_read: 'Want to Read',
  reading: 'Currently Reading',
  read: 'Read',
};

export function BookActionsMenu({
  book,
  onDeleted,
  onMenuOpenChange,
  align = 'right',
}: BookActionsMenuProps) {
  const addToNextUp = useAddToNextUp();
  const removeFromNextUp = useRemoveFromNextUp();
  const deleteBook = useDeleteBook();
  const updateBook = useUpdateBook();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<BookStatus | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const changeMenuOpen = (open: boolean) => {
    setMenuOpen(open);
    onMenuOpenChange?.(open);
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        changeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  const handleAddToNextUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    changeMenuOpen(false);
    addToNextUp.mutate(book.id);
  };

  const handleRemoveFromNextUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    changeMenuOpen(false);
    removeFromNextUp.mutate(book.id);
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    changeMenuOpen(!menuOpen);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    changeMenuOpen(false);
    if (confirm('Are you sure you want to delete this book?')) {
      deleteBook.mutate(book.id, {
        onSuccess: () => onDeleted?.(),
      });
    }
  };

  const handleSetCategory = (e: React.MouseEvent, category: 'fiction' | 'nonfiction') => {
    e.stopPropagation();
    changeMenuOpen(false);
    updateBook.mutate({ id: book.id, data: { category } });
  };

  const handleStatusChange = (e: React.MouseEvent, status: BookStatus) => {
    e.stopPropagation();
    changeMenuOpen(false);
    setTargetStatus(status);
    setStatusModalOpen(true);
  };

  const handleCloseStatusModal = () => {
    setStatusModalOpen(false);
    setTargetStatus(null);
  };

  // Get available status transitions based on current status
  const getAvailableStatusTransitions = (): BookStatus[] => {
    const allStatuses: BookStatus[] = ['want_to_read', 'reading', 'read'];
    return allStatuses.filter((s) => s !== book.status);
  };

  const isInNextUp = book.nextUpOrder !== null && book.nextUpOrder !== undefined;

  return (
    <div ref={menuRef} className="relative">
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
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 w-44 bg-white rounded-xl shadow-lg border-2 border-soft-peach py-1 z-10`}
        >
          {/* Status change options */}
          <div className="px-3 py-1.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">
            Move to
          </div>
          {getAvailableStatusTransitions().map((status) => (
            <button
              key={status}
              onClick={(e) => handleStatusChange(e, status)}
              className="w-full px-4 py-2 text-left text-sm text-charcoal hover:bg-soft-peach/30 flex items-center gap-2"
            >
              {status === 'read' && <span className="text-terracotta">★</span>}
              {status === 'reading' && <span className="text-forest-green">📖</span>}
              {status === 'want_to_read' && <span className="text-charcoal/60">📚</span>}
              {statusLabels[status]}
            </button>
          ))}

          <div className="my-1 border-t border-soft-peach" />

          {/* Category options */}
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

          {book.status !== 'reading' && (
            <>
              <div className="my-1 border-t border-soft-peach" />
              {isInNextUp ? (
                <button
                  onClick={handleRemoveFromNextUp}
                  disabled={removeFromNextUp.isPending}
                  className="w-full px-4 py-2 text-left text-sm text-charcoal hover:bg-soft-peach/30 disabled:opacity-50"
                >
                  Remove from Next Up
                </button>
              ) : (
                <button
                  onClick={handleAddToNextUp}
                  disabled={addToNextUp.isPending}
                  className="w-full px-4 py-2 text-left text-sm text-charcoal hover:bg-soft-peach/30 disabled:opacity-50"
                >
                  Add to Next Up
                </button>
              )}
            </>
          )}

          <div className="my-1 border-t border-soft-peach" />

          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-sm text-terracotta hover:bg-soft-peach"
          >
            Delete
          </button>
        </div>
      )}

      {/* Status Change Modal */}
      {targetStatus && (
        <StatusChangeModal
          book={book}
          targetStatus={targetStatus}
          isOpen={statusModalOpen}
          onClose={handleCloseStatusModal}
        />
      )}
    </div>
  );
}
