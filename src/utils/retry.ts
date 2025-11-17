import { logger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: unknown) => boolean;
}

const DEFAULT_RETRYABLE = (error: unknown): boolean => {
  // Retry on network errors, timeouts, and 5xx errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout')
    ) {
      return true;
    }
  }

  // Check for HTTP errors (if error has status property)
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: number }).status;
    return status >= 500 && status < 600;
  }

  return false;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  context?: Record<string, unknown>,
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    retryableErrors = DEFAULT_RETRYABLE,
  } = options;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable
      if (!retryableErrors(error)) {
        if (context) {
          logger.debug({ ...context, attempt, error: error instanceof Error ? error.message : String(error) }, 'Error not retryable');
        }
        throw error;
      }

      // Don't retry on last attempt
      if (attempt >= maxAttempts) {
        if (context) {
          logger.warn(
            {
              ...context,
              attempt,
              maxAttempts,
              error: error instanceof Error ? error.message : String(error),
            },
            'Max retry attempts reached',
          );
        }
        throw error;
      }

      // Log retry attempt
      if (context) {
        logger.warn(
          {
            ...context,
            attempt,
            maxAttempts,
            delayMs: delay,
            error: error instanceof Error ? error.message : String(error),
          },
          'Retrying after error',
        );
      }

      // Wait before retry
      await sleep(delay);

      // Exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

