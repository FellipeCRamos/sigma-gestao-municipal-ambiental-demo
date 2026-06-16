const crypto = require('crypto');
const db = require('../config/db');
const publicoService = require('./publicoService');
const auditService = require('./auditService');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

exports.createParceiro = async ({ nome, descricao, escopos, expires_at }, actor, req = null) => {
  const token = `sigba_${crypto.randomBytes(24).toString('hex')}`;
  const tokenHash = hashToken(token);

  const result = await db.query(
    `
      INSERT INTO parceiro_integracoes (
        nome,
        descricao,
        token_hash,
        escopos,
        created_by_interno_id,
        expires_at
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
      RETURNING id, nome, descricao, escopos, status, expires_at, created_at;
    `,
    [
      nome,
      descricao || null,
      tokenHash,
      JSON.stringify(Array.isArray(escopos) ? escopos : ['indicadores', 'animais_publicos']),
      actor?.id || null,
      expires_at || null
    ]
  );

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor?.id || null,
    acao: 'criar_parceiro_integracao',
    entidade: 'parceiro_integracoes',
    entidade_id: result.rows[0].id,
    before: null,
    after: result.rows[0],
    dados: {
      nome,
      escopos: Array.isArray(escopos) ? escopos : ['indicadores', 'animais_publicos'],
      expires_at: expires_at || null
    },
    req
  });

  return {
    parceiro: result.rows[0],
    token
  };
};

exports.findParceiros = async () => {
  const result = await db.query(`
    SELECT
      id,
      nome,
      descricao,
      escopos,
      status,
      expires_at,
      last_used_at,
      revoked_at,
      rotated_at,
      created_at,
      updated_at
    FROM parceiro_integracoes
    ORDER BY id DESC;
  `);

  return result.rows;
};

exports.authenticate = async (token) => {
  if (!token) return null;

  const result = await db.query(
    `
      SELECT id, nome, escopos, status
      FROM parceiro_integracoes
      WHERE token_hash = $1
        AND status = 'ativo'
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
    `,
    [hashToken(token)]
  );

  const parceiro = result.rows[0] || null;

  if (parceiro) {
    await db.query(
      `
        UPDATE parceiro_integracoes
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [parceiro.id]
    );
  }

  return parceiro;
};

exports.logRequest = async ({ parceiroId, endpoint, metodo, statusCode }) => {
  await db.query(
    `
      INSERT INTO integracao_logs (
        parceiro_id,
        endpoint,
        metodo,
        status_code
      )
      VALUES ($1, $2, $3, $4);
    `,
    [parceiroId || null, endpoint, metodo, statusCode || null]
  );
};

exports.getIndicadoresParceiro = async () => {
  return publicoService.getIndicadoresPublicos();
};

exports.getAnimalParceiro = async (publicId) => {
  return publicoService.getAnimalPublico(publicId);
};

exports.revokeParceiro = async (id, actor, req = null) => {
  const beforeResult = await db.query(
    `
      SELECT id, nome, descricao, escopos, status, expires_at, last_used_at, revoked_at, rotated_at, created_at, updated_at
      FROM parceiro_integracoes
      WHERE id = $1;
    `,
    [id]
  );
  const before = beforeResult.rows[0] || null;

  const result = await db.query(
    `
      UPDATE parceiro_integracoes
      SET
        status = 'revogado',
        revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
        revoked_by_interno_id = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, nome, descricao, escopos, status, expires_at, last_used_at, revoked_at, rotated_at, created_at, updated_at;
    `,
    [actor?.id || null, id]
  );

  const parceiro = result.rows[0] || null;

  if (parceiro) {
    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: actor?.id || null,
      acao: 'revogar_token_parceiro',
      entidade: 'parceiro_integracoes',
      entidade_id: parceiro.id,
      before,
      after: parceiro,
      dados: { nome: parceiro.nome },
      req
    });
  }

  return parceiro;
};

exports.rotateParceiro = async (id, actor, req = null) => {
  const token = `sigba_${crypto.randomBytes(24).toString('hex')}`;
  const tokenHash = hashToken(token);
  const beforeResult = await db.query(
    `
      SELECT id, nome, descricao, escopos, status, expires_at, last_used_at, revoked_at, rotated_at, created_at, updated_at
      FROM parceiro_integracoes
      WHERE id = $1;
    `,
    [id]
  );
  const before = beforeResult.rows[0] || null;

  const result = await db.query(
    `
      UPDATE parceiro_integracoes
      SET
        token_hash = $1,
        rotated_at = CURRENT_TIMESTAMP,
        rotated_by_interno_id = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND status = 'ativo'
        AND revoked_at IS NULL
      RETURNING id, nome, descricao, escopos, status, expires_at, last_used_at, revoked_at, rotated_at, created_at, updated_at;
    `,
    [tokenHash, actor?.id || null, id]
  );

  const parceiro = result.rows[0] || null;

  if (parceiro) {
    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: actor?.id || null,
      acao: 'rotacionar_token_parceiro',
      entidade: 'parceiro_integracoes',
      entidade_id: parceiro.id,
      before,
      after: parceiro,
      dados: { nome: parceiro.nome },
      req
    });
  }

  return parceiro ? { parceiro, token } : null;
};
