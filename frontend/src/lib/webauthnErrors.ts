// Map raw WebAuthn/browser errors to messages a person can act on.
// @simplewebauthn/browser wraps the underlying DOMException in a
// WebAuthnError whose `cause` is the original error, so check both names.
//
// `excludedCredentials` should be set when the ceremony was a registration
// that listed the account's existing credentials in excludeCredentials. When
// an authenticator matches one of them, the spec lets the browser report
// either InvalidStateError or NotAllowedError (Firefox on Linux does the
// latter for a PIN-protected YubiKey, right after the PIN prompt), so a
// NotAllowedError there may mean "already registered" rather than "cancelled".
export function describeWebAuthnError(
  err: unknown,
  fallback: string,
  { excludedCredentials = false }: { excludedCredentials?: boolean } = {}
): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    const causeName = cause instanceof Error ? cause.name : undefined;
    const name = causeName || err.name;

    switch (name) {
      case 'NotAllowedError':
        if (excludedCredentials) {
          return 'The passkey prompt was cancelled, timed out, or this security key or device is already registered to your account. If it is already registered, you can sign in with it as is.';
        }
        return 'The passkey prompt was cancelled or timed out. Please try again.';
      case 'InvalidStateError':
        if (excludedCredentials) {
          return 'This security key or device is already registered to your account. You can sign in with it as is.';
        }
        return 'This device already has a passkey for this account. Try signing in with it instead.';
      case 'AbortError':
        return 'The passkey prompt was interrupted. Please try again.';
      case 'SecurityError':
        return "This site's domain doesn't match its passkey configuration. Passkeys can't work until that is fixed.";
      case 'NotSupportedError':
        return "This browser or device doesn't support passkeys.";
    }

    if (err.message) return err.message;
  }
  return fallback;
}
