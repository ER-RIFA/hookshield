import { Schema, model, Document } from 'mongoose';

export interface IIdempotencyKey extends Document {
  ownerId: string;
  key: string;
  eventId: string;
  expiresAt: Date;
}

const idempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    ownerId: { type: String, required: true },
    key: { type: String, required: true },
    eventId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false }
);

// Unique compound index to prevent duplicates
idempotencyKeySchema.index({ ownerId: 1, key: 1 }, { unique: true });
// TTL index — MongoDB will auto-delete expired docs
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyKey = model<IIdempotencyKey>('IdempotencyKey', idempotencyKeySchema);
