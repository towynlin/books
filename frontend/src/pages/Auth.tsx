import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { authAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export function Auth() {
  const [username, setUsername] = useState('');
  const [hasUser, setHasUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if a user already exists
    const checkUserStatus = async () => {
      try {
        const status = await authAPI.checkStatus();
        setHasUser(status.hasUser);
      } catch (err) {
        console.error('Failed to check user status:', err);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkUserStatus();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!username.trim()) {
        setError('Username is required');
        setIsLoading(false);
        return;
      }

      // Get registration options from server
      const options = await authAPI.getRegistrationOptions(username);

      // Start WebAuthn registration
      const credential = await startRegistration({ optionsJSON: options });

      // Verify registration with server
      const response = await authAPI.verifyRegistration(username, credential);

      // Store auth token and redirect
      login(response.token, response.user);
      navigate('/');
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!username.trim()) {
        setError('Username is required');
        setIsLoading(false);
        return;
      }

      // Get login options from server
      const options = await authAPI.getLoginOptions(username);

      // Start WebAuthn authentication
      const credential = await startAuthentication({ optionsJSON: options });

      // Verify login with server
      const response = await authAPI.verifyLogin(username, credential);

      // Store auth token and redirect
      login(response.token, response.user);
      navigate('/');
    } catch (err) {
      console.error('Login failed:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Books Tracker
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {hasUser ? 'Sign in with your passkey' : 'Create your account with a passkey'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={hasUser ? handleLogin : handleRegister}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                <>
                  {hasUser ? 'Sign in with Passkey' : 'Create Account with Passkey'}
                </>
              )}
            </button>
          </div>

          <div className="text-sm text-center text-gray-600">
            <p>
              {hasUser ? 'Use your device\'s biometric authentication or security key' : 'Your passkey will be stored securely on this device'}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
