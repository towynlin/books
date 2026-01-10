import { useState } from 'react';
import { useBooks } from '../hooks/useBooks';
import { BookCard } from '../components/BookCard';
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Books</h1>
          <p className="text-gray-600">Track your reading journey</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading books...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              Error loading books: {error.message}
            </div>
          )}

          {books && books.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No books found</p>
              <p className="text-gray-400 text-sm mt-2">
                {activeTab === 'next_up'
                  ? 'Add books to your next-up list to see them here'
                  : 'Add some books to get started!'}
              </p>
            </div>
          )}

          {books && books.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
