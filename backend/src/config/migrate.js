const fs = require('fs');
const path = require('path');
const db = require('./db');

const migrationsDir = path.resolve(__dirname, '..', '..', 'migrations');

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function runMigration(filename) {
  const filePath = path.join(migrationsDir, filename);
  const sql = fs.readFileSync(filePath, 'utf8');

  await db.query('BEGIN');

  try {
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await db.query('COMMIT');
    console.log(`Migration applied: ${filename}`);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function migrate() {
  await ensureMigrationsTable();

  const appliedResult = await db.query('SELECT filename FROM schema_migrations;');
  const applied = new Set(appliedResult.rows.map((row) => row.filename));
  const files = fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  for (const filename of files) {
    if (!applied.has(filename)) {
      await runMigration(filename);
    }
  }

  console.log('Migrations finished.');
}

if (require.main === module) {
  migrate()
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.end();
    });
}

module.exports = migrate;
