import { desc, eq } from 'drizzle-orm';
import { db } from '../config/database';
import { userQueries, type InsertUserQuery } from '../db/schema';

export class UserQueryRepository {
  async create(data: InsertUserQuery) {
    const [record] = await db.insert(userQueries).values(data).returning();
    return record;
  }

  async findRecentByUser(userId: string, limit = 20) {
    return db
      .select()
      .from(userQueries)
      .where(eq(userQueries.userId, userId))
      .orderBy(desc(userQueries.createdAt))
      .limit(limit);
  }
}
