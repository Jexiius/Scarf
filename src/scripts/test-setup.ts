import { GooglePlacesService } from '../services/google-places.service';
import { db } from '../config/database';
import { sql } from 'drizzle-orm';

const TESTS = {
  API_KEY: '1. Google Places API Key',
  DB_CONNECTION: '2. Database Connection',
  DB_TABLES: '3. Required Tables',
  TEST_SEARCH: '4. Test API Search',
} as const;

type TestName = (typeof TESTS)[keyof typeof TESTS];

export async function runTests(): Promise<boolean> {
  console.log('🧪 Running Pre-Flight Checks');
  console.log('===========================\n');

  const results: Record<TestName, boolean> = {
    [TESTS.API_KEY]: false,
    [TESTS.DB_CONNECTION]: false,
    [TESTS.DB_TABLES]: false,
    [TESTS.TEST_SEARCH]: false,
  };

  console.log(`${TESTS.API_KEY}...`);
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _service = new GooglePlacesService();
    results[TESTS.API_KEY] = true;
    console.log('   ✅ API key configured\n');
  } catch (error) {
    console.log('   ❌ API key missing or invalid');
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   Error: ${message}\n`);
  }

  console.log(`${TESTS.DB_CONNECTION}...`);
  try {
    await db.execute(sql`SELECT 1`);
    results[TESTS.DB_CONNECTION] = true;
    console.log('   ✅ Database connected\n');
  } catch (error) {
    console.log('   ❌ Database connection failed');
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   Error: ${message}\n`);
  }

  console.log(`${TESTS.DB_TABLES}...`);
  try {
    const requiredTables = ['restaurants', 'reviews', 'processing_queue'];
    let allPresent = true;

    for (const table of requiredTables) {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = ${table}
        );
      `);

      const exists = Boolean(result.rows[0]?.exists);
      if (exists) {
        console.log(`   ✅ Table '${table}' exists`);
      } else {
        console.log(`   ❌ Table '${table}' missing`);
      }
      allPresent &&= exists;
    }

    results[TESTS.DB_TABLES] = allPresent;
    console.log();
  } catch (error) {
    console.log('   ❌ Could not check tables');
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   Error: ${message}\n`);
  }

  console.log(`${TESTS.TEST_SEARCH}...`);
  try {
    const placesService = new GooglePlacesService();

    const places = await placesService.searchRestaurants(40.758, -73.9855, 500, 'restaurant');

    if (places.length > 0) {
      results[TESTS.TEST_SEARCH] = true;
      console.log('   ✅ API search successful');
      console.log(`   Found ${places.length} restaurants`);
      console.log(`   Example: ${places[0]?.name ?? 'N/A'}\n`);
    } else {
      console.log('   ⚠️  Search returned no results');
      console.log('   This might be okay, but verify coordinates\n');
    }
  } catch (error) {
    console.log('   ❌ API search failed');
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   Error: ${message}\n`);
  }

  console.log('📊 Test Summary');
  console.log('==============');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, success]) => {
    console.log(`${success ? '✅' : '❌'} ${test}`);
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
      console.log('- Run database migrations to create required tables');
      console.log('- Refer to DATABASE_DOCUMENTATION.txt for schema details');
    }
    if (!results[TESTS.TEST_SEARCH]) {
      console.log('- Verify Places API is enabled and billing is configured');
      console.log('- Retry with a different keyword or smaller radius');
    }
  }

  return passed === total;
}

if (require.main === module) {
  runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('\n💥 Test runner crashed:', message);
      process.exit(1);
    });
}
