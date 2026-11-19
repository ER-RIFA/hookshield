import { Schema, model, Document, Types } from 'mongoose';

export interface IEvent extends Document {
  _id: Types.ObjectId;
  eventId: string;
  ownerId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

eventSchema.index({ ownerId: 1, createdAt: -1 });
eventSchema.index({ type: 1 });

export const Event = model<IEvent>('Event', eventSchema);
