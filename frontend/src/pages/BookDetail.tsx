import { useParams, useNavigate } from 'react-router-dom';
import { useBook } from '../hooks/useBooks';
import { getBookCoverUrl } from '../lib/bookCovers';
import { Book, BookStatus } from '../types/book';

const statusLabels: Record<BookStatus, string> = {
  want_to_read: 'Want to Read',
  reading: 'Currently Reading',
  read: 'Read',
};

const statusColors: Record<BookStatus, string> = {
  want_to_read: 'bg-soft-peach text-charcoal',
  reading: 'bg-forest-green/10 text-forest-green',
  read: 'bg-terracotta/10 text-terracotta',
};

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">{label}</dt>
      <dd className="mt-1 text-charcoal">{value}</dd>
    </div>
  );
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < rating ? 'text-terracotta' : 'text-soft-peach'}>
          ★
        </span>
      ))}
    </div>
  );
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function BookDetailContent({ book }: { book: Book }) {
  const navigate = useNavigate();
  const coverUrl = book.coverUrl || getBookCoverUrl(book.isbn13, book.isbn, 'L');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center gap-2 text-sm text-charcoal/60 hover:text-forest-green transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="bg-white rounded-2xl shadow-md border border-soft-peach/20 overflow-hidden">
        {/* Header section */}
        <div className="p-8 flex gap-8">
          {/* Cover */}
          <div className="flex-shrink-0">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={`${book.title} cover`}
                className="w-40 h-56 object-cover rounded-xl shadow-md"
              />
            ) : (
              <div className="w-40 h-56 bg-soft-peach rounded-xl flex items-center justify-center text-terracotta text-sm text-center p-4">
                No cover available
              </div>
            )}
          </div>

          {/* Title, author, badges */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold font-serif text-forest-green leading-tight">
              {book.title}
            </h1>
            <p className="mt-2 text-xl text-terracotta">{book.author}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[book.status]}`}>
                {statusLabels[book.status]}
              </span>
              {book.category && (
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    book.category === 'fiction'
                      ? 'bg-soft-peach text-terracotta'
                      : 'bg-forest-green/10 text-forest-green'
                  }`}
                >
                  {book.category}
                </span>
              )}
            </div>

            {book.myRating && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/50 mb-1">
                  My Rating
                </p>
                <StarRating rating={book.myRating} />
              </div>
            )}

            {book.averageRating && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/50 mb-1">
                  Avg. Rating
                </p>
                <div className="flex items-center gap-2">
                  <StarRating rating={Math.round(book.averageRating)} />
                  <span className="text-sm text-charcoal/60">
                    ({book.averageRating.toFixed(2)})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-soft-peach/50" />

        {/* Details grid */}
        <div className="p-8">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <DetailField label="Date Added" value={formatDate(book.dateAdded)} />
            <DetailField label="Date Started" value={formatDate(book.dateStarted)} />
            <DetailField label="Date Finished" value={formatDate(book.dateFinished)} />
            <DetailField label="Publisher" value={book.publisher} />
            <DetailField label="Binding" value={book.binding} />
            <DetailField label="Pages" value={book.pages} />
            <DetailField label="Year Published" value={book.yearPublished} />
            <DetailField
              label="Original Publication Year"
              value={book.originalPublicationYear !== book.yearPublished ? book.originalPublicationYear : null}
            />
            <DetailField label="ISBN-13" value={book.isbn13} />
            <DetailField label="ISBN-10" value={book.isbn} />
            {book.goodreadsId && (
              <DetailField label="Goodreads ID" value={book.goodreadsId} />
            )}
          </dl>
        </div>

        {/* Notes */}
        {book.notes && (
          <>
            <div className="border-t border-soft-peach/50" />
            <div className="p-8">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50 mb-3">
                Notes
              </h2>
              <p className="text-charcoal whitespace-pre-wrap leading-relaxed">{book.notes}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: book, isLoading, error } = useBook(id!);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-terracotta">
          {error ? `Error: ${error.message}` : 'Book not found.'}
        </p>
      </div>
    );
  }

  return <BookDetailContent book={book} />;
}
