import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home } from './pages/Home';
import { Import } from './pages/Import';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          {/* Navigation */}
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center gap-8">
                  <Link to="/" className="text-2xl font-bold text-blue-600">
                    Books
                  </Link>
                  <div className="flex gap-4">
                    <Link
                      to="/"
                      className="text-gray-700 hover:text-blue-600 transition-colors"
                    >
                      Library
                    </Link>
                    <Link
                      to="/import"
                      className="text-gray-700 hover:text-blue-600 transition-colors"
                    >
                      Import
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Routes */}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/import" element={<Import />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
