import { Schema, model, Document, Types } from 'mongoose';

export type DeliveryStatus = 'pending' | 'delivering' | 'success' | 'retrying' | 'failed';

export interface IDelivery extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  endpointId: Types.ObjectId;
  ownerId: string;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: Date;
  leaseUntil?: Date;
  lastError?: string;
  lastStatusCode?: number;
  lastDurationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

const deliverySchema = new Schema<IDelivery>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    endpointId: { type: Schema.Types.ObjectId, ref: 'Endpoint', required: true },
    ownerId: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'delivering', 'success', 'retrying', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, required: true, default: () => new Date() },
    leaseUntil: { type: Date },
    lastError: { type: String },
    lastStatusCode: { type: Number },
    lastDurationMs: { type: Number },
  },
  { timestamps: true }
);

deliverySchema.index({ status: 1, nextAttemptAt: 1 });

export const Delivery = model<IDelivery>('Delivery', deliverySchema);
