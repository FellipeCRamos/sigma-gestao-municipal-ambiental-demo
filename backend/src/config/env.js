require('dotenv').config({ quiet: process.env.DOTENV_QUIET !== 'false' });

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const APP_VERSION = process.env.APP_VERSION || process.env.npm_package_version || 'local';
const DEFAULT_DEV_CORS_ORIGINS = Object.freeze([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]);

const INSECURE_VALUES = new Set([
  'sigba-dev-chave-alterar',
  'alterar',
  'trocar',
  'chave',
  'dev-chave'
]);

function getRequiredSecret(name) {
  const value = process.env[name];
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}.`);
  }

  if (normalized.length < 32 || INSECURE_VALUES.has(normalized)) {
    throw new Error(`Variavel de ambiente insegura ou curta demais: ${name}.`);
  }

  return normalized;
}

function getRequired(name) {
  const value = String(process.env[name] || '').trim();

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}.`);
  }

  return value;
}

function getInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getBoolean(name, fallback = false) {
  const raw = process.env[name];

  if (raw === undefined) return fallback;

  return ['1', 'true', 'sim', 'yes'].includes(String(raw).trim().toLowerCase());
}

function isViveiroPublicPortalEnabled() {
  return getBoolean('VIVEIRO_PUBLIC_PORTAL_ENABLED', false);
}

function isPortalRequerenteEnabled() {
  return getBoolean('PORTAL_REQUERENTE_ENABLED', false);
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertHttpUrl(name, value, { requireHttpsInProduction = false } = {}) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} deve ser uma URL HTTP/HTTPS valida.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} deve usar protocolo HTTP ou HTTPS.`);
  }

  if (IS_PRODUCTION && requireHttpsInProduction && parsed.protocol !== 'https:') {
    throw new Error(`${name} deve usar HTTPS em producao.`);
  }

  return parsed.toString().replace(/\/$/, '');
}

function getCorsOrigins() {
  const configured = parseList(process.env.CORS_ORIGINS);

  if (!configured.length && IS_PRODUCTION) {
    throw new Error('CORS_ORIGINS deve ser configurado explicitamente em producao.');
  }

  const origins = configured.length ? configured : DEFAULT_DEV_CORS_ORIGINS;

  if (origins.includes('*')) {
    throw new Error('CORS_ORIGINS nao deve usar wildcard "*". Configure origens explicitas.');
  }

  if (
    IS_PRODUCTION &&
    !getBoolean('ALLOW_LOCAL_CORS_IN_PRODUCTION', false) &&
    origins.some((origin) => /localhost|127\.0\.0\.1/i.test(origin))
  ) {
    throw new Error('CORS_ORIGINS de producao contem origem local. Revise a configuracao.');
  }

  return origins;
}

function getDatabaseConfig() {
  return {
    host: IS_PRODUCTION ? getRequired('DB_HOST') : process.env.DB_HOST || '127.0.0.1',
    port: getInteger('DB_PORT', 5432),
    user: IS_PRODUCTION ? getRequired('DB_USER') : process.env.DB_USER,
    password: IS_PRODUCTION ? getRequired('DB_PASSWORD') : process.env.DB_PASSWORD,
    database: IS_PRODUCTION ? getRequired('DB_NAME') : process.env.DB_NAME,
    ssl: getBoolean('DB_SSL', false) ? { rejectUnauthorized: getBoolean('DB_SSL_REJECT_UNAUTHORIZED', true) } : false,
    max: getInteger('DB_POOL_MAX', 10),
    idleTimeoutMillis: getInteger('DB_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMillis: getInteger('DB_CONNECTION_TIMEOUT_MS', 5000),
  };
}

function getWebPushConfig() {
  const enabled = getBoolean('WEB_PUSH_ENABLED', false);
  const publicKey = String(process.env.WEB_PUSH_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim();
  const subject = String(process.env.WEB_PUSH_SUBJECT || '').trim();
  const privateKeyConfigured = Boolean(privateKey);

  if (enabled && !publicKey) {
    throw new Error('WEB_PUSH_PUBLIC_KEY deve ser configurado quando WEB_PUSH_ENABLED=true.');
  }

  if (enabled && !privateKeyConfigured) {
    throw new Error('WEB_PUSH_PRIVATE_KEY deve ser configurado quando WEB_PUSH_ENABLED=true.');
  }

  if (enabled && !subject) {
    throw new Error('WEB_PUSH_SUBJECT deve ser configurado quando WEB_PUSH_ENABLED=true.');
  }

  return Object.freeze({
    enabled,
    publicKey,
    privateKey,
    privateKeyConfigured,
    subject,
  });
}

function getPasswordResetDeliveryConfig() {
  const mode = String(process.env.PASSWORD_RESET_DELIVERY_MODE || (IS_PRODUCTION ? 'smtp' : 'log'))
    .trim()
    .toLowerCase();
  const allowedModes = new Set(['smtp', 'log', 'disabled']);
  const configuredAppPublicUrl = String(process.env.APP_PUBLIC_URL || '').trim();

  if (IS_PRODUCTION && !configuredAppPublicUrl) {
    throw new Error('APP_PUBLIC_URL deve ser configurado explicitamente em producao.');
  }

  const appPublicUrl = assertHttpUrl(
    'APP_PUBLIC_URL',
    configuredAppPublicUrl || 'http://127.0.0.1:5173',
    { requireHttpsInProduction: !getBoolean('ALLOW_INSECURE_PUBLIC_URL_IN_PRODUCTION', false) }
  );
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPassword = String(process.env.SMTP_PASSWORD || '').trim();
  const smtpFrom = String(process.env.SMTP_FROM || smtpUser || '').trim();

  if (!allowedModes.has(mode)) {
    throw new Error('PASSWORD_RESET_DELIVERY_MODE deve ser smtp, log ou disabled.');
  }

  if (
    IS_PRODUCTION &&
    mode !== 'smtp' &&
    !getBoolean('ALLOW_PASSWORD_RESET_WITHOUT_SMTP_IN_PRODUCTION', false)
  ) {
    throw new Error('Recuperacao de senha em producao exige PASSWORD_RESET_DELIVERY_MODE=smtp.');
  }

  if (mode === 'smtp') {
    if (!String(process.env.SMTP_HOST || '').trim()) {
      throw new Error('SMTP_HOST deve ser configurado quando PASSWORD_RESET_DELIVERY_MODE=smtp.');
    }

    if (!smtpFrom) {
      throw new Error('SMTP_FROM deve ser configurado quando PASSWORD_RESET_DELIVERY_MODE=smtp.');
    }

    if ((smtpUser && !smtpPassword) || (!smtpUser && smtpPassword)) {
      throw new Error('SMTP_USER e SMTP_PASSWORD devem ser configurados em conjunto.');
    }
  }

  return Object.freeze({
    mode,
    appPublicUrl,
    smtp: Object.freeze({
      host: String(process.env.SMTP_HOST || '').trim(),
      port: getInteger('SMTP_PORT', 587),
      secure: getBoolean('SMTP_SECURE', false),
      user: smtpUser,
      password: smtpPassword,
      from: smtpFrom,
      replyTo: String(process.env.SMTP_REPLY_TO || '').trim(),
      rejectUnauthorized: getBoolean('SMTP_TLS_REJECT_UNAUTHORIZED', true),
    }),
  });
}

const UPLOAD_MAX_BYTES = getInteger('UPLOAD_MAX_BYTES', 5 * 1024 * 1024);
const RATE_LIMITS = Object.freeze({
  login: {
    windowMs: getInteger('RATE_LIMIT_LOGIN_WINDOW_MS', 15 * 60 * 1000),
    max: getInteger('RATE_LIMIT_LOGIN_MAX', 10),
  },
  passwordReset: {
    windowMs: getInteger('RATE_LIMIT_PASSWORD_RESET_WINDOW_MS', 15 * 60 * 1000),
    max: getInteger('RATE_LIMIT_PASSWORD_RESET_MAX', 5),
  },
  publicRead: {
    windowMs: getInteger('RATE_LIMIT_PUBLIC_WINDOW_MS', 60 * 1000),
    max: getInteger('RATE_LIMIT_PUBLIC_MAX', 60),
  },
  publicWrite: {
    windowMs: getInteger('RATE_LIMIT_PUBLIC_WRITE_WINDOW_MS', 15 * 60 * 1000),
    max: getInteger('RATE_LIMIT_PUBLIC_WRITE_MAX', 8),
  },
  integration: {
    windowMs: getInteger('RATE_LIMIT_INTEGRATION_WINDOW_MS', 60 * 1000),
    max: getInteger('RATE_LIMIT_INTEGRATION_MAX', 120),
  },
  maxKeys: getInteger('RATE_LIMIT_MAX_KEYS', 10000),
});

module.exports = {
  NODE_ENV,
  IS_PRODUCTION,
  APP_VERSION,
  PORT: getInteger('PORT', 3001),
  DB: getDatabaseConfig(),
  CORS_ORIGINS: getCorsOrigins(),
  TRUST_PROXY: getBoolean('TRUST_PROXY', false),
  REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT || '1mb',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_REQUESTS: getBoolean('LOG_REQUESTS', !IS_PRODUCTION),
  UPLOAD_MAX_BYTES,
  RATE_LIMITS,
  JWT_SECRET: getRequiredSecret('JWT_SECRET'),
  JWT_INTERNO_EXPIRES_IN: process.env.JWT_INTERNO_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '8h',
  JWT_EXTERNO_EXPIRES_IN: process.env.JWT_EXTERNO_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '7d',
  PASSWORD_RESET_EXPIRES_MINUTES: getInteger('PASSWORD_RESET_EXPIRES_MINUTES', 30),
  PASSWORD_RESET_DELIVERY: getPasswordResetDeliveryConfig(),
  WEB_PUSH: getWebPushConfig(),
  isViveiroPublicPortalEnabled,
  isPortalRequerenteEnabled,
};
