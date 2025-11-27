import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Context } from 'hono';
import { rateLimiter } from '../../src/middleware/rate-limit';
import { getRateLimitStore, PostgresRateLimitStore } from '../../src/repositories/rate-limit.repository';
import type { AppBindings } from '../../src/types/app';

// Mock the rate limit store
vi.mock('../../src/repositories/rate-limit.repository', () => {
  const mockStore = {
    increment: vi.fn(),
    get: vi.fn(),
    reset: vi.fn(),
    cleanupExpired: vi.fn(),
  };

  return {
    getRateLimitStore: () => mockStore,
    PostgresRateLimitStore: vi.fn(),
  };
});

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Rate Limiter Middleware', () => {
  let mockContext: Partial<Context<AppBindings>>;
  let mockNext: ReturnType<typeof vi.fn>;
  let mockStore: ReturnType<typeof getRateLimitStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = getRateLimitStore();
    mockNext = vi.fn().mockResolvedValue(new Response());

    mockContext = {
      get: vi.fn(),
      req: {
        header: vi.fn(),
        path: '/api/test',
        method: 'GET',
      } as any,
      header: vi.fn(),
      json: vi.fn().mockReturnValue(new Response()),
    } as any;
  });

  describe('Identifier Resolution', () => {
    it('should use user ID for authenticated users', async () => {
      (mockContext.get as any).mockReturnValue({ id: 'user-123', subscriptionTier: 'free' });
      (mockContext.req.header as any).mockReturnValue(null);

      const now = Date.now();
      const resetAt = new Date(now + 3600000);
      (mockStore.increment as any).mockResolvedValue({
        key: 'user:user-123',
        count: 1,
        resetAt,
      });

      const middleware = rateLimiter();
      await middleware(mockContext as Context<AppBindings>, mockNext);

      expect(mockStore.increment).toHaveBeenCalledWith('user:user-123', expect.any(Number));
    });

    it('should prioritize cf-connecting-ip over x-forwarded-for', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockImplementation((name: string) => {
        if (name === 'cf-connecting-ip') return '1.2.3.4';
        if (name === 'x-forwarded-for') return '5.6.7.8';
        return null;
      });

      const now = Date.now();
      const resetAt = new Date(now + 3600000);
      (mockStore.increment as any).mockResolvedValue({
        key: 'ip:1.2.3.4',
        count: 1,
        resetAt,
      });

      const middleware = rateLimiter();
      await middleware(mockContext as Context<AppBindings>, mockNext);

      expect(mockStore.increment).toHaveBeenCalledWith('ip:1.2.3.4', expect.any(Number));
    });

    it('should use x-real-ip when cf-connecting-ip is not available', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockImplementation((name: string) => {
        if (name === 'x-real-ip') return '9.10.11.12';
        return null;
      });

      const now = Date.now();
      const resetAt = new Date(now + 3600000);
      (mockStore.increment as any).mockResolvedValue({
        key: 'ip:9.10.11.12',
        count: 1,
        resetAt,
      });

      const middleware = rateLimiter();
      await middleware(mockContext as Context<AppBindings>, mockNext);

      expect(mockStore.increment).toHaveBeenCalledWith('ip:9.10.11.12', expect.any(Number));
    });

    it('should never use x-request-id header', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockImplementation((name: string) => {
        if (name === 'x-request-id') return 'spoofed-id';
        if (name === 'x-forwarded-for') return '1.2.3.4';
        return null;
      });

      const now = Date.now();
      const resetAt = new Date(now + 3600000);
      (mockStore.increment as any).mockResolvedValue({
        key: 'ip:1.2.3.4',
        count: 1,
        resetAt,
      });

      const middleware = rateLimiter();
      await middleware(mockContext as Context<AppBindings>, mockNext);

      // Should use x-forwarded-for, not x-request-id
      expect(mockStore.increment).toHaveBeenCalledWith('ip:1.2.3.4', expect.any(Number));
      expect(mockStore.increment).not.toHaveBeenCalledWith('spoofed-id', expect.any(Number));
    });
  });

  describe('Rate Limit Enforcement', () => {
    it('should allow requests under the limit', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockReturnValue(null);

      const now = Date.now();
      const resetAt = new Date(now + 3600000);
      (mockStore.increment as any).mockResolvedValue({
        key: 'anonymous',
        count: 15,
        resetAt,
      });

      const middleware = rateLimiter({
        tiers: { anonymous: 30, free: 120, premium: 1200 },
      });
      await middleware(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '15');
    });

    it('should block requests exceeding the limit', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockReturnValue(null);

      const now = Date.now();
      const resetAt = new Date(now + 3600000);
      (mockStore.increment as any).mockResolvedValue({
        key: 'anonymous',
        count: 31,
        resetAt,
      });

      const middleware = rateLimiter({
        tiers: { anonymous: 30, free: 120, premium: 1200 },
      });
      const result = await middleware(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.header).toHaveBeenCalledWith('Retry-After', expect.any(String));
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded',
        }),
        { status: 429 },
      );
    });

    it('should apply different limits for premium users', async () => {
      (mockContext.get as any).mockReturnValue({
        id: 'user-123',
        subscriptionTier: 'premium',
      });
      (mockContext.req.header as any).mockReturnValue(null);

      const now = Date.now();
      const resetAt = new Date(now + 3600000);
      (mockStore.increment as any).mockResolvedValue({
        key: 'user:user-123',
        count: 500,
        resetAt,
      });

      const middleware = rateLimiter({
        tiers: { anonymous: 30, free: 120, premium: 1200 },
      });
      await middleware(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '1200');
    });
  });

  describe('Error Handling', () => {
    it('should fail open if store operation fails', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockReturnValue(null);
      (mockStore.increment as any).mockRejectedValue(new Error('Database error'));

      const middleware = rateLimiter();
      await middleware(mockContext as Context<AppBindings>, mockNext);

      // Should allow request through on error
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

