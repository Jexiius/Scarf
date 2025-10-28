import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { closePool, db } from '../src/config/database';

async function run() {
  const migrationsDir = join(process.cwd(), 'src', 'db', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No SQL migrations found.');
    await closePool();
    return;
  }

  console.log(`Applying ${files.length} SQL migration(s)...`);

  for (const file of files) {
    const fullPath = join(migrationsDir, file);
    const contents = readFileSync(fullPath, 'utf8');
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
  await closePool();
}

run().catch(async (error) => {
  console.error('Migration failed', error);
  await closePool();
  process.exit(1);
});
