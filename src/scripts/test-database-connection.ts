import { closePool, testConnection } from '../config/database';

async function main(): Promise<void> {
  try {
    await testConnection();
    console.log('✅ Database connection test completed successfully.');
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('❌ Database connection test failed.', error);
  process.exitCode = 1;
});

