const db = require('../config/db');

function normalizePayload(payload = {}) {
  return {
    tipo_item: payload.tipo_item,
    item_id: payload.item_id,
    evento: payload.evento,
    status_anterior: payload.status_anterior || null,
    status_novo: payload.status_novo || null,
    responsavel_anterior_id: payload.responsavel_anterior_id || null,
    responsavel_novo_id: payload.responsavel_novo_id || null,
    prazo_anterior: payload.prazo_anterior || null,
    prazo_novo: payload.prazo_novo || null,
    pendencia_aberta: payload.pendencia_aberta ?? null,
    observacao: payload.observacao || null,
    dados: payload.dados || {},
    created_by_interno_id: payload.created_by_interno_id || null,
  };
}

async function insertWithRunner(runner, payload) {
  const data = normalizePayload(payload);

  await runner.query(
    `
      INSERT INTO operacao_historico (
        tipo_item,
        item_id,
        evento,
        status_anterior,
        status_novo,
        responsavel_anterior_id,
        responsavel_novo_id,
        prazo_anterior,
        prazo_novo,
        pendencia_aberta,
        observacao,
        dados,
        created_by_interno_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13);
    `,
    [
      data.tipo_item,
      data.item_id,
      data.evento,
      data.status_anterior,
      data.status_novo,
      data.responsavel_anterior_id,
      data.responsavel_novo_id,
      data.prazo_anterior,
      data.prazo_novo,
      data.pendencia_aberta,
      data.observacao,
      JSON.stringify(data.dados),
      data.created_by_interno_id,
    ]
  );
}

exports.logWithClient = async (client, payload) => insertWithRunner(client, payload);

exports.log = async (payload) => insertWithRunner(db, payload);

exports.findByItem = async (tipoItem, itemId) => {
  const result = await db.query(
    `
      SELECT
        h.*,
        u.nome AS created_by_nome,
        ra.nome AS responsavel_anterior_nome,
        rn.nome AS responsavel_novo_nome
      FROM operacao_historico h
      LEFT JOIN usuarios_internos u ON u.id = h.created_by_interno_id
      LEFT JOIN usuarios_internos ra ON ra.id = h.responsavel_anterior_id
      LEFT JOIN usuarios_internos rn ON rn.id = h.responsavel_novo_id
      WHERE h.tipo_item = $1
        AND h.item_id = $2
      ORDER BY h.created_at DESC, h.id DESC;
    `,
    [tipoItem, itemId]
  );

  return result.rows;
};
