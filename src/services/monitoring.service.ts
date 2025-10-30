import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { restaurantFeatures, restaurants, type TaskType } from '../db/schema';
import { QueueRepository } from '../repositories/queue.repository';

interface QueueSection {
  summary: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  };
  pendingByType: Record<TaskType, number>;
  stuckTasks: number;
}

interface LowConfidenceSample {
  restaurantId: string;
  name: string;
  confidence: number | null;
  reviewCount: number;
  lastUpdatedAt: string | null;
}

interface DataQualitySection {
  totalRestaurants: number;
  restaurantsWithFeatures: number;
  restaurantsMissingFeatures: number;
  averageConfidence: number;
  averageReviewCount: number;
  lowConfidenceCount: number;
  staleFeatureCount: number;
  recentAggregationAt: string | null;
  lowConfidenceSamples: LowConfidenceSample[];
}

export interface MonitoringDashboard {
  generatedAt: string;
  queue: QueueSection;
  dataQuality: DataQualitySection;
}

export class MonitoringService {
  constructor(private readonly queueRepo = new QueueRepository()) {}

  async getDashboard(): Promise<MonitoringDashboard> {
    const [queue, dataQuality] = await Promise.all([
      this.getQueueSection(),
      this.getDataQualitySection(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      queue,
      dataQuality,
    };
  }

  private async getQueueSection(): Promise<QueueSection> {
    const [summary, pendingByType, stuckTasks] = await Promise.all([
      this.queueRepo.getQueueStats(),
      this.queueRepo.getPendingTasksByType(),
      this.queueRepo.getStuckTasks(),
    ]);

    return {
      summary,
      pendingByType,
      stuckTasks: stuckTasks.length,
    };
  }

  private async getDataQualitySection(): Promise<DataQualitySection> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [[restaurantTotals], [confidenceStats], [lowConfidence], [staleFeatures], [recentAggregation], lowConfidenceSamples] =
      await Promise.all([
        db
          .select({
            total: sql<number>`count(*)`,
            withFeatures: sql<number>`count(${restaurantFeatures.id})`,
          })
          .from(restaurants)
          .leftJoin(restaurantFeatures, eq(restaurants.id, restaurantFeatures.restaurantId)),
        db
          .select({
            averageConfidence: sql<number>`COALESCE(avg(${restaurantFeatures.confidenceScore}::float), 0)`,
            averageReviewCount: sql<number>`COALESCE(avg(${restaurantFeatures.reviewCountAnalyzed}), 0)`,
          })
          .from(restaurantFeatures),
        db
          .select({
            count: sql<number>`count(*)`,
          })
          .from(restaurantFeatures)
          .where(
            and(
              sql`${restaurantFeatures.confidenceScore} IS NOT NULL`,
              sql`${restaurantFeatures.confidenceScore}::float < 0.5`,
            ),
          ),
        db
          .select({
            count: sql<number>`count(*)`,
          })
          .from(restaurantFeatures)
          .where(lt(restaurantFeatures.lastUpdatedAt, thirtyDaysAgo)),
        db
          .select({
            last: sql<Date | null>`max(${restaurantFeatures.lastUpdatedAt})`,
          })
          .from(restaurantFeatures),
        db
          .select({
            restaurantId: restaurants.id,
            name: restaurants.name,
            confidence: restaurantFeatures.confidenceScore,
            reviewCount: restaurantFeatures.reviewCountAnalyzed,
            updatedAt: restaurantFeatures.lastUpdatedAt,
          })
          .from(restaurants)
          .innerJoin(restaurantFeatures, eq(restaurants.id, restaurantFeatures.restaurantId))
          .where(sql`${restaurantFeatures.confidenceScore} IS NOT NULL`)
          .orderBy(sql`${restaurantFeatures.confidenceScore}::float ASC`)
          .limit(5),
      ]);

    const totalRestaurants = this.toNumber(restaurantTotals?.total);
    const restaurantsWithFeatures = this.toNumber(restaurantTotals?.withFeatures);
    const missingFeatures = Math.max(totalRestaurants - restaurantsWithFeatures, 0);

    const averageConfidence = this.roundNumber(confidenceStats?.averageConfidence);
    const averageReviewCount = this.roundNumber(confidenceStats?.averageReviewCount, 1);
    const lowConfidenceCount = this.toNumber(lowConfidence?.count);
    const staleFeatureCount = this.toNumber(staleFeatures?.count);
    const recentAggregationAt =
      recentAggregation?.last instanceof Date ? recentAggregation.last.toISOString() : null;

    const samples: LowConfidenceSample[] = lowConfidenceSamples.map((row) => ({
      restaurantId: row.restaurantId,
      name: row.name,
      confidence: this.parseConfidence(row.confidence),
      reviewCount: this.toNumber(row.reviewCount),
      lastUpdatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
    }));

    return {
      totalRestaurants,
      restaurantsWithFeatures,
      restaurantsMissingFeatures: missingFeatures,
      averageConfidence,
      averageReviewCount,
      lowConfidenceCount,
      staleFeatureCount,
      recentAggregationAt,
      lowConfidenceSamples: samples,
    };
  }

  private toNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  private parseConfidence(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const numeric = this.toNumber(value, Number.NaN);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return this.roundNumber(Math.min(1, Math.max(0, numeric)));
  }

  private roundNumber(value: unknown, precision: number = 2): number {
    const numeric = this.toNumber(value, 0);
    return Number(numeric.toFixed(precision));
  }
}
