import pino from 'pino';
import { env } from '../config/env';

const loggerConfig: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
};

// Only use pino-pretty in development (use validated env config)
if (env.isDevelopment) {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true,
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(loggerConfig);
