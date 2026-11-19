import mongoose from 'mongoose';
import { Delivery } from './models/Delivery';

const LEASE_DURATION_MS = 30_000; // 30 second lease
const BATCH_SIZE = 10;

/**
 * Sweeps for abandoned/zombie jobs: deliveries that were marked 'delivering'
 * but whose worker died or timed out (lease expired).
 * Resets them back to 'retrying' with immediate retry eligibility.
 */
export async function recoverOrphanJobs(): Promise<number> {
  const now = new Date();
  const result = await Delivery.updateMany(
    {
      status: 'delivering',
      leaseUntil: { $lte: now },
    },
    {
      $set: {
        status: 'retrying',
        nextAttemptAt: now,
      },
      $unset: {
        leaseUntil: 1,
      },
    }
  );

  if (result.modifiedCount > 0) {
    console.log(`[scheduler] Recovered ${result.modifiedCount} orphaned/zombie delivery job(s)`);
  }
  return result.modifiedCount;
}

/**
 * Atomically claim a batch of due delivery jobs using findOneAndUpdate.
 * This prevents two workers from claiming the same job concurrently.
 */
export async function claimDueJobs() {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_DURATION_MS);

  // First sweep and recover any orphaned jobs
  await recoverOrphanJobs();

  const claimed = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    const job = await Delivery.findOneAndUpdate(
      {
        status: { $in: ['pending', 'retrying'] },
        nextAttemptAt: { $lte: now },
        $or: [
          { leaseUntil: { $exists: false } },
          { leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          status: 'delivering',
          leaseUntil,
        },
      },
      { new: true }
    );
    if (!job) break;
    claimed.push(job);
  }
  return claimed;
}
