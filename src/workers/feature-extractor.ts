import type pino from 'pino';
import { closePool } from '../config/database';
import { env } from '../config/env';
import { FeatureExtractionRepository } from '../repositories/feature-extraction.repository';
import { QueueRepository, type QueueTask } from '../repositories/queue.repository';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { ReviewRepository } from '../repositories/review.repository';
import { FeatureExtractionService } from '../services/feature-extraction.service';
import { logger } from '../utils/logger';

export class FeatureExtractorWorker {
  private readonly reviewRepo = new ReviewRepository();
  private readonly featureRepo = new FeatureExtractionRepository();
  private readonly restaurantRepo = new RestaurantRepository();
  private readonly queueRepo = new QueueRepository();
  private readonly extractionService = new FeatureExtractionService();
  private readonly batchSize: number;

  constructor() {
    this.batchSize = Math.min(100, env.FEATURE_EXTRACTOR_BATCH_SIZE);
  }

  async execute(restaurantId: string): Promise<void> {
    const log = logger.child({ restaurantId, worker: 'feature-extractor' });

    log.info('Starting feature extraction');

    const restaurant = await this.restaurantRepo.findById(restaurantId);
    if (!restaurant) {
      throw new Error(`Restaurant not found for feature extraction: ${restaurantId}`);
    }

    const reviews = await this.reviewRepo.findUnprocessedByRestaurant(restaurantId, this.batchSize);
    if (reviews.length === 0) {
      log.info('No unprocessed reviews found');
      return;
    }

    log.info({ reviewCount: reviews.length, restaurantName: restaurant.restaurant.name }, 'Processing reviews');

    const extractionInputs = reviews.map((review) => ({
      id: review.id,
      text: review.text,
      rating: review.rating,
    }));

    const settled = await this.extractionService.extractBatch(extractionInputs);

    const successfulReviewIds: string[] = [];
    let totalTokens = 0;
    let totalCost = 0;

    for (const item of settled) {
      if (item.result) {
        try {
          await this.featureRepo.upsertExtraction({
            reviewId: item.result.reviewId,
            restaurantId,
            features: item.result.features,
            extractionConfidence: item.result.confidence,
            modelUsed: item.result.modelUsed,
            promptVersion: item.result.promptVersion,
            extractedAt: new Date(),
            tokensUsed: item.result.tokensUsed.total,
            costUsd: item.result.costUsd,
          });

          successfulReviewIds.push(item.result.reviewId);
          totalTokens += item.result.tokensUsed.total;
          totalCost += item.result.costUsd;

          log.debug({ reviewId: item.result.reviewId }, 'Extracted features for review');
        } catch (error) {
          log.error(
            {
              reviewId: item.review.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to persist extraction',
          );
        }
      } else if (item.error) {
        log.warn(
          {
            reviewId: item.review.id,
            error: item.error.message,
          },
          'Feature extraction failed for review',
        );
      }
    }

    if (successfulReviewIds.length > 0) {
      await this.reviewRepo.markProcessed(successfulReviewIds);
      log.info(
        {
          extractionCount: successfulReviewIds.length,
          tokensUsed: totalTokens,
          costUsd: totalCost,
        },
        'Saved feature extractions',
      );

      const hasAggregationTask = await this.queueRepo.taskExists(restaurantId, 'aggregate_features', [
        'pending',
        'processing',
      ]);

      if (!hasAggregationTask) {
        await this.queueRepo.addTask(restaurantId, 'aggregate_features', 40);
        log.info('Queued aggregation task');
      }
    }

    const remaining = await this.reviewRepo.countUnprocessed(restaurantId);
    if (remaining > 0) {
      const hasPending = await this.queueRepo.taskExists(restaurantId, 'extract_features', [
        'pending',
        'processing',
      ]);

      if (!hasPending) {
        await this.queueRepo.addTask(restaurantId, 'extract_features', 40);
        log.info({ remainingReviews: remaining }, 'Re-queued extraction task');
      }
    }
  }
}

export class FeatureExtractionQueueProcessor {
  private readonly worker = new FeatureExtractorWorker();
  private readonly queueRepo = new QueueRepository();
  private isRunning = false;
  private lastRecoveryCheck = 0;
  private readonly recoveryCheckInterval = 5 * 60 * 1000; // 5 minutes

  async start(): Promise<void> {
    this.isRunning = true;
    const log = logger.child({ worker: 'feature-extraction-processor' });
    log.info('Feature Extraction Worker Started');

    while (this.isRunning) {
      let task: QueueTask | null = null;
      try {
        // Periodically reset stuck tasks
        await this.checkAndResetStuckTasks(log);

        task = await this.queueRepo.claimNextTask(['extract_features']);

        if (!task) {
          await this.sleep(5_000);
          continue;
        }

        const taskLog = log.child({
          taskId: task.id,
          restaurantId: task.restaurantId,
          attempt: task.attempts + 1,
          maxAttempts: task.maxAttempts,
        });

        // Check if task was recovered from stuck state
        if ((task as any)._wasStuck) {
          taskLog.warn('Recovered stuck task');
        }

        taskLog.info('Processing extraction task');

        await this.worker.execute(task.restaurantId);
        await this.queueRepo.completeTask(task.id);
        taskLog.info('Extraction task completed');

        const stats = await this.queueRepo.getQueueStats();
        log.debug(
          {
            pending: stats.pending,
            processing: stats.processing,
            completed: stats.completed,
          },
          'Queue stats',
        );

        await this.sleep(2_000);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const errorLog = task
          ? log.child({ taskId: task.id, restaurantId: task.restaurantId })
          : log;
        errorLog.error({ error: message, stack: error instanceof Error ? error.stack : undefined }, 'Extraction task failed');

        if (task) {
          await this.queueRepo.failTask(task.id, message);
        }

        await this.sleep(10_000);
      }
    }

    log.info('Feature extraction worker stopped');
  }

  private async checkAndResetStuckTasks(log: pino.Logger): Promise<void> {
    const now = Date.now();
    if (now - this.lastRecoveryCheck < this.recoveryCheckInterval) {
      return;
    }

    this.lastRecoveryCheck = now;

    try {
      const resetCount = await this.queueRepo.resetStuckTasks();
      if (resetCount > 0) {
        log.warn({ resetCount }, 'Reset stuck tasks');
      }
    } catch (error) {
      log.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to reset stuck tasks',
      );
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

if (require.main === module) {
  const processor = new FeatureExtractionQueueProcessor();
  let shuttingDown = false;

  const shutdown = async (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    processor.stop();
    try {
      await closePool();
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to close database pool',
      );
    } finally {
      process.exit(code);
    }
  };

  process.on('SIGTERM', () => shutdown(0));
  process.on('SIGINT', () => shutdown(0));

  processor.start().catch(async (error) => {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Feature extraction worker crashed',
    );
    await shutdown(1);
  });
}
