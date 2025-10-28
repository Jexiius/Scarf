import { and, desc, eq } from 'drizzle-orm';
import { db } from '../config/database';
import {
  restaurantFeatures,
  restaurants,
  savedRestaurants,
  type InsertSavedRestaurant,
} from '../db/schema';

export class SavedRestaurantRepository {
  async listByUser(userId: string) {
    return db
      .select({
        saved: savedRestaurants,
        restaurant: restaurants,
        features: restaurantFeatures,
      })
      .from(savedRestaurants)
      .innerJoin(restaurants, eq(savedRestaurants.restaurantId, restaurants.id))
      .leftJoin(restaurantFeatures, eq(restaurants.id, restaurantFeatures.restaurantId))
      .where(eq(savedRestaurants.userId, userId))
      .orderBy(desc(savedRestaurants.createdAt));
  }

  async find(userId: string, restaurantId: string) {
    const [record] = await db
      .select({
        saved: savedRestaurants,
        restaurant: restaurants,
        features: restaurantFeatures,
      })
      .from(savedRestaurants)
      .innerJoin(restaurants, eq(savedRestaurants.restaurantId, restaurants.id))
      .leftJoin(restaurantFeatures, eq(restaurants.id, restaurantFeatures.restaurantId))
      .where(and(eq(savedRestaurants.userId, userId), eq(savedRestaurants.restaurantId, restaurantId)));

    return record ?? null;
  }

  async create(data: InsertSavedRestaurant) {
    const [record] = await db.insert(savedRestaurants).values(data).returning();
    return record;
  }

  async remove(userId: string, restaurantId: string) {
    const result = await db
      .delete(savedRestaurants)
      .where(and(eq(savedRestaurants.userId, userId), eq(savedRestaurants.restaurantId, restaurantId)))
      .returning();

    return result[0] ?? null;
  }
}
