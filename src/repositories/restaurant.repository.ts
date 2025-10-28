import { and, eq, lte } from 'drizzle-orm';
import { db } from '../config/database';
import { restaurantFeatures, restaurants } from '../db/schema';

export interface FindActiveParams {
  maxPrice?: number;
}

export class RestaurantRepository {
  async findActive(params: FindActiveParams = {}) {
    const conditions = [eq(restaurants.isActive, true)];

    if (typeof params.maxPrice === 'number') {
      conditions.push(lte(restaurants.priceLevel, params.maxPrice));
    }

    return db
      .select({
        restaurant: restaurants,
        features: restaurantFeatures,
      })
      .from(restaurants)
      .leftJoin(restaurantFeatures, eq(restaurants.id, restaurantFeatures.restaurantId))
      .where(and(...conditions));
  }

  async findById(id: string) {
    const [result] = await db
      .select({
        restaurant: restaurants,
        features: restaurantFeatures,
      })
      .from(restaurants)
      .leftJoin(restaurantFeatures, eq(restaurants.id, restaurantFeatures.restaurantId))
      .where(eq(restaurants.id, id));

    return result ?? null;
  }
}
