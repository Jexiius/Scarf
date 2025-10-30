import { closePool } from '../config/database';
import { FeatureExtractionRepository } from '../repositories/feature-extraction.repository';
import { QueueRepository, type QueueTask } from '../repositories/queue.repository';
import { RestaurantRepository } from '../repositories/restaurant.repository';
import { FeatureAggregationService } from '../services/feature-aggregation.service';

export class FeatureAggregatorWorker {
  private readonly featureRepo = new FeatureExtractionRepository();
  private readonly restaurantRepo = new RestaurantRepository();
  private readonly aggregationService = new FeatureAggregationService();

  async execute(restaurantId: string): Promise<void> {
    console.log(`\n📈 Aggregating features for restaurant ${restaurantId}`);

    const extractions = await this.featureRepo.getByRestaurant(restaurantId);
    if (extractions.length === 0) {
      console.log('⚠️  No feature extractions available for aggregation');
      return;
    }

    const aggregation = this.aggregationService.aggregate(extractions);

    await this.restaurantRepo.upsertFeatures(restaurantId, aggregation.values, {
      reviewCountAnalyzed: aggregation.reviewCountAnalyzed,
      confidenceScore: aggregation.confidenceScore,
      modelVersion: aggregation.modelVersion,
    });

    const cost = await this.featureRepo.getCostSummary(restaurantId);

    console.log(
      `✅ Aggregated ${aggregation.reviewCountAnalyzed} extractions | Confidence ${aggregation.confidenceScore} | Cost so far $${cost.costUsd.toFixed(
        4,
      )}`,
    );
  }
}

export class FeatureAggregationQueueProcessor {
  private readonly worker = new FeatureAggregatorWorker();
  private readonly queueRepo = new QueueRepository();
  private isRunning = false;

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('🚀 Feature Aggregation Worker Started');
    console.log('====================================');

    while (this.isRunning) {
      let task: QueueTask | null = null;
      try {
        task = await this.queueRepo.claimNextTask(['aggregate_features']);

        if (!task) {
          await this.sleep(5_000);
          continue;
        }

        console.log(`\n⚡ Processing aggregation task: ${task.id} for restaurant ${task.restaurantId}`);
        await this.worker.execute(task.restaurantId);

        await this.queueRepo.completeTask(task.id);
        console.log('✅ Aggregation task completed');

        const stats = await this.queueRepo.getQueueStats();
        console.log(
          `\n📊 Queue Stats → Pending: ${stats.pending}, Processing: ${stats.processing}, Completed: ${stats.completed}`,
        );

        await this.sleep(2_000);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Aggregation task failed:', message);

        if (task) {
          await this.queueRepo.failTask(task.id, message);
        }

        await this.sleep(10_000);
      }
    }

    console.log('\n🛑 Feature aggregation worker stopped');
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
      console.error('Failed to close database pool:', error);
    } finally {
      process.exit(code);
    }
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  processor.start().catch(async (error) => {
    console.error('💥 Feature aggregation worker crashed:', error);
    await shutdown(1);
  });
}
