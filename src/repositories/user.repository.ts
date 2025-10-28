import { eq, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { users, type InsertUser } from '../db/schema';

export class UserRepository {
  async create(data: InsertUser) {
    const payload: InsertUser = {
      ...data,
      email: data.email.toLowerCase(),
    };

    const [user] = await db.insert(users).values(payload).returning();

    if (!user) {
      throw new Error('Failed to create user record');
    }

    return user;
  }

  async findByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user ?? null;
  }

  async findById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ?? null;
  }

  async updateLastLogin(id: string) {
    const now = new Date();
    const [user] = await db
      .update(users)
      .set({ lastLoginAt: now, lastActiveAt: now, updatedAt: now })
      .where(eq(users.id, id))
      .returning();
    return user ?? null;
  }

  async recordQueryActivity(id: string) {
    const now = new Date();
    const [user] = await db
      .update(users)
      .set({
        lastActiveAt: now,
        updatedAt: now,
        queryCount: sql`${users.queryCount} + 1`,
      })
      .where(eq(users.id, id))
      .returning();

    return user ?? null;
  }
}
