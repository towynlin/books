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
      <div className="min-h-screen flex items-center justify-center bg-warm-cream">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terracotta mx-auto"></div>
          <p className="mt-4 text-charcoal opacity-80">Validating setup link...</p>
        </div>
      </div>
    );
  }

  if (error || !isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-cream py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-soft-peach flex items-center justify-center">
              <svg className="h-6 w-6 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold font-serif text-forest-green">
              Invalid Setup Link
            </h2>
            <p className="mt-2 text-sm text-charcoal/70">
              {error || 'This setup link is invalid or has expired.'}
            </p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/auth')}
                className="font-semibold text-terracotta hover:text-terracotta/80 transition-colors"
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
    <div className="min-h-screen flex items-center justify-center bg-warm-cream py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold font-serif text-forest-green">
            Add This Device
          </h2>
          <p className="mt-2 text-center text-sm text-charcoal/70">
            Set up passkey access for <span className="font-semibold">{username}</span>
          </p>
          {expiresInMinutes > 0 && (
            <p className="mt-1 text-center text-xs text-charcoal/50">
              This link expires in {expiresInMinutes} minute{expiresInMinutes !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="bg-forest-green/10 border-2 border-forest-green rounded-2xl p-4">
          <p className="text-forest-green text-sm font-medium">
            You'll create a passkey for this device. Use your device's biometric authentication (fingerprint, face, etc.)
            or security key to complete setup.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSetup}>
          <div>
            <label htmlFor="deviceName" className="block text-sm font-medium text-charcoal mb-1">
              Device Name (Optional)
            </label>
            <input
              id="deviceName"
              type="text"
              className="appearance-none rounded-full relative block w-full px-4 py-3 border-2 border-soft-peach placeholder-charcoal/40 text-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-forest-green focus:border-forest-green sm:text-sm"
              placeholder="e.g., My iPhone, Work Laptop"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              disabled={isRegistering}
            />
            <p className="mt-1 text-sm text-charcoal/50">
              Help yourself remember which device this is
            </p>
          </div>

          {error && (
            <div className="rounded-2xl bg-soft-peach border-2 border-terracotta p-4">
              <div className="text-sm text-terracotta font-medium">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isRegistering}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-full text-white bg-forest-green hover:bg-forest-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-green disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
