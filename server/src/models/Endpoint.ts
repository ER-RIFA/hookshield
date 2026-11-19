import { Schema, model, Document, Types } from 'mongoose';

export interface IEndpoint extends Document {
  _id: Types.ObjectId;
  ownerId: string;
  url: string;
  description?: string;
  subscribedEvents: string[];
  enabled: boolean;
  encryptedSecret: string;
  createdAt: Date;
  updatedAt: Date;
}

const endpointSchema = new Schema<IEndpoint>(
  {
    ownerId: { type: String, required: true, index: true },
    url: { type: String, required: true },
    description: { type: String },
    subscribedEvents: { type: [String], required: true, default: [] },
    enabled: { type: Boolean, default: true },
    encryptedSecret: { type: String, required: true, select: false }, // never return in queries by default
  },
  { timestamps: true }
);

endpointSchema.index({ ownerId: 1, createdAt: -1 });

export const Endpoint = model<IEndpoint>('Endpoint', endpointSchema);
