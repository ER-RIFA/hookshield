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
    eventId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const Event = model<IEvent>('Event', eventSchema);
