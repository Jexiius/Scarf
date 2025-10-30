import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

// Google Places API response types
export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  opening_hours?: {
    open_now?: boolean;
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
    relative_time_description: string;
  }>;
}

interface PlacesApiError {
  status: string;
  error_message?: string;
}

export class GooglePlacesService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/place';

  constructor() {
    if (!env.GOOGLE_PLACES_API_KEY) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    }

    this.apiKey = env.GOOGLE_PLACES_API_KEY;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Search for restaurants in a geographic area
   * @param latitude Center latitude
   * @param longitude Center longitude
   * @param radiusMeters Search radius in meters (max 50000)
   * @param keyword Optional search keyword (e.g., "Italian restaurant")
   * @returns Array of place search results
   */
  async searchRestaurants(
    latitude: number,
    longitude: number,
    radiusMeters: number = 2500, // ~1.5 miles
    keyword?: string
  ): Promise<PlaceSearchResult[]> {
    try {
      const params: any = {
        key: this.apiKey,
        location: `${latitude},${longitude}`,
        radius: radiusMeters,
        type: 'restaurant',
      };

      if (keyword) {
        params.keyword = keyword;
      }

      console.log(`🔍 Searching restaurants at (${latitude}, ${longitude}) radius ${radiusMeters}m`);

      const response = await this.client.get('/nearbysearch/json', { params });
      const data = response.data;

      if (data.status === 'ZERO_RESULTS') {
        console.log('⚠️  No results found');
        return [];
      }

      if (data.status !== 'OK') {
        throw new Error(`Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      console.log(`✅ Found ${data.results.length} restaurants`);
      return data.results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Places API request failed:', error.response?.data || error.message);
        throw new Error(`Places API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get detailed information about a specific place including reviews
   * @param placeId Google Place ID
   * @returns Place details with reviews
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
      const params = {
        key: this.apiKey,
        place_id: placeId,
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'formatted_phone_number',
          'website',
          'geometry',
          'rating',
          'user_ratings_total',
          'price_level',
          'types',
          'address_components',
          'opening_hours',
          'photos',
          'reviews',
        ].join(','),
      };

      console.log(`📋 Fetching details for place: ${placeId}`);

      const response = await this.client.get('/details/json', { params });
      const data = response.data;

      if (data.status === 'NOT_FOUND') {
        console.log(`⚠️  Place not found: ${placeId}`);
        return null;
      }

      if (data.status !== 'OK') {
        throw new Error(`Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      console.log(`✅ Got details for: ${data.result.name}`);
      return data.result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Places API request failed:', error.response?.data || error.message);
        
        // Rate limiting
        if (error.response?.status === 429) {
          throw new Error('RATE_LIMIT_EXCEEDED');
        }
        
        throw new Error(`Places API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get photo URL for a photo reference
   * @param photoReference Photo reference from place data
   * @param maxWidth Max width in pixels (default 400)
   * @returns Photo URL
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${this.baseUrl}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  /**
   * Extract city and state from address components
   */
  extractAddressComponents(addressComponents?: PlaceDetails['address_components']): {
    city?: string;
    state?: string;
    zipCode?: string;
  } {
    if (!addressComponents) return {};

    const city = addressComponents.find(c => c.types.includes('locality'))?.long_name;
    const state = addressComponents.find(c => c.types.includes('administrative_area_level_1'))?.short_name;
    const zipCode = addressComponents.find(c => c.types.includes('postal_code'))?.long_name;

    return { city, state, zipCode };
  }

  /**
   * Map Google cuisine types to our standardized tags
   */
  mapCuisineTags(types?: string[]): string[] {
    if (!types) return [];

    const cuisineMap: Record<string, string> = {
      'italian_restaurant': 'Italian',
      'chinese_restaurant': 'Chinese',
      'japanese_restaurant': 'Japanese',
      'mexican_restaurant': 'Mexican',
      'indian_restaurant': 'Indian',
      'thai_restaurant': 'Thai',
      'french_restaurant': 'French',
      'korean_restaurant': 'Korean',
      'vietnamese_restaurant': 'Vietnamese',
      'spanish_restaurant': 'Spanish',
      'mediterranean_restaurant': 'Mediterranean',
      'american_restaurant': 'American',
      'bar': 'Bar',
      'cafe': 'Cafe',
      'bakery': 'Bakery',
      'pizza_restaurant': 'Pizza',
      'seafood_restaurant': 'Seafood',
      'steak_house': 'Steakhouse',
      'barbecue_restaurant': 'BBQ',
      'fast_food_restaurant': 'Fast Food',
    };

    const tags = types
      .map(type => cuisineMap[type])
      .filter((tag): tag is string => !!tag);

    // Fallback to generic tags
    if (tags.length === 0) {
      if (types.includes('meal_takeaway')) tags.push('Takeout');
      if (types.includes('meal_delivery')) tags.push('Delivery');
      if (types.includes('restaurant')) tags.push('Restaurant');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Convert opening hours to our JSON format
   */
  formatOpeningHours(openingHours?: PlaceDetails['opening_hours']): Record<string, string> | null {
    if (!openingHours?.weekday_text) return null;

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const hours: Record<string, string> = {};

    openingHours.weekday_text.forEach((text, index) => {
      // Format: "Monday: 11:00 AM – 10:00 PM"
      const match = text.match(/:\s*(.+)/);
      if (match) {
        hours[days[index]] = match[1];
      }
    });

    return hours;
  }

  /**
   * Rate limiting helper - wait between requests
   */
  async rateLimitDelay(ms: number = 1000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
