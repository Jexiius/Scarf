import pino from 'pino';
import { env } from '../config/env';

const loggerConfig: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
};

// Only use pino-pretty in development if it's available (it's a devDependency)
if (env.isDevelopment) {
  try {
    // Check if pino-pretty is available before using it
    require.resolve('pino-pretty');
    loggerConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: true,
        ignore: 'pid,hostname',
      },
    };
  } catch {
    // pino-pretty not available, use default JSON logging
  }
}

export const logger = pino(loggerConfig);
