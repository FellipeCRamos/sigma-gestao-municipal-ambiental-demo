const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { PASSWORD_RESET_EXPIRES_MINUTES } = require('../config/env');
const auditService = require('./auditService');
const { assertPasswordPolicy } = require('./passwordPolicy');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getUserColumn(tipo) {
  return tipo === 'interno' ? 'usuario_interno_id' : 'usuario_externo_id';
}

function getUserTable(tipo) {
  return tipo === 'interno' ? 'usuarios_internos' : 'usuarios_externos';
}

async function findUserByEmail(tipo, email) {
  const table = getUserTable(tipo);
  const statusCondition = tipo === 'interno' ? "AND status = 'ativo'" : "AND status = 'ativo'";

  const result = await db.query(
    `
      SELECT id, email
      FROM ${table}
      WHERE email = $1
        ${statusCondition}
      LIMIT 1;
    `,
    [email.toLowerCase()]
  );

  return result.rows[0] || null;
}

exports.requestReset = async ({ tipo, email, req }) => {
  if (!['interno', 'externo'].includes(tipo)) {
    const error = new Error('Tipo de usuario invalido.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    const error = new Error('Informe o email.');
    error.statusCode = 400;
    throw error;
  }

  const user = await findUserByEmail(tipo, normalizedEmail);

  if (!user) {
    return { created: false };
  }

  const token = createResetToken();
  const tokenHash = hashToken(token);
  const userColumn = getUserColumn(tipo);
  const context = auditService.getContext(req);

  await db.query(
    `
      INSERT INTO password_reset_tokens (
        ${userColumn},
        token_hash,
        expires_at,
        requested_ip,
        requested_user_agent
      )
      VALUES ($1, $2, CURRENT_TIMESTAMP + ($3::int * INTERVAL '1 minute'), $4, $5);
    `,
    [
      user.id,
      tokenHash,
      PASSWORD_RESET_EXPIRES_MINUTES,
      context.ip,
      context.user_agent
    ]
  );

  await auditService.log({
    ator_tipo: tipo,
    ator_id: user.id,
    acao: 'solicitar_reset_senha',
    entidade: tipo === 'interno' ? 'usuarios_internos' : 'usuarios_externos',
    entidade_id: user.id,
    dados: { email: normalizedEmail },
    req
  });

  return {
    created: true,
    token,
    expires_in_minutes: PASSWORD_RESET_EXPIRES_MINUTES
  };
};

exports.resetPassword = async ({ tipo: expectedTipo = null, token, novaSenha, req }) => {
  const normalizedToken = String(token || '').trim();

  if (!normalizedToken) {
    const error = new Error('Token de redefinicao invalido.');
    error.statusCode = 400;
    throw error;
  }

  assertPasswordPolicy(novaSenha);

  const tokenHash = hashToken(normalizedToken);
  const senhaHash = await bcrypt.hash(novaSenha, 10);
  const context = auditService.getContext(req);
  const client = await db.connect();
  let auditPayload = null;

  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `
        SELECT *
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        FOR UPDATE;
      `,
      [tokenHash]
    );

    const reset = tokenResult.rows[0];

    if (!reset) {
      await client.query('ROLLBACK');
      return null;
    }

    const tipo = reset.usuario_interno_id ? 'interno' : 'externo';

    if (expectedTipo && tipo !== expectedTipo) {
      await client.query('ROLLBACK');
      return null;
    }

    const table = getUserTable(tipo);
    const userId = reset.usuario_interno_id || reset.usuario_externo_id;
    const beforeUserResult = await client.query(
      `
        SELECT id, email, status, token_version, senha_atualizada_em
        FROM ${table}
        WHERE id = $1;
      `,
      [userId]
    );
    const beforeUser = beforeUserResult.rows[0] || null;

    const afterUserResult = await client.query(
      `
        UPDATE ${table}
        SET
          senha_hash = $1,
          token_version = token_version + 1,
          senha_atualizada_em = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, email, status, token_version, senha_atualizada_em;
      `,
      [senhaHash, userId]
    );
    const afterUser = afterUserResult.rows[0] || null;

    await client.query(
      `
        UPDATE password_reset_tokens
        SET
          used_at = CURRENT_TIMESTAMP,
          used_ip = $1,
          used_user_agent = $2
        WHERE id = $3;
      `,
      [context.ip, context.user_agent, reset.id]
    );

    await client.query(
      `
        UPDATE password_reset_tokens
        SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP)
        WHERE id <> $1
          AND used_at IS NULL
          AND (
            usuario_interno_id = $2
            OR usuario_externo_id = $3
          );
      `,
      [
        reset.id,
        reset.usuario_interno_id || null,
        reset.usuario_externo_id || null
      ]
    );

    await client.query('COMMIT');
    auditPayload = { tipo, userId, beforeUser, afterUser, tokenId: reset.id };

    await auditService.logChange({
      ator_tipo: tipo,
      ator_id: userId,
      acao: 'redefinir_senha',
      entidade: tipo === 'interno' ? 'usuarios_internos' : 'usuarios_externos',
      entidade_id: userId,
      before: auditPayload.beforeUser,
      after: auditPayload.afterUser,
      dados: { token_id: reset.id },
      req
    });

    return { tipo, user_id: userId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
