import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { claimDueJobs } from './scheduler';
import { processDelivery } from './deliveryProcessor';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000');
const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is required');
  process.exit(1);
}

async function connectDB(): Promise<void> {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('✅  Worker connected to MongoDB');
}

let running = true;

async function poll(): Promise<void> {
  if (!running) return;
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
      console.log('✅  Worker connected to MongoDB');
    }
    const jobs = await claimDueJobs();
    if (jobs.length > 0) {
      console.log(`[worker] Claimed ${jobs.length} job(s)`);
      await Promise.allSettled(jobs.map(processDelivery));
    }
  } catch (err: any) {
    if (mongoose.connection.readyState !== 1) {
      console.warn(`⚠️  Worker waiting for MongoDB: ${err.message}. Retrying in ${POLL_INTERVAL_MS}ms...`);
    } else {
      console.error('[worker] Poll error:', err);
    }
  }
  if (running) {
    setTimeout(poll, POLL_INTERVAL_MS);
  }
}

async function start(): Promise<void> {
  console.log(`🔧  HookShield Worker started (poll interval: ${POLL_INTERVAL_MS}ms)`);
  poll();
}

process.on('SIGTERM', () => {
  console.log('Worker shutting down...');
  running = false;
});

process.on('SIGINT', () => {
  running = false;
  process.exit(0);
});

start();
