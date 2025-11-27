import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Context } from 'hono';
import { requireAdmin } from '../../src/middleware/require-admin';
import type { AppBindings } from '../../src/types/app';
import type { UserPayload } from '../../src/types/user';

// Mock env
vi.mock('../../src/config/env', () => ({
  env: {
    isDevelopment: false,
    isProduction: true,
    MONITORING_ADMIN_EMAILS: 'admin@example.com,ops@example.com',
    MONITORING_ALLOWED_IPS: '192.168.1.100,10.0.0.0/24',
    MONITORING_SERVICE_TOKEN: 'test-service-token-123',
  },
}));

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('requireAdmin Middleware', () => {
  let mockContext: Partial<Context<AppBindings>>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn().mockResolvedValue(new Response());

    mockContext = {
      get: vi.fn(),
      req: {
        header: vi.fn(),
        path: '/api/v1/monitoring',
        method: 'GET',
      } as any,
      json: vi.fn().mockReturnValue(new Response()),
    } as any;
  });

  describe('JWT Admin Flag', () => {
    it('should allow access when user has isAdmin: true', async () => {
      const adminUser: UserPayload = {
        id: 'user-123',
        email: 'admin@example.com',
        subscriptionTier: 'premium',
        isAdmin: true,
      };
      (mockContext.get as any).mockReturnValue(adminUser);
      (mockContext.req.header as any).mockReturnValue(null);

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access when user has isAdmin: false', async () => {
      const regularUser: UserPayload = {
        id: 'user-123',
        email: 'user@example.com',
        subscriptionTier: 'free',
        isAdmin: false,
      };
      (mockContext.get as any).mockReturnValue(regularUser);
      (mockContext.req.header as any).mockReturnValue(null);

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Forbidden') }),
        { status: 403 },
      );
    });
  });

  describe('Email Allowlist', () => {
    it('should allow access when email is in allowlist', async () => {
      const user: UserPayload = {
        id: 'user-123',
        email: 'admin@example.com',
        subscriptionTier: 'free',
      };
      (mockContext.get as any).mockReturnValue(user);
      (mockContext.req.header as any).mockReturnValue(null);

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access for case-insensitive email match', async () => {
      const user: UserPayload = {
        id: 'user-123',
        email: 'ADMIN@EXAMPLE.COM',
        subscriptionTier: 'free',
      };
      (mockContext.get as any).mockReturnValue(user);
      (mockContext.req.header as any).mockReturnValue(null);

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access when email is not in allowlist', async () => {
      const user: UserPayload = {
        id: 'user-123',
        email: 'user@example.com',
        subscriptionTier: 'free',
      };
      (mockContext.get as any).mockReturnValue(user);
      (mockContext.req.header as any).mockReturnValue(null);

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Forbidden') }),
        { status: 403 },
      );
    });
  });

  describe('IP Allowlist', () => {
    it('should allow access when IP matches exact IP', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockImplementation((name: string) => {
        if (name === 'cf-connecting-ip') return '192.168.1.100';
        return null;
      });

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access when IP matches CIDR block', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockImplementation((name: string) => {
        if (name === 'x-real-ip') return '10.0.0.50';
        return null;
      });

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access when IP does not match', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockImplementation((name: string) => {
        if (name === 'cf-connecting-ip') return '1.2.3.4';
        return null;
      });

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Forbidden') }),
        { status: 403 },
      );
    });
  });

  describe('Service Token', () => {
    it('should allow access with valid service token', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockImplementation((name: string) => {
        if (name === 'x-monitoring-token') return 'test-service-token-123';
        return null;
      });

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access with invalid service token', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockImplementation((name: string) => {
        if (name === 'x-monitoring-token') return 'wrong-token';
        return null;
      });

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Forbidden') }),
        { status: 403 },
      );
    });
  });

  describe('Development Mode', () => {
    it('should allow access in development mode', async () => {
      const envModule = await import('../../src/config/env');
      const original = envModule.env.isDevelopment;
      envModule.env.isDevelopment = true;

      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockReturnValue(null);

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).toHaveBeenCalled();

      envModule.env.isDevelopment = original;
    });
  });

  describe('Unauthenticated Requests', () => {
    it('should deny access when no user is authenticated', async () => {
      (mockContext.get as any).mockReturnValue(null);
      (mockContext.req.header as any).mockReturnValue(null);

      await requireAdmin(mockContext as Context<AppBindings>, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Forbidden') }),
        { status: 403 },
      );
    });
  });
});
