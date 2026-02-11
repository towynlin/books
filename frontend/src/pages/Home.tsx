import { useState, useMemo } from 'react';
import { useBooks } from '../hooks/useBooks';
import { BookCard } from '../components/BookCard';
import { DraggableBookList } from '../components/DraggableBookList';
import { BookSearchBar } from '../components/BookSearchBar';
import { Book, BookStatus } from '../types/book';

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  let j = 0;
  for (let i = 0; i < lower.length && j < query.length; i++) {
    if (lower[i] === query[j]) j++;
  }
  return j === query.length;
}

function bookMatchesFilter(book: Book, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fuzzyMatch(book.title, q) || fuzzyMatch(book.author, q);
}

type ViewTab = 'reading' | 'read' | 'want_to_read' | 'next_up';

type SortOption = 'date_added' | 'title' | 'author' | 'date_finished';
type SortDir = 'asc' | 'desc';

const defaultDir: Record<SortOption, SortDir> = {
  date_added: 'desc',
  date_finished: 'desc',
  title: 'asc',
  author: 'asc',
};

const sortOptions: Record<string, { id: SortOption; label: string }[]> = {
  want_to_read: [
    { id: 'date_added', label: 'Date Added' },
    { id: 'title', label: 'Title' },
    { id: 'author', label: 'Author' },
  ],
  read: [
    { id: 'date_finished', label: 'Date Completed' },
    { id: 'date_added', label: 'Date Added' },
    { id: 'title', label: 'Title' },
    { id: 'author', label: 'Author' },
  ],
};

export function Home() {
  const [activeTab, setActiveTab] = useState<ViewTab>('reading');
  const [sortBy, setSortBy] = useState<Record<string, SortOption>>({
    want_to_read: 'date_added',
    read: 'date_finished',
  });
  const [sortDir, setSortDir] = useState<Record<string, SortDir>>({
    want_to_read: 'desc',
    read: 'desc',
  });

  const statusMap: Record<ViewTab, BookStatus | undefined> = {
    reading: 'reading',
    read: 'read',
    want_to_read: 'want_to_read',
    next_up: undefined,
  };

  const currentSort = sortOptions[activeTab] ? sortBy[activeTab] : undefined;
  const currentDir = sortOptions[activeTab] ? sortDir[activeTab] : undefined;

  const [filterText, setFilterText] = useState('');

  const { data: books, isLoading, error } = useBooks(
    activeTab === 'next_up'
      ? { nextUp: true }
      : { status: statusMap[activeTab], sort: currentSort, sortDir: currentDir }
  );

  const filteredBooks = useMemo(
    () => books?.filter((book) => bookMatchesFilter(book, filterText)),
    [books, filterText]
  );

  const tabs: { id: ViewTab; label: string }[] = [
    { id: 'reading', label: 'Currently Reading' },
    { id: 'next_up', label: 'Next Up' },
    { id: 'want_to_read', label: 'Want to Read' },
    { id: 'read', label: 'Already Read' },
  ];

  return (
    <div className="min-h-screen bg-warm-cream">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-serif text-forest-green mb-2">My Books</h1>
          <p className="text-terracotta font-medium">Track your reading journey</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 flex justify-center">
          <BookSearchBar />
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b-2 border-soft-peach">
          <nav className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-forest-green text-forest-green'
                    : 'border-transparent text-charcoal opacity-60 hover:opacity-100 hover:border-soft-peach'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Filter Input */}
        <div className="mb-4">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by title or author..."
            className="w-full max-w-md px-4 py-2 rounded-full border-2 border-soft-peach bg-white text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:border-forest-green transition-colors"
          />
        </div>

        {/* Sort Controls */}
        {sortOptions[activeTab] && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-charcoal opacity-60">Sort by:</span>
            {sortOptions[activeTab].map((option) => {
              const isActive = sortBy[activeTab] === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    if (isActive) {
                      setSortDir((prev) => ({
                        ...prev,
                        [activeTab]: prev[activeTab] === 'asc' ? 'desc' : 'asc',
                      }));
                    } else {
                      setSortBy((prev) => ({ ...prev, [activeTab]: option.id }));
                      setSortDir((prev) => ({ ...prev, [activeTab]: defaultDir[option.id] }));
                    }
                  }}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    isActive
                      ? 'bg-forest-green text-white'
                      : 'bg-soft-peach text-charcoal hover:bg-forest-green/20'
                  }`}
                >
                  {option.label}
                  {isActive && (
                    <span className="ml-1">{sortDir[activeTab] === 'asc' ? '\u2191' : '\u2193'}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div>
          {isLoading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta"></div>
              <p className="mt-2 text-charcoal opacity-80">Loading books...</p>
            </div>
          )}

          {error && (
            <div className="bg-soft-peach border-2 border-terracotta rounded-2xl p-4 text-terracotta">
              Error loading books: {error.message}
            </div>
          )}

          {filteredBooks && filteredBooks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-charcoal text-lg font-medium">No books found</p>
              <p className="text-charcoal opacity-60 text-sm mt-2">
                {filterText
                  ? 'No books match your filter'
                  : activeTab === 'next_up'
                    ? 'Add books to your next-up list to see them here'
                    : 'Add some books to get started!'}
              </p>
            </div>
          )}

          {filteredBooks && filteredBooks.length > 0 && (
            activeTab === 'next_up' ? (
              <DraggableBookList books={filteredBooks} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBooks.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
