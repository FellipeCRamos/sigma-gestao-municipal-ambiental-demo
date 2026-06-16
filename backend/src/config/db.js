const { Pool } = require('pg');
const { DB } = require('./env');
const logger = require('../utils/logger');

const pool = new Pool(DB);

pool.on('error', (err) => {
  logger.error('db.pool.error', {
    message: err.message,
    code: err.code
  });
});

module.exports = pool;
