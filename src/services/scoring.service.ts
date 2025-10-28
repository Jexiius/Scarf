import type { Restaurant, RestaurantFeature } from '../db/schema';
import { haversineDistanceMiles } from '../utils/distance';
import type { ParsedFeature, ParsedQuery } from './query-parser.service';

export interface FeatureMatch {
  target: number;
  actual: number;
  match: number;
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
  matchScore: number;
  featureMatches: Record<string, FeatureMatch>;
  explanation: string;
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

        const { score, featureMatches } = this.calculateFeatureScore(features, parsedQuery.features);

        const finalScore = this.calculateFinalScore(
          score,
          restaurant.googleRating ? Number(restaurant.googleRating) : null,
          distanceMiles,
          radiusMiles,
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
          matchScore: finalScore,
          featureMatches,
          explanation: this.generateExplanation(restaurant.name, featureMatches),
        };
      })
      .filter((item) => item.distanceMiles <= radiusMiles)
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  private calculateFeatureScore(
    features: RestaurantFeature | null,
    queryFeatures: Record<string, ParsedFeature>,
  ): { score: number; featureMatches: Record<string, FeatureMatch> } {
    if (!features) {
      return { score: 0, featureMatches: {} };
    }

    let weightedSum = 0;
    let totalWeight = 0;
    const featureMatches: Record<string, FeatureMatch> = {};

    Object.entries(queryFeatures).forEach(([featureName, queryFeature]) => {
      const featureKey = this.toCamelCase(featureName);
      const rawActual = features[featureKey as keyof RestaurantFeature];
      if (rawActual === null || typeof rawActual === 'undefined') {
        return;
      }

      const actual = Number(rawActual);
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

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return { score, featureMatches };
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
  ): number {
    const featureWeight = 0.7;
    const qualityWeight = 0.2;
    const proximityWeight = 0.1;

    const normalizedRating = googleRating ? googleRating / 5 : 0.6;
    const proximityScore = 1 - Math.min(distance / maxDistance, 1);

    const finalScore =
      featureScore * featureWeight + normalizedRating * qualityWeight + proximityScore * proximityWeight;

    return Math.round(finalScore * 100) / 100;
  }

  private generateExplanation(name: string, featureMatches: Record<string, FeatureMatch>): string {
    const topMatches = Object.entries(featureMatches)
      .filter(([, match]) => match.match >= 0.7)
      .sort((a, b) => b[1].match - a[1].match)
      .slice(0, 3)
      .map(([feature]) => feature.replace(/_/g, ' '));

    if (topMatches.length === 0) {
      return `${name} is a good option in the area.`;
    }

    if (topMatches.length === 1) {
      return `${name} stands out for ${topMatches[0]}.`;
    }

    const last = topMatches.pop();
    return `${name} matches your preferences with strong scores for ${topMatches.join(', ')} and ${last}.`;
  }

  private toCamelCase(value: string): string {
    return value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  }
}
