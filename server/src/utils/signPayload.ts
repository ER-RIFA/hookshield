import crypto from 'crypto';

/**
 * Sign an exact serialized request body with HMAC-SHA256.
 * The caller is responsible for passing the exact raw bytes that will be sent.
 */
export function signPayload(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/**
 * Timing-safe comparison of two HMAC signatures.
 */
export function verifySignature(rawBody: string, secret: string, signature: string): boolean {
  const expected = signPayload(rawBody, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Build the full signature header value in the format:
 * t=<timestamp>,v1=<hex-signature>
 */
export function buildSignatureHeader(rawBody: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signingPayload = `${timestamp}.${rawBody}`;
  const sig = signPayload(signingPayload, secret);
  return `t=${timestamp},v1=${sig}`;
}
