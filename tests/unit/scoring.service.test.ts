import { describe, expect, it } from 'vitest';
import type { Restaurant, RestaurantFeature } from '../../src/db/schema';
import { ScoringService } from '../../src/services/scoring.service';

const scoringService = new ScoringService();

const now = new Date();

function buildRestaurant(overrides: Partial<Restaurant>): Restaurant {
  return {
    id: 'restaurant-1',
    name: 'Test Restaurant',
    googlePlaceId: null,
    latitude: '40.7589',
    longitude: '-73.9851',
    address: null,
    city: null,
    state: null,
    zipCode: null,
    priceLevel: 2,
    googleRating: '4.6',
    googleReviewCount: 50,
    cuisineTags: ['Italian'],
    phone: null,
    website: null,
    photoUrls: [],
    hours: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    lastScrapedAt: null,
    ...overrides,
  };
}

function buildFeatures(
  restaurantId: string,
  overrides: Partial<Record<keyof RestaurantFeature, number | string | Date | null>>,
): RestaurantFeature {
  const base: RestaurantFeature = {
    id: `feature-${restaurantId}`,
    restaurantId,
    romantic: null,
    cozy: null,
    casual: null,
    noiseLevel: null,
    energyLevel: null,
    crowdedness: null,
    goodForDates: null,
    goodForGroups: null,
    familyFriendly: null,
    businessAppropriate: null,
    celebrationWorthy: null,
    fastService: null,
    attentiveService: null,
    authentic: null,
    creativeMenu: null,
    comfortFood: null,
    healthyOptions: null,
    portionsLarge: null,
    veganFriendly: null,
    photogenicFood: null,
    decorQuality: null,
    photoFriendlyLighting: null,
    niceViews: null,
    trendy: null,
    outdoorSeating: null,
    easyParking: null,
    reservationsNeeded: null,
    lateNight: null,
    formality: null,
    goodValue: null,
   splurgeWorthy: null,
   popularity: null,
    confidenceScore: '0.9',
    reviewCountAnalyzed: 12,
    lastUpdatedAt: now,
    modelVersion: null,
  };

  Object.entries(overrides).forEach(([key, value]) => {
    (base as Record<string, unknown>)[key] = value;
  });

  return base;
}

describe('ScoringService', () => {
  it('awards high scores for matching features', () => {
    const restaurant = buildRestaurant({});
    const features = buildFeatures(restaurant.id, {
      romantic: '0.9',
      cozy: '0.8',
      confidenceScore: '0.95',
      reviewCountAnalyzed: 24,
    });

    const result = scoringService.scoreRestaurants(
      [{ restaurant, features }],
      {
        features: {
          romantic: { weight: 1, target: 0.9 },
          cozy: { weight: 1, target: 0.8 },
        },
        intent: 'date_night',
        confidence: 1,
      },
      { lat: 40.7589, lng: -73.9851 },
      10,
    );

    expect(result[0].featureScore).toBeGreaterThanOrEqual(0.85);
    expect(result[0].matchScore).toBeGreaterThan(0.8);
    expect(result[0].featureMatches.romantic.match).toBe(1);
    expect(result[0].dataQuality.confidence).toBeCloseTo(0.95, 2);
    expect(result[0].dataQuality.warnings).toHaveLength(0);
  });

  it('penalizes required features when they do not match', () => {
    const restaurant = buildRestaurant({ id: 'restaurant-2', latitude: '40.75', longitude: '-73.98' });
    const features = buildFeatures(restaurant.id, {
      romantic: '0.2',
      confidenceScore: '0.85',
      reviewCountAnalyzed: 18,
    });

    const result = scoringService.scoreRestaurants(
      [{ restaurant, features }],
      {
        features: {
          romantic: { weight: 1, target: 0.9, required: true },
        },
        intent: 'date_night',
        confidence: 1,
      },
      { lat: 40.7589, lng: -73.9851 },
      10,
    );

    expect(result[0].matchScore).toBeLessThan(0.6);
    expect(result[0].dataQuality.warnings).toHaveLength(0);
  });

  it('sorts restaurants by match score and filters outside radius', () => {
    const closeRestaurant = buildRestaurant({ id: 'restaurant-3' });
    const closeFeatures = buildFeatures(closeRestaurant.id, { romantic: '0.8' });

    const farRestaurant = buildRestaurant({
      id: 'restaurant-4',
      latitude: '41.5',
      longitude: '-74.2',
      googleRating: '5.0',
    });
    const farFeatures = buildFeatures(farRestaurant.id, { romantic: '1.0' });

    const result = scoringService.scoreRestaurants(
      [
        { restaurant: closeRestaurant, features: closeFeatures },
        { restaurant: farRestaurant, features: farFeatures },
      ],
      {
        features: {
          romantic: { weight: 1, target: 0.9 },
        },
        intent: 'date_night',
        confidence: 1,
      },
      { lat: 40.7589, lng: -73.9851 },
      15,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('restaurant-3');
  });

  it('adds warnings and lowers score for low confidence data', () => {
    const restaurant = buildRestaurant({ id: 'restaurant-5' });
    const features = buildFeatures(restaurant.id, {
      romantic: '0.92',
      confidenceScore: '0.32',
      reviewCountAnalyzed: 2,
      lastUpdatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });

    const [scored] = scoringService.scoreRestaurants(
      [{ restaurant, features }],
      {
        features: {
          romantic: { weight: 1, target: 0.9 },
        },
        intent: 'date_night',
        confidence: 1,
      },
      { lat: 40.7589, lng: -73.9851 },
      10,
    );

    expect(scored.featureScore).toBeGreaterThan(0.8);
    expect(scored.matchScore).toBeLessThan(scored.featureScore);
    expect(scored.dataQuality.warnings).toEqual(
      expect.arrayContaining(['low_confidence', 'insufficient_reviews', 'stale_features']),
    );
    expect(scored.explanation).toContain('Confidence is limited');
  });

  it('flags missing features and provides fallback explanation', () => {
    const restaurant = buildRestaurant({ id: 'restaurant-6' });

    const [scored] = scoringService.scoreRestaurants(
      [{ restaurant, features: null }],
      {
        features: {
          romantic: { weight: 1, target: 0.9 },
        },
        intent: 'date_night',
        confidence: 1,
      },
      { lat: 40.7589, lng: -73.9851 },
      10,
    );

    expect(scored.matchScore).toBe(0);
    expect(scored.dataQuality.warnings).toEqual(expect.arrayContaining(['missing_features']));
    expect(scored.explanation).toContain('does not have enough recent review data');
  });
});
