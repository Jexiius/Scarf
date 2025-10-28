import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { closePool, db } from '../src/config/database';

async function run() {
  const seedPath = join(process.cwd(), 'database', 'seed-test-restaurants.sql');
  const contents = readFileSync(seedPath, 'utf8');

  const existingCount = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int as count FROM restaurants`,
  );

  if (existingCount.rows[0]?.count && existingCount.rows[0].count > 0) {
    console.log('Restaurants already exist; skipping seed.');
    await closePool();
    return;
  }

  const sanitized = contents.replace(/--.*$/gm, '');

  const statements = sanitized
    .split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter((statement) => statement && !statement.startsWith('--'));

  console.log(`Seeding database with ${statements.length} statements...`);

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }

  console.log('Seed data inserted successfully');
  await closePool();
}

run().catch(async (error) => {
  console.error('Seeding failed', error);
  await closePool();
  process.exit(1);
});
