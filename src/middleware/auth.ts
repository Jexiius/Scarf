import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { env } from '../config/env';
import type { AppBindings } from '../types/app';
import type { UserPayload } from '../types/user';

export const auth = async (c: Context<AppBindings>, next: Next) => {
  const authorization = c.req.header('Authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return next();
  }

  if (!env.JWT_SECRET) {
    return c.json({ error: 'Authentication is not configured' }, { status: 500 });
  }

  const token = authorization.slice('Bearer '.length);

  try {
    const payload = (await verify(token, env.JWT_SECRET)) as unknown as UserPayload;
    c.set('user', payload);
  } catch {
    return c.json({ error: 'Invalid token' }, { status: 401 });
  }

  return next();
};

export const requireAuth = async (c: Context<AppBindings>, next: Next) => {
  await auth(
    c,
    async () => {
      /* no-op to reuse auth logic */
    },
  );

  if (!c.get('user')) {
    return c.json({ error: 'Authentication required' }, { status: 401 });
  }

  return next();
};
