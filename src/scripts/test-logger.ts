#!/usr/bin/env tsx
/**
 * Test script to verify logger configuration
 * 
 * Usage:
 *   Development: NODE_ENV=development tsx src/scripts/test-logger.ts
 *   Production:  NODE_ENV=production tsx src/scripts/test-logger.ts
 */

import { logger } from '../utils/logger';
import { env } from '../config/env';

console.log('\n=== Logger Configuration Test ===\n');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`env.isDevelopment: ${env.isDevelopment}`);
console.log(`env.isProduction: ${env.isProduction}`);
console.log(`LOG_LEVEL: ${env.LOG_LEVEL}\n`);

// Test different log levels
logger.trace('This is a TRACE message');
logger.debug('This is a DEBUG message');
logger.info('This is an INFO message');
logger.warn('This is a WARN message');
logger.error('This is an ERROR message');

// Test structured logging
logger.info({ userId: '123', action: 'test' }, 'Structured log message');

// Test error logging
try {
  throw new Error('Test error');
} catch (error) {
  logger.error({ err: error }, 'Caught test error');
}

console.log('\n=== Test Complete ===\n');
console.log('Expected behavior:');
console.log('- Development: Pretty formatted, colored output');
console.log('- Production: JSON formatted output (one line per log)');
console.log('- No crashes or "pino-pretty" errors\n');

