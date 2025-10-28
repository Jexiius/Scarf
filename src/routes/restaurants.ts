import { Hono } from 'hono';
import { NotFoundError } from '../utils/errors';
import { RestaurantRepository } from '../repositories/restaurant.repository';
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

  return c.json({
    id: restaurant.id,
    name: restaurant.name,
    address: restaurant.address,
    city: restaurant.city,
    state: restaurant.state,
    zipCode: restaurant.zipCode,
    coordinates: {
      lat: Number(restaurant.latitude),
      lng: Number(restaurant.longitude),
    },
    priceLevel: restaurant.priceLevel,
    rating: restaurant.googleRating ? Number(restaurant.googleRating) : null,
    reviewCount: restaurant.googleReviewCount,
    cuisineTags: restaurant.cuisineTags ?? [],
    phone: restaurant.phone,
    website: restaurant.website,
    photos: restaurant.photoUrls ?? [],
    hours: restaurant.hours,
    features,
  });
});

export default restaurantRouter;
