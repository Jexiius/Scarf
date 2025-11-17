import { closePool } from '../config/database';
import { FeatureExtractionRepository } from '../repositories/feature-extraction.repository';
import { QueueRepository, type QueueTask } from '../repositories/queue.repository';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { FeatureAggregationService } from '../services/feature-aggregation.service';
import { logger } from '../utils/logger';

export class FeatureAggregatorWorker {
  private readonly featureRepo = new FeatureExtractionRepository();
  private readonly restaurantRepo = new RestaurantRepository();
  private readonly aggregationService = new FeatureAggregationService();

  async execute(restaurantId: string): Promise<void> {
    const log = logger.child({ restaurantId, worker: 'feature-aggregator' });
    log.info('Starting feature aggregation');

    const extractions = await this.featureRepo.getByRestaurant(restaurantId);
    if (extractions.length === 0) {
      log.warn('No feature extractions available for aggregation');
      return;
    }

    const aggregation = this.aggregationService.aggregate(extractions);

    await this.restaurantRepo.upsertFeatures(restaurantId, aggregation.values, {
      reviewCountAnalyzed: aggregation.reviewCountAnalyzed,
      confidenceScore: aggregation.confidenceScore,
      modelVersion: aggregation.modelVersion,
    });

    const cost = await this.featureRepo.getCostSummary(restaurantId);

    log.info(
      {
        extractionCount: aggregation.reviewCountAnalyzed,
        confidenceScore: aggregation.confidenceScore,
        costUsd: cost.costUsd,
      },
      'Aggregated features',
    );
  }
}

export class FeatureAggregationQueueProcessor {
  private readonly worker = new FeatureAggregatorWorker();
  private readonly queueRepo = new QueueRepository();
  private isRunning = false;
  private lastRecoveryCheck = 0;
  private readonly recoveryCheckInterval = 5 * 60 * 1000; // 5 minutes

  async start(): Promise<void> {
    this.isRunning = true;
    const log = logger.child({ worker: 'feature-aggregation-processor' });
    log.info('Feature Aggregation Worker Started');

    while (this.isRunning) {
      let task: QueueTask | null = null;
      try {
        // Periodically reset stuck tasks
        await this.checkAndResetStuckTasks(log);

        task = await this.queueRepo.claimNextTask(['aggregate_features']);

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

        taskLog.info('Processing aggregation task');
        await this.worker.execute(task.restaurantId);

        await this.queueRepo.completeTask(task.id);
        taskLog.info('Aggregation task completed');

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
        errorLog.error({ error: message, stack: error instanceof Error ? error.stack : undefined }, 'Aggregation task failed');

        if (task) {
          await this.queueRepo.failTask(task.id, message);
        }

        await this.sleep(10_000);
      }
    }

    log.info('Feature aggregation worker stopped');
  }

  private async checkAndResetStuckTasks(log: ReturnType<typeof logger.child>): Promise<void> {
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
  const processor = new FeatureAggregationQueueProcessor();
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

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  processor.start().catch(async (error) => {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Feature aggregation worker crashed',
    );
    await shutdown(1);
  });
}
