const crypto = require('crypto');

module.exports = function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  req.requestId = String(requestId);
  res.setHeader('X-Request-Id', req.requestId);

  return next();
};
