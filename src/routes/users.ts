import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '../middleware/auth';
import { SavedRestaurantsService } from '../services/saved-restaurants.service';
import { UserRepository } from '../repositories/user.repository';
import { UserQueryRepository } from '../repositories/user-query.repository';
import type { AppBindings } from '../types/app';

const savedRestaurantsService = new SavedRestaurantsService();
const userRepository = new UserRepository();
const userQueryRepository = new UserQueryRepository();

const saveRestaurantSchema = z.object({
  restaurantId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
  personalRating: z.number().int().min(1).max(5).optional(),
  visited: z.boolean().optional(),
  visitedAt: z.string().datetime({ offset: true }).optional(),
});

const restaurantIdParamSchema = z.object({
  restaurantId: z.string().uuid(),
});

const queryHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const userRouter = new Hono<AppBindings>();

userRouter.use('/me', requireAuth);
userRouter.use('/me/*', requireAuth);

userRouter.get('/me', async (c) => {
  const userPayload = c.get('user');
  const user = userPayload ? await userRepository.findById(userPayload.id) : null;

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const { passwordHash: _passwordHash, ...rest } = user;
  return c.json({ user: rest });
});

userRouter.get('/me/saved', async (c) => {
  const user = c.get('user');
  const saved = await savedRestaurantsService.list(user!.id);
  return c.json({ items: saved });
});

userRouter.post('/me/saved', zValidator('json', saveRestaurantSchema), async (c) => {
  const user = c.get('user');
  const payload = c.req.valid('json');
  const saved = await savedRestaurantsService.save(user!.id, payload);
  return c.json(saved, 201);
});

userRouter.delete(
  '/me/saved/:restaurantId',
  zValidator('param', restaurantIdParamSchema),
  async (c) => {
    const user = c.get('user');
    const params = c.req.valid('param');
    await savedRestaurantsService.remove(user!.id, params.restaurantId);
    return c.json({ success: true });
  },
);

userRouter.get('/me/queries', zValidator('query', queryHistorySchema), async (c) => {
  const user = c.get('user');
  const { limit } = c.req.valid('query');
  const queries = await userQueryRepository.findRecentByUser(user!.id, limit ?? 20);
  return c.json({ items: queries });
});

export default userRouter;
