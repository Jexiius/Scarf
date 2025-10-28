import type { Context } from 'hono';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { AppBindings } from '../types/app';
import type { StatusCode } from 'hono/utils/http-status';

export const errorHandler = (error: Error, c: Context<AppBindings>) => {
  const requestId = c.get('requestId');
  const errorId = randomUUID();

  logger.error({ err: error, path: c.req.path, requestId, errorId }, 'Unhandled error');

  if (error instanceof AppError) {
    c.status(error.statusCode as StatusCode);
    return c.json({
      error: {
        message: error.message,
        statusCode: error.statusCode,
        requestId,
        errorId,
      },
    });
  }

  c.status(500);
  return c.json({
    error: {
      message: 'Internal server error',
      statusCode: 500,
      requestId,
      errorId,
    },
  });
};
