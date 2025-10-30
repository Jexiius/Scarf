import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { reviews, type Review } from '../db/schema';

export class ReviewRepository {
  async findUnprocessedByRestaurant(restaurantId: string, limit: number = 25): Promise<Review[]> {
    const rows = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.restaurantId, restaurantId), eq(reviews.isProcessed, false)))
      .orderBy(desc(reviews.publishedAt))
      .limit(limit);

    return rows;
  }

  async markProcessed(reviewIds: string[]): Promise<void> {
    if (reviewIds.length === 0) {
      return;
    }

    await db
      .update(reviews)
      .set({
        isProcessed: true,
        processedAt: new Date(),
      })
      .where(inArray(reviews.id, reviewIds));
  }

  async markFailed(reviewId: string): Promise<void> {
    await db
      .update(reviews)
      .set({
        isProcessed: false,
        processedAt: null,
      })
      .where(eq(reviews.id, reviewId));
  }

  async countUnprocessed(restaurantId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(and(eq(reviews.restaurantId, restaurantId), eq(reviews.isProcessed, false)));

    return Number(result?.count ?? 0);
  }
}
