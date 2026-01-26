import { useState } from 'react';
import { authAPI } from '../lib/api';

export function Invitations() {
  const [invitation, setInvitation] = useState<{
    token: string;
    expiresAt: string;
    inviteUrl: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateInvitation = async () => {
    setError(null);
    setIsLoading(true);
    setCopied(false);

    try {
      const result = await authAPI.generateInvitation();
      setInvitation(result);
    } catch (err) {
      console.error('Failed to generate invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invitation) return;

    try {
      await navigator.clipboard.writeText(invitation.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatExpirationDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold font-serif text-forest-green mb-2">
        Invite a Friend
      </h1>
      <p className="text-charcoal/70 mb-8">
        Generate an invitation link to allow someone to create an account on this Books Tracker instance.
      </p>

      <div className="bg-white shadow-xl rounded-2xl p-6 border-2 border-soft-peach">
        <div className="space-y-6">
          <div className="bg-soft-peach/50 rounded-xl p-4">
            <h3 className="font-semibold text-charcoal mb-2">How it works</h3>
            <ul className="text-sm text-charcoal/80 space-y-1">
              <li>1. Click the button below to generate an invitation link</li>
              <li>2. Share the link with someone you want to invite</li>
              <li>3. They can use the link to create their own account</li>
              <li>4. Each invitation link can only be used once</li>
            </ul>
          </div>

          {error && (
            <div className="rounded-2xl bg-soft-peach border-2 border-terracotta p-4">
              <div className="text-sm text-terracotta font-medium">{error}</div>
            </div>
          )}

          {!invitation && (
            <button
              onClick={handleGenerateInvitation}
              disabled={isLoading}
              className="w-full py-3 px-4 border border-transparent text-sm font-semibold rounded-full text-white bg-forest-green hover:bg-forest-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-green disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Invitation Link'
              )}
            </button>
          )}

          {invitation && (
            <div className="space-y-4">
              <div className="bg-forest-green/10 border-2 border-forest-green rounded-2xl p-4">
                <p className="text-sm text-forest-green font-medium mb-2">
                  Invitation link generated successfully!
                </p>
                <p className="text-xs text-forest-green/80">
                  Valid until: {formatExpirationDate(invitation.expiresAt)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-charcoal">
                  Invitation Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={invitation.inviteUrl}
                    className="flex-1 px-4 py-3 border-2 border-soft-peach rounded-full text-charcoal bg-warm-cream text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-3 border-2 border-forest-green rounded-full text-sm font-semibold text-forest-green bg-white hover:bg-forest-green hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-green"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-soft-peach">
                <button
                  onClick={() => {
                    setInvitation(null);
                    setCopied(false);
                  }}
                  className="w-full py-2 px-4 border-2 border-terracotta rounded-full text-sm font-semibold text-terracotta bg-white hover:bg-terracotta hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-terracotta"
                >
                  Generate Another Invitation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
