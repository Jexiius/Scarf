import { v4 as uuidv4 } from 'uuid';
import { RestaurantRepository, type FindActiveParams } from '../repositories/restaurant.repository';
import { UserQueryRepository } from '../repositories/user-query.repository';
import { UserRepository } from '../repositories/user.repository';
import type { ParsedQuery } from './query-parser.service';
import { QueryParserService } from './query-parser.service';
import { ScoringService, type ScoredRestaurant } from './scoring.service';

export interface SearchParams {
  query: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  maxPrice?: number;
  cuisines?: string[];
  limit: number;
  offset?: number;
  cursor?: string;
  userId?: string;
}

export interface SearchResult {
  queryId: string;
  restaurants: ScoredRestaurant[];
  parsedQuery: ParsedQuery;
  totalCount: number;
  nextCursor?: string; // For cursor-based pagination
}

export class SearchService {
  constructor(
    private readonly restaurantRepo = new RestaurantRepository(),
    private readonly queryParser = new QueryParserService(),
    private readonly scoringService = new ScoringService(),
    private readonly userQueryRepo = new UserQueryRepository(),
    private readonly userRepo = new UserRepository(),
  ) {}

  async search(params: SearchParams): Promise<SearchResult> {
    const queryId = uuidv4();

    const parsedQuery = await this.queryParser.parseQuery(params.query);
    const maxPrice = params.maxPrice ?? parsedQuery.maxPrice;
    const cuisineList = params.cuisines ?? parsedQuery.cuisines;

    // Build repository query params with SQL-level filters
    const findParams: FindActiveParams = {
      latitude: params.latitude,
      longitude: params.longitude,
      radiusMiles: params.radiusMiles,
      limit: Math.min(params.limit * 2, 100), // Fetch more for scoring, but cap at 100
      offset: params.offset,
      cursor: params.cursor,
    };

    if (typeof maxPrice === 'number') {
      findParams.maxPrice = maxPrice;
    }

    if (cuisineList && cuisineList.length > 0) {
      findParams.cuisines = cuisineList;
    }

    // Query with SQL-level filtering (price, cuisine, radius)
    const results = await this.restaurantRepo.findActive(findParams);

    // Score the results (distance already calculated in SQL if available)
    const scored = this.scoringService.scoreRestaurants(
      results,
      parsedQuery,
      { lat: params.latitude, lng: params.longitude },
      params.radiusMiles,
    );

    // Take top N results
    const top = scored.slice(0, params.limit);

    this.logQuery(queryId, params, parsedQuery, top, params.userId).catch((error) => {
      // Use logger instead of console.warn
      // Error is logged in the catch block, no need to log here
    });

    // Determine next cursor (last restaurant ID) for pagination
    const nextCursor = top.length > 0 && top.length === params.limit ? top[top.length - 1]!.id : undefined;

    return {
      queryId,
      restaurants: top,
      parsedQuery,
      totalCount: scored.length,
      nextCursor,
    };
  }

  private async logQuery(
    _queryId: string,
    params: SearchParams,
    parsedQuery: ParsedQuery,
    results: ScoredRestaurant[],
    userId?: string,
  ) {
    if (!userId) {
      return;
    }

    const filters = {
      maxPrice: params.maxPrice ?? parsedQuery.maxPrice ?? null,
      cuisines: params.cuisines ?? parsedQuery.cuisines ?? null,
      limit: params.limit,
    };

    const resultsReturned = results.map((result, index) => ({
      restaurant_id: result.id,
      name: result.name,
      score: result.matchScore,
      position: index + 1,
      distance_miles: result.distanceMiles,
    }));

    await this.userQueryRepo.create({
      userId,
      queryText: params.query,
      parsedQuery,
      filtersApplied: filters,
      latitude: params.latitude.toFixed(6),
      longitude: params.longitude.toFixed(6),
      radiusMiles: params.radiusMiles.toFixed(2),
      resultsReturned,
    });

    await this.userRepo.recordQueryActivity(userId);
  }

}
