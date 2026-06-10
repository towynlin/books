import { Component, ErrorInfo, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function ErrorFallback({ error }: { error: Error }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold font-serif text-forest-green">
        Something went wrong
      </h1>
      <p className="mt-3 text-charcoal/70">{error.message}</p>
      <div className="mt-8 flex justify-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2 rounded-xl border-2 border-soft-peach text-charcoal hover:bg-soft-peach/30 transition-colors"
        >
          Go back
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2 rounded-xl bg-forest-green text-white hover:bg-forest-green/90 transition-colors"
        >
          Go to Library
        </button>
      </div>
    </div>
  );
}

class ErrorBoundaryInner extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

// Keyed by location so navigating (back, nav links) remounts the boundary
// and clears the error state instead of staying stuck on the fallback.
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundaryInner key={location.key}>{children}</ErrorBoundaryInner>;
}
