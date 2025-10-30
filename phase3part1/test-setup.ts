import { GooglePlacesService } from '../services/google-places.service';
import { db } from '../config/database';
import { restaurants } from '../db/schema';
import { sql } from 'drizzle-orm';

/**
 * Pre-flight checks before running the seeding/scraping pipeline
 * 
 * This script verifies:
 * 1. Google Places API key is valid
 * 2. Database connection works
 * 3. Required tables exist
 * 4. Can perform a test search
 */

const TESTS = {
  API_KEY: '1. Google Places API Key',
  DB_CONNECTION: '2. Database Connection',
  DB_TABLES: '3. Required Tables',
  TEST_SEARCH: '4. Test API Search',
};

async function runTests() {
  console.log('🧪 Running Pre-Flight Checks');
  console.log('===========================\n');

  const results: Record<string, boolean> = {};

  // Test 1: API Key
  console.log(`${TESTS.API_KEY}...`);
  try {
    const placesService = new GooglePlacesService();
    results[TESTS.API_KEY] = true;
    console.log('   ✅ API key configured\n');
  } catch (error) {
    results[TESTS.API_KEY] = false;
    console.log('   ❌ API key missing or invalid');
    console.log(`   Error: ${error}\n`);
  }

  // Test 2: Database Connection
  console.log(`${TESTS.DB_CONNECTION}...`);
  try {
    await db.execute(sql`SELECT 1 as test`);
    results[TESTS.DB_CONNECTION] = true;
    console.log('   ✅ Database connected\n');
  } catch (error) {
    results[TESTS.DB_CONNECTION] = false;
    console.log('   ❌ Database connection failed');
    console.log(`   Error: ${error}\n`);
  }

  // Test 3: Required Tables
  console.log(`${TESTS.DB_TABLES}...`);
  try {
    const requiredTables = ['restaurants', 'reviews', 'processing_queue'];
    const tableChecks: Record<string, boolean> = {};

    for (const table of requiredTables) {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
        );
      `);
      
      const exists = result.rows[0]?.exists || false;
      tableChecks[table] = exists;
      
      if (exists) {
        console.log(`   ✅ Table '${table}' exists`);
      } else {
        console.log(`   ❌ Table '${table}' missing`);
      }
    }

    results[TESTS.DB_TABLES] = Object.values(tableChecks).every(v => v);
    console.log();
  } catch (error) {
    results[TESTS.DB_TABLES] = false;
    console.log('   ❌ Could not check tables');
    console.log(`   Error: ${error}\n`);
  }

  // Test 4: Test API Search
  console.log(`${TESTS.TEST_SEARCH}...`);
  try {
    const placesService = new GooglePlacesService();
    
    // Search for a single restaurant in Times Square
    const places = await placesService.searchRestaurants(
      40.7580, // Times Square
      -73.9855,
      500, // 500m radius (small test)
      'restaurant'
    );

    if (places.length > 0) {
      results[TESTS.TEST_SEARCH] = true;
      console.log(`   ✅ API search successful`);
      console.log(`   Found ${places.length} restaurants`);
      console.log(`   Example: ${places[0].name}\n`);
    } else {
      results[TESTS.TEST_SEARCH] = false;
      console.log('   ⚠️  Search returned no results');
      console.log('   This might be okay, but verify coordinates\n');
    }
  } catch (error) {
    results[TESTS.TEST_SEARCH] = false;
    console.log('   ❌ API search failed');
    console.log(`   Error: ${error}\n`);
  }

  // Summary
  console.log('📊 Test Summary');
  console.log('==============');
  
  const passed = Object.values(results).filter(v => v).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });

  console.log(`\n${passed}/${total} tests passed\n`);

  if (passed === total) {
    console.log('🎉 All systems go! Ready to run:');
    console.log('   npm run seed:midtown');
    console.log('   npm run worker');
  } else {
    console.log('⚠️  Some tests failed. Please fix issues before proceeding.');
    console.log('\nTroubleshooting:');
    
    if (!results[TESTS.API_KEY]) {
      console.log('- Check GOOGLE_PLACES_API_KEY in .env.local');
    }
    if (!results[TESTS.DB_CONNECTION]) {
      console.log('- Check DATABASE_URL in .env.local');
      console.log('- Ensure PostgreSQL is running');
    }
    if (!results[TESTS.DB_TABLES]) {
      console.log('- Run database migrations');
      console.log('- Check DATABASE_DOCUMENTATION.txt for schema');
    }
    if (!results[TESTS.TEST_SEARCH]) {
      console.log('- Verify API key has Places API enabled');
      console.log('- Check billing is enabled in Google Cloud');
    }
  }

  return passed === total;
}

// Run tests
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Test runner crashed:', error);
      process.exit(1);
    });
}

export { runTests };
