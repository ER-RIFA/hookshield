// Shared retry policy — copied to worker to avoid cross-package dependency issues
export const MAX_ATTEMPTS = 5;

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS  = 3_600_000;
const JITTER_FACTOR = 0.3;

export function nextRetryAt(attemptNumber: number): Date {
  const exponential = BASE_DELAY_MS * Math.pow(2, attemptNumber);
  const capped = Math.min(exponential, MAX_DELAY_MS);
  const jitter = capped * JITTER_FACTOR * (Math.random() * 2 - 1);
  const delayMs = Math.max(1000, capped + jitter);
  return new Date(Date.now() + delayMs);
}

export function isExhausted(attemptNumber: number): boolean {
  return attemptNumber >= MAX_ATTEMPTS;
}

export function shouldRetry(statusCode: number | undefined, error: Error | undefined): boolean {
  if (error) return true;
  if (!statusCode) return true;
  if (statusCode >= 200 && statusCode < 300) return false;
  if (statusCode === 400) return false;
  if (statusCode === 401) return false;
  if (statusCode === 403) return false;
  return true;
}
