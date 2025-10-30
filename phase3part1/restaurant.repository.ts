import { db } from '../config/database';
import { restaurants, reviews } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export interface CreateRestaurantInput {
  googlePlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  priceLevel?: number;
  googleRating?: number;
  googleReviewCount?: number;
  cuisineTags?: string[];
  phone?: string;
  website?: string;
  photoUrls?: string[];
  hours?: Record<string, string>;
}

export interface CreateReviewInput {
  restaurantId: string;
  authorName: string;
  text: string;
  rating: number;
  source: string;
  sourceReviewId: string;
  reviewUrl?: string;
  publishedAt?: Date;
}

export class RestaurantRepository {
  /**
   * Create a new restaurant or update if already exists
   */
  async upsertRestaurant(input: CreateRestaurantInput): Promise<string> {
    try {
      const [restaurant] = await db
        .insert(restaurants)
        .values({
          googlePlaceId: input.googlePlaceId,
          name: input.name,
          latitude: input.latitude.toString(),
          longitude: input.longitude.toString(),
          address: input.address,
          city: input.city,
          state: input.state,
          zipCode: input.zipCode,
          priceLevel: input.priceLevel,
          googleRating: input.googleRating?.toString(),
          googleReviewCount: input.googleReviewCount,
          cuisineTags: input.cuisineTags || [],
          phone: input.phone,
          website: input.website,
          photoUrls: input.photoUrls || [],
          hours: input.hours ? sql`${JSON.stringify(input.hours)}::jsonb` : null,
          isActive: true,
          lastScrapedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [restaurants.googlePlaceId],
          set: {
            name: input.name,
            address: input.address,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            priceLevel: input.priceLevel,
            googleRating: input.googleRating?.toString(),
            googleReviewCount: input.googleReviewCount,
            cuisineTags: input.cuisineTags || [],
            phone: input.phone,
            website: input.website,
            photoUrls: input.photoUrls || [],
            hours: input.hours ? sql`${JSON.stringify(input.hours)}::jsonb` : null,
            lastScrapedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning({ id: restaurants.id });

      return restaurant.id;
    } catch (error) {
      console.error('Failed to upsert restaurant:', error);
      throw error;
    }
  }

  /**
   * Get restaurant by Google Place ID
   */
  async findByGooglePlaceId(googlePlaceId: string) {
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.googlePlaceId, googlePlaceId))
      .limit(1);

    return restaurant || null;
  }

  /**
   * Get restaurant by ID
   */
  async findById(id: string) {
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);

    return restaurant || null;
  }

  /**
   * Create a review (skip if duplicate)
   */
  async createReview(input: CreateReviewInput): Promise<boolean> {
    try {
      await db
        .insert(reviews)
        .values({
          restaurantId: input.restaurantId,
          authorName: input.authorName,
          text: input.text,
          rating: input.rating,
          source: input.source,
          sourceReviewId: input.sourceReviewId,
          reviewUrl: input.reviewUrl,
          publishedAt: input.publishedAt,
          scrapedAt: new Date(),
          isProcessed: false,
        })
        .onConflictDoNothing(); // Skip duplicates

      return true;
    } catch (error) {
      console.error('Failed to create review:', error);
      return false;
    }
  }

  /**
   * Bulk create reviews (more efficient)
   */
  async createReviews(inputs: CreateReviewInput[]): Promise<number> {
    if (inputs.length === 0) return 0;

    try {
      const result = await db
        .insert(reviews)
        .values(
          inputs.map(input => ({
            restaurantId: input.restaurantId,
            authorName: input.authorName,
            text: input.text,
            rating: input.rating,
            source: input.source,
            sourceReviewId: input.sourceReviewId,
            reviewUrl: input.reviewUrl,
            publishedAt: input.publishedAt,
            scrapedAt: new Date(),
            isProcessed: false,
          }))
        )
        .onConflictDoNothing(); // Skip duplicates

      return result.rowCount || 0;
    } catch (error) {
      console.error('Failed to bulk create reviews:', error);
      return 0;
    }
  }

  /**
   * Get review count for a restaurant
   */
  async getReviewCount(restaurantId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.restaurantId, restaurantId));

    return Number(result?.count || 0);
  }

  /**
   * Get unprocessed review count for a restaurant
   */
  async getUnprocessedReviewCount(restaurantId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(
        sql`${reviews.restaurantId} = ${restaurantId} AND ${reviews.isProcessed} = false`
      );

    return Number(result?.count || 0);
  }

  /**
   * Mark restaurant as inactive (soft delete)
   */
  async deactivateRestaurant(id: string): Promise<void> {
    await db
      .update(restaurants)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(restaurants.id, id));
  }

  /**
   * Get restaurants that need scraping (not scraped in X days)
   */
  async getRestaurantsNeedingScrape(daysOld: number = 30): Promise<Array<{ id: string; name: string }>> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const results = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
      })
      .from(restaurants)
      .where(
        sql`${restaurants.isActive} = true AND (
          ${restaurants.lastScrapedAt} IS NULL OR 
          ${restaurants.lastScrapedAt} < ${cutoffDate}
        )`
      )
      .limit(100);

    return results;
  }
}
