import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import { env } from './env';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
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
