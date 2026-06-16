const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, JWT_EXTERNO_EXPIRES_IN, WEB_PUSH } = require('../config/env');
const { assertPasswordPolicy } = require('./passwordPolicy');
const { TERMOS_USO, POLITICA_PRIVACIDADE } = require('../config/governance');

const DEFAULT_COMMUNICATION_PREFERENCES = Object.freeze({
  portal: true,
  email: false,
  web_push: false,
  campanhas: true,
  inscricoes: true,
  ocorrencias: true,
  carteira_vacinal: true,
  operacional_essencial: true,
});

const EDITABLE_COMMUNICATION_KEYS = Object.freeze([
  'portal',
  'email',
  'web_push',
  'campanhas',
  'inscricoes',
  'ocorrencias',
  'carteira_vacinal',
]);

function sanitizeUser(user) {
  if (!user) return null;

  const { senha_hash, ...safeUser } = user;
  return safeUser;
}

function normalizeCpf(cpf) {
  if (!cpf) return null;
  return String(cpf).replace(/\D/g, '');
}

function normalizeCommunicationPreferences(input = {}, current = {}) {
  const next = {
    ...DEFAULT_COMMUNICATION_PREFERENCES,
    ...(current || {}),
  };

  EDITABLE_COMMUNICATION_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(input || {}, key)) {
      next[key] = Boolean(input[key]);
    }
  });

  next.operacional_essencial = true;

  if (!WEB_PUSH.enabled) {
    next.web_push = false;
  }

  return next;
}

function buildWebPushStatus(activeSubscriptions = 0) {
  return {
    enabled: WEB_PUSH.enabled,
    public_key: WEB_PUSH.enabled ? WEB_PUSH.publicKey : null,
    private_key_configured: WEB_PUSH.privateKeyConfigured,
    subscriptions_ativas: Number(activeSubscriptions) || 0,
    status: WEB_PUSH.enabled ? 'disponivel_para_opt_in' : 'preparado_dependente_configuracao',
    observacao: WEB_PUSH.enabled
      ? 'Base de assinatura disponivel mediante opt-in explicito do tutor.'
      : 'Web Push preparado, mas envio/assinatura dependem de configuracao institucional de chaves VAPID.',
  };
}

function getEndpointHash(endpoint) {
  return crypto.createHash('sha256').update(String(endpoint)).digest('hex');
}

function sanitizePushSubscription(row) {
  if (!row) return null;

  return {
    id: row.id,
    endpoint_hash: row.endpoint_hash,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    revoked_at: row.revoked_at,
  };
}

function assertValidPushSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') {
    const error = new Error('Assinatura Web Push invalida.');
    error.statusCode = 400;
    throw error;
  }

  if (!subscription.endpoint || typeof subscription.endpoint !== 'string') {
    const error = new Error('Endpoint Web Push obrigatorio.');
    error.statusCode = 400;
    throw error;
  }

  if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
    const error = new Error('Chaves da assinatura Web Push obrigatorias.');
    error.statusCode = 400;
    throw error;
  }
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: 'tutor',
      email: user.email,
      token_version: user.token_version || 0
    },
    JWT_SECRET,
    { expiresIn: JWT_EXTERNO_EXPIRES_IN }
  );
}

exports.register = async (data) => {
  assertPasswordPolicy(data.senha);

  const senhaHash = await bcrypt.hash(data.senha, 10);

  const query = `
    INSERT INTO usuarios_externos (
      nome,
      cpf,
      email,
      telefone,
      endereco,
      senha_hash,
      termo_uso_versao,
      termo_uso_aceito_em,
      politica_privacidade_versao,
      politica_privacidade_aceita_em,
      aceite_governanca_origem
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP, $9)
    RETURNING *;
  `;

  const values = [
    data.nome,
    normalizeCpf(data.cpf),
    data.email.toLowerCase(),
    data.telefone || null,
    data.endereco || null,
    senhaHash,
    data.termo_uso_versao || TERMOS_USO.versao,
    data.politica_privacidade_versao || POLITICA_PRIVACIDADE.versao,
    data.aceite_governanca_origem || 'portal_tutor'
  ];

  const result = await db.query(query, values);
  const user = sanitizeUser(result.rows[0]);

  return {
    user,
    token: createToken(user)
  };
};

exports.login = async ({ email, senha }) => {
  const result = await db.query(
    `
      SELECT *
      FROM usuarios_externos
      WHERE email = $1
        AND status = 'ativo';
    `,
    [email.toLowerCase()]
  );

  const user = result.rows[0];

  if (!user) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(senha, user.senha_hash);

  if (!passwordMatches) {
    return null;
  }

  const safeUser = sanitizeUser(user);

  return {
    user: safeUser,
    token: createToken(safeUser)
  };
};

exports.findById = async (id) => {
  const result = await db.query(
    `
      SELECT *
      FROM usuarios_externos
      WHERE id = $1
        AND status = 'ativo';
    `,
    [id]
  );

  return sanitizeUser(result.rows[0]);
};

exports.isTokenVersionValid = async (id, tokenVersion = 0) => {
  const result = await db.query(
    `
      SELECT token_version
      FROM usuarios_externos
      WHERE id = $1
        AND status = 'ativo';
    `,
    [id]
  );

  const current = result.rows[0];
  return Boolean(current && Number(current.token_version || 0) === Number(tokenVersion || 0));
};

exports.getCommunicationPreferences = async (usuarioId) => {
  const result = await db.query(
    `
      SELECT preferencias_comunicacao
      FROM usuarios_externos
      WHERE id = $1
        AND status = 'ativo';
    `,
    [usuarioId]
  );

  const usuario = result.rows[0];

  if (!usuario) {
    return null;
  }

  const subscriptionsResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM usuario_externo_push_subscriptions
      WHERE usuario_externo_id = $1
        AND status = 'ativa';
    `,
    [usuarioId]
  );

  return {
    preferencias: normalizeCommunicationPreferences({}, usuario.preferencias_comunicacao || {}),
    web_push: buildWebPushStatus(subscriptionsResult.rows[0]?.total || 0),
  };
};

exports.updateCommunicationPreferences = async (usuarioId, preferences = {}) => {
  const current = await exports.getCommunicationPreferences(usuarioId);

  if (!current) {
    return null;
  }

  const normalized = normalizeCommunicationPreferences(preferences, current.preferencias);
  const result = await db.query(
    `
      UPDATE usuarios_externos
      SET preferencias_comunicacao = $2::jsonb
      WHERE id = $1
        AND status = 'ativo'
      RETURNING preferencias_comunicacao;
    `,
    [usuarioId, JSON.stringify(normalized)]
  );

  const subscriptionsResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM usuario_externo_push_subscriptions
      WHERE usuario_externo_id = $1
        AND status = 'ativa';
    `,
    [usuarioId]
  );

  return {
    preferencias: normalizeCommunicationPreferences({}, result.rows[0]?.preferencias_comunicacao || normalized),
    web_push: buildWebPushStatus(subscriptionsResult.rows[0]?.total || 0),
  };
};

exports.savePushSubscription = async ({ usuarioId, subscription, userAgent }) => {
  if (!WEB_PUSH.enabled) {
    const error = new Error('Web Push ainda nao esta habilitado neste ambiente.');
    error.statusCode = 409;
    throw error;
  }

  assertValidPushSubscription(subscription);

  const endpointHash = getEndpointHash(subscription.endpoint);
  const result = await db.query(
    `
      INSERT INTO usuario_externo_push_subscriptions (
        usuario_externo_id,
        endpoint_hash,
        endpoint,
        subscription,
        user_agent,
        status,
        updated_at,
        revoked_at
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, 'ativa', CURRENT_TIMESTAMP, NULL)
      ON CONFLICT (usuario_externo_id, endpoint_hash)
      DO UPDATE SET
        endpoint = EXCLUDED.endpoint,
        subscription = EXCLUDED.subscription,
        user_agent = EXCLUDED.user_agent,
        status = 'ativa',
        updated_at = CURRENT_TIMESTAMP,
        revoked_at = NULL
      RETURNING *;
    `,
    [
      usuarioId,
      endpointHash,
      subscription.endpoint,
      JSON.stringify(subscription),
      String(userAgent || '').slice(0, 500) || null,
    ]
  );

  return sanitizePushSubscription(result.rows[0]);
};

exports.revokePushSubscription = async ({ usuarioId, endpoint }) => {
  const values = [usuarioId];
  let endpointFilter = '';

  if (endpoint) {
    values.push(getEndpointHash(endpoint));
    endpointFilter = 'AND endpoint_hash = $2';
  }

  const result = await db.query(
    `
      UPDATE usuario_externo_push_subscriptions
      SET
        status = 'revogada',
        revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE usuario_externo_id = $1
        AND status = 'ativa'
        ${endpointFilter}
      RETURNING *;
    `,
    values
  );

  return {
    revogadas: result.rowCount,
    assinaturas: result.rows.map(sanitizePushSubscription),
  };
};
