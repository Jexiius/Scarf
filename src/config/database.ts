import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import { env } from './env';

function resolveSslConfig(): boolean | { rejectUnauthorized: boolean } | undefined {
  if (env.DATABASE_SSL === 'disable') {
    return undefined;
  }

  if (env.DATABASE_SSL === 'require') {
    return { rejectUnauthorized: false };
  }

  return env.isProduction ? { rejectUnauthorized: false } : undefined;
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
  ssl: resolveSslConfig(),
});

export const db = drizzle(pool, { schema });

export async function testConnection(): Promise<void> {
  const result = await pool.query<{ now: string }>('SELECT NOW()');
  const now = result.rows[0]?.now;
  if (!now) {
    throw new Error('Database connection succeeded but returned no timestamp');
  }
  console.log('✅ Database connected:', now);
}

export async function closePool(): Promise<void> {
  await pool.end();
}
