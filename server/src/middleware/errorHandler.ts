import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({ success: false, error: err.message });
    return;
  }

  // Mongoose duplicate key
  if ((err as NodeJS.ErrnoException).name === 'MongoServerError' && (err as any).code === 11000) {
    res.status(409).json({ success: false, error: 'Duplicate entry' });
    return;
  }

  // Unknown
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
}
