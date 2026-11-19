import { Schema, model, Document, Types } from 'mongoose';

export interface IDeliveryAttempt extends Document {
  deliveryId: Types.ObjectId;
  attemptNo: number;
  statusCode?: number;
  durationMs: number;
  errorCategory?: string;
  responseBody?: string;
  success: boolean;
  attemptedAt: Date;
}

const deliveryAttemptSchema = new Schema<IDeliveryAttempt>({
  deliveryId: { type: Schema.Types.ObjectId, ref: 'Delivery', required: true, index: true },
  attemptNo: { type: Number, required: true },
  statusCode: { type: Number },
  durationMs: { type: Number, required: true },
  errorCategory: { type: String },
  responseBody: { type: String },
  success: { type: Boolean, required: true },
  attemptedAt: { type: Date, default: () => new Date() },
});

export const DeliveryAttempt = model<IDeliveryAttempt>('DeliveryAttempt', deliveryAttemptSchema);
