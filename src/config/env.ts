import { config } from 'dotenv';
import { z } from 'zod';

const dotenvOptions: Parameters<typeof config>[0] = {};

if (process.env.DOTENV_PATH) {
  dotenvOptions.path = process.env.DOTENV_PATH;
}

config(dotenvOptions);

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.enum(['require', 'disable']).optional(),
  OPENAI_API_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32).optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  FEATURE_EXTRACTION_CONCURRENCY: z.coerce.number().int().positive().max(10).default(3),
  FEATURE_EXTRACTOR_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(25),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

type BaseEnv = z.infer<typeof envSchema>;

const parsed = envSchema.parse(process.env);

if (parsed.NODE_ENV === 'production' && !parsed.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production environments');
}

export const env: BaseEnv & {
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
} = {
  ...parsed,
  isDevelopment: parsed.NODE_ENV === 'development',
  isProduction: parsed.NODE_ENV === 'production',
  isTest: parsed.NODE_ENV === 'test',
};

export type Env = typeof env;
