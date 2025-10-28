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
  userId?: string;
}

export interface SearchResult {
  queryId: string;
  restaurants: ScoredRestaurant[];
  parsedQuery: ParsedQuery;
  totalCount: number;
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

    const findParams: FindActiveParams = {};
    if (typeof maxPrice === 'number') {
      findParams.maxPrice = maxPrice;
    }

    const results = await this.restaurantRepo.findActive(findParams);

    const cuisineList = params.cuisines ?? parsedQuery.cuisines;
    const filtered = cuisineList && cuisineList.length > 0
      ? results.filter(({ restaurant }) => this.matchCuisines(restaurant.cuisineTags ?? [], cuisineList))
      : results;

    const scored = this.scoringService.scoreRestaurants(
      filtered,
      parsedQuery,
      { lat: params.latitude, lng: params.longitude },
      params.radiusMiles,
    );

    const top = scored.slice(0, params.limit);

    this.logQuery(queryId, params, parsedQuery, top, params.userId).catch((error) => {
      console.warn('Failed to log query', error);
    });

    return {
      queryId,
      restaurants: top,
      parsedQuery,
      totalCount: scored.length,
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

  private matchCuisines(restaurantCuisines: string[], desired: string[]): boolean {
    if (restaurantCuisines.length === 0) {
      return false;
    }

    const normalizedRestaurant = restaurantCuisines.map((cuisine) => cuisine.toLowerCase());
    return desired.some((cuisine) => normalizedRestaurant.includes(cuisine.toLowerCase()));
  }
}
