import { closePool, testConnection } from '../config/database';
import { getRateLimitStore } from '../repositories/rate-limit.repository';
import { logger } from '../utils/logger';

/**
 * Cleanup script for expired rate limit entries.
 * Run this periodically (e.g., every 5 minutes) to prevent table bloat.
 *
 * Usage:
 *   npm run cleanup:rate-limits
 *   or
 *   tsx src/scripts/cleanup-rate-limits.ts
 */
async function cleanupRateLimits() {
  try {
    logger.info('Starting rate limit cleanup...');

    // Test database connection
    await testConnection();

    const store = getRateLimitStore();
    const deletedCount = await store.cleanupExpired();

    logger.info(
      {
        deletedCount,
      },
      'Rate limit cleanup completed',
    );

    process.exit(0);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Rate limit cleanup failed',
    );
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  cleanupRateLimits();
}

