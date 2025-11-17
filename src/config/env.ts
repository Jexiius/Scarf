import { setDefaultResultOrder } from 'node:dns';
import { config } from 'dotenv';
import { z } from 'zod';

try {
  setDefaultResultOrder('ipv4first');
} catch {
  // Older Node.js versions may not support setDefaultResultOrder; ignore.
}

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
  DATABASE_CA_PATH: z.string().optional(), // Path to CA certificate file
  DATABASE_CA: z.string().optional(), // Inline CA certificate content
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).optional(), // Allow disabling cert validation (dev only)
  OPENAI_API_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32).optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  FEATURE_EXTRACTION_CONCURRENCY: z.coerce.number().int().positive().max(10).default(3),
  FEATURE_EXTRACTOR_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(25),
  QUEUE_TASK_TIMEOUT_MS: z.coerce.number().int().positive().default(30 * 60 * 1000), // 30 minutes default
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  MONITORING_ADMIN_EMAILS: z.string().optional(), // Comma-separated list of admin emails
  MONITORING_ALLOWED_IPS: z.string().optional(), // Comma-separated list of allowed IPs/CIDR blocks
  MONITORING_SERVICE_TOKEN: z.string().optional(), // Service-to-service token for monitoring access
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
