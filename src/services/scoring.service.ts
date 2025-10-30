import type { Restaurant, RestaurantFeature } from '../db/schema';
import { haversineDistanceMiles } from '../utils/distance';
import type { ParsedFeature, ParsedQuery } from './query-parser.service';

export type DataQualityWarning =
  | 'missing_features'
  | 'low_confidence'
  | 'insufficient_reviews'
  | 'stale_features'
  | 'invalid_feature_value';

export interface FeatureMatch {
  target: number;
  actual: number;
  match: number;
}

export interface DataQualitySummary {
  confidence: number | null;
  reviewCount: number;
  lastUpdatedAt: string | null;
  warnings: DataQualityWarning[];
}

export interface ScoredRestaurant {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  priceLevel: number | null;
  googleRating: number | null;
  cuisineTags: string[];
  photoUrls: string[];
  distanceMiles: number;
  featureScore: number;
  matchScore: number;
  featureMatches: Record<string, FeatureMatch>;
  explanation: string;
  dataQuality: DataQualitySummary;
}

interface RestaurantWithFeatures {
  restaurant: Restaurant;
  features: RestaurantFeature | null;
}

export class ScoringService {
  scoreRestaurants(
    results: RestaurantWithFeatures[],
    parsedQuery: ParsedQuery,
    userLocation: { lat: number; lng: number },
    radiusMiles: number,
  ): ScoredRestaurant[] {
    return results
      .map(({ restaurant, features }) => {
        const distanceMiles = haversineDistanceMiles(
          Number(restaurant.latitude),
          Number(restaurant.longitude),
          userLocation.lat,
          userLocation.lng,
        );

        const dataQuality = this.evaluateDataQuality(features);
        const { score: featureScore, featureMatches, warnings: featureWarnings } = this.calculateFeatureScore(
          features,
          parsedQuery.features,
        );

        const combinedWarnings = this.mergeWarnings(dataQuality.warnings, featureWarnings);
        const dataQualityWithWarnings: DataQualitySummary = {
          ...dataQuality,
          warnings: combinedWarnings,
        };

        const finalScore = this.calculateFinalScore(
          featureScore,
          restaurant.googleRating ? Number(restaurant.googleRating) : null,
          distanceMiles,
          radiusMiles,
          dataQualityWithWarnings.confidence,
          combinedWarnings,
        );

        return {
          id: restaurant.id,
          name: restaurant.name,
          latitude: Number(restaurant.latitude),
          longitude: Number(restaurant.longitude),
          priceLevel: restaurant.priceLevel,
          googleRating: restaurant.googleRating ? Number(restaurant.googleRating) : null,
          cuisineTags: restaurant.cuisineTags ?? [],
          photoUrls: restaurant.photoUrls ?? [],
          distanceMiles,
          featureScore,
          matchScore: finalScore,
          featureMatches,
          explanation: this.generateExplanation(restaurant.name, featureMatches, dataQualityWithWarnings),
          dataQuality: dataQualityWithWarnings,
        };
      })
      .filter((item) => item.distanceMiles <= radiusMiles)
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  private calculateFeatureScore(
    features: RestaurantFeature | null,
    queryFeatures: Record<string, ParsedFeature>,
  ): { score: number; featureMatches: Record<string, FeatureMatch>; warnings: DataQualityWarning[] } {
    if (!features) {
      return { score: 0, featureMatches: {}, warnings: ['missing_features'] };
    }

    let weightedSum = 0;
    let totalWeight = 0;
    const featureMatches: Record<string, FeatureMatch> = {};
    const warnings: DataQualityWarning[] = [];

    Object.entries(queryFeatures).forEach(([featureName, queryFeature]) => {
      const featureKey = this.toCamelCase(featureName);
      const rawActual = features[featureKey as keyof RestaurantFeature];
      if (rawActual === null || typeof rawActual === 'undefined') {
        return;
      }

      const parsed = this.parseFeatureValue(rawActual);
      if (parsed.invalid) {
        warnings.push('invalid_feature_value');
      }

      if (parsed.value === null) {
        return;
      }

      const actual = parsed.value;
      const target = queryFeature.target;
      const weight = queryFeature.weight;

      const match = this.calculateMatchScore(actual, target);

      featureMatches[featureName] = {
        target,
        actual,
        match,
      };

      if (queryFeature.required && match < 0.7) {
        weightedSum += match * weight * 0.5;
      } else {
        weightedSum += match * weight;
      }

      totalWeight += weight;
    });

    const score = totalWeight > 0 ? this.roundScore(weightedSum / totalWeight) : 0;

    return { score, featureMatches, warnings };
  }

  private calculateMatchScore(actual: number, target: number): number {
    const distance = Math.abs(target - actual);
    const match = Math.max(0, 1 - distance);
    return Math.round(match * 100) / 100;
  }

  private calculateFinalScore(
    featureScore: number,
    googleRating: number | null,
    distance: number,
    maxDistance: number,
    dataConfidence: number | null,
    warnings: DataQualityWarning[],
  ): number {
    if (warnings.includes('missing_features')) {
      return 0;
    }

    const featureWeight = 0.7;
    const qualityWeight = 0.2;
    const proximityWeight = 0.1;

    const normalizedRating =
      typeof googleRating === 'number' && Number.isFinite(googleRating)
        ? Math.min(1, Math.max(0, googleRating / 5))
        : 0.6;
    const proximityScore = 1 - Math.min(distance / maxDistance, 1);

    const baseScore =
      featureScore * featureWeight + normalizedRating * qualityWeight + proximityScore * proximityWeight;

    const confidence = dataConfidence ?? 0.6;
    const multiplier = 0.65 + 0.35 * confidence;
    const penalty = warnings.reduce((total, warning) => total + this.warningPenalty(warning), 0);

    const adjustedScore = Math.max(0, baseScore * multiplier - penalty);

    return this.roundScore(Math.min(1, adjustedScore));
  }

  private generateExplanation(
    name: string,
    featureMatches: Record<string, FeatureMatch>,
    dataQuality: DataQualitySummary,
  ): string {
    if (dataQuality.warnings.includes('missing_features')) {
      return `${name} does not have enough recent review data for a confident match yet.`;
    }

    const topMatches = Object.entries(featureMatches)
      .filter(([, match]) => match.match >= 0.7)
      .sort((a, b) => b[1].match - a[1].match)
      .slice(0, 3)
      .map(([feature]) => feature.replace(/_/g, ' '));

    if (topMatches.length === 0) {
      return this.applyDataWarningContext(`${name} is a good option in the area.`, dataQuality);
    }

    if (topMatches.length === 1) {
      return this.applyDataWarningContext(`${name} stands out for ${topMatches[0]}.`, dataQuality);
    }

    const last = topMatches.pop();
    const baseExplanation = `${name} matches your preferences with strong scores for ${topMatches.join(', ')} and ${last}.`;

    return this.applyDataWarningContext(baseExplanation, dataQuality);
  }

  private toCamelCase(value: string): string {
    return value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  }

  private evaluateDataQuality(features: RestaurantFeature | null): DataQualitySummary {
    if (!features) {
      return {
        confidence: null,
        reviewCount: 0,
        lastUpdatedAt: null,
        warnings: ['missing_features'],
      };
    }

    const confidence = this.parseDecimal(features.confidenceScore);
    const reviewCount =
      typeof features.reviewCountAnalyzed === 'number' && Number.isFinite(features.reviewCountAnalyzed)
        ? features.reviewCountAnalyzed
        : 0;
    const lastUpdated = features.lastUpdatedAt ?? null;

    const warnings: DataQualityWarning[] = [];

    if (confidence !== null && confidence < 0.5) {
      warnings.push('low_confidence');
    }

    if (reviewCount < 5) {
      warnings.push('insufficient_reviews');
    }

    if (!lastUpdated || this.daysSince(lastUpdated) > 30) {
      warnings.push('stale_features');
    }

    return {
      confidence,
      reviewCount,
      lastUpdatedAt: lastUpdated ? lastUpdated.toISOString() : null,
      warnings,
    };
  }

  private parseDecimal(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return Number(Math.min(1, Math.max(0, numeric)).toFixed(2));
  }

  private parseFeatureValue(
    value: unknown,
  ): { value: number | null; invalid: boolean } {
    if (value === null || value === undefined) {
      return { value: null, invalid: false };
    }

    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return { value: null, invalid: true };
    }

    if (numeric < 0 || numeric > 1) {
      return { value: null, invalid: true };
    }

    return { value: Number(numeric.toFixed(2)), invalid: false };
  }

  private warningPenalty(warning: DataQualityWarning): number {
    switch (warning) {
      case 'missing_features':
        return 0.15;
      case 'stale_features':
        return 0.07;
      case 'low_confidence':
        return 0.05;
      case 'insufficient_reviews':
        return 0.05;
      case 'invalid_feature_value':
        return 0.03;
      default:
        return 0;
    }
  }

  private daysSince(date: Date): number {
    const diff = Date.now() - date.getTime();
    return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
  }

  private mergeWarnings(
    a: DataQualityWarning[],
    b: DataQualityWarning[],
  ): DataQualityWarning[] {
    const set = new Set<DataQualityWarning>([...a, ...b]);
    return Array.from(set);
  }

  private roundScore(value: number): number {
    return Number(value.toFixed(2));
  }

  private applyDataWarningContext(base: string, dataQuality: DataQualitySummary): string {
    if (
      dataQuality.warnings.some((warning) =>
        ['low_confidence', 'insufficient_reviews', 'stale_features'].includes(warning),
      )
    ) {
      const reviewContext =
        dataQuality.reviewCount > 0 ? ` Data is based on ${dataQuality.reviewCount} recent reviews.` : '';
      return `${base} Confidence is limited.${reviewContext}`.trim();
    }

    return base;
  }
}
