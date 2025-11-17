import type { Context, Next } from 'hono';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { AppBindings } from '../types/app';
import type { UserPayload } from '../types/user';

/**
 * Resolves the client IP address from request headers.
 * Prioritizes trusted proxy headers.
 */
function getClientIp(c: Context<AppBindings>): string | null {
  // Trusted proxy headers (Cloudflare, nginx, etc.)
  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const xRealIp = c.req.header('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  // x-forwarded-for (less trusted, take first IP)
  const xForwardedFor = c.req.header('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return null;
}

/**
 * Checks if an IP address matches an allowed IP or CIDR block.
 * Simple implementation - for production, consider using a library like ipaddr.js
 */
function isIpAllowed(clientIp: string, allowedIps: string): boolean {
  if (!allowedIps) {
    return false;
  }

  const allowed = allowedIps.split(',').map((ip) => ip.trim());
  
  for (const allowedIp of allowed) {
    // Exact match
    if (allowedIp === clientIp) {
      return true;
    }

    // CIDR block match (simple implementation for /24, /16, /8)
    if (allowedIp.includes('/')) {
      const [network, prefixLength] = allowedIp.split('/');
      const prefix = Number.parseInt(prefixLength, 10);
      
      // Simple CIDR matching for common cases
      if (prefix === 24) {
        const networkPrefix = network.split('.').slice(0, 3).join('.');
        const clientPrefix = clientIp.split('.').slice(0, 3).join('.');
        if (networkPrefix === clientPrefix) {
          return true;
        }
      } else if (prefix === 16) {
        const networkPrefix = network.split('.').slice(0, 2).join('.');
        const clientPrefix = clientIp.split('.').slice(0, 2).join('.');
        if (networkPrefix === clientPrefix) {
          return true;
        }
      } else if (prefix === 8) {
        const networkPrefix = network.split('.')[0];
        const clientPrefix = clientIp.split('.')[0];
        if (networkPrefix === clientPrefix) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Middleware to require admin access for monitoring endpoints.
 * 
 * Access is granted if ANY of the following conditions are met:
 * 1. User has isAdmin: true in JWT payload
 * 2. User email is in MONITORING_ADMIN_EMAILS env var
 * 3. Client IP is in MONITORING_ALLOWED_IPS env var
 * 4. Request includes valid MONITORING_SERVICE_TOKEN header
 * 
 * In development, access is always granted.
 */
export const requireAdmin = async (c: Context<AppBindings>, next: Next) => {
  // In development, allow access for easier testing
  if (env.isDevelopment) {
    logger.debug('Development mode: allowing monitoring access');
    return next();
  }

  const user = c.get('user') as UserPayload | undefined;
  const clientIp = getClientIp(c);
  const serviceToken = c.req.header('x-monitoring-token');

  // Check 1: JWT admin flag
  if (user?.isAdmin === true) {
    logger.debug({ userId: user.id, email: user.email }, 'Monitoring access granted via JWT admin flag');
    return next();
  }

  // Check 2: Email allowlist
  if (user?.email && env.MONITORING_ADMIN_EMAILS) {
    const adminEmails = env.MONITORING_ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase());
    if (adminEmails.includes(user.email.toLowerCase())) {
      logger.debug({ userId: user.id, email: user.email }, 'Monitoring access granted via email allowlist');
      return next();
    }
  }

  // Check 3: IP allowlist
  if (clientIp && env.MONITORING_ALLOWED_IPS) {
    if (isIpAllowed(clientIp, env.MONITORING_ALLOWED_IPS)) {
      logger.debug({ clientIp }, 'Monitoring access granted via IP allowlist');
      return next();
    }
  }

  // Check 4: Service token
  if (serviceToken && env.MONITORING_SERVICE_TOKEN) {
    if (serviceToken === env.MONITORING_SERVICE_TOKEN) {
      logger.debug({ clientIp }, 'Monitoring access granted via service token');
      return next();
    }
  }

  // Access denied
  logger.warn(
    {
      userId: user?.id,
      email: user?.email,
      clientIp,
      path: c.req.path,
      method: c.req.method,
    },
    'Monitoring access denied',
  );

  return c.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
};

