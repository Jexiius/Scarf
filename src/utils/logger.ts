import pino from 'pino';
import { env } from '../config/env';

const prettyTransport =
  env.isProduction
    ? null
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: true,
          ignore: 'pid,hostname',
        },
      };

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(prettyTransport ? { transport: prettyTransport } : {}),
});
