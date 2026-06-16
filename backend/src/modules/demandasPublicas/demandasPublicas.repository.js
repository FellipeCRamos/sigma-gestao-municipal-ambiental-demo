const db = require('../../config/db');

async function withTransaction(callback) {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getNextDemandId(client) {
  const result = await client.query(
    "SELECT nextval(pg_get_serial_sequence('sigma_demandas_publicas', 'id')) AS id;"
  );
  return Number(result.rows[0].id);
}

function buildProtocol(id, date = new Date()) {
  const year = date.getFullYear();
  return `SIGMA-DEN-${year}-${String(id).padStart(6, '0')}`;
}

async function createPublicDemand(client, payload) {
  const id = await getNextDemandId(client);
  const protocolo = buildProtocol(id);

  const result = await client.query(
    `
      INSERT INTO sigma_demandas_publicas (
        id,
        protocolo,
        categoria,
        subcategoria,
        descricao,
        endereco_referencia,
        bairro_localidade,
        ponto_referencia,
        identificacao_tipo,
        nome_comunicante,
        telefone_comunicante,
        email_comunicante,
        status,
        modulo_sugerido,
        modulo_responsavel,
        prioridade,
        origem,
        aceite_lgpd
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, 'recebida', $13, NULL, 'normal',
        'painel_publico_sigma', true
      )
      RETURNING *;
    `,
    [
      id,
      protocolo,
      payload.categoria,
      payload.subcategoria,
      payload.descricao,
      payload.endereco_referencia,
      payload.bairro_localidade,
      payload.ponto_referencia,
      payload.identificacao_tipo,
      payload.nome_comunicante,
      payload.telefone_comunicante,
      payload.email_comunicante,
      payload.modulo_sugerido,
    ]
  );

  return result.rows[0];
}

async function insertMovement(client, payload) {
  const result = await client.query(
    `
      INSERT INTO sigma_demandas_movimentacoes (
        demanda_id,
        status_anterior,
        status_novo,
        descricao,
        usuario_id,
        origem
      )
      VALUES ($1, $2, $3, $4, $5::integer, $6)
      RETURNING *;
    `,
    [
      payload.demanda_id,
      payload.status_anterior || null,
      payload.status_novo || null,
      payload.descricao,
      payload.usuario_id || null,
      payload.origem || 'area_interna_sigma',
    ]
  );

  return result.rows[0];
}

async function listDemands(filters) {
  const where = ['d.deleted_at IS NULL'];
  const params = [];

  if (filters.categoria) {
    params.push(filters.categoria);
    where.push(`d.categoria = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    where.push(`d.status = $${params.length}`);
  }

  if (filters.prioridade) {
    params.push(filters.prioridade);
    where.push(`d.prioridade = $${params.length}`);
  }

  if (filters.modulo_responsavel) {
    params.push(filters.modulo_responsavel);
    where.push(`d.modulo_responsavel = $${params.length}`);
  }

  if (filters.localidade) {
    params.push(`%${filters.localidade.toLowerCase()}%`);
    where.push(`LOWER(d.bairro_localidade) LIKE $${params.length}`);
  }

  if (filters.data_inicio) {
    params.push(filters.data_inicio);
    where.push(`d.data_recebimento >= $${params.length}::timestamp`);
  }

  if (filters.data_fim) {
    params.push(filters.data_fim);
    where.push(`d.data_recebimento <= $${params.length}::timestamp`);
  }

  if (filters.busca) {
    params.push(`%${filters.busca.toLowerCase()}%`);
    where.push(`(
      LOWER(d.protocolo) LIKE $${params.length}
      OR LOWER(d.descricao) LIKE $${params.length}
      OR LOWER(d.bairro_localidade) LIKE $${params.length}
      OR LOWER(d.endereco_referencia) LIKE $${params.length}
    )`);
  }

  const limit = filters.page_size;
  const offset = (filters.page - 1) * filters.page_size;
  params.push(limit);
  const limitParam = params.length;
  params.push(offset);
  const offsetParam = params.length;

  const [itemsResult, countResult] = await Promise.all([
    db.query(
      `
        SELECT
          d.id,
          d.protocolo,
          d.categoria,
          d.subcategoria,
          d.bairro_localidade,
          d.status,
          d.prioridade,
          d.modulo_sugerido,
          d.modulo_responsavel,
          d.responsavel_id,
          ui.nome AS responsavel_nome,
          d.identificacao_tipo,
          d.origem,
          d.data_recebimento,
          d.updated_at,
          d.data_encerramento
        FROM sigma_demandas_publicas d
        LEFT JOIN usuarios_internos ui ON ui.id = d.responsavel_id
        WHERE ${where.join(' AND ')}
        ORDER BY d.data_recebimento DESC, d.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      params
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM sigma_demandas_publicas d
        WHERE ${where.join(' AND ')};
      `,
      params.slice(0, -2)
    ),
  ]);

  return {
    items: itemsResult.rows,
    pagination: {
      page: filters.page,
      page_size: filters.page_size,
      total_items: countResult.rows[0]?.total || 0,
      total_pages: Math.max(1, Math.ceil((countResult.rows[0]?.total || 0) / filters.page_size)),
    },
  };
}

async function getDemandById(id, client = db, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      SELECT *
      FROM sigma_demandas_publicas
      WHERE id = $1
        AND deleted_at IS NULL
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function listMovements(demandId) {
  const result = await db.query(
    `
      SELECT
        m.*,
        ui.nome AS usuario_nome
      FROM sigma_demandas_movimentacoes m
      LEFT JOIN usuarios_internos ui ON ui.id = m.usuario_id
      WHERE m.demanda_id = $1
      ORDER BY m.created_at DESC, m.id DESC;
    `,
    [demandId]
  );

  return result.rows;
}

async function getDemandDetail(id) {
  const result = await db.query(
    `
      SELECT
        d.*,
        responsavel.nome AS responsavel_nome,
        encerrado_por.nome AS encerrado_por_nome
      FROM sigma_demandas_publicas d
      LEFT JOIN usuarios_internos responsavel ON responsavel.id = d.responsavel_id
      LEFT JOIN usuarios_internos encerrado_por ON encerrado_por.id = d.encerrado_por_id
      WHERE d.id = $1
        AND d.deleted_at IS NULL;
    `,
    [id]
  );
  const demanda = result.rows[0] || null;

  if (!demanda) {
    return null;
  }

  return {
    ...demanda,
    movimentacoes: await listMovements(id),
  };
}

async function updateDemandStatus(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE sigma_demandas_publicas
      SET
        status = $1,
        modulo_responsavel = COALESCE($2, modulo_responsavel),
        data_encerramento = CASE WHEN $4 THEN COALESCE(data_encerramento, CURRENT_TIMESTAMP) ELSE NULL END,
        motivo_encerramento = CASE WHEN $4 THEN $5 ELSE NULL END,
        encerrado_por_id = CASE WHEN $4 THEN $6::integer ELSE NULL::integer END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [
      payload.status,
      payload.modulo_responsavel,
      id,
      Boolean(payload.is_closing),
      payload.motivo_encerramento || null,
      payload.is_closing ? userId || null : null,
    ]
  );

  const updated = result.rows[0] || null;

  if (updated) {
    await insertMovement(client, {
      demanda_id: id,
      status_anterior: payload.status_anterior,
      status_novo: payload.status,
      descricao: payload.descricao,
      usuario_id: userId,
      origem: 'area_interna_sigma',
    });
  }

  return updated;
}

async function assignResponsible(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE sigma_demandas_publicas
      SET
        responsavel_id = $1::integer,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [payload.responsavel_id, id]
  );

  const updated = result.rows[0] || null;

  if (updated) {
    await insertMovement(client, {
      demanda_id: id,
      status_anterior: updated.status,
      status_novo: updated.status,
      descricao: payload.descricao || (
        payload.responsavel_id
          ? `Responsavel interno atribuido: usuario #${payload.responsavel_id}.`
          : 'Responsavel interno removido da demanda.'
      ),
      usuario_id: userId,
      origem: 'area_interna_sigma',
    });
  }

  return updated;
}

async function closeDemand(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE sigma_demandas_publicas
      SET
        status = $1,
        data_encerramento = CURRENT_TIMESTAMP,
        motivo_encerramento = $2,
        encerrado_por_id = $3::integer,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [payload.status, payload.justificativa, userId || null, id]
  );

  const updated = result.rows[0] || null;

  if (updated) {
    await insertMovement(client, {
      demanda_id: id,
      status_anterior: payload.status_anterior,
      status_novo: payload.status,
      descricao: payload.justificativa,
      usuario_id: userId,
      origem: 'area_interna_sigma',
    });
  }

  return updated;
}

module.exports = {
  db,
  withTransaction,
  createPublicDemand,
  insertMovement,
  listDemands,
  getDemandById,
  getDemandDetail,
  updateDemandStatus,
  assignResponsible,
  closeDemand,
};
