const db = require('../config/db');

const SENSITIVE_KEYS = new Set([
  'senha',
  'senha_hash',
  'token',
  'token_hash',
  'nova_senha',
  'password',
  'file_hash_sha256'
]);

function getContext(req) {
  if (!req) return {};

  return {
    request_id: req.requestId || req.headers?.['x-request-id'] || null,
    ip: req.ip || req.socket?.remoteAddress || null,
    user_agent: req.headers?.['user-agent'] || null,
    origem: req.headers?.origin || req.headers?.referer || null,
  };
}

exports.getContext = getContext;

function redactValue(key, value) {
  if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
    return '[redigido]';
  }

  return value;
}

function sanitizeForAudit(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForAudit);
  }

  return Object.entries(value).reduce((acc, [key, item]) => {
    acc[key] = redactValue(key, sanitizeForAudit(item));
    return acc;
  }, {});
}

function buildDiff(before, after) {
  const safeBefore = sanitizeForAudit(before || {});
  const safeAfter = sanitizeForAudit(after || {});
  const keys = new Set([...Object.keys(safeBefore || {}), ...Object.keys(safeAfter || {})]);
  const diff = {};

  keys.forEach((key) => {
    const beforeValue = safeBefore?.[key];
    const afterValue = safeAfter?.[key];

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      diff[key] = {
        antes: beforeValue === undefined ? null : beforeValue,
        depois: afterValue === undefined ? null : afterValue
      };
    }
  });

  return diff;
}

exports.buildDiff = buildDiff;

exports.log = async ({
  ator_tipo,
  ator_id = null,
  acao,
  entidade,
  entidade_id = null,
  dados = {},
  request_id = null,
  ip = null,
  user_agent = null,
  origem = null,
  req = null
}) => {
  const context = getContext(req);

  await db.query(
    `
      INSERT INTO audit_logs (
        ator_tipo,
        ator_id,
        acao,
        entidade,
        entidade_id,
        dados,
        request_id,
        ip,
        user_agent,
        origem
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10);
    `,
    [
      ator_tipo,
      ator_id,
      acao,
      entidade,
      entidade_id,
      JSON.stringify(dados),
      request_id || context.request_id,
      ip || context.ip,
      user_agent || context.user_agent,
      origem || context.origem
    ]
  );
};

exports.logChange = async ({
  ator_tipo,
  ator_id = null,
  acao,
  entidade,
  entidade_id = null,
  before = null,
  after = null,
  dados = {},
  req = null
}) => {
  const context = getContext(req);
  const safeBefore = sanitizeForAudit(before);
  const safeAfter = sanitizeForAudit(after);
  const diff = buildDiff(before, after);

  await db.query(
    `
      INSERT INTO audit_logs (
        ator_tipo,
        ator_id,
        acao,
        entidade,
        entidade_id,
        dados,
        request_id,
        ip,
        user_agent,
        origem,
        estado_anterior,
        estado_posterior,
        diff
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb);
    `,
    [
      ator_tipo,
      ator_id,
      acao,
      entidade,
      entidade_id,
      JSON.stringify(sanitizeForAudit(dados)),
      context.request_id,
      context.ip,
      context.user_agent,
      context.origem,
      JSON.stringify(safeBefore),
      JSON.stringify(safeAfter),
      JSON.stringify(diff)
    ]
  );
};
