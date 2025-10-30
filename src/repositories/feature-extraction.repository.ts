import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import {
  featureExtractions,
  reviews,
  type FeatureExtraction,
  type InsertFeatureExtraction,
} from '../db/schema';

export interface UpsertFeatureExtractionInput {
  reviewId: string;
  restaurantId: string;
  features: Record<string, number | null>;
  extractionConfidence?: number | null;
  modelUsed: string;
  promptVersion: string;
  extractedAt: Date;
  tokensUsed?: number | null;
  costUsd?: number | null;
}

export interface FeatureExtractionWithReview extends FeatureExtraction {
  reviewRating: number | null;
  reviewPublishedAt: Date | null;
}

function toDecimalString(value: number | null | undefined, precision: number = 2): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return value.toFixed(precision);
}

export class FeatureExtractionRepository {
  async upsertExtraction(data: UpsertFeatureExtractionInput): Promise<void> {
    const payload: InsertFeatureExtraction = {
      reviewId: data.reviewId,
      restaurantId: data.restaurantId,
      features: data.features,
      extractionConfidence: toDecimalString(data.extractionConfidence),
      modelUsed: data.modelUsed,
      promptVersion: data.promptVersion,
      extractedAt: data.extractedAt,
      tokensUsed: typeof data.tokensUsed === 'number' ? Math.round(data.tokensUsed) : null,
      costUsd: toDecimalString(data.costUsd, 6),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db
      .insert(featureExtractions)
      .values(payload)
      .onConflictDoUpdate({
        target: featureExtractions.reviewId,
        set: {
          features: payload.features,
          extractionConfidence: payload.extractionConfidence,
          modelUsed: payload.modelUsed,
          promptVersion: payload.promptVersion,
          extractedAt: payload.extractedAt,
          tokensUsed: payload.tokensUsed,
          costUsd: payload.costUsd,
          updatedAt: new Date(),
        },
      });
  }

  async getByRestaurant(restaurantId: string): Promise<FeatureExtractionWithReview[]> {
    const rows = await db
      .select({
        extraction: featureExtractions,
        reviewRating: reviews.rating,
        reviewPublishedAt: reviews.publishedAt,
      })
      .from(featureExtractions)
      .innerJoin(reviews, eq(reviews.id, featureExtractions.reviewId))
      .where(eq(featureExtractions.restaurantId, restaurantId));

    return rows.map((row) => ({
      ...row.extraction,
      reviewRating: row.reviewRating ?? null,
      reviewPublishedAt: row.reviewPublishedAt ?? null,
    }));
  }

  async getCostSummary(restaurantId: string): Promise<{ tokens: number; costUsd: number }> {
    const rows = await db
      .select({
        tokens: featureExtractions.tokensUsed,
        cost: featureExtractions.costUsd,
      })
      .from(featureExtractions)
      .where(eq(featureExtractions.restaurantId, restaurantId));

    return rows.reduce(
      (acc, row) => {
        if (typeof row.tokens === 'number') {
          acc.tokens += row.tokens;
        }
        if (typeof row.cost === 'string') {
          acc.costUsd += Number(row.cost);
        }
        return acc;
      },
      { tokens: 0, costUsd: 0 },
    );
  }
}
