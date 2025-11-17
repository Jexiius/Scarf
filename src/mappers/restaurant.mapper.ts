import type { Restaurant, RestaurantFeature } from '../db/schema';
import type { ScoredRestaurant } from '../services/scoring.service';

/**
 * Public API DTOs - these represent the shape of data returned to clients.
 * Internal database fields are stripped and decimals are normalized to numbers.
 */

export interface RestaurantDto {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  coordinates: {
    lat: number;
    lng: number;
  };
  priceLevel: number | null;
  rating: number | null;
  reviewCount: number | null;
  cuisineTags: string[];
  phone: string | null;
  website: string | null;
  photos: string[];
  hours: Record<string, string> | null;
  features: RestaurantFeaturesDto | null;
}

export interface RestaurantFeaturesDto {
  romantic: number | null;
  cozy: number | null;
  casual: number | null;
  noiseLevel: number | null;
  energyLevel: number | null;
  crowdedness: number | null;
  goodForDates: number | null;
  goodForGroups: number | null;
  familyFriendly: number | null;
  businessAppropriate: number | null;
  celebrationWorthy: number | null;
  fastService: number | null;
  attentiveService: number | null;
  authentic: number | null;
  creativeMenu: number | null;
  comfortFood: number | null;
  healthyOptions: number | null;
  portionsLarge: number | null;
  veganFriendly: number | null;
  photogenicFood: number | null;
  decorQuality: number | null;
  photoFriendlyLighting: number | null;
  niceViews: number | null;
  trendy: number | null;
  outdoorSeating: number | null;
  easyParking: number | null;
  reservationsNeeded: number | null;
  lateNight: number | null;
  formality: number | null;
  goodValue: number | null;
  splurgeWorthy: number | null;
  popularity: number | null;
}

/**
 * Maps a database restaurant record with features to a public DTO.
 * Strips internal fields and normalizes decimals to numbers.
 */
export function mapRestaurantToDto(
  restaurant: Restaurant,
  features: RestaurantFeature | null,
): RestaurantDto {
  return {
    id: restaurant.id,
    name: restaurant.name,
    address: restaurant.address,
    city: restaurant.city,
    state: restaurant.state,
    zipCode: restaurant.zipCode,
    coordinates: {
      lat: Number(restaurant.latitude),
      lng: Number(restaurant.longitude),
    },
    priceLevel: restaurant.priceLevel,
    rating: restaurant.googleRating ? Number(restaurant.googleRating) : null,
    reviewCount: restaurant.googleReviewCount,
    cuisineTags: restaurant.cuisineTags ?? [],
    phone: restaurant.phone,
    website: restaurant.website,
    photos: restaurant.photoUrls ?? [],
    hours: restaurant.hours as Record<string, string> | null,
    features: features ? mapFeaturesToDto(features) : null,
  };
}

/**
 * Maps restaurant features from database format to DTO.
 * Converts all decimal fields to numbers and strips internal metadata.
 */
export function mapFeaturesToDto(features: RestaurantFeature): RestaurantFeaturesDto {
  return {
    romantic: parseDecimal(features.romantic),
    cozy: parseDecimal(features.cozy),
    casual: parseDecimal(features.casual),
    noiseLevel: parseDecimal(features.noiseLevel),
    energyLevel: parseDecimal(features.energyLevel),
    crowdedness: parseDecimal(features.crowdedness),
    goodForDates: parseDecimal(features.goodForDates),
    goodForGroups: parseDecimal(features.goodForGroups),
    familyFriendly: parseDecimal(features.familyFriendly),
    businessAppropriate: parseDecimal(features.businessAppropriate),
    celebrationWorthy: parseDecimal(features.celebrationWorthy),
    fastService: parseDecimal(features.fastService),
    attentiveService: parseDecimal(features.attentiveService),
    authentic: parseDecimal(features.authentic),
    creativeMenu: parseDecimal(features.creativeMenu),
    comfortFood: parseDecimal(features.comfortFood),
    healthyOptions: parseDecimal(features.healthyOptions),
    portionsLarge: parseDecimal(features.portionsLarge),
    veganFriendly: parseDecimal(features.veganFriendly),
    photogenicFood: parseDecimal(features.photogenicFood),
    decorQuality: parseDecimal(features.decorQuality),
    photoFriendlyLighting: parseDecimal(features.photoFriendlyLighting),
    niceViews: parseDecimal(features.niceViews),
    trendy: parseDecimal(features.trendy),
    outdoorSeating: parseDecimal(features.outdoorSeating),
    easyParking: parseDecimal(features.easyParking),
    reservationsNeeded: parseDecimal(features.reservationsNeeded),
    lateNight: parseDecimal(features.lateNight),
    formality: parseDecimal(features.formality),
    goodValue: parseDecimal(features.goodValue),
    splurgeWorthy: parseDecimal(features.splurgeWorthy),
    popularity: parseDecimal(features.popularity),
  };
}

/**
 * Maps a ScoredRestaurant (from search results) to a DTO.
 * ScoredRestaurant already has normalized numbers, but we ensure consistency.
 */
export function mapScoredRestaurantToDto(scored: ScoredRestaurant): ScoredRestaurantDto {
  return {
    id: scored.id,
    name: scored.name,
    coordinates: {
      lat: scored.latitude,
      lng: scored.longitude,
    },
    priceLevel: scored.priceLevel,
    rating: scored.googleRating,
    cuisineTags: scored.cuisineTags,
    photos: scored.photoUrls,
    distanceMiles: scored.distanceMiles,
    matchScore: scored.matchScore,
    featureScore: scored.featureScore,
    featureMatches: scored.featureMatches,
    explanation: scored.explanation,
    dataQuality: scored.dataQuality,
  };
}

export interface ScoredRestaurantDto {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  priceLevel: number | null;
  rating: number | null;
  cuisineTags: string[];
  photos: string[];
  distanceMiles: number;
  matchScore: number;
  featureScore: number;
  featureMatches: Record<string, { target: number; actual: number; match: number }>;
  explanation: string;
  dataQuality: {
    confidence: number | null;
    reviewCount: number;
    lastUpdatedAt: string | null;
    warnings: string[];
  };
}

/**
 * Helper to parse decimal values from database to numbers.
 * Handles string decimals (from Postgres) and null values.
 */
function parseDecimal(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
  }

  return null;
}

