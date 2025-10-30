import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '../config/database';
import {
  restaurantFeatures,
  restaurants,
  reviews,
  type InsertRestaurant,
} from '../db/schema';

export interface FindActiveParams {
  maxPrice?: number;
}

export interface CreateRestaurantInput {
  googlePlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  priceLevel?: number | null;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  cuisineTags?: string[] | null;
  phone?: string | null;
  website?: string | null;
  photoUrls?: string[] | null;
  hours?: Record<string, string> | null;
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

function toDecimalString(value: number | null | undefined): string | null {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value.toString();
  }
  return null;
}

function normalizeNullableArray(values?: string[] | null): string[] | null {
  if (!values || values.length === 0) {
    return null;
  }
  return values;
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

  async findByGooglePlaceId(googlePlaceId: string) {
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.googlePlaceId, googlePlaceId))
      .limit(1);

    return restaurant ?? null;
  }

  async upsertRestaurant(input: CreateRestaurantInput): Promise<string> {
    const values: InsertRestaurant = {
      googlePlaceId: input.googlePlaceId,
      name: input.name,
      latitude: input.latitude.toString(),
      longitude: input.longitude.toString(),
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zipCode: input.zipCode ?? null,
      priceLevel: typeof input.priceLevel === 'number' ? input.priceLevel : null,
      googleRating: toDecimalString(input.googleRating),
      googleReviewCount:
        typeof input.googleReviewCount === 'number' ? input.googleReviewCount : null,
      cuisineTags: normalizeNullableArray(input.cuisineTags),
      phone: input.phone ?? null,
      website: input.website ?? null,
      photoUrls: normalizeNullableArray(input.photoUrls),
      hours: input.hours ?? null,
      isActive: true,
      lastScrapedAt: new Date(),
    };

    const [restaurant] = await db
      .insert(restaurants)
      .values(values)
      .onConflictDoUpdate({
        target: restaurants.googlePlaceId,
        set: {
          name: input.name,
          address: input.address ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          zipCode: input.zipCode ?? null,
          priceLevel: typeof input.priceLevel === 'number' ? input.priceLevel : null,
          googleRating: toDecimalString(input.googleRating),
          googleReviewCount:
            typeof input.googleReviewCount === 'number' ? input.googleReviewCount : null,
          cuisineTags: normalizeNullableArray(input.cuisineTags),
          phone: input.phone ?? null,
          website: input.website ?? null,
          photoUrls: normalizeNullableArray(input.photoUrls),
          hours: input.hours ?? null,
          lastScrapedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning({ id: restaurants.id });

    if (!restaurant) {
      throw new Error('Failed to upsert restaurant');
    }

    return restaurant.id;
  }

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
          reviewUrl: input.reviewUrl ?? null,
          publishedAt: input.publishedAt ?? null,
          scrapedAt: new Date(),
          isProcessed: false,
        })
        .onConflictDoNothing();

      return true;
    } catch (error) {
      console.error('Failed to create review:', error);
      return false;
    }
  }

  async createReviews(inputs: CreateReviewInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    try {
      const result = await db
        .insert(reviews)
        .values(
          inputs.map((input) => ({
            restaurantId: input.restaurantId,
            authorName: input.authorName,
            text: input.text,
            rating: input.rating,
            source: input.source,
            sourceReviewId: input.sourceReviewId,
            reviewUrl: input.reviewUrl ?? null,
            publishedAt: input.publishedAt ?? null,
            scrapedAt: new Date(),
            isProcessed: false,
          })),
        )
        .onConflictDoNothing();

      return result.rowCount ?? 0;
    } catch (error) {
      console.error('Failed to bulk create reviews:', error);
      return 0;
    }
  }

  async getReviewCount(restaurantId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.restaurantId, restaurantId));

    return Number(result?.count ?? 0);
  }

  async getUnprocessedReviewCount(restaurantId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(and(eq(reviews.restaurantId, restaurantId), eq(reviews.isProcessed, false)));

    return Number(result?.count ?? 0);
  }

  async deactivateRestaurant(id: string): Promise<void> {
    await db
      .update(restaurants)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(restaurants.id, id));
  }

  async getRestaurantsNeedingScrape(daysOld: number = 30): Promise<Array<{ id: string; name: string }>> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    return db
      .select({
        id: restaurants.id,
        name: restaurants.name,
      })
      .from(restaurants)
      .where(
        and(
          eq(restaurants.isActive, true),
          sql`${restaurants.lastScrapedAt} IS NULL OR ${restaurants.lastScrapedAt} < ${cutoffDate}`,
        ),
      )
      .limit(100);
  }
}
