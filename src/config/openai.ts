import OpenAI from 'openai';
import { env } from './env';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const MODELS = {
  FAST: 'gpt-4o-mini',
  SMART: 'gpt-4o',
  EMBEDDING: 'text-embedding-3-small',
} as const;
