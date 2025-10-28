import pino from 'pino';

const prettyTransport =
  process.env.NODE_ENV === 'production'
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
  level: process.env.LOG_LEVEL ?? 'info',
  ...(prettyTransport ? { transport: prettyTransport } : {}),
});
