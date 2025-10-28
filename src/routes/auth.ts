import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { AuthService } from '../services/auth.service';
import type { AppBindings } from '../types/app';

const authService = new AuthService();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
  name: z.string().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
});

export const authRouter = new Hono<AppBindings>();

authRouter.post('/register', zValidator('json', registerSchema), async (c) => {
  const payload = c.req.valid('json');
  const result = await authService.register(payload);
  return c.json(result, 201);
});

authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  const payload = c.req.valid('json');
  const result = await authService.login(payload);
  return c.json(result);
});

export default authRouter;
