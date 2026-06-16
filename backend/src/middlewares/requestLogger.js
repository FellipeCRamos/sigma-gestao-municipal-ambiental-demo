const logger = require('../utils/logger');
const { LOG_REQUESTS } = require('../config/env');

module.exports = function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const payload = {
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: durationMs,
      ip: req.ip || req.socket?.remoteAddress || null,
      user_agent: req.headers?.['user-agent'] || null,
    };

    if (res.statusCode >= 500) {
      logger.error('http.request', payload);
      return;
    }

    if (res.statusCode >= 400) {
      logger.warn('http.request', payload);
      return;
    }

    if (LOG_REQUESTS) {
      logger.info('http.request', payload);
    }
  });

  return next();
};
