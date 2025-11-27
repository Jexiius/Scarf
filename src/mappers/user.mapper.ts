import type { User } from '../db/schema';
import { mapRestaurantToDto, type RestaurantDto } from './restaurant.mapper';

/**
 * Public User DTO - strips sensitive fields and normalizes data.
 */
export interface UserDto {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  defaultLocation: {
    latitude: number | null;
    longitude: number | null;
    city: string | null;
  } | null;
  favoriteCuisines: string[];
  subscriptionTier: 'free' | 'premium';
  subscriptionStartsAt: string | null;
  subscriptionEndsAt: string | null;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  queryCount: number;
}

/**
 * Maps a database user record to a public DTO.
 * Strips password hash and other sensitive/internal fields.
 */
export function mapUserToDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    defaultLocation:
      user.defaultLatitude && user.defaultLongitude
        ? {
            latitude: Number(user.defaultLatitude),
            longitude: Number(user.defaultLongitude),
            city: user.defaultCity,
          }
        : null,
    favoriteCuisines: user.favoriteCuisines ?? [],
    subscriptionTier: user.subscriptionTier,
    subscriptionStartsAt: user.subscriptionStartsAt?.toISOString() ?? null,
    subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    queryCount: user.queryCount,
  };
}

/**
 * Saved Restaurant DTO - combines saved restaurant metadata with restaurant data.
 */
export interface SavedRestaurantDto {
  id: string;
  notes: string | null;
  tags: string[];
  savedAt: string;
  personalRating: number | null;
  visited: boolean;
  visitedAt: string | null;
  restaurant: RestaurantDto;
}

/**
 * Maps a saved restaurant record with restaurant data to a DTO.
 */
export function mapSavedRestaurantToDto(data: {
  saved: {
    id: string;
    notes: string | null;
    tags: string[] | null;
    createdAt: Date;
    personalRating: number | null;
    visited: boolean;
    visitedAt: Date | null;
  };
  restaurant: RestaurantDto;
}): SavedRestaurantDto {
  return {
    id: data.saved.id,
    notes: data.saved.notes,
    tags: data.saved.tags ?? [],
    savedAt: data.saved.createdAt.toISOString(),
    personalRating: data.saved.personalRating,
    visited: data.saved.visited,
    visitedAt: data.saved.visitedAt?.toISOString() ?? null,
    restaurant: data.restaurant,
  };
}

