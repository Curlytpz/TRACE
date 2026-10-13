import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const asyncHandler = (handler: RequestHandler): RequestHandler =>
  (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    response.status(400).json({ error: 'Invalid request.', details: error.flatten().fieldErrors });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    response.status(409).json({ error: 'That relationship already exists.' });
    return;
  }

  console.error(error);
  response.status(500).json({ error: 'Internal server error.' });
}
