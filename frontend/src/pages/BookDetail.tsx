import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBook, useEnrichBook, useUpdateBook } from '../hooks/useBooks';
import { getBookCoverUrl } from '../lib/bookCovers';
import { BookActionsMenu } from '../components/BookActionsMenu';
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

function NotesEditor({ book }: { book: Book }) {
  const updateBook = useUpdateBook();
  const [notes, setNotes] = useState(book.notes ?? '');
  const [isDirty, setIsDirty] = useState(false);

  // Reset local state if a different book loads or the saved value changes elsewhere
  useEffect(() => {
    setNotes(book.notes ?? '');
    setIsDirty(false);
  }, [book.id, book.notes]);

  const handleSave = () => {
    if (!isDirty || updateBook.isPending) return;
    const trimmed = notes.trim();
    updateBook.mutate(
      { id: book.id, data: { notes: trimmed === '' ? null : notes } },
      { onSuccess: () => setIsDirty(false) }
    );
  };

  return (
    <div className="p-8">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50 mb-3">
        Notes
      </h2>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setIsDirty(true);
        }}
        onBlur={handleSave}
        placeholder="Add your notes about this book…"
        rows={5}
        className="w-full rounded-xl border border-soft-peach/50 p-3 text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-forest-green/30 resize-y"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!isDirty || updateBook.isPending}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-forest-green text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-forest-green/90 transition-colors"
        >
          Save
        </button>
        <span className="text-xs text-charcoal/50">
          {updateBook.isPending
            ? 'Saving…'
            : isDirty
            ? 'Unsaved changes'
            : updateBook.isSuccess
            ? 'Saved'
            : ''}
        </span>
      </div>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-forest-green underline decoration-forest-green/30 hover:decoration-forest-green transition-colors"
    >
      {children}
    </a>
  );
}

const descriptionSourceLabels = {
  openlibrary: 'Open Library',
  wikipedia: 'Wikipedia (CC BY-SA)',
} as const;

function BookDetailContent({ book }: { book: Book }) {
  const navigate = useNavigate();
  const coverUrl = book.coverUrl || getBookCoverUrl(book.isbn13, book.isbn, 'L');
  // average_rating is NUMERIC in Postgres and may arrive as a string
  const averageRating = book.averageRating != null ? Number(book.averageRating) : null;

  // Lazily fetch synopsis + reviews the first time the detail page is opened.
  // The backend stamps *_fetched_at even when nothing is found, so this only
  // fires for books that haven't been looked up yet (or retries after errors).
  const enrich = useEnrichBook();
  const enrichFired = useRef(false);
  const needsEnrichment =
    book.descriptionFetchedAt === null ||
    book.wikipediaFetchedAt === null ||
    book.nytFetchedAt === null;
  useEffect(() => {
    if (needsEnrichment && !enrichFired.current) {
      enrichFired.current = true;
      enrich.mutate(book.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, needsEnrichment]);

  const lookingUpSynopsis = !book.description && book.descriptionFetchedAt === null;
  const bookMarksUrl = `https://bookmarks.reviews/?s=${encodeURIComponent(
    `${book.title} ${book.author}`
  )}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back button + actions */}
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-charcoal/60 hover:text-forest-green transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <BookActionsMenu book={book} align="right" onDeleted={() => navigate('/')} />
      </div>

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

            {averageRating != null && !Number.isNaN(averageRating) && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/50 mb-1">
                  Avg. Rating
                </p>
                <div className="flex items-center gap-2">
                  <StarRating rating={Math.round(averageRating)} />
                  <span className="text-sm text-charcoal/60">
                    ({averageRating.toFixed(2)})
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

        {/* Synopsis */}
        {(book.description || lookingUpSynopsis) && (
          <>
            <div className="border-t border-soft-peach/50" />
            <div className="p-8">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50 mb-3">
                Synopsis
              </h2>
              {book.description ? (
                <>
                  <p className="text-charcoal whitespace-pre-wrap leading-relaxed">
                    {book.description}
                  </p>
                  {book.descriptionSource && book.descriptionUrl && (
                    <p className="mt-3 text-xs text-charcoal/50">
                      Source:{' '}
                      <ExternalLink href={book.descriptionUrl}>
                        {descriptionSourceLabels[book.descriptionSource]}
                      </ExternalLink>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-charcoal/50">Looking up synopsis…</p>
              )}
            </div>
          </>
        )}

        {/* Notes */}
        <div className="border-t border-soft-peach/50" />
        <NotesEditor book={book} />

        {/* Critic reviews */}
        <div className="border-t border-soft-peach/50" />
        <div className="p-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50 mb-3">
            Critic Reviews
          </h2>

          {book.nytReviews && book.nytReviews.length > 0 && (
            <div className="space-y-4 mb-4">
              {book.nytReviews.map((review) => (
                <div
                  key={review.url}
                  className="rounded-xl border border-soft-peach/50 bg-soft-peach/10 p-4"
                >
                  {review.byline && (
                    <p className="text-sm font-semibold text-charcoal">
                      Review by {review.byline}
                      {review.publicationDt && (
                        <span className="ml-2 font-normal text-charcoal/50">
                          {formatDate(review.publicationDt)}
                        </span>
                      )}
                    </p>
                  )}
                  {review.summary && (
                    <p className="mt-1 text-charcoal leading-relaxed">{review.summary}</p>
                  )}
                  <p className="mt-2 text-sm">
                    <ExternalLink href={review.url}>
                      Read at The New York Times
                    </ExternalLink>
                  </p>
                </div>
              ))}
            </div>
          )}

          {book.wikipediaReception && (
            <div className="mb-4">
              <blockquote className="border-l-4 border-soft-peach pl-4 text-charcoal leading-relaxed italic">
                {book.wikipediaReception}
              </blockquote>
              {book.wikipediaUrl && (
                <p className="mt-2 text-xs text-charcoal/50">
                  From <ExternalLink href={book.wikipediaUrl}>Wikipedia</ExternalLink>, CC BY-SA
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-charcoal/60">
            {!book.wikipediaReception && (!book.nytReviews || book.nytReviews.length === 0)
              ? 'No cached reviews found — try '
              : 'More reviews: '}
            <ExternalLink href={bookMarksUrl}>
              search Book Marks for critic reviews ↗
            </ExternalLink>
          </p>
        </div>
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
