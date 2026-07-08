// Map raw WebAuthn/browser errors to messages a person can act on.
// @simplewebauthn/browser wraps the underlying DOMException in a
// WebAuthnError whose `cause` is the original error, so check both names.
export function describeWebAuthnError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    const causeName = cause instanceof Error ? cause.name : undefined;
    const name = causeName || err.name;

    switch (name) {
      case 'NotAllowedError':
        return 'The passkey prompt was cancelled or timed out. Please try again.';
      case 'InvalidStateError':
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
