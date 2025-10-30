import { closePool } from '../config/database';
import { env } from '../config/env';
import { FeatureExtractionRepository } from '../repositories/feature-extraction.repository';
import { QueueRepository, type QueueTask } from '../repositories/queue.repository';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { ReviewRepository } from '../repositories/review.repository';
import { FeatureExtractionService } from '../services/feature-extraction.service';

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
    console.log(`\n🧪 Extracting features for restaurant: ${restaurantId}`);

    const restaurant = await this.restaurantRepo.findById(restaurantId);
    if (!restaurant) {
      throw new Error(`Restaurant not found for feature extraction: ${restaurantId}`);
    }

    const reviews = await this.reviewRepo.findUnprocessedByRestaurant(restaurantId, this.batchSize);
    if (reviews.length === 0) {
      console.log('No unprocessed reviews found for feature extraction');
      return;
    }

    console.log(`📝 Processing ${reviews.length} reviews for ${restaurant.restaurant.name}`);

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

          console.log(`✅ Extracted features for review ${item.result.reviewId}`);
        } catch (error) {
          console.error(
            `❌ Failed to persist extraction for review ${item.review.id}:`,
            error,
          );
        }
      } else if (item.error) {
        console.warn(`⚠️ Feature extraction failed for review ${item.review.id}: ${item.error.message}`);
      }
    }

    if (successfulReviewIds.length > 0) {
      await this.reviewRepo.markProcessed(successfulReviewIds);
      console.log(
        `💾 Saved ${successfulReviewIds.length} extractions | Tokens: ${totalTokens} | Cost $${totalCost.toFixed(
          4,
        )}`,
      );

      const hasAggregationTask = await this.queueRepo.taskExists(restaurantId, 'aggregate_features', [
        'pending',
        'processing',
      ]);

      if (!hasAggregationTask) {
        await this.queueRepo.addTask(restaurantId, 'aggregate_features', 40);
        console.log('🪄 Queued aggregation task');
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
        console.log(`🔁 Re-queued extraction task (${remaining} reviews remaining)`);
      }
    }
  }
}

export class FeatureExtractionQueueProcessor {
  private readonly worker = new FeatureExtractorWorker();
  private readonly queueRepo = new QueueRepository();
  private isRunning = false;

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('🚀 Feature Extraction Worker Started');
    console.log('===================================');

    while (this.isRunning) {
      let task: QueueTask | null = null;
      try {
        task = await this.queueRepo.claimNextTask(['extract_features']);

        if (!task) {
          await this.sleep(5_000);
          continue;
        }

        console.log(`\n⚡ Processing extraction task: ${task.id}`);
        console.log(`   Restaurant: ${task.restaurantId}`);
        console.log(`   Attempt: ${task.attempts + 1}/${task.maxAttempts}`);

        await this.worker.execute(task.restaurantId);
        await this.queueRepo.completeTask(task.id);
        console.log('✅ Extraction task completed');

        const stats = await this.queueRepo.getQueueStats();
        console.log(
          `\n📊 Queue Stats → Pending: ${stats.pending}, Processing: ${stats.processing}, Completed: ${stats.completed}`,
        );

        await this.sleep(2_000);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Extraction task failed:', message);

        if (task) {
          await this.queueRepo.failTask(task.id, message);
        }

        await this.sleep(10_000);
      }
    }

    console.log('\n🛑 Feature extraction worker stopped');
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
      console.error('Failed to close database pool:', error);
    } finally {
      process.exit(code);
    }
  };

  process.on('SIGTERM', () => shutdown(0));
  process.on('SIGINT', () => shutdown(0));

  processor.start().catch(async (error) => {
    console.error('💥 Feature extraction worker crashed:', error);
    await shutdown(1);
  });
}
