import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FeatureAggregationService } from '../../src/services/feature-aggregation.service';
import type { FeatureExtractionWithReview } from '../../src/repositories/feature-extraction.repository';

const buildExtraction = (overrides: Partial<FeatureExtractionWithReview>): FeatureExtractionWithReview => ({
  id: overrides.id ?? randomUUID(),
  reviewId: overrides.reviewId ?? randomUUID(),
  restaurantId: overrides.restaurantId ?? 'restaurant-1',
  features: overrides.features ?? { romantic: 0.9, noise_level: 0.2 },
  extractionConfidence: overrides.extractionConfidence ?? '0.8',
  modelUsed: overrides.modelUsed ?? 'gpt-4o-mini',
  promptVersion: overrides.promptVersion ?? 'feature-extraction-v1',
  extractedAt: overrides.extractedAt ?? new Date(),
  tokensUsed: overrides.tokensUsed ?? 120,
  costUsd: overrides.costUsd ?? '0.00045',
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
  reviewRating: overrides.reviewRating ?? 5,
  reviewPublishedAt: overrides.reviewPublishedAt ?? new Date(),
});

describe('FeatureAggregationService', () => {
  const service = new FeatureAggregationService();

  it('aggregates single extraction into restaurant features', () => {
    const extraction = buildExtraction({
      features: { romantic: 0.92, noise_level: 0.15 },
      extractionConfidence: '0.9',
    });

    const result = service.aggregate([extraction]);

    expect(result.values.romantic).toBeCloseTo(0.92, 2);
    expect(result.values.noiseLevel).toBeCloseTo(0.15, 2);
    expect(result.reviewCountAnalyzed).toBe(1);
    expect(result.confidenceScore).toBeGreaterThan(0.3);
    expect(result.modelVersion).toBe('gpt-4o-mini:feature-extraction-v1');
  });

  it('weights more recent and confident reviews higher', () => {
    const recent = buildExtraction({
      features: { romantic: 0.95 },
      extractionConfidence: '0.9',
      reviewRating: 5,
      extractedAt: new Date(),
    });

    const older = buildExtraction({
      features: { romantic: 0.2 },
      extractionConfidence: '0.4',
      reviewRating: 3,
      extractedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180), // 6 months ago
    });

    const result = service.aggregate([recent, older]);

    expect(result.values.romantic).toBeGreaterThan(0.7);
  });
});
