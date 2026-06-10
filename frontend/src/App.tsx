import { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { BookDetail } from './pages/BookDetail';
import { Import } from './pages/Import';
import { Auth } from './pages/Auth';
import { Passkeys } from './pages/Passkeys';
import { Setup } from './pages/Setup';
import { Invitations } from './pages/Invitations';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Navigation() {
  const { isAuthenticated, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="bg-white shadow-md border-b border-soft-peach">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-2xl font-bold font-serif text-forest-green">
            Books
          </Link>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="p-2 rounded-md text-charcoal/70 hover:text-terracotta hover:bg-soft-peach/30 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-soft-peach py-1 z-50">
                <div className="px-4 py-2 text-xs text-charcoal/50 border-b border-soft-peach">
                  {user?.username}
                </div>
                <Link
                  to="/"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-charcoal/80 hover:text-terracotta hover:bg-soft-peach/20 transition-colors"
                >
                  Library
                </Link>
                <Link
                  to="/import"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-charcoal/80 hover:text-terracotta hover:bg-soft-peach/20 transition-colors"
                >
                  Import
                </Link>
                <Link
                  to="/passkeys"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-charcoal/80 hover:text-terracotta hover:bg-soft-peach/20 transition-colors"
                >
                  Passkeys
                </Link>
                <Link
                  to="/invitations"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-charcoal/80 hover:text-terracotta hover:bg-soft-peach/20 transition-colors"
                >
                  Invitations
                </Link>
                <div className="border-t border-soft-peach mt-1 pt-1">
                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="block w-full text-left px-4 py-2 text-sm text-terracotta hover:text-terracotta/80 hover:bg-soft-peach/20 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-warm-cream">
      <Navigation />

      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/setup" element={<Setup />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/books/:id"
          element={
            <ProtectedRoute>
              <BookDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/import"
          element={
            <ProtectedRoute>
              <Import />
            </ProtectedRoute>
          }
        />
        <Route
          path="/passkeys"
          element={
            <ProtectedRoute>
              <Passkeys />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invitations"
          element={
            <ProtectedRoute>
              <Invitations />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
