import { Request, Response, NextFunction } from 'express';

/**
 * Authentication & Tenant Context Middleware.
 * Extracts the tenant / owner identity from:
 * 1. Bearer token in Authorization header
 * 2. X-API-Key header
 * 3. X-Owner-Id header
 * Defaults to 'demo-user' for local testing and developer velocity.
 */
export function auth(req: Request, _res: Response, next: NextFunction): void {
  let ownerId: string | undefined;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    ownerId = authHeader.substring(7).trim();
  }

  if (!ownerId && req.headers['x-api-key']) {
    ownerId = (req.headers['x-api-key'] as string).trim();
  }

  if (!ownerId && req.headers['x-owner-id']) {
    ownerId = (req.headers['x-owner-id'] as string).trim();
  }

  // Fallback for demo/development environments
  (req as any).ownerId = ownerId || 'demo-user';
  next();
}
