import { SavedRestaurantRepository } from '../repositories/saved-restaurant.repository';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { ValidationError, NotFoundError } from '../utils/errors';
import type { Restaurant, RestaurantFeature, SavedRestaurant } from '../db/schema';

interface SaveParams {
  restaurantId: string;
  notes?: string | undefined;
  tags?: string[] | undefined;
  personalRating?: number | undefined;
  visited?: boolean | undefined;
  visitedAt?: Date | string | undefined;
}

export class SavedRestaurantsService {
  constructor(
    private readonly savedRepo = new SavedRestaurantRepository(),
    private readonly restaurantRepo = new RestaurantRepository(),
  ) {}

  async list(userId: string) {
    const records = await this.savedRepo.listByUser(userId);
    return records.map((record) => this.mapRecord(record));
  }

  async save(userId: string, params: SaveParams) {
    const restaurant = await this.restaurantRepo.findById(params.restaurantId);
    if (!restaurant) {
      throw new NotFoundError('Restaurant not found');
    }

    const existing = await this.savedRepo.find(userId, params.restaurantId);
    if (existing) {
      throw new ValidationError('Restaurant is already saved');
    }

    const visitedAt = params.visitedAt ? new Date(params.visitedAt) : null;
    const normalizedVisitedAt = visitedAt && !Number.isNaN(visitedAt.getTime()) ? visitedAt : null;

    await this.savedRepo.create({
      userId,
      restaurantId: params.restaurantId,
      notes: params.notes?.trim(),
      tags: params.tags && params.tags.length > 0 ? params.tags : null,
      personalRating: typeof params.personalRating === 'number' ? params.personalRating : null,
      visited: params.visited ?? false,
      visitedAt: normalizedVisitedAt,
    });

    const record = await this.savedRepo.find(userId, params.restaurantId);
    if (!record) {
      throw new NotFoundError('Saved restaurant could not be retrieved after creation');
    }

    return this.mapRecord(record);
  }

  async remove(userId: string, restaurantId: string) {
    const removed = await this.savedRepo.remove(userId, restaurantId);
    if (!removed) {
      throw new NotFoundError('Saved restaurant not found');
    }
  }

  private mapRecord(record: {
    saved: SavedRestaurant;
    restaurant: Restaurant;
    features?: RestaurantFeature | null;
  }) {
    return {
      id: record.saved.id,
      notes: record.saved.notes,
      tags: record.saved.tags ?? [],
      savedAt: record.saved.createdAt,
      personalRating:
        typeof record.saved.personalRating === 'number' ? record.saved.personalRating : null,
      visited: record.saved.visited ?? false,
      visitedAt: record.saved.visitedAt ?? null,
      restaurant: record.restaurant,
      features: record.features,
    };
  }
}
