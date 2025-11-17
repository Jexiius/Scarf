import { eq, lt, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { rateLimits } from '../db/schema';

export interface RateLimitRecord {
  key: string;
  count: number;
  resetAt: Date;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitRecord>;
  get(key: string): Promise<RateLimitRecord | null>;
  reset(key: string): Promise<void>;
  cleanupExpired(): Promise<number>;
}

export class PostgresRateLimitStore implements RateLimitStore {
  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = new Date();
    const newResetAt = new Date(now.getTime() + windowMs);

    const [record] = await db
      .insert(rateLimits)
      .values({
        key,
        count: 1,
        resetAt: newResetAt,
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.resetAt} <= NOW() THEN 1 ELSE ${rateLimits.count} + 1 END`,
          resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= NOW() THEN ${newResetAt} ELSE ${rateLimits.resetAt} END`,
        },
      })
      .returning();

    if (!record) {
      throw new Error('Failed to update rate limit');
    }

    return {
      key: record.key,
      count: Number(record.count),
      resetAt: record.resetAt,
    };
  }

  async get(key: string): Promise<RateLimitRecord | null> {
    const [record] = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1);

    if (!record) {
      return null;
    }

    // Check if expired
    if (record.resetAt <= new Date()) {
      return null;
    }

    return {
      key: record.key,
      count: Number(record.count),
      resetAt: record.resetAt,
    };
  }

  async reset(key: string): Promise<void> {
    await db.delete(rateLimits).where(eq(rateLimits.key, key));
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(rateLimits)
      .where(lt(rateLimits.resetAt, now));

    return result.rowCount ?? 0;
  }
}

// Singleton instance
let storeInstance: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (!storeInstance) {
    storeInstance = new PostgresRateLimitStore();
  }
  return storeInstance;
}
