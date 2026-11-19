import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as endpointService from '../services/endpoint.service';

const createSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  description: z.string().max(200).optional(),
  subscribedEvents: z.array(z.string().min(1)).min(1, 'At least one event type required'),
  secret: z.string().min(16).optional(),
});

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  subscribedEvents: z.array(z.string().min(1)).optional(),
  description: z.string().max(200).optional(),
  url: z.string().url().optional(),
});

export async function createEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const ownerId = (req as any).ownerId;
    const result = await endpointService.createEndpoint({ ...parsed.data, ownerId });
    res.status(201).json({ success: true, data: result.endpoint, secret: result.secret });
  } catch (err) {
    next(err);
  }
}

export async function listEndpoints(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await endpointService.listEndpoints(ownerId, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const endpoint = await endpointService.getEndpoint(req.params.id as string, ownerId);
    res.json({ success: true, data: endpoint });
  } catch (err) {
    next(err);
  }
}

export async function updateEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const ownerId = (req as any).ownerId;
    const endpoint = await endpointService.updateEndpoint(req.params.id as string, ownerId, parsed.data);
    res.json({ success: true, data: endpoint });
  } catch (err) {
    next(err);
  }
}

export async function deleteEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    await endpointService.deleteEndpoint(req.params.id as string, ownerId);
    res.json({ success: true, message: 'Endpoint deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getEndpointSecret(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const secret = await endpointService.getEndpointSecret(req.params.id as string, ownerId);
    res.json({ success: true, secret });
  } catch (err) {
    next(err);
  }
}

export async function rotateEndpointSecret(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const result = await endpointService.rotateEndpointSecret(req.params.id as string, ownerId);
    res.json({ success: true, data: result.endpoint, secret: result.secret });
  } catch (err) {
    next(err);
  }
}

export async function testEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const result = await endpointService.testEndpoint(req.params.id as string, ownerId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
