import type { Context, Next } from 'hono';
import { env } from '../config/env';
import type { AppBindings } from '../types/app';

export const securityHeaders = async (c: Context<AppBindings>, next: Next) => {
  await next();

  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-DNS-Prefetch-Control', 'off');
  c.header('Cross-Origin-Resource-Policy', 'same-site');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (env.isProduction) {
    c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
};
