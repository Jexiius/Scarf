import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { closePool, db } from '../config/database';

const DEFAULT_DB_WAIT_ATTEMPTS = parseEnvNumber(process.env.DB_WAIT_ATTEMPTS, 20);
const DEFAULT_DB_WAIT_DELAY_MS = parseEnvNumber(process.env.DB_WAIT_DELAY_MS, 2_000);
const DEFAULT_DB_WAIT_MAX_DELAY_MS = parseEnvNumber(process.env.DB_WAIT_MAX_DELAY_MS, 15_000);
const shouldRunMigrations = parseEnvBoolean(process.env.RUN_MIGRATIONS, true);

type WaitForDatabaseOptions = {
  attempts?: number;
  delayMs?: number;
  maxDelayMs?: number;
};

type NodePostgresError = Error & {
  code?: string;
  severity?: string;
  detail?: string;
  hint?: string;
};

function parseEnvNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function parseEnvBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  return fallback;
}

function summarizeError(error: unknown): string {
  if (error instanceof AggregateError) {
    const nested = error.errors?.map((err) => summarizeError(err)).join('; ');
    return `${error.message}${nested ? ` | nested: ${nested}` : ''}`;
  }

  if (error instanceof Error) {
    const pgError = error as NodePostgresError;
    const parts = [
      pgError.message,
      pgError.code && `code=${pgError.code}`,
      pgError.severity && `severity=${pgError.severity}`,
      pgError.detail && `detail=${pgError.detail}`,
      pgError.hint && `hint=${pgError.hint}`,
    ]
      .filter(Boolean)
      .join(' | ');

    return parts;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function waitForDatabase({
  attempts = DEFAULT_DB_WAIT_ATTEMPTS,
  delayMs = DEFAULT_DB_WAIT_DELAY_MS,
  maxDelayMs = DEFAULT_DB_WAIT_MAX_DELAY_MS,
}: WaitForDatabaseOptions = {}): Promise<void> {
  let currentDelay = delayMs;
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
      const summary = summarizeError(error);
      const delaySeconds = (currentDelay / 1000).toFixed(1);

      console.warn(
        `Database not ready (attempt ${attempt}/${attempts}). Retrying in ${delaySeconds}s... Remaining attempts: ${remaining}. ${summary}`,
      );
      console.warn('Database connection attempt failed with error object:', error);

      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay = Math.min(currentDelay * 2, maxDelayMs);
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
  if (!shouldRunMigrations) {
    console.warn('RUN_MIGRATIONS is set to false. Skipping migrations.');
    return;
  }

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
