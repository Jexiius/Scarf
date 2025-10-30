import { FEATURE_COLUMN_MAP, FEATURE_NAMES, type FeatureName } from '../constants/features';
import type { FeatureExtractionWithReview } from '../repositories/feature-extraction.repository';

export interface AggregatedFeatureValues {
  values: Record<string, number | null>;
  confidenceScore: number | null;
  reviewCountAnalyzed: number;
  modelVersion: string | null;
}

function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function monthsBetween(from: Date, to: Date): number {
  const diffMs = Math.max(0, to.getTime() - from.getTime());
  return diffMs / (1000 * 60 * 60 * 24 * 30);
}

export class FeatureAggregationService {
  aggregate(extractions: FeatureExtractionWithReview[]): AggregatedFeatureValues {
    if (extractions.length === 0) {
      return {
        values: Object.fromEntries(
          Object.values(FEATURE_COLUMN_MAP).map((column) => [column, null]),
        ),
        confidenceScore: null,
        reviewCountAnalyzed: 0,
        modelVersion: null,
      };
    }

    const now = new Date();
    const aggregated: Record<string, number | null> = {};
    const contributionCounts: Record<FeatureName, number> = Object.fromEntries(
      FEATURE_NAMES.map((name) => [name, 0]),
    ) as Record<FeatureName, number>;

    const confidenceSamples: number[] = [];

    FEATURE_NAMES.forEach((featureName) => {
      let weightedSum = 0;
      let totalWeight = 0;

      extractions.forEach((extraction) => {
        const features = extraction.features as Record<string, number | null>;
        const rawValue = features?.[featureName];
        if (rawValue === null || rawValue === undefined) {
          return;
        }

        const extractedAt =
          extraction.extractedAt ?? extraction.updatedAt ?? extraction.reviewPublishedAt ?? now;
        const monthsOld = monthsBetween(extractedAt, now);
        const recencyWeight = Math.max(0.35, Math.exp(-monthsOld / 6));

        const confidence = parseDecimal(extraction.extractionConfidence) ?? 0.6;
        const ratingWeight =
          extraction.reviewRating !== null && extraction.reviewRating !== undefined
            ? Math.max(0.3, extraction.reviewRating / 5)
            : 0.6;

        const weight = recencyWeight * confidence * ratingWeight;
        if (weight <= 0) {
          return;
        }

        weightedSum += rawValue * weight;
        totalWeight += weight;
        contributionCounts[featureName] += 1;
        confidenceSamples.push(confidence);
      });

      if (totalWeight > 0) {
        aggregated[FEATURE_COLUMN_MAP[featureName]] = this.toRoundedScore(weightedSum / totalWeight);
      } else {
        aggregated[FEATURE_COLUMN_MAP[featureName]] = null;
      }
    });

    const confidenceScore = this.calculateOverallConfidence(contributionCounts, confidenceSamples);
    const modelVersion = this.resolveModelVersion(extractions);

    return {
      values: aggregated,
      confidenceScore,
      reviewCountAnalyzed: extractions.length,
      modelVersion,
    };
  }

  private toRoundedScore(value: number, precision: number = 2): number {
    return Number(value.toFixed(precision));
  }

  private calculateOverallConfidence(
    contributionCounts: Record<FeatureName, number>,
    confidences: number[],
  ): number {
    if (confidences.length === 0) {
      return 0.4;
    }

    const totalContributions = Object.values(contributionCounts).reduce(
      (sum, value) => sum + value,
      0,
    );

    const averageConfidence = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
    const featureCoverage = Math.min(1, totalContributions / (FEATURE_NAMES.length * 3));

    const score = 0.3 + 0.4 * averageConfidence + 0.3 * featureCoverage;
    return Number(Math.min(0.99, Math.max(0.3, score)).toFixed(2));
  }

  private resolveModelVersion(extractions: FeatureExtractionWithReview[]): string | null {
    const latest = extractions.reduce<FeatureExtractionWithReview | null>((acc, current) => {
      if (!acc) {
        return current;
      }

      const accTime = acc.extractedAt ?? acc.updatedAt ?? new Date(0);
      const currentTime = current.extractedAt ?? current.updatedAt ?? new Date(0);
      return currentTime > accTime ? current : acc;
    }, null);

    if (!latest) {
      return null;
    }

    return `${latest.modelUsed}:${latest.promptVersion}`;
  }
}
