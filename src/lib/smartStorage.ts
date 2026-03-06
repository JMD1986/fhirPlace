/**
 * SMART token scrubber.
 *
 * Security model
 * ──────────────
 * fhirclient stores OAuth state (PKCE verifier, server URL, and ultimately
 * the tokenResponse) in sessionStorage under two keys:
 *   "SMART_KEY"   → a UUID string pointing to the real state entry
 *   <uuid>        → JSON blob with the full state incl. tokenResponse
 *
 * We let fhirclient use its own sessionStorage for the handshake (it needs
 * to survive the OAuth redirect). Immediately after ready() resolves we call
 * scrubFhirClientState() to delete both keys, so the access/refresh tokens
 * end up only in the in-memory Client object held by React state.
 *
 * Result: tokens are never durably stored in localStorage or sessionStorage.
 */

/** Delete the sessionStorage entries that fhirclient wrote during the OAuth flow. */
export function scrubFhirClientState(): void {
  try {
    const stateKey = sessionStorage.getItem("SMART_KEY");
    if (stateKey) sessionStorage.removeItem(stateKey);
    sessionStorage.removeItem("SMART_KEY");
  } catch {
    // sessionStorage may not be available in some test environments.
  }
}
