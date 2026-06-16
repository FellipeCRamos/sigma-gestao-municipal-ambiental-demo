const { RATE_LIMITS } = require('../config/env');

function createRateLimit({ windowMs, max, message }) {
  const hits = new Map();
  const cleanupInterval = setInterval(() => pruneExpired(hits, Date.now()), Math.max(60000, Math.min(windowMs, 300000)));

  cleanupInterval.unref?.();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const routeKey = `${req.method}:${req.baseUrl || ''}${req.path || String(req.originalUrl || '').split('?')[0]}`;
    const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${routeKey}`;
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      ensureCapacity(hits, now);
      hits.set(key, { count: 1, resetAt: now + windowMs });
      setRateLimitHeaders(res, max, max - 1, now + windowMs);
      return next();
    }

    current.count += 1;
    setRateLimitHeaders(res, max, Math.max(0, max - current.count), current.resetAt);

    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));

      return res.status(429).json({
        success: false,
        error: message || 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
      });
    }

    return next();
  };
}

function pruneExpired(hits, now) {
  for (const [key, value] of hits.entries()) {
    if (value.resetAt <= now) {
      hits.delete(key);
    }
  }
}

function ensureCapacity(hits, now) {
  if (hits.size < RATE_LIMITS.maxKeys) return;

  pruneExpired(hits, now);

  while (hits.size >= RATE_LIMITS.maxKeys) {
    const oldestKey = hits.keys().next().value;
    if (!oldestKey) return;
    hits.delete(oldestKey);
  }
}

function setRateLimitHeaders(res, limit, remaining, resetAt) {
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
}

module.exports = {
  loginRateLimit: createRateLimit({
    windowMs: RATE_LIMITS.login.windowMs,
    max: RATE_LIMITS.login.max,
    message: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.'
  }),
  passwordResetRateLimit: createRateLimit({
    windowMs: RATE_LIMITS.passwordReset.windowMs,
    max: RATE_LIMITS.passwordReset.max,
    message: 'Muitas solicitacoes de recuperacao de senha. Aguarde alguns minutos.'
  }),
  publicReadRateLimit: createRateLimit({
    windowMs: RATE_LIMITS.publicRead.windowMs,
    max: RATE_LIMITS.publicRead.max,
    message: 'Muitas consultas publicas. Aguarde um momento.'
  }),
  publicWriteRateLimit: createRateLimit({
    windowMs: RATE_LIMITS.publicWrite.windowMs,
    max: RATE_LIMITS.publicWrite.max,
    message: 'Muitas comunicacoes publicas em curto periodo. Aguarde alguns minutos.'
  }),
  integrationRateLimit: createRateLimit({
    windowMs: RATE_LIMITS.integration.windowMs,
    max: RATE_LIMITS.integration.max,
    message: 'Limite temporario de integracao atingido.'
  }),
};
