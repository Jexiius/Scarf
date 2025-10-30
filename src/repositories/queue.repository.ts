import { and, eq, inArray, sql } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import { db } from '../config/database';
import {
  processingQueue,
  type ProcessingQueueTask,
  type TaskStatus,
  type TaskType,
} from '../db/schema';

export type QueueTask = ProcessingQueueTask;

export class QueueRepository {
  async addTask(restaurantId: string, taskType: TaskType, priority: number = 0): Promise<QueueTask> {
    try {
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

      if (!task) {
        throw new Error('Failed to insert queue task');
      }

      return task;
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '23505') {
        const [existing] = await db
          .select()
          .from(processingQueue)
          .where(
            and(
              eq(processingQueue.restaurantId, restaurantId),
              eq(processingQueue.taskType, taskType),
              inArray(processingQueue.status, ['pending', 'processing']),
            ),
          )
          .limit(1);

        if (!existing) {
          throw new Error('Queue task conflict occurred but existing task was not found');
        }

        return existing;
      }

      throw error;
    }
  }

  async addTasks(
    tasks: Array<{ restaurantId: string; taskType: TaskType; priority?: number }>,
  ): Promise<void> {
    if (tasks.length === 0) {
      return;
    }

    await db
      .insert(processingQueue)
      .values(
        tasks.map((task) => ({
          restaurantId: task.restaurantId,
          taskType: task.taskType,
          priority: task.priority ?? 0,
          status: 'pending' as const,
          attempts: 0,
          maxAttempts: 3,
        })),
      )
      .onConflictDoNothing();
  }

  async claimNextTask(allowedTypes?: TaskType[]): Promise<QueueTask | null> {
    try {
      const result = await db.transaction(async (tx) => {
        const conditions = [eq(processingQueue.status, 'pending')];

        if (allowedTypes && allowedTypes.length > 0) {
          conditions.push(inArray(processingQueue.taskType, allowedTypes));
        }

        const [task] = await tx
          .select()
          .from(processingQueue)
          .where(and(...conditions))
          .orderBy(sql`${processingQueue.priority} DESC, ${processingQueue.createdAt} ASC`)
          .limit(1)
          .for('update', { skipLocked: true });

        if (!task) {
          return null;
        }

        const [updatedTask] = await tx
          .update(processingQueue)
          .set({
            status: 'processing',
            startedAt: new Date(),
          })
          .where(eq(processingQueue.id, task.id))
          .returning();

        if (!updatedTask) {
          throw new Error('Failed to mark task as processing');
        }

        return updatedTask;
      });

      return result ?? null;
    } catch (error) {
      console.error('Failed to claim task:', error);
      return null;
    }
  }

  async completeTask(taskId: string): Promise<void> {
    await db
      .update(processingQueue)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(processingQueue.id, taskId));
  }

  async failTask(taskId: string, error: string): Promise<void> {
    const [task] = await db
      .select()
      .from(processingQueue)
      .where(eq(processingQueue.id, taskId))
      .limit(1);

    if (!task) {
      return;
    }

    const attempts = task.attempts + 1;
    const shouldRetry = attempts < task.maxAttempts;

    await db
      .update(processingQueue)
      .set({
        status: shouldRetry ? 'pending' : 'failed',
        attempts,
        lastError: error,
        startedAt: null,
      })
      .where(eq(processingQueue.id, taskId));

    console.log(
      `Task ${taskId} failed (attempt ${attempts}/${task.maxAttempts}). ${
        shouldRetry ? 'Will retry.' : 'Max attempts reached.'
      }`,
    );
  }

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

    for (const stat of stats) {
      const status = stat.status as keyof typeof result;
      const count = Number(stat.count);
      if (status in result) {
        result[status] = count;
        result.total += count;
      }
    }

    return result;
  }

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

    for (const task of tasks) {
      result[task.taskType as TaskType] = Number(task.count);
    }

    return result;
  }

  async getStuckTasks(): Promise<QueueTask[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const tasks = await db
      .select()
      .from(processingQueue)
      .where(
        and(
          eq(processingQueue.status, 'processing'),
          sql`${processingQueue.startedAt} < ${oneHourAgo}`,
        ),
      );

    return tasks;
  }

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
          sql`${processingQueue.startedAt} < ${oneHourAgo}`,
        ),
      );

    return result.rowCount ?? 0;
  }

  async cleanupCompletedTasks(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(processingQueue)
      .where(
        and(
          eq(processingQueue.status, 'completed'),
          sql`${processingQueue.completedAt} < ${cutoffDate}`,
        ),
      );

    return result.rowCount ?? 0;
  }

  async taskExists(
    restaurantId: string,
    taskType: TaskType,
    statuses: TaskStatus[] = ['pending', 'processing'],
  ): Promise<boolean> {
    const [task] = await db
      .select()
      .from(processingQueue)
      .where(
        and(
          eq(processingQueue.restaurantId, restaurantId),
          eq(processingQueue.taskType, taskType),
          inArray(processingQueue.status, statuses),
        ),
      )
      .limit(1);

    return Boolean(task);
  }
}
