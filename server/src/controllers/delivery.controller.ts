import { Request, Response, NextFunction } from 'express';
import * as deliveryService from '../services/delivery.service';

export async function listDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const filters = {
      status: req.query.status as string | undefined,
      endpointId: req.query.endpointId as string | undefined,
      eventId: req.query.eventId as string | undefined,
    };
    const result = await deliveryService.listDeliveries(ownerId, filters, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const result = await deliveryService.getDeliveryDetails(req.params.id as string, ownerId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function replayDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const delivery = await deliveryService.replayDelivery(req.params.id as string, ownerId);
    res.json({ success: true, data: delivery });
  } catch (err) {
    next(err);
  }
}

export async function replayAllFailed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const result = await deliveryService.replayAllFailed(ownerId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = (req as any).ownerId;
    const stats = await deliveryService.getDashboardStats(ownerId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}
