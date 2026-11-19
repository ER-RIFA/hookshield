import { Schema, model, Document, Types } from 'mongoose';

export interface IEndpoint extends Document {
  _id: Types.ObjectId;
  ownerId: string;
  url: string;
  subscribedEvents: string[];
  enabled: boolean;
  encryptedSecret: string;
}

const endpointSchema = new Schema<IEndpoint>({
  ownerId: { type: String, required: true },
  url: { type: String, required: true },
  subscribedEvents: { type: [String], default: [] },
  enabled: { type: Boolean, default: true },
  encryptedSecret: { type: String, required: true },
});

export const Endpoint = model<IEndpoint>('Endpoint', endpointSchema);
