const app = require('./app');
const db = require('./config/db');
const logger = require('./utils/logger');
const { PORT, NODE_ENV, APP_VERSION } = require('./config/env');

const server = app.listen(PORT, () => {
  logger.info('api.started', {
    port: PORT,
    environment: NODE_ENV,
    version: APP_VERSION
  });
});

async function shutdown(signal) {
  logger.warn('api.shutdown', { signal });

  server.close(async () => {
    try {
      await db.end();
      logger.info('api.shutdown.complete', { signal });
      process.exit(0);
    } catch (error) {
      logger.error('api.shutdown.error', { signal, message: error.message });
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
