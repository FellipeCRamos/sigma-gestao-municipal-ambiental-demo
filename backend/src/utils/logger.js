const LEVEL_WEIGHT = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

const REDACT_KEYS = new Set([
  'authorization',
  'cookie',
  'senha',
  'senha_hash',
  'password',
  'token',
  'token_hash',
  'api_key',
  'x-sigba-api-key',
  'jwt_secret',
  'db_password',
]);

function getConfiguredLevel() {
  const level = String(process.env.LOG_LEVEL || 'info').toLowerCase();
  return LEVEL_WEIGHT[level] ? level : 'info';
}

function shouldLog(level) {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[getConfiguredLevel()];
}

function redact(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);

  return Object.entries(value).reduce((acc, [key, item]) => {
    const normalizedKey = String(key).toLowerCase();
    acc[key] = REDACT_KEYS.has(normalizedKey) ? '[redigido]' : redact(item);
    return acc;
  }, {});
}

function write(level, event, meta = {}) {
  if (!shouldLog(level)) return;

  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...redact(meta)
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

module.exports = {
  debug: (event, meta) => write('debug', event, meta),
  info: (event, meta) => write('info', event, meta),
  warn: (event, meta) => write('warn', event, meta),
  error: (event, meta) => write('error', event, meta),
};
