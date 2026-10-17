/** Total play time a guest gets before having to create an account. */
export const GUEST_TRIAL_MS = 60_000;

const KEY = 'guestPlayedMs';

/**
 * Tracks how long a guest has played. The counter lives in localStorage, so this is a
 * convenience limit, not a security boundary: clearing site data resets it. What stays
 * enforced by the server is that guests can never save a score.
 */
export function loadPlayedMs(): number {
  try {
    const value = Number(localStorage.getItem(KEY));
    return Number.isFinite(value) && value > 0 ? Math.min(value, GUEST_TRIAL_MS) : 0;
  } catch {
    return 0;
  }
}

export function savePlayedMs(ms: number): void {
  try {
    localStorage.setItem(KEY, String(Math.round(ms)));
  } catch {
    // Blocked storage: the trial then only lasts for this page visit.
  }
}
