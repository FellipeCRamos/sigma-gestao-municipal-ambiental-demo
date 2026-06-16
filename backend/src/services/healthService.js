const db = require('../config/db');
const { APP_VERSION, NODE_ENV } = require('../config/env');

exports.getHealth = () => ({
  success: true,
  status: 'ok',
  service: 'sigba-api',
  version: APP_VERSION,
  environment: NODE_ENV,
  timestamp: new Date().toISOString(),
});

exports.getReadiness = async () => {
  const dbStartedAt = Date.now();
  await db.query('SELECT 1 AS ok;');
  const dbLatencyMs = Date.now() - dbStartedAt;

  const migrationsResult = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      MAX(executed_at) AS ultima_migration_em
    FROM schema_migrations;
  `);

  return {
    success: true,
    status: 'ready',
    service: 'sigba-api',
    version: APP_VERSION,
    environment: NODE_ENV,
    database: {
      status: 'ok',
      latency_ms: dbLatencyMs,
    },
    migrations: migrationsResult.rows[0] || { total: 0, ultima_migration_em: null },
    timestamp: new Date().toISOString(),
  };
};
