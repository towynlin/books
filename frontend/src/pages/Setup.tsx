import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { authAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export function Setup() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [username, setUsername] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deviceName, setDeviceName] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No setup token provided');
      setIsValidating(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) return;

    try {
      const response = await authAPI.validateSetupToken(token);
      setIsValid(response.valid);
      setUsername(response.username);
      setExpiresAt(response.expiresAt);
    } catch (err) {
      console.error('Token validation failed:', err);
      setError(err instanceof Error ? err.message : 'Invalid or expired setup link');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setIsRegistering(true);

    try {
      // Get registration options
      const options = await authAPI.getSetupRegistrationOptions(token);

      // Start WebAuthn registration
      const credential = await startRegistration({ optionsJSON: options });

      // Complete setup
      const response = await authAPI.completeSetup(token, credential, deviceName.trim() || undefined);

      // Login and redirect
      login(response.token, response.user);
      navigate('/');
    } catch (err) {
      console.error('Setup failed:', err);
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsRegistering(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Validating setup link...</p>
        </div>
      </div>
    );
  }

  if (error || !isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Invalid Setup Link
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {error || 'This setup link is invalid or has expired.'}
            </p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/auth')}
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const expiresInMinutes = Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Add This Device
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Set up passkey access for <span className="font-semibold">{username}</span>
          </p>
          {expiresInMinutes > 0 && (
            <p className="mt-1 text-center text-xs text-gray-500">
              This link expires in {expiresInMinutes} minute{expiresInMinutes !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            You'll create a passkey for this device. Use your device's biometric authentication (fingerprint, face, etc.)
            or security key to complete setup.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSetup}>
          <div>
            <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700 mb-1">
              Device Name (Optional)
            </label>
            <input
              id="deviceName"
              type="text"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="e.g., My iPhone, Work Laptop"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              disabled={isRegistering}
            />
            <p className="mt-1 text-sm text-gray-500">
              Help yourself remember which device this is
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isRegistering}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegistering ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Setting up...
                </span>
              ) : (
                'Create Passkey for This Device'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
