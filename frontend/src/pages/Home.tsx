import { useState } from 'react';
import { useBooks } from '../hooks/useBooks';
import { BookCard } from '../components/BookCard';
import { DraggableBookList } from '../components/DraggableBookList';
import { BookStatus } from '../types/book';

type ViewTab = 'reading' | 'read' | 'want_to_read' | 'next_up';

export function Home() {
  const [activeTab, setActiveTab] = useState<ViewTab>('reading');

  const statusMap: Record<ViewTab, BookStatus | undefined> = {
    reading: 'reading',
    read: 'read',
    want_to_read: 'want_to_read',
    next_up: undefined,
  };

  const { data: books, isLoading, error } = useBooks(
    activeTab === 'next_up'
      ? { nextUp: true }
      : { status: statusMap[activeTab] }
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

          {books && books.length === 0 && (
            <div className="text-center py-12">
              <p className="text-charcoal text-lg font-medium">No books found</p>
              <p className="text-charcoal opacity-60 text-sm mt-2">
                {activeTab === 'next_up'
                  ? 'Add books to your next-up list to see them here'
                  : 'Add some books to get started!'}
              </p>
            </div>
          )}

          {books && books.length > 0 && (
            activeTab === 'next_up' ? (
              <DraggableBookList books={books} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {books.map((book) => (
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
