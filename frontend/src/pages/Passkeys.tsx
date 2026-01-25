import { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { authAPI } from '../lib/api';

interface Passkey {
  id: string;
  createdAt: string;
  deviceName: string;
}

export function Passkeys() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [setupLink, setSetupLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  useEffect(() => {
    loadPasskeys();
  }, []);

  const loadPasskeys = async () => {
    try {
      setIsLoading(true);
      const response = await authAPI.listPasskeys();
      setPasskeys(response.passkeys);
    } catch (err) {
      console.error('Failed to load passkeys:', err);
      setError('Failed to load passkeys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsAdding(true);

    try {
      // Get registration options
      const options = await authAPI.getAddPasskeyOptions();

      // Start WebAuthn registration
      const credential = await startRegistration({ optionsJSON: options });

      // Verify and add passkey
      const response = await authAPI.addPasskey(credential, deviceName.trim() || undefined);

      setSuccess(response.message);
      setDeviceName('');

      // Reload passkeys list
      await loadPasskeys();
    } catch (err) {
      console.error('Failed to add passkey:', err);
      setError(err instanceof Error ? err.message : 'Failed to add passkey');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this passkey? You will not be able to log in with it anymore.')) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await authAPI.deletePasskey(id);
      setSuccess(response.message);

      // Reload passkeys list
      await loadPasskeys();
    } catch (err) {
      console.error('Failed to delete passkey:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete passkey');
    }
  };

  const handleGenerateSetupLink = async () => {
    setError(null);
    setSuccess(null);
    setIsGeneratingLink(true);
    setSetupLink(null);

    try {
      const response = await authAPI.generateSetupToken();
      setSetupLink(response.setupUrl);
      setSuccess('Setup link generated! Copy it and open on your other device.');
    } catch (err) {
      console.error('Failed to generate setup link:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate setup link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terracotta mx-auto"></div>
          <p className="mt-4 text-charcoal/60">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold font-serif text-forest-green mb-6">Manage Passkeys</h1>

      <div className="bg-soft-peach border-l-4 border-terracotta rounded-r-xl p-4 mb-6">
        <h2 className="font-semibold font-serif text-forest-green mb-2">About Passkeys</h2>
        <p className="text-charcoal/80 text-sm">
          Passkeys are a secure way to log in without passwords. You can add multiple passkeys for different devices (phone, laptop, etc.).
          When logging in from a new device, you can scan a QR code with your phone to authenticate.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-soft-peach border-2 border-terracotta p-4 mb-6">
          <div className="text-sm text-terracotta">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-2xl bg-forest-green/10 border-2 border-forest-green p-4 mb-6">
          <div className="text-sm text-forest-green">{success}</div>
        </div>
      )}

      <div className="bg-white shadow-md rounded-2xl border border-soft-peach/20 p-6 mb-6">
        <h2 className="text-xl font-semibold font-serif text-forest-green mb-4">Add Another Device</h2>
        <p className="text-sm text-charcoal/60 mb-4">
          Generate a time-limited link to add a passkey on another device (phone, tablet, another computer, etc.).
          The link expires in 30 minutes.
        </p>
        <button
          onClick={handleGenerateSetupLink}
          disabled={isGeneratingLink}
          className="w-full py-3 px-4 text-sm font-medium rounded-full text-white bg-forest-green hover:bg-forest-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-green disabled:opacity-50 disabled:cursor-not-allowed mb-4 transition-colors"
        >
          {isGeneratingLink ? 'Generating...' : 'Generate Setup Link'}
        </button>

        {setupLink && (
          <div className="space-y-3">
            <div className="bg-soft-peach/30 p-4 rounded-xl border border-soft-peach">
              <p className="text-xs font-mono break-all text-charcoal">{setupLink}</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(setupLink);
                alert('Link copied to clipboard!');
              }}
              className="w-full py-3 px-4 border-2 border-forest-green rounded-full text-sm font-medium text-forest-green bg-white hover:bg-forest-green hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-green transition-colors"
            >
              Copy Link
            </button>
          </div>
        )}
      </div>

      <div className="bg-white shadow-md rounded-2xl border border-soft-peach/20 p-6 mb-6">
        <h2 className="text-xl font-semibold font-serif text-forest-green mb-4">Add New Passkey</h2>
        <form onSubmit={handleAddPasskey} className="space-y-4">
          <div>
            <label htmlFor="deviceName" className="block text-sm font-medium text-charcoal mb-1">
              Device Name (Optional)
            </label>
            <input
              id="deviceName"
              type="text"
              className="appearance-none rounded-full relative block w-full px-4 py-2 border-2 border-soft-peach placeholder-charcoal/40 text-charcoal focus:outline-none focus:ring-2 focus:ring-forest-green focus:border-forest-green sm:text-sm transition-colors"
              placeholder="e.g., My iPhone, Work Laptop"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              disabled={isAdding}
            />
            <p className="mt-1 text-sm text-charcoal/60">
              Give this passkey a name to help you remember which device it's for
            </p>
          </div>
          <button
            type="submit"
            disabled={isAdding}
            className="w-full flex justify-center py-3 px-4 text-sm font-medium rounded-full text-white bg-forest-green hover:bg-forest-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-green disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAdding ? 'Adding Passkey...' : 'Add Passkey for This Device'}
          </button>
        </form>
      </div>

      <div className="bg-white shadow-md rounded-2xl border border-soft-peach/20 p-6">
        <h2 className="text-xl font-semibold font-serif text-forest-green mb-4">Your Passkeys</h2>
        {passkeys.length === 0 ? (
          <p className="text-charcoal/60 text-sm">No passkeys found.</p>
        ) : (
          <div className="space-y-3">
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="flex items-center justify-between p-4 border border-soft-peach rounded-xl hover:bg-soft-peach/30 transition-colors"
              >
                <div>
                  <h3 className="font-medium text-charcoal">{passkey.deviceName}</h3>
                  <p className="text-sm text-charcoal/60">
                    Added {new Date(passkey.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {passkeys.length > 1 && (
                  <button
                    onClick={() => handleDeletePasskey(passkey.id)}
                    className="text-terracotta hover:text-terracotta/80 text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {passkeys.length === 1 && (
          <p className="mt-4 text-sm text-charcoal/60">
            You must have at least one passkey. Add another passkey before deleting this one.
          </p>
        )}
      </div>
    </div>
  );
}
