import { GooglePlacesService } from '../services/google-places.service';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { QueueRepository } from '../repositories/queue.repository';

const MIDTOWN_CENTER = {
  latitude: 40.758,
  longitude: -73.9855,
};

const SEARCH_RADIUS_METERS = 2_500;
const TARGET_RESTAURANT_COUNT = 100;

export async function seedMidtownRestaurants(): Promise<void> {
  console.log('🗽 Starting Midtown NYC Restaurant Seeding');
  console.log('=====================================');
  console.log(`📍 Center: ${MIDTOWN_CENTER.latitude}, ${MIDTOWN_CENTER.longitude}`);
  console.log(`📏 Radius: ${SEARCH_RADIUS_METERS}m (~1.5 miles)`);
  console.log(`🎯 Target: ${TARGET_RESTAURANT_COUNT} restaurants\n`);

  const placesService = new GooglePlacesService();
  const restaurantRepo = new RestaurantRepository();
  const queueRepo = new QueueRepository();

  let newRestaurants = 0;
  let updatedRestaurants = 0;
  let tasksCreated = 0;

  try {
    console.log('🔍 Searching for restaurants...');
    const places = await placesService.searchRestaurants(
      MIDTOWN_CENTER.latitude,
      MIDTOWN_CENTER.longitude,
      SEARCH_RADIUS_METERS,
    );

    if (places.length === 0) {
      console.log('❌ No restaurants found. Check API key and coordinates.');
      return;
    }

    const selectedPlaces = places.slice(0, TARGET_RESTAURANT_COUNT);
    console.log(`✅ Found ${selectedPlaces.length} restaurants\n`);

    console.log('💾 Importing restaurants...');

    for (const [index, place] of selectedPlaces.entries()) {

      try {
        const existing = await restaurantRepo.findByGooglePlaceId(place.place_id);

        const photoUrls =
          place.photos?.slice(0, 5).map((photo) => placesService.getPhotoUrl(photo.photo_reference, 800)) ?? [];
        const cuisineTags = placesService.mapCuisineTags(place.types);

        const restaurantId = await restaurantRepo.upsertRestaurant({
          googlePlaceId: place.place_id,
          name: place.name,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          address: place.formatted_address ?? place.vicinity ?? null,
          priceLevel: typeof place.price_level === 'number' ? place.price_level : null,
          googleRating: typeof place.rating === 'number' ? place.rating : null,
          googleReviewCount:
            typeof place.user_ratings_total === 'number' ? place.user_ratings_total : null,
          cuisineTags,
          photoUrls,
        });

        if (existing) {
          updatedRestaurants += 1;
          console.log(`🔄 Updated: ${place.name}`);
        } else {
          newRestaurants += 1;
          console.log(`✨ New: ${place.name}`);
        }

        if (place.user_ratings_total && place.user_ratings_total > 0) {
          const taskExists = await queueRepo.taskExists(restaurantId, 'scrape_reviews', [
            'pending',
            'processing',
          ]);

          if (!taskExists) {
            await queueRepo.addTask(restaurantId, 'scrape_reviews', 100);
            tasksCreated += 1;
          }
        }

        await placesService.rateLimitDelay(500);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to import ${place.name}:`, message);
      }

      if ((index + 1) % 10 === 0) {
        console.log(`📊 Progress: ${index + 1}/${selectedPlaces.length} restaurants processed`);
      }
    }

    console.log('\n✅ Seeding Complete!');
    console.log('===================');
    console.log(`✨ New restaurants: ${newRestaurants}`);
    console.log(`🔄 Updated restaurants: ${updatedRestaurants}`);
    console.log(`📋 Tasks created: ${tasksCreated}`);

    const queueStats = await queueRepo.getQueueStats();
    console.log('\n📈 Queue Statistics:');
    console.log(`   Pending: ${queueStats.pending}`);
    console.log(`   Processing: ${queueStats.processing}`);
    console.log(`   Completed: ${queueStats.completed}`);
    console.log(`   Failed: ${queueStats.failed}`);

    console.log('\n🎉 Ready to start the review scraper worker!');
    console.log('   Run: npm run worker');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Seeding failed:', message);
    throw error instanceof Error ? error : new Error(message);
  }
}

if (require.main === module) {
  seedMidtownRestaurants()
    .then(() => {
      console.log('\n👋 Seeding script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}
