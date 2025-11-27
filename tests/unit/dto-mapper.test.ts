import { describe, it, expect } from 'vitest';
import { mapRestaurantToDto, mapFeaturesToDto, mapScoredRestaurantToDto } from '../../src/mappers/restaurant.mapper';
import { mapUserToDto, mapSavedRestaurantToDto } from '../../src/mappers/user.mapper';
import type { Restaurant, RestaurantFeature } from '../../src/db/schema';
import type { ScoredRestaurant } from '../../src/services/scoring.service';

describe('DTO Mappers', () => {
  describe('mapRestaurantToDto', () => {
    it('should convert decimals to numbers', () => {
      const restaurant: Restaurant = {
        id: 'test-id',
        name: 'Test Restaurant',
        googlePlaceId: 'place-id',
        latitude: '40.7589',
        longitude: '-73.9851',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        priceLevel: 3,
        googleRating: '4.5',
        googleReviewCount: 250,
        cuisineTags: ['Italian'],
        phone: '+1-212-555-1234',
        website: 'https://example.com',
        photoUrls: ['https://photo1.jpg'],
        hours: { monday: '11:00 AM – 10:00 PM' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastScrapedAt: null,
      };

      const features: RestaurantFeature = {
        id: 'feature-id',
        restaurantId: 'test-id',
        romantic: '0.9',
        cozy: '0.85',
        casual: null,
        noiseLevel: '0.3',
        energyLevel: null,
        crowdedness: null,
        goodForDates: '0.95',
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
        confidenceScore: '0.85',
        reviewCountAnalyzed: 150,
        lastUpdatedAt: new Date(),
        modelVersion: 'v1.0',
      };

      const dto = mapRestaurantToDto(restaurant, features);

      expect(dto.coordinates.lat).toBe(40.7589);
      expect(dto.coordinates.lng).toBe(-73.9851);
      expect(dto.rating).toBe(4.5);
      expect(typeof dto.rating).toBe('number');
      expect(dto.features?.romantic).toBe(0.9);
      expect(typeof dto.features?.romantic).toBe('number');
      expect(dto.features?.casual).toBeNull();
    });

    it('should strip internal fields', () => {
      const restaurant: Restaurant = {
        id: 'test-id',
        name: 'Test Restaurant',
        googlePlaceId: 'place-id',
        latitude: '40.7589',
        longitude: '-73.9851',
        address: null,
        city: null,
        state: null,
        zipCode: null,
        priceLevel: null,
        googleRating: null,
        googleReviewCount: null,
        cuisineTags: null,
        phone: null,
        website: null,
        photoUrls: null,
        hours: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastScrapedAt: null,
      };

      const dto = mapRestaurantToDto(restaurant, null);

      expect('isActive' in dto).toBe(false);
      expect('createdAt' in dto).toBe(false);
      expect('updatedAt' in dto).toBe(false);
      expect('lastScrapedAt' in dto).toBe(false);
      expect('modelVersion' in (dto.features || {})).toBe(false);
    });
  });

  describe('mapFeaturesToDto', () => {
    it('should convert all decimal fields to numbers', () => {
      const features: RestaurantFeature = {
        id: 'feature-id',
        restaurantId: 'restaurant-id',
        romantic: '0.9',
        cozy: '0.85',
        casual: null,
        noiseLevel: '0.3',
        energyLevel: '0.5',
        crowdedness: null,
        goodForDates: '0.95',
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
        confidenceScore: '0.85',
        reviewCountAnalyzed: 150,
        lastUpdatedAt: new Date(),
        modelVersion: 'v1.0',
      };

      const dto = mapFeaturesToDto(features);

      expect(dto.romantic).toBe(0.9);
      expect(dto.cozy).toBe(0.85);
      expect(dto.casual).toBeNull();
      expect(dto.noiseLevel).toBe(0.3);
      expect(dto.energyLevel).toBe(0.5);
      expect(typeof dto.romantic).toBe('number');
    });
  });

  describe('mapScoredRestaurantToDto', () => {
    it('should map scored restaurant correctly', () => {
      const scored: ScoredRestaurant = {
        id: 'restaurant-id',
        name: 'Test Restaurant',
        latitude: 40.7589,
        longitude: -73.9851,
        priceLevel: 3,
        googleRating: 4.5,
        cuisineTags: ['Italian'],
        photoUrls: ['https://photo1.jpg'],
        distanceMiles: 2.3,
        featureScore: 0.88,
        matchScore: 0.92,
        featureMatches: {
          romantic: {
            target: 0.9,
            actual: 0.9,
            match: 1.0,
          },
        },
        explanation: 'Test explanation',
        dataQuality: {
          confidence: 0.85,
          reviewCount: 150,
          lastUpdatedAt: '2024-01-15T00:00:00.000Z',
          warnings: [],
        },
      };

      const dto = mapScoredRestaurantToDto(scored);

      expect(dto.coordinates.lat).toBe(40.7589);
      expect(dto.coordinates.lng).toBe(-73.9851);
      expect(dto.matchScore).toBe(0.92);
      expect(dto.featureMatches.romantic.match).toBe(1.0);
    });
  });

  describe('mapUserToDto', () => {
    it('should strip password hash and normalize decimals', () => {
      const user = {
        id: 'user-id',
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        emailVerified: true,
        name: 'Test User',
        defaultLatitude: '40.7589',
        defaultLongitude: '-73.9851',
        defaultCity: 'New York',
        tasteProfile: null,
        favoriteCuisines: ['Italian'],
        subscriptionTier: 'premium' as const,
        subscriptionStartsAt: new Date(),
        subscriptionEndsAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
        queryCount: 42,
      };

      const dto = mapUserToDto(user);

      expect('passwordHash' in dto).toBe(false);
      expect('createdAt' in dto).toBe(false);
      expect('updatedAt' in dto).toBe(false);
      expect(dto.defaultLocation?.latitude).toBe(40.7589);
      expect(dto.defaultLocation?.longitude).toBe(-73.9851);
      expect(typeof dto.defaultLocation?.latitude).toBe('number');
    });
  });

  describe('mapSavedRestaurantToDto', () => {
    it('should map saved restaurant with nested restaurant DTO', () => {
      const saved = {
        saved: {
          id: 'saved-id',
          notes: 'Test notes',
          tags: ['favorite'],
          createdAt: new Date('2024-01-01'),
          personalRating: 5,
          visited: true,
          visitedAt: new Date('2024-01-15'),
        },
        restaurant: {
          id: 'restaurant-id',
          name: 'Test Restaurant',
          coordinates: { lat: 40.7589, lng: -73.9851 },
          priceLevel: 3,
          rating: 4.5,
          reviewCount: 250,
          cuisineTags: ['Italian'],
          photos: [],
          features: null,
        } as any,
      };

      const dto = mapSavedRestaurantToDto(saved);

      expect(dto.id).toBe('saved-id');
      expect(dto.restaurant.id).toBe('restaurant-id');
      expect(dto.savedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(dto.visitedAt).toBe('2024-01-15T00:00:00.000Z');
    });
  });
});

