import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;

function getDerivedKey(): Buffer {
  // Derive a fixed-length key from the env variable using SHA-256
  return crypto.createHash('sha256').update(env.WEBHOOK_SECRET_ENCRYPTION_KEY).digest();
}

/**
 * Encrypt a plain-text secret using AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex).
 */
export function encryptSecret(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an encrypted secret produced by encryptSecret.
 */
export function decryptSecret(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid ciphertext format');
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString('utf8') + decipher.final('utf8');
}
