import { config } from 'dotenv';
import { z } from 'zod';

const dotenvOptions: Parameters<typeof config>[0] = {};

if (process.env.DOTENV_PATH) {
  dotenvOptions.path = process.env.DOTENV_PATH;
}

config(dotenvOptions);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32).optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
