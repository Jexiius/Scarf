import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '../db/schema';
import { env } from './env';
import { logger } from '../utils/logger';

interface SslConfig {
  rejectUnauthorized: boolean;
  ca?: string | Buffer;
}

/**
 * Resolves SSL configuration for database connections.
 * 
 * Security: In production, SSL certificate validation is enabled by default
 * unless explicitly disabled. This prevents man-in-the-middle attacks.
 * 
 * Environment variables:
 * - DATABASE_SSL=require: Enable SSL with certificate validation (default in production)
 * - DATABASE_SSL=disable: Disable SSL (development only)
 * - DATABASE_CA_PATH: Path to CA certificate file (optional)
 * - DATABASE_CA: Inline CA certificate content (optional)
 */
function resolveSslConfig(): boolean | SslConfig | undefined {
  // Explicitly disable SSL
  if (env.DATABASE_SSL === 'disable') {
    if (env.isProduction) {
      logger.warn('SSL is disabled in production. This is not recommended for security.');
    }
    return undefined;
  }

  // Default behavior: require SSL in production, optional in development
  const shouldUseSsl = env.DATABASE_SSL === 'require' || env.isProduction;

  if (!shouldUseSsl) {
    return undefined;
  }

  // Build SSL config with certificate validation enabled by default
  const sslConfig: SslConfig = {
    rejectUnauthorized: true, // CRITICAL: Validate certificates in production
  };

  // Load CA certificate if provided
  if (process.env.DATABASE_CA_PATH) {
    try {
      const caPath = path.resolve(process.env.DATABASE_CA_PATH);
      sslConfig.ca = fs.readFileSync(caPath);
      logger.info({ caPath }, 'Loaded database CA certificate from file');
    } catch (error) {
      logger.error(
        {
          caPath: process.env.DATABASE_CA_PATH,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to load database CA certificate file',
      );
      throw new Error(`Failed to load database CA certificate: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (process.env.DATABASE_CA) {
    // Inline CA certificate (useful for containerized deployments)
    sslConfig.ca = process.env.DATABASE_CA;
    logger.debug('Using inline database CA certificate');
  }

  // Allow disabling certificate validation only in development (for self-signed certs)
  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
    if (env.isProduction) {
      logger.error('DATABASE_SSL_REJECT_UNAUTHORIZED=false is not allowed in production');
      throw new Error('Certificate validation cannot be disabled in production');
    }
    logger.warn('SSL certificate validation is disabled. This should only be used in development.');
    sslConfig.rejectUnauthorized = false;
  }

  return sslConfig;
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
  ssl: resolveSslConfig(),
});

pool.on('error', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Database pool error');
});

export const db = drizzle(pool, { schema });

export async function testConnection(): Promise<void> {
  try {
    const result = await pool.query<{ now: string }>('SELECT NOW()');
    const now = result.rows[0]?.now;
    if (!now) {
      throw new Error('Database connection succeeded but returned no timestamp');
    }
    logger.info({ timestamp: now }, 'Database connection test successful');
    
    // Also verify SSL if enabled
    const sslResult = await pool.query('SHOW ssl');
    const sslValue = sslResult.rows[0]?.ssl;
    const sslEnabled = typeof sslValue === 'string' && sslValue === 'on';
    if (sslEnabled) {
      logger.info('Database SSL is enabled');
    } else {
      logger.warn('Database SSL is not enabled');
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Database connection test failed',
    );
    throw error;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
