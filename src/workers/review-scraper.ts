import { GooglePlacesService } from '../services/google-places.service';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { QueueRepository, type QueueTask } from '../repositories/queue.repository';

export class ReviewScraperWorker {
  private readonly placesService = new GooglePlacesService();
  private readonly restaurantRepo = new RestaurantRepository();
  private readonly queueRepo = new QueueRepository();

  async execute(restaurantId: string): Promise<void> {
    console.log(`\n🔍 Scraping reviews for restaurant: ${restaurantId}`);

    const record = await this.restaurantRepo.findById(restaurantId);
    if (!record) {
      throw new Error(`Restaurant not found: ${restaurantId}`);
    }

    const { restaurant } = record;

    if (!restaurant.googlePlaceId) {
      throw new Error(`Restaurant has no Google Place ID: ${restaurantId}`);
    }

    console.log(`📍 Restaurant: ${restaurant.name}`);

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

    console.log('✅ Updated restaurant metadata');

    if (!placeDetails.reviews || placeDetails.reviews.length === 0) {
      console.log('⚠️  No reviews available from API');
      return;
    }

    console.log(`📝 Found ${placeDetails.reviews.length} reviews`);

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

    console.log(
      `✅ Saved ${created} new reviews (${placeDetails.reviews.length - created} duplicates skipped)`,
    );

    const totalReviews = await this.restaurantRepo.getReviewCount(restaurant.id);
    console.log(`📊 Total reviews in DB: ${totalReviews}`);

    if (created > 0) {
      const unprocessed = await this.restaurantRepo.getUnprocessedReviewCount(restaurant.id);
      if (unprocessed > 0) {
        const hasTask = await this.queueRepo.taskExists(restaurant.id, 'extract_features', [
          'pending',
          'processing',
        ]);

        if (!hasTask) {
          await this.queueRepo.addTask(restaurant.id, 'extract_features', 50);
          console.log(`📋 Queued feature extraction task (${unprocessed} reviews to process)`);
        }
      }
    }
  }
}

export class QueueProcessor {
  private readonly worker = new ReviewScraperWorker();
  private readonly queueRepo = new QueueRepository();
  private isRunning = false;

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('🚀 Review Scraper Worker Started');
    console.log('================================');
    console.log('Watching for scrape_reviews tasks...\n');

    while (this.isRunning) {
      let task: QueueTask | null = null;
      try {
        task = await this.queueRepo.claimNextTask();

        if (!task) {
          await this.sleep(5_000);
          continue;
        }

        if (task.taskType !== 'scrape_reviews') {
          console.log(`⏭️  Skipping task type: ${task.taskType}`);
          await this.queueRepo.completeTask(task.id);
          continue;
        }

        console.log(`\n⚡ Processing task: ${task.id}`);
        console.log(`   Restaurant: ${task.restaurantId}`);
        console.log(`   Attempt: ${task.attempts + 1}/${task.maxAttempts}`);

        await this.worker.execute(task.restaurantId);

        await this.queueRepo.completeTask(task.id);
        console.log('✅ Task completed successfully');

        const stats = await this.queueRepo.getQueueStats();
        console.log(
          `\n📊 Queue: ${stats.pending} pending, ${stats.processing} processing, ${stats.completed} completed`,
        );

        await this.sleep(2_000);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Task failed:', message);

        if (task) {
          await this.queueRepo.failTask(task.id, message);
        }

        const delay = message === 'RATE_LIMIT_EXCEEDED' ? 60_000 : 10_000;
        await this.sleep(delay);
      }
    }

    console.log('\n🛑 Worker stopped');
  }

  stop(): void {
    console.log('\n⏸️  Stopping worker...');
    this.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

if (require.main === module) {
  const processor = new QueueProcessor();

  const shutdown = () => processor.stop();
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  processor.start().catch((error) => {
    console.error('💥 Worker crashed:', error);
    process.exit(1);
  });
}
