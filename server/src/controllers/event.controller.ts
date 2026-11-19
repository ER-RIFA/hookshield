import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as eventService from '../services/event.service';

const createSchema = z.object({
  type: z.string().min(1).max(100).regex(/^[a-z0-9_.]+$/, 'Event type must be lowercase alphanumeric with dots/underscores'),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().max(256).optional(),
});

export async function createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const ownerId = (req as any).ownerId;
    const result = await eventService.createEvent({ ...parsed.data, ownerId });
    const status = result.duplicate ? 200 : 201;
    res.status(status).json({ success: true, duplicate: result.duplicate, deliveriesCreated: result.deliveriesCreated, data: result.event });
  } catch (err) {
    next(err);
  }
}

export async function listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await eventService.listEvents(ownerId, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const result = await eventService.getEvent(req.params.id as string, ownerId);
    res.json({ success: true, data: result.event, deliveries: result.deliveries });
  } catch (err) {
    next(err);
  }
}
