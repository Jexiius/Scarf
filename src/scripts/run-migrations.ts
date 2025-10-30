import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { closePool, db } from '../config/database';

async function waitForDatabase({
  attempts = 10,
  delayMs = 2_000,
}: { attempts?: number; delayMs?: number } = {}): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await db.execute(sql`SELECT 1`);
      if (attempt > 1) {
        console.log('✅ Database connection established');
      }
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }

      const remaining = attempts - attempt;
      console.warn(
        `Database not ready (attempt ${attempt}/${attempts}). Retrying in ${delayMs / 1000}s... Remaining attempts: ${remaining}`,
        error instanceof Error ? error.message : error,
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function runMigrations(): Promise<void> {
  const migrationsDir = join(process.cwd(), 'src', 'db', 'migrations');
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No SQL migrations found.');
    return;
  }

  console.log(`Applying ${files.length} SQL migration(s)...`);

  for (const file of files) {
    const fullPath = join(migrationsDir, file);
    const contents = await readFile(fullPath, 'utf8');
    const sanitized = contents.replace(/--.*$/gm, '');

    const statements = sanitized
      .split(/;\s*\n/)
      .map((statement) => statement.trim())
      .filter(Boolean);

    console.log(`Running migration ${file} (${statements.length} statements)...`);

    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }
  }

  console.log('Migrations completed successfully.');
}

async function main(): Promise<void> {
  try {
    await waitForDatabase();
    await runMigrations();
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('Migration failed', error);
  process.exitCode = 1;
});
