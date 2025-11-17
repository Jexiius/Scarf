import { and, arrayOverlaps, eq, lte, sql } from 'drizzle-orm';
import { db } from '../config/database';
import {
  restaurantFeatures,
  restaurants,
  reviews,
  type InsertRestaurant,
  type InsertRestaurantFeature,
} from '../db/schema';

export interface FindActiveParams {
  maxPrice?: number;
  cuisines?: string[];
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  limit?: number;
  offset?: number;
  cursor?: string; // For cursor-based pagination
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

function toDecimalString(value: number | null | undefined, precision: number = 2): string | null {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value.toFixed(precision);
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

    // Price filter
    if (typeof params.maxPrice === 'number') {
      conditions.push(lte(restaurants.priceLevel, params.maxPrice));
    }

    // Cuisine filter (array overlap)
    if (params.cuisines && params.cuisines.length > 0) {
      conditions.push(arrayOverlaps(restaurants.cuisineTags, params.cuisines));
    }

    // Geospatial radius filter (using earthdistance extension)
    if (
      typeof params.latitude === 'number' &&
      typeof params.longitude === 'number' &&
      typeof params.radiusMiles === 'number'
    ) {
      const radiusMeters = params.radiusMiles * 1609.34; // Convert miles to meters
      conditions.push(
        sql`earth_distance(
          ll_to_earth(${restaurants.latitude}::float, ${restaurants.longitude}::float),
          ll_to_earth(${params.latitude}, ${params.longitude})
        ) <= ${radiusMeters}`,
      );
    }

    // Cursor-based pagination (if cursor provided, filter by id > cursor)
    if (params.cursor) {
      conditions.push(sql`${restaurants.id} > ${params.cursor}`);
    }

    // Build query with conditional distance calculation
    const hasLocation = typeof params.latitude === 'number' && typeof params.longitude === 'number';
    
    let query;
    if (hasLocation) {
      query = db
        .select({
          restaurant: restaurants,
          features: restaurantFeatures,
          distanceMiles: sql<number>`earth_distance(
            ll_to_earth(${restaurants.latitude}::float, ${restaurants.longitude}::float),
            ll_to_earth(${params.latitude}, ${params.longitude})
          ) / 1609.34`.as('distance_miles'),
        })
        .from(restaurants)
        .leftJoin(restaurantFeatures, eq(restaurants.id, restaurantFeatures.restaurantId))
        .where(and(...conditions))
        .orderBy(
          sql`earth_distance(
            ll_to_earth(${restaurants.latitude}::float, ${restaurants.longitude}::float),
            ll_to_earth(${params.latitude}, ${params.longitude})
          )`,
          restaurants.id,
        );
    } else {
      query = db
        .select({
          restaurant: restaurants,
          features: restaurantFeatures,
        })
        .from(restaurants)
        .leftJoin(restaurantFeatures, eq(restaurants.id, restaurantFeatures.restaurantId))
        .where(and(...conditions))
        .orderBy(restaurants.id);
    }

    // Apply limit and offset
    if (typeof params.limit === 'number') {
      query = query.limit(params.limit);
    }
    if (typeof params.offset === 'number') {
      query = query.offset(params.offset);
    }

    return query;
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

  async upsertFeatures(
    restaurantId: string,
    features: Record<string, number | null>,
    metadata: { reviewCountAnalyzed: number; confidenceScore: number | null; modelVersion: string | null },
  ): Promise<void> {
    const now = new Date();

    const baseValues: Partial<InsertRestaurantFeature> = {
      restaurantId,
      reviewCountAnalyzed: metadata.reviewCountAnalyzed,
      confidenceScore: toDecimalString(metadata.confidenceScore),
      lastUpdatedAt: now,
      modelVersion: metadata.modelVersion ?? null,
    };

    Object.entries(features).forEach(([key, value]) => {
      (baseValues as Record<string, unknown>)[key] = toDecimalString(value, 2);
    });

    const insertValues = baseValues as InsertRestaurantFeature;
    const { restaurantId: _ignored, ...updateValues } = insertValues;

    await db
      .insert(restaurantFeatures)
      .values(insertValues)
      .onConflictDoUpdate({
        target: [restaurantFeatures.restaurantId],
        set: {
          ...updateValues,
          lastUpdatedAt: now,
        },
      });
  }
}
