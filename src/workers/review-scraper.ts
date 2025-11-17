import { closePool } from '../config/database';
import { GooglePlacesService } from '../services/google-places.service';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { QueueRepository, type QueueTask } from '../repositories/queue.repository';
import { logger } from '../utils/logger';

export class ReviewScraperWorker {
  private readonly placesService = new GooglePlacesService();
  private readonly restaurantRepo = new RestaurantRepository();
  private readonly queueRepo = new QueueRepository();

  async execute(restaurantId: string): Promise<void> {
    const log = logger.child({ restaurantId, worker: 'review-scraper' });
    log.info('Starting review scraping');

    const record = await this.restaurantRepo.findById(restaurantId);
    if (!record) {
      throw new Error(`Restaurant not found: ${restaurantId}`);
    }

    const { restaurant } = record;

    if (!restaurant.googlePlaceId) {
      throw new Error(`Restaurant has no Google Place ID: ${restaurantId}`);
    }

    log.info({ restaurantName: restaurant.name, googlePlaceId: restaurant.googlePlaceId }, 'Scraping restaurant');

    const placeDetails = await this.placesService.getPlaceDetails(restaurant.googlePlaceId);
    if (!placeDetails) {
      throw new Error(`Could not fetch place details for: ${restaurant.googlePlaceId}`);
    }

    const addressComponents = this.placesService.extractAddressComponents(
      placeDetails.address_components,
    );
    const cuisineTags = this.placesService.mapCuisineTags(placeDetails.types);
    const hours = this.placesService.formatOpeningHours(placeDetails.opening_hours);
    const photoUrls =
      placeDetails.photos?.slice(0, 5).map((photo) => this.placesService.getPhotoUrl(photo.photo_reference, 800)) ??
      [];

    await this.restaurantRepo.upsertRestaurant({
      googlePlaceId: restaurant.googlePlaceId,
      name: placeDetails.name,
      latitude: placeDetails.geometry.location.lat,
      longitude: placeDetails.geometry.location.lng,
      address: placeDetails.formatted_address ?? null,
      city: addressComponents.city ?? null,
      state: addressComponents.state ?? null,
      zipCode: addressComponents.zipCode ?? null,
      priceLevel: typeof placeDetails.price_level === 'number' ? placeDetails.price_level : null,
      googleRating: typeof placeDetails.rating === 'number' ? placeDetails.rating : null,
      googleReviewCount:
        typeof placeDetails.user_ratings_total === 'number' ? placeDetails.user_ratings_total : null,
      cuisineTags,
      phone: placeDetails.formatted_phone_number ?? null,
      website: placeDetails.website ?? null,
      photoUrls,
      hours: hours ?? null,
    });

    log.info('Updated restaurant metadata');

    if (!placeDetails.reviews || placeDetails.reviews.length === 0) {
      log.warn('No reviews available from API');
      return;
    }

    log.info({ reviewCount: placeDetails.reviews.length }, 'Found reviews from API');

    const created = await this.restaurantRepo.createReviews(
      placeDetails.reviews.map((review) => ({
        restaurantId: restaurant.id,
        authorName: review.author_name,
        text: review.text,
        rating: review.rating,
        source: 'google',
        sourceReviewId: `${restaurant.googlePlaceId}_${review.time}`,
        publishedAt: new Date(review.time * 1000),
      })),
    );

    log.info(
      {
        created,
        duplicates: placeDetails.reviews.length - created,
      },
      'Saved reviews',
    );

    const totalReviews = await this.restaurantRepo.getReviewCount(restaurant.id);
    log.info({ totalReviews }, 'Total reviews in database');

    if (created > 0) {
      const unprocessed = await this.restaurantRepo.getUnprocessedReviewCount(restaurant.id);
      if (unprocessed > 0) {
        const hasTask = await this.queueRepo.taskExists(restaurant.id, 'extract_features', [
          'pending',
          'processing',
        ]);

        if (!hasTask) {
          await this.queueRepo.addTask(restaurant.id, 'extract_features', 50);
          log.info({ unprocessedReviews: unprocessed }, 'Queued feature extraction task');
        }
      }
    }
  }
}

export class QueueProcessor {
  private readonly worker = new ReviewScraperWorker();
  private readonly queueRepo = new QueueRepository();
  private isRunning = false;
  private lastRecoveryCheck = 0;
  private readonly recoveryCheckInterval = 5 * 60 * 1000; // 5 minutes

  async start(): Promise<void> {
    this.isRunning = true;
    const log = logger.child({ worker: 'review-scraper-processor' });
    log.info('Review Scraper Worker Started');

    while (this.isRunning) {
      let task: QueueTask | null = null;
      try {
        // Periodically reset stuck tasks
        await this.checkAndResetStuckTasks(log as any);

        task = await this.queueRepo.claimNextTask(['scrape_reviews']);

        if (!task) {
          await this.sleep(5_000);
          continue;
        }

        const taskLog = log.child({
          taskId: task.id,
          restaurantId: task.restaurantId,
          attempt: task.attempts + 1,
          maxAttempts: task.maxAttempts,
        });

        // Check if task was recovered from stuck state
        if ((task as any)._wasStuck) {
          taskLog.warn('Recovered stuck task');
        }

        taskLog.info('Processing scrape task');

        await this.worker.execute(task.restaurantId);

        await this.queueRepo.completeTask(task.id);
        taskLog.info('Task completed successfully');

        const stats = await this.queueRepo.getQueueStats();
        log.debug(
          {
            pending: stats.pending,
            processing: stats.processing,
            completed: stats.completed,
          },
          'Queue stats',
        );

        await this.sleep(2_000);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const errorLog = task
          ? log.child({ taskId: task.id, restaurantId: task.restaurantId })
          : log;
        errorLog.error({ error: message, stack: error instanceof Error ? error.stack : undefined }, 'Task failed');

        if (task) {
          await this.queueRepo.failTask(task.id, message);
        }

        const delay = message === 'RATE_LIMIT_EXCEEDED' ? 60_000 : 10_000;
        await this.sleep(delay);
      }
    }

    log.info('Worker stopped');
  }

  private async checkAndResetStuckTasks(log: ReturnType<typeof logger.child>): Promise<void> {
    const now = Date.now();
    if (now - this.lastRecoveryCheck < this.recoveryCheckInterval) {
      return;
    }

    this.lastRecoveryCheck = now;

    try {
      const resetCount = await this.queueRepo.resetStuckTasks();
      if (resetCount > 0) {
        log.warn({ resetCount }, 'Reset stuck tasks');
      }
    } catch (error) {
      log.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to reset stuck tasks',
      );
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

if (require.main === module) {
  const processor = new QueueProcessor();
  let shuttingDown = false;

  const shutdown = async (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    processor.stop();
    try {
      await closePool();
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to close database pool',
      );
    } finally {
      process.exit(code);
    }
  };

  process.on('SIGTERM', () => shutdown(0));
  process.on('SIGINT', () => shutdown(0));

  processor.start().catch(async (error) => {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Worker crashed',
    );
    await shutdown(1);
  });
}
