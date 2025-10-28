"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../src/config/database");
async function run() {
    const seedPath = (0, node_path_1.join)(process.cwd(), 'database', 'seed-test-restaurants.sql');
    const contents = (0, node_fs_1.readFileSync)(seedPath, 'utf8');
    const sanitized = contents.replace(/--.*$/gm, '');
    const statements = sanitized
        .split(/;\s*\n/)
        .map((statement) => statement.trim())
        .filter((statement) => statement && !statement.startsWith('--'));
    console.log(`Seeding database with ${statements.length} statements...`);
    for (const statement of statements) {
        await database_1.db.execute(drizzle_orm_1.sql.raw(statement));
    }
    console.log('Seed data inserted successfully');
    await (0, database_1.closePool)();
}
run().catch(async (error) => {
    console.error('Seeding failed', error);
    await (0, database_1.closePool)();
    process.exit(1);
});
