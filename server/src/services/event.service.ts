import { v4 as uuidv4 } from 'uuid';
import { Event, IEvent } from '../models/Event';
import { Delivery } from '../models/Delivery';
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

  // Idempotency deduplication
  if (input.idempotencyKey) {
    const existing = await IdempotencyKey.findOne({ ownerId: input.ownerId, key: input.idempotencyKey });
    if (existing) {
      const event = await Event.findOne({ eventId: existing.eventId });
      if (event) {
        return { event, deliveriesCreated: 0, duplicate: true };
      }
    }
  }

  const eventId = uuidv4();
  const event = new Event({
    eventId,
    ownerId: input.ownerId,
    type: input.type,
    payload: input.payload,
  });
  await event.save();

  // Store idempotency key with 24-hour expiry
  if (input.idempotencyKey) {
    try {
      await IdempotencyKey.create({
        ownerId: input.ownerId,
        key: input.idempotencyKey,
        eventId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    } catch {
      // Concurrent duplicate — race condition handled; continue
    }
  }

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

export async function getEvent(eventId: string, ownerId: string): Promise<IEvent> {
  const event = await Event.findOne({ eventId, ownerId });
  if (!event) throw new AppError(404, 'Event not found');
  return event;
}
