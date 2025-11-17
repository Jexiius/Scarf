import { and, eq, lt, sql } from 'drizzle-orm';
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
    const resetAt = new Date(now.getTime() + windowMs);

    // Check if record exists and is still valid
    const existing = await this.get(key);

    if (existing) {
      // Record exists and is within window - increment
      const [updated] = await db
        .update(rateLimits)
        .set({
          count: sql`${rateLimits.count} + 1`,
        })
        .where(eq(rateLimits.key, key))
        .returning();

      if (!updated) {
        throw new Error('Failed to update rate limit');
      }

      return {
        key: updated.key,
        count: Number(updated.count),
        resetAt: updated.resetAt,
      };
    } else {
      // Record doesn't exist or is expired - insert or reset
      const result = await db
        .insert(rateLimits)
        .values({
          key,
          count: 1,
          resetAt,
        })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: {
            count: 1,
            resetAt,
          },
        })
        .returning();

      const record = result[0];
      if (!record) {
        throw new Error('Failed to insert rate limit');
      }

      return {
        key: record.key,
        count: Number(record.count),
        resetAt: record.resetAt,
      };
    }
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

