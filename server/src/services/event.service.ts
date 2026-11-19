import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Event, IEvent } from '../models/Event';
import { Delivery, IDelivery } from '../models/Delivery';
import { IdempotencyKey } from '../models/IdempotencyKey';
import { findMatchingEndpoints } from './endpoint.service';
import { AppError } from '../middleware/errorHandler';

const MAX_PAYLOAD_BYTES = 65_536; // 64 KB

export interface CreateEventInput {
  ownerId: string;
  type: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export async function createEvent(input: CreateEventInput): Promise<{ event: IEvent; deliveriesCreated: number; duplicate: boolean }> {
  // Payload size guard
  const payloadSize = Buffer.byteLength(JSON.stringify(input.payload), 'utf8');
  if (payloadSize > MAX_PAYLOAD_BYTES) {
    throw new AppError(413, `Payload too large (max ${MAX_PAYLOAD_BYTES} bytes)`);
  }

  const eventId = uuidv4();

  // Atomic idempotency reservation to eliminate race conditions under concurrent duplicates
  if (input.idempotencyKey) {
    try {
      await IdempotencyKey.create({
        ownerId: input.ownerId,
        key: input.idempotencyKey,
        eventId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    } catch (err: any) {
      if (err.code === 11000) {
        // Unique compound index collision: Another request with this key already won or is in progress
        const existingRecord = await IdempotencyKey.findOne({ ownerId: input.ownerId, key: input.idempotencyKey });
        if (existingRecord) {
          // Poll briefly in case winning thread is currently saving
          let existingEvent = await Event.findOne({ eventId: existingRecord.eventId });
          if (!existingEvent) {
            await new Promise((resolve) => setTimeout(resolve, 80));
            existingEvent = await Event.findOne({ eventId: existingRecord.eventId });
          }
          if (existingEvent) {
            return { event: existingEvent, deliveriesCreated: 0, duplicate: true };
          }
        }
      }
      throw err;
    }
  }

  const event = new Event({
    eventId,
    ownerId: input.ownerId,
    type: input.type,
    payload: input.payload,
  });
  await event.save();

  // Find matching endpoints and create delivery jobs
  const matchingEndpoints = await findMatchingEndpoints(input.ownerId, input.type);
  if (matchingEndpoints.length > 0) {
    const deliveries = matchingEndpoints.map((ep) => ({
      eventId: event._id,
      endpointId: ep._id,
      ownerId: input.ownerId,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(),
    }));
    await Delivery.insertMany(deliveries);
  }

  return { event, deliveriesCreated: matchingEndpoints.length, duplicate: false };
}

export async function listEvents(
  ownerId: string,
  page = 1,
  limit = 20
): Promise<{ data: IEvent[]; total: number; page: number; pages: number }> {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Event.find({ ownerId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Event.countDocuments({ ownerId }),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) };
}

export async function getEvent(
  idOrEventId: string,
  ownerId: string
): Promise<{ event: IEvent; deliveries: IDelivery[] }> {
  const isObjectId = mongoose.Types.ObjectId.isValid(idOrEventId);
  const event = await Event.findOne({
    $or: [
      { eventId: idOrEventId },
      ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(idOrEventId) }] : []),
    ],
    ownerId,
  });
  if (!event) throw new AppError(404, 'Event not found');

  const deliveries = await Delivery.find({ eventId: event._id, ownerId })
    .populate('endpointId', 'url description')
    .sort({ createdAt: -1 });

  return { event, deliveries };
}
