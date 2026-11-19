/**
 * Bounded exponential backoff with jitter for retry scheduling.
 * Strategy: delay = min(cap, base * 2^attempt) + random_jitter
 */

const BASE_DELAY_MS = 30_000;     // 30 seconds
const MAX_DELAY_MS  = 3_600_000;  // 1 hour cap
const JITTER_FACTOR = 0.3;        // ±30% jitter

export const MAX_ATTEMPTS = 5;

/**
 * Returns the Date at which the next attempt should occur.
 * attempt is 0-indexed (0 = first retry).
 */
export function nextRetryAt(attemptNumber: number): Date {
  const exponential = BASE_DELAY_MS * Math.pow(2, attemptNumber);
  const capped = Math.min(exponential, MAX_DELAY_MS);
  const jitter = capped * JITTER_FACTOR * (Math.random() * 2 - 1); // -30% to +30%
  const delayMs = Math.max(1000, capped + jitter);
  return new Date(Date.now() + delayMs);
}

/**
 * Returns true if the delivery should give up after this attempt.
 */
export function isExhausted(attemptNumber: number): boolean {
  return attemptNumber >= MAX_ATTEMPTS;
}

/**
 * Classify an HTTP status code into a retry decision.
 */
export function shouldRetry(statusCode: number | undefined, error: Error | undefined): boolean {
  if (error) return true;              // network errors are retried
  if (!statusCode) return true;
  if (statusCode >= 200 && statusCode < 300) return false; // success
  if (statusCode === 400) return false; // bad request — our fault, don't retry
  if (statusCode === 401) return false;
  if (statusCode === 403) return false;
  return true;                          // 4xx (not above), 5xx → retry
}
