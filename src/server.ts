import { serve } from '@hono/node-server';
import app from './app';
import { closePool } from './config/database';
import { env } from './config/env';
import { logger } from './utils/logger';

const port = env.PORT;

serve({
  fetch: app.fetch,
  port,
});

logger.info(`Server listening on http://localhost:${port}`);

const gracefulShutdown = async () => {
  logger.info('Shutting down server');
  await closePool();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
