import { Request, Response, NextFunction } from 'express';

/**
 * Simple demo authentication middleware.
 * In production, replace with JWT/OAuth2 verification.
 * For this demo, ownerId is extracted from the X-Owner-Id header (or defaults to 'demo-user').
 */
export function auth(req: Request, _res: Response, next: NextFunction): void {
  const ownerId = (req.headers['x-owner-id'] as string) || 'demo-user';
  (req as any).ownerId = ownerId;
  next();
}
