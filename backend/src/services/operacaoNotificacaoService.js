const db = require('../config/db');

function normalizePayload(payload = {}) {
  return {
    usuario_interno_id: payload.usuario_interno_id,
    tipo: payload.tipo,
    titulo: payload.titulo,
    mensagem: payload.mensagem,
    tipo_item: payload.tipo_item || null,
    item_id: payload.item_id || null,
    dados: payload.dados || {},
  };
}

async function insertWithRunner(runner, payload) {
  const data = normalizePayload(payload);

  if (!data.usuario_interno_id) {
    return null;
  }

  const result = await runner.query(
    `
      INSERT INTO operacao_notificacoes (
        usuario_interno_id,
        tipo,
        titulo,
        mensagem,
        tipo_item,
        item_id,
        dados
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *;
    `,
    [
      data.usuario_interno_id,
      data.tipo,
      data.titulo,
      data.mensagem,
      data.tipo_item,
      data.item_id,
      JSON.stringify(data.dados),
    ]
  );

  return result.rows[0] || null;
}

exports.createWithClient = async (client, payload) => insertWithRunner(client, payload);

exports.create = async (payload) => insertWithRunner(db, payload);

exports.createOncePerDay = async (payload) => {
  const data = normalizePayload(payload);

  if (!data.usuario_interno_id || !data.tipo_item || !data.item_id) {
    return null;
  }

  const existing = await db.query(
    `
      SELECT id
      FROM operacao_notificacoes
      WHERE usuario_interno_id = $1
        AND tipo = $2
        AND tipo_item = $3
        AND item_id = $4
        AND created_at::date = CURRENT_DATE
      LIMIT 1;
    `,
    [data.usuario_interno_id, data.tipo, data.tipo_item, data.item_id]
  );

  if (existing.rows[0]) {
    return null;
  }

  return insertWithRunner(db, data);
};

exports.findByUsuario = async (usuarioInternoId) => {
  const result = await db.query(
    `
      SELECT *
      FROM operacao_notificacoes
      WHERE usuario_interno_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 100;
    `,
    [usuarioInternoId]
  );

  return result.rows;
};
