"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const migrator_1 = require("drizzle-orm/node-postgres/migrator");
const database_1 = require("../src/config/database");
async function run() {
    console.log('Running migrations...');
    await (0, migrator_1.migrate)(database_1.db, { migrationsFolder: './src/db/migrations' });
    console.log('Migrations completed');
    process.exit(0);
}
run().catch((error) => {
    console.error('Migration failed', error);
    process.exit(1);
});
