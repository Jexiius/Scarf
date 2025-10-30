import { db } from '../config/database';
import { processingQueue } from '../db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

export type TaskType = 'scrape_reviews' | 'extract_features' | 'aggregate_features';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueTask {
  id: string;
  restaurantId: string;
  taskType: TaskType;
  priority: number;
  status: TaskStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export class QueueRepository {
  /**
   * Add a new task to the queue
   */
  async addTask(
    restaurantId: string,
    taskType: TaskType,
    priority: number = 0
  ): Promise<QueueTask> {
    const [task] = await db
      .insert(processingQueue)
      .values({
        restaurantId,
        taskType,
        priority,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
      })
      .returning();

    return task as QueueTask;
  }

  /**
   * Add multiple tasks in bulk (more efficient)
   */
  async addTasks(
    tasks: Array<{ restaurantId: string; taskType: TaskType; priority?: number }>
  ): Promise<void> {
    if (tasks.length === 0) return;

    await db
      .insert(processingQueue)
      .values(
        tasks.map(t => ({
          restaurantId: t.restaurantId,
          taskType: t.taskType,
          priority: t.priority || 0,
          status: 'pending' as TaskStatus,
          attempts: 0,
          maxAttempts: 3,
        }))
      )
      .onConflictDoNothing(); // Skip if task already exists
  }

  /**
   * Claim the next available task (atomic operation)
   * Uses FOR UPDATE SKIP LOCKED to prevent race conditions
   */
  async claimNextTask(): Promise<QueueTask | null> {
    try {
      const result = await db.transaction(async (tx) => {
        // Find next pending task
        const [task] = await tx
          .select()
          .from(processingQueue)
          .where(eq(processingQueue.status, 'pending'))
          .orderBy(sql`${processingQueue.priority} DESC, ${processingQueue.createdAt} ASC`)
          .limit(1)
          .for('update', { skipLocked: true });

        if (!task) return null;

        // Mark as processing
        const [updatedTask] = await tx
          .update(processingQueue)
          .set({
            status: 'processing',
            startedAt: new Date(),
          })
          .where(eq(processingQueue.id, task.id))
          .returning();

        return updatedTask;
      });

      return result as QueueTask | null;
    } catch (error) {
      console.error('Failed to claim task:', error);
      return null;
    }
  }

  /**
   * Mark task as completed
   */
  async completeTask(taskId: string): Promise<void> {
    await db
      .update(processingQueue)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(processingQueue.id, taskId));
  }

  /**
   * Mark task as failed and increment attempts
   */
  async failTask(taskId: string, error: string): Promise<void> {
    const [task] = await db
      .select()
      .from(processingQueue)
      .where(eq(processingQueue.id, taskId));

    if (!task) return;

    const newAttempts = task.attempts + 1;
    const shouldRetry = newAttempts < task.maxAttempts;

    await db
      .update(processingQueue)
      .set({
        status: shouldRetry ? 'pending' : 'failed',
        attempts: newAttempts,
        lastError: error,
        startedAt: null, // Reset for retry
      })
      .where(eq(processingQueue.id, taskId));

    console.log(
      `Task ${taskId} failed (attempt ${newAttempts}/${task.maxAttempts}). ${
        shouldRetry ? 'Will retry.' : 'Max attempts reached.'
      }`
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const stats = await db
      .select({
        status: processingQueue.status,
        count: sql<number>`count(*)`,
      })
      .from(processingQueue)
      .groupBy(processingQueue.status);

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    stats.forEach(stat => {
      const count = Number(stat.count);
      result[stat.status as keyof typeof result] = count;
      result.total += count;
    });

    return result;
  }

  /**
   * Get pending tasks count by type
   */
  async getPendingTasksByType(): Promise<Record<TaskType, number>> {
    const tasks = await db
      .select({
        taskType: processingQueue.taskType,
        count: sql<number>`count(*)`,
      })
      .from(processingQueue)
      .where(eq(processingQueue.status, 'pending'))
      .groupBy(processingQueue.taskType);

    const result: Record<TaskType, number> = {
      scrape_reviews: 0,
      extract_features: 0,
      aggregate_features: 0,
    };

    tasks.forEach(task => {
      result[task.taskType as TaskType] = Number(task.count);
    });

    return result;
  }

  /**
   * Get stuck tasks (processing for >1 hour)
   */
  async getStuckTasks(): Promise<QueueTask[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const tasks = await db
      .select()
      .from(processingQueue)
      .where(
        and(
          eq(processingQueue.status, 'processing'),
          sql`${processingQueue.startedAt} < ${oneHourAgo}`
        )
      );

    return tasks as QueueTask[];
  }

  /**
   * Reset stuck tasks back to pending
   */
  async resetStuckTasks(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const result = await db
      .update(processingQueue)
      .set({
        status: 'pending',
        startedAt: null,
        lastError: 'Task was stuck in processing state',
      })
      .where(
        and(
          eq(processingQueue.status, 'processing'),
          sql`${processingQueue.startedAt} < ${oneHourAgo}`
        )
      );

    return result.rowCount || 0;
  }

  /**
   * Clear completed tasks older than N days
   */
  async cleanupCompletedTasks(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(processingQueue)
      .where(
        and(
          eq(processingQueue.status, 'completed'),
          sql`${processingQueue.completedAt} < ${cutoffDate}`
        )
      );

    return result.rowCount || 0;
  }

  /**
   * Check if a task already exists for a restaurant
   */
  async taskExists(
    restaurantId: string,
    taskType: TaskType,
    statuses: TaskStatus[] = ['pending', 'processing']
  ): Promise<boolean> {
    const [task] = await db
      .select()
      .from(processingQueue)
      .where(
        and(
          eq(processingQueue.restaurantId, restaurantId),
          eq(processingQueue.taskType, taskType),
          inArray(processingQueue.status, statuses)
        )
      )
      .limit(1);

    return !!task;
  }
}
