import type { Context, Next } from 'hono';
import type { AppBindings } from '../types/app';

type RateLimiterOptions = {
  windowMs: number;
  tiers: {
    anonymous: number;
    free: number;
    premium: number;
  };
};

type RateLimitRecord = {
  count: number;
  resetAt: number;
  timeout: ReturnType<typeof setTimeout>;
};

const DEFAULT_OPTIONS: RateLimiterOptions = {
  windowMs: 60 * 60 * 1000,
  tiers: {
    anonymous: 30,
    free: 120,
    premium: 1200,
  },
};

const store = new Map<string, RateLimitRecord>();

const resolveIdentifier = (c: Context<AppBindings>) =>
  c.get('user')?.id ??
  c.req.header('x-request-id') ??
  c.req.header('x-forwarded-for') ??
  c.req.header('cf-connecting-ip') ??
  c.req.header('x-real-ip') ??
  'anonymous';

export const rateLimiter = (options?: Partial<RateLimiterOptions>) => {
  const config: RateLimiterOptions = {
    windowMs: options?.windowMs ?? DEFAULT_OPTIONS.windowMs,
    tiers: {
      anonymous: options?.tiers?.anonymous ?? DEFAULT_OPTIONS.tiers.anonymous,
      free: options?.tiers?.free ?? DEFAULT_OPTIONS.tiers.free,
      premium: options?.tiers?.premium ?? DEFAULT_OPTIONS.tiers.premium,
    },
  };

  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    const key = resolveIdentifier(c);
    const now = Date.now();
    const existing = store.get(key);

    const limitTier = user
      ? user.subscriptionTier === 'premium'
        ? 'premium'
        : 'free'
      : 'anonymous';

    const limit = config.tiers[limitTier];

    if (!existing || existing.resetAt <= now) {
      if (existing?.timeout) {
        clearTimeout(existing.timeout);
      }

      const timeout = setTimeout(() => {
        store.delete(key);
      }, config.windowMs);

      if (typeof timeout.unref === 'function') {
        timeout.unref();
      }

      store.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
        timeout,
      });
    } else {
      existing.count += 1;
    }

    const record = store.get(key)!;

    if (record.count > limit) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      c.header('Retry-After', retryAfterSeconds.toString());
      c.header('X-RateLimit-Limit', limit.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', new Date(record.resetAt).toISOString());
      c.header('X-RateLimit-Window', (config.windowMs / 1000).toString());

      return c.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', Math.max(limit - record.count, 0).toString());
    c.header('X-RateLimit-Reset', new Date(record.resetAt).toISOString());
    c.header('X-RateLimit-Window', (config.windowMs / 1000).toString());

    return next();
  };
};
