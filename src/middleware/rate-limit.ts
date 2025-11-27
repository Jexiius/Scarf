import type { Context, Next } from 'hono';
import { getRateLimitStore, type RateLimitRecord } from '../repositories/rate-limit.repository';
import { logger } from '../utils/logger';
import type { AppBindings } from '../types/app';

type RateLimiterOptions = {
  windowMs: number;
  tiers: {
    anonymous: number;
    free: number;
    premium: number;
  };
};

const DEFAULT_OPTIONS: RateLimiterOptions = {
  windowMs: 60 * 60 * 1000, // 1 hour
  tiers: {
    anonymous: 30,
    free: 120,
    premium: 1200,
  },
};

/**
 * Resolves the identifier for rate limiting with proper priority:
 * 1. Authenticated user ID (most reliable)
 * 2. Trusted proxy headers (cf-connecting-ip, x-real-ip)
 * 3. Less trusted headers (x-forwarded-for - may contain multiple IPs)
 * 4. Never use user-controlled headers like x-request-id
 */
const resolveIdentifier = (c: Context<AppBindings>): string => {
  const user = c.get('user');
  
  // Priority 1: Authenticated user ID
  if (user?.id) {
    return `user:${user.id}`;
  }

  // Priority 2: Trusted proxy headers (Cloudflare, nginx, etc.)
  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) {
    return `ip:${cfConnectingIp}`;
  }

  const xRealIp = c.req.header('x-real-ip');
  if (xRealIp) {
    return `ip:${xRealIp}`;
  }

  // Priority 3: x-forwarded-for (less trusted, may contain multiple IPs)
  // Take the first IP in the chain (original client)
  const xForwardedFor = c.req.header('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return `ip:${firstIp}`;
    }
  }

  // Fallback: anonymous (should rarely happen in production with proper proxy setup)
  return 'anonymous';
};

export const rateLimiter = (options?: Partial<RateLimiterOptions>) => {
  const config: RateLimiterOptions = {
    windowMs: options?.windowMs ?? DEFAULT_OPTIONS.windowMs,
    tiers: {
      anonymous: options?.tiers?.anonymous ?? DEFAULT_OPTIONS.tiers.anonymous,
      free: options?.tiers?.free ?? DEFAULT_OPTIONS.tiers.free,
      premium: options?.tiers?.premium ?? DEFAULT_OPTIONS.tiers.premium,
    },
  };

  const store = getRateLimitStore();

  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    const identifier = resolveIdentifier(c);
    const now = Date.now();

    const limitTier = user
      ? user.subscriptionTier === 'premium'
        ? 'premium'
        : 'free'
      : 'anonymous';

    const limit = config.tiers[limitTier];

    try {
      // Increment the counter (this handles window reset automatically)
      const record = await store.increment(identifier, config.windowMs);

      const remaining = Math.max(limit - record.count, 0);
      const resetAtMs = record.resetAt.getTime();
      const retryAfterSeconds = Math.ceil((resetAtMs - now) / 1000);

      // Set rate limit headers
      c.header('X-RateLimit-Limit', limit.toString());
      c.header('X-RateLimit-Remaining', remaining.toString());
      c.header('X-RateLimit-Reset', record.resetAt.toISOString());
      c.header('X-RateLimit-Window', (config.windowMs / 1000).toString());

      // Check if limit exceeded
      if (record.count > limit) {
        logger.warn(
          {
            identifier,
            limitTier,
            count: record.count,
            limit,
            path: c.req.path,
            method: c.req.method,
          },
          'Rate limit exceeded',
        );

        c.header('Retry-After', retryAfterSeconds.toString());

        return c.json(
          {
            error: 'Rate limit exceeded',
            retryAfter: retryAfterSeconds,
          },
          { status: 429 },
        );
      }

      // Log if approaching limit (80% threshold)
      if (record.count >= limit * 0.8) {
        logger.debug(
          {
            identifier,
            limitTier,
            count: record.count,
            limit,
            remaining,
          },
          'Rate limit approaching threshold',
        );
      }

      return next();
    } catch (error) {
      // If store operation fails, log error but allow request through
      // This prevents rate limit store failures from breaking the API
      logger.error(
        {
          identifier,
          error: error instanceof Error ? error.message : String(error),
        },
        'Rate limit store operation failed',
      );

      // Allow request through on store failure (fail open)
      return next();
    }
  };
};
