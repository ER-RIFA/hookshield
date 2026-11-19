import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root, cwd, or local server dir
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  WEBHOOK_SECRET_ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 chars'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WORKER_POLL_INTERVAL_MS: z.string().default('5000'),
  DELIVERY_TIMEOUT_MS: z.string().default('10000'),
  MAX_RETRY_ATTEMPTS: z.string().default('5'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
