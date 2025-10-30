import { GooglePlacesService } from '../services/google-places.service';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { QueueRepository } from '../repositories/queue.repository';
import type { QueueTask } from '../repositories/queue.repository';

/**
 * Review Scraper Worker
 * 
 * Processes tasks from the queue and scrapes reviews from Google Places
 */

export class ReviewScraperWorker {
  private placesService: GooglePlacesService;
  private restaurantRepo: RestaurantRepository;
  private queueRepo: QueueRepository;

  constructor() {
    this.placesService = new GooglePlacesService();
    this.restaurantRepo = new RestaurantRepository();
    this.queueRepo = new QueueRepository();
  }

  /**
   * Execute scraping for a specific restaurant
   */
  async execute(restaurantId: string): Promise<void> {
    console.log(`\n🔍 Scraping reviews for restaurant: ${restaurantId}`);

    try {
      // Get restaurant details
      const restaurant = await this.restaurantRepo.findById(restaurantId);
      
      if (!restaurant) {
        throw new Error(`Restaurant not found: ${restaurantId}`);
      }

      if (!restaurant.googlePlaceId) {
        throw new Error(`Restaurant has no Google Place ID: ${restaurantId}`);
      }

      console.log(`📍 Restaurant: ${restaurant.name}`);

      // Fetch detailed place info including reviews
      const placeDetails = await this.placesService.getPlaceDetails(restaurant.googlePlaceId);

      if (!placeDetails) {
        throw new Error(`Could not fetch place details for: ${restaurant.googlePlaceId}`);
      }

      // Update restaurant metadata if needed
      const addressComponents = this.placesService.extractAddressComponents(
        placeDetails.address_components
      );
      
      const cuisineTags = this.placesService.mapCuisineTags(placeDetails.types);
      const hours = this.placesService.formatOpeningHours(placeDetails.opening_hours);
      
      const photoUrls = placeDetails.photos?.slice(0, 5).map(photo => 
        this.placesService.getPhotoUrl(photo.photo_reference, 800)
      ) || [];

      await this.restaurantRepo.upsertRestaurant({
        googlePlaceId: restaurant.googlePlaceId,
        name: placeDetails.name,
        latitude: placeDetails.geometry.location.lat,
        longitude: placeDetails.geometry.location.lng,
        address: placeDetails.formatted_address,
        city: addressComponents.city,
        state: addressComponents.state,
        zipCode: addressComponents.zipCode,
        priceLevel: placeDetails.price_level,
        googleRating: placeDetails.rating,
        googleReviewCount: placeDetails.user_ratings_total,
        cuisineTags,
        phone: placeDetails.formatted_phone_number,
        website: placeDetails.website,
        photoUrls,
        hours: hours || undefined,
      });

      console.log(`✅ Updated restaurant metadata`);

      // Process reviews
      if (!placeDetails.reviews || placeDetails.reviews.length === 0) {
        console.log('⚠️  No reviews available from API');
        return;
      }

      console.log(`📝 Found ${placeDetails.reviews.length} reviews`);

      // Create review records
      const reviewInputs = placeDetails.reviews.map(review => ({
        restaurantId: restaurant.id,
        authorName: review.author_name,
        text: review.text,
        rating: review.rating,
        source: 'google' as const,
        sourceReviewId: `${restaurant.googlePlaceId}_${review.time}`, // Unique ID
        publishedAt: new Date(review.time * 1000), // Convert Unix timestamp
      }));

      const created = await this.restaurantRepo.createReviews(reviewInputs);
      console.log(`✅ Saved ${created} new reviews (${placeDetails.reviews.length - created} duplicates skipped)`);

      // Get total review count
      const totalReviews = await this.restaurantRepo.getReviewCount(restaurant.id);
      console.log(`📊 Total reviews in DB: ${totalReviews}`);

      // Queue feature extraction tasks if we have new reviews
      if (created > 0) {
        const unprocessed = await this.restaurantRepo.getUnprocessedReviewCount(restaurant.id);
        
        if (unprocessed > 0) {
          // Add extraction task
          const taskExists = await this.queueRepo.taskExists(
            restaurant.id,
            'extract_features',
            ['pending', 'processing']
          );

          if (!taskExists) {
            await this.queueRepo.addTask(restaurant.id, 'extract_features', 50);
            console.log(`📋 Queued feature extraction task (${unprocessed} reviews to process)`);
          }
        }
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'RATE_LIMIT_EXCEEDED') {
          console.error('⚠️  Rate limit exceeded. Retrying later...');
          throw error;
        }
      }
      throw error;
    }
  }
}

/**
 * Main worker loop - continuously processes queue
 */
export class QueueProcessor {
  private worker: ReviewScraperWorker;
  private queueRepo: QueueRepository;
  private isRunning = false;

  constructor() {
    this.worker = new ReviewScraperWorker();
    this.queueRepo = new QueueRepository();
  }

  /**
   * Start processing queue
   */
  async start(): Promise<void> {
    this.isRunning = true;
    console.log('🚀 Review Scraper Worker Started');
    console.log('================================');
    console.log('Watching for scrape_reviews tasks...\n');

    while (this.isRunning) {
      try {
        // Claim next task
        const task = await this.queueRepo.claimNextTask();

        if (!task) {
          // No tasks available, wait and check again
          await this.sleep(5000); // Check every 5 seconds
          continue;
        }

        // Only process scrape_reviews tasks
        if (task.taskType !== 'scrape_reviews') {
          console.log(`⏭️  Skipping task type: ${task.taskType}`);
          await this.queueRepo.completeTask(task.id);
          continue;
        }

        console.log(`\n⚡ Processing task: ${task.id}`);
        console.log(`   Restaurant: ${task.restaurantId}`);
        console.log(`   Attempt: ${task.attempts + 1}/${task.maxAttempts}`);

        // Execute scraping
        await this.worker.execute(task.restaurantId);

        // Mark as completed
        await this.queueRepo.completeTask(task.id);
        console.log(`✅ Task completed successfully`);

        // Show queue stats
        const stats = await this.queueRepo.getQueueStats();
        console.log(`\n📊 Queue: ${stats.pending} pending, ${stats.processing} processing, ${stats.completed} completed`);

        // Rate limiting between tasks
        await this.sleep(2000); // 2 second delay between restaurants

      } catch (error) {
        console.error('\n❌ Task failed:', error);
        
        // Try to fail the task if we have a reference
        // (In a real implementation, we'd track the current task better)
        
        // Wait longer on error
        await this.sleep(10000);
      }
    }

    console.log('\n🛑 Worker stopped');
  }

  /**
   * Stop worker
   */
  stop(): void {
    console.log('\n⏸️  Stopping worker...');
    this.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run worker if called directly
if (require.main === module) {
  const processor = new QueueProcessor();

  // Handle graceful shutdown
  process.on('SIGTERM', () => processor.stop());
  process.on('SIGINT', () => processor.stop());

  processor.start().catch(error => {
    console.error('💥 Worker crashed:', error);
    process.exit(1);
  });
}
