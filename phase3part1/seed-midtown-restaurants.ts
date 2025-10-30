import { GooglePlacesService } from '../services/google-places.service';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { QueueRepository } from '../repositories/queue.repository';

/**
 * Seed Midtown NYC restaurants into the database
 * 
 * This script:
 * 1. Searches for restaurants in Midtown Manhattan
 * 2. Saves basic info to restaurants table
 * 3. Creates scrape_reviews tasks in processing queue
 */

// Midtown NYC coordinates
const MIDTOWN_CENTER = {
  latitude: 40.7580,  // Times Square
  longitude: -73.9855,
};

const SEARCH_RADIUS_METERS = 2500; // ~1.5 miles
const TARGET_RESTAURANT_COUNT = 100;

async function seedMidtownRestaurants() {
  console.log('🗽 Starting Midtown NYC Restaurant Seeding');
  console.log('=====================================');
  console.log(`📍 Center: ${MIDTOWN_CENTER.latitude}, ${MIDTOWN_CENTER.longitude}`);
  console.log(`📏 Radius: ${SEARCH_RADIUS_METERS}m (~1.5 miles)`);
  console.log(`🎯 Target: ${TARGET_RESTAURANT_COUNT} restaurants\n`);

  const placesService = new GooglePlacesService();
  const restaurantRepo = new RestaurantRepository();
  const queueRepo = new QueueRepository();

  let allPlaces: any[] = [];
  let newRestaurants = 0;
  let updatedRestaurants = 0;
  let tasksCreated = 0;

  try {
    // Search for restaurants
    console.log('🔍 Searching for restaurants...');
    const places = await placesService.searchRestaurants(
      MIDTOWN_CENTER.latitude,
      MIDTOWN_CENTER.longitude,
      SEARCH_RADIUS_METERS
    );

    if (places.length === 0) {
      console.log('❌ No restaurants found. Check API key and coordinates.');
      return;
    }

    allPlaces = places.slice(0, TARGET_RESTAURANT_COUNT);
    console.log(`✅ Found ${allPlaces.length} restaurants\n`);

    // Process each restaurant
    console.log('💾 Importing restaurants...');
    
    for (let i = 0; i < allPlaces.length; i++) {
      const place = allPlaces[i];
      
      try {
        // Check if already exists
        const existing = await restaurantRepo.findByGooglePlaceId(place.place_id);
        
        // Extract photo URLs
        const photoUrls = place.photos?.slice(0, 5).map((photo: any) => 
          placesService.getPhotoUrl(photo.photo_reference, 800)
        ) || [];

        // Extract cuisine tags
        const cuisineTags = placesService.mapCuisineTags(place.types);

        // Upsert restaurant
        const restaurantId = await restaurantRepo.upsertRestaurant({
          googlePlaceId: place.place_id,
          name: place.name,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          address: place.formatted_address || place.vicinity,
          priceLevel: place.price_level,
          googleRating: place.rating,
          googleReviewCount: place.user_ratings_total,
          cuisineTags,
          photoUrls,
        });

        if (existing) {
          updatedRestaurants++;
          console.log(`🔄 Updated: ${place.name}`);
        } else {
          newRestaurants++;
          console.log(`✨ New: ${place.name}`);
        }

        // Create scrape task if restaurant has reviews
        if (place.user_ratings_total && place.user_ratings_total > 0) {
          const taskExists = await queueRepo.taskExists(
            restaurantId,
            'scrape_reviews',
            ['pending', 'processing']
          );

          if (!taskExists) {
            await queueRepo.addTask(
              restaurantId,
              'scrape_reviews',
              100 // High priority for initial scrape
            );
            tasksCreated++;
          }
        }

        // Rate limiting: wait 0.5s between requests to be safe
        await placesService.rateLimitDelay(500);

      } catch (error) {
        console.error(`❌ Failed to import ${place.name}:`, error);
        continue;
      }

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`📊 Progress: ${i + 1}/${allPlaces.length} restaurants processed`);
      }
    }

    // Summary
    console.log('\n✅ Seeding Complete!');
    console.log('===================');
    console.log(`✨ New restaurants: ${newRestaurants}`);
    console.log(`🔄 Updated restaurants: ${updatedRestaurants}`);
    console.log(`📋 Tasks created: ${tasksCreated}`);
    console.log(`📊 Total in queue: ${tasksCreated}`);

    // Show queue stats
    const queueStats = await queueRepo.getQueueStats();
    console.log('\n📈 Queue Statistics:');
    console.log(`   Pending: ${queueStats.pending}`);
    console.log(`   Processing: ${queueStats.processing}`);
    console.log(`   Completed: ${queueStats.completed}`);
    console.log(`   Failed: ${queueStats.failed}`);

    console.log('\n🎉 Ready to start the review scraper worker!');
    console.log('   Run: npm run worker');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run if called directly
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

export { seedMidtownRestaurants };
