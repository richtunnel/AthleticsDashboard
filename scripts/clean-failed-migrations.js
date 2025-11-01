const { Client } = require("pg");

async function cleanFailedMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("🧹 Cleaning failed migration records...");

    // Delete any failed or rolled-back migrations
    const result = await client.query(`
  DELETE FROM "_prisma_migrations" 
  WHERE finished_at IS NULL 
     OR rolled_back_at IS NOT NULL
`);

    console.log(`✅ Removed ${result.rowCount} failed migration record(s)`);

    // Show remaining migrations
    const remaining = await client.query(`
  SELECT migration_name, finished_at 
  FROM "_prisma_migrations" 
  ORDER BY started_at
`);

    console.log("📋 Remaining migrations:", remaining.rows);
  } catch (error) {
    console.error("⚠️ Error cleaning migrations:", error.message);
    // Don't fail the build - just log and continue
  } finally {
    await client.end();
  }
}

cleanFailedMigrations();
