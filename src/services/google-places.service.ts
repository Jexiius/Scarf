import { env } from '../config/env';

interface PlacesSearchResponse {
  status: string;
  results: PlaceSearchResult[];
  next_page_token?: string;
  error_message?: string;
}

interface PlaceDetailsResponse {
  status: string;
  result: PlaceDetails;
  error_message?: string;
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} ${statusText}`);
  }
}

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  vicinity?: string;
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

export class GooglePlacesService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api/place';
  private readonly timeoutMs = 10_000;

  constructor() {
    if (!env.GOOGLE_PLACES_API_KEY) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    }

    this.apiKey = env.GOOGLE_PLACES_API_KEY;
  }

  async searchRestaurants(
    latitude: number,
    longitude: number,
    radiusMeters = 2_500,
    keyword?: string,
    maxResults = 60,
  ): Promise<PlaceSearchResult[]> {
    const collected: PlaceSearchResult[] = [];
    let pageToken: string | undefined;
    let page = 0;

    while (page < 3 && collected.length < maxResults) {
      if (pageToken) {
        await this.rateLimitDelay(2_000);
      }

      const params: Record<string, string | number | undefined> = {
        key: this.apiKey,
        type: 'restaurant',
        keyword,
      };

      if (pageToken) {
        params.pagetoken = pageToken;
      } else {
        params.location = `${latitude},${longitude}`;
        params.radius = radiusMeters;
      }

      try {
        const data = await this.getJson<PlacesSearchResponse>('/nearbysearch/json', params);

        if (data.status === 'ZERO_RESULTS') {
          console.log('⚠️  No results found for this search');
          break;
        }

        if (data.status === 'INVALID_REQUEST' && pageToken) {
          console.log('⏳ Next page token not ready, retrying...');
          await this.rateLimitDelay(2_000);
          continue;
        }

        if (data.status !== 'OK') {
          throw new Error(`Places API error: ${data.status} - ${data.error_message ?? 'Unknown error'}`);
        }

        collected.push(...data.results);
        console.log(`✅ Page ${page + 1}: fetched ${data.results.length} restaurants (total ${collected.length})`);

        if (!data.next_page_token) {
          break;
        }

        pageToken = data.next_page_token;
        page += 1;
      } catch (error) {
        this.logError('searchRestaurants', error);
        throw this.wrapError(error, 'Places API request failed');
      }
    }

    return collected.slice(0, maxResults);
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
      const data = await this.getJson<PlaceDetailsResponse>('/details/json', {
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
      });

      if (data.status === 'NOT_FOUND') {
        console.log(`⚠️  Place not found: ${placeId}`);
        return null;
      }

      if (data.status !== 'OK') {
        throw new Error(`Places API error: ${data.status} - ${data.error_message ?? 'Unknown error'}`);
      }

      console.log(`✅ Got details for: ${data.result.name}`);
      return data.result;
    } catch (error) {
      if (error instanceof HttpError && error.status === 429) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      this.logError('getPlaceDetails', error);
      throw this.wrapError(error, 'Places API request failed');
    }
  }

  getPhotoUrl(photoReference: string, maxWidth = 400): string {
    return `${this.baseUrl}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  extractAddressComponents(
    addressComponents?: PlaceDetails['address_components'],
  ): { city?: string; state?: string; zipCode?: string } {
    if (!addressComponents) {
      return {};
    }

    const result: { city?: string; state?: string; zipCode?: string } = {};

    const city = addressComponents.find((component) => component.types.includes('locality'))?.long_name;
    const state = addressComponents.find((component) =>
      component.types.includes('administrative_area_level_1'),
    )?.short_name;
    const zipCode = addressComponents.find((component) => component.types.includes('postal_code'))?.long_name;

    if (city) result.city = city;
    if (state) result.state = state;
    if (zipCode) result.zipCode = zipCode;

    return result;
  }

  mapCuisineTags(types?: string[]): string[] {
    if (!types) {
      return [];
    }

    const cuisineMap: Record<string, string> = {
      italian_restaurant: 'Italian',
      chinese_restaurant: 'Chinese',
      japanese_restaurant: 'Japanese',
      mexican_restaurant: 'Mexican',
      indian_restaurant: 'Indian',
      thai_restaurant: 'Thai',
      french_restaurant: 'French',
      korean_restaurant: 'Korean',
      vietnamese_restaurant: 'Vietnamese',
      spanish_restaurant: 'Spanish',
      mediterranean_restaurant: 'Mediterranean',
      american_restaurant: 'American',
      bar: 'Bar',
      cafe: 'Cafe',
      bakery: 'Bakery',
      pizza_restaurant: 'Pizza',
      seafood_restaurant: 'Seafood',
      steak_house: 'Steakhouse',
      barbecue_restaurant: 'BBQ',
      fast_food_restaurant: 'Fast Food',
    };

    const tags = new Set<string>();

    for (const type of types) {
      const mapped = cuisineMap[type];
      if (mapped) {
        tags.add(mapped);
      }
    }

    if (tags.size === 0) {
      if (types.includes('meal_takeaway')) tags.add('Takeout');
      if (types.includes('meal_delivery')) tags.add('Delivery');
      if (types.includes('restaurant')) tags.add('Restaurant');
    }

    return Array.from(tags);
  }

  formatOpeningHours(
    openingHours?: PlaceDetails['opening_hours'],
  ): Record<string, string> | null {
    if (!openingHours?.weekday_text) {
      return null;
    }

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const hours: Record<string, string> = {};

    openingHours.weekday_text.forEach((text, index) => {
      const match = text.match(/:\s*(.+)/);
      const day = days[index];
      if (match && day) {
        const value = match[1];
        if (value) {
          hours[day] = value;
        }
      }
    });

    return hours;
  }

  async rateLimitDelay(ms = 1_000): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async getJson<T>(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new HttpError(response.status, response.statusText, body);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private logError(context: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Places API request failed in ${context}:`, message);
  }

  private wrapError(error: unknown, prefix: string): Error {
    if (error instanceof Error) {
      return new Error(`${prefix}: ${error.message}`);
    }
    return new Error(`${prefix}: ${String(error)}`);
  }
}
