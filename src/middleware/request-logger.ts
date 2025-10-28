import type { Context, Next } from 'hono';
import { randomUUID } from 'node:crypto';
import type { AppBindings } from '../types/app';
import { logger } from '../utils/logger';

export const requestLogger = async (c: Context<AppBindings>, next: Next) => {
  const start = Date.now();
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  c.header('X-Request-Id', requestId);
  c.set('requestId', requestId);

  await next();

  const durationMs = Date.now() - start;
  const user = c.get('user');

  logger.info(
    {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
      userId: user?.id,
    },
    'request completed',
  );
};
