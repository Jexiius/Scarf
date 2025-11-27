import { Hono } from 'hono';
import { NotFoundError } from '../utils/errors';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { mapRestaurantToDto } from '../mappers/restaurant.mapper';
import type { AppBindings } from '../types/app';

const restaurantRepository = new RestaurantRepository();
export const restaurantRouter = new Hono<AppBindings>();

restaurantRouter.get('/:id', async (c) => {
  const { id } = c.req.param();

  const record = await restaurantRepository.findById(id);
  if (!record) {
    throw new NotFoundError('Restaurant not found');
  }

  const { restaurant, features } = record;
  const dto = mapRestaurantToDto(restaurant, features);

  return c.json(dto);
});

export default restaurantRouter;
