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

async function getNextFiscalizacaoId(client) {
  const result = await client.query(
    "SELECT nextval(pg_get_serial_sequence('fiscalizacoes_ambientais', 'id')) AS id;"
  );
  return Number(result.rows[0].id);
}

function buildProtocol(id, date = new Date()) {
  const year = date.getFullYear();
  return `SIGMA-FISC-${year}-${String(id).padStart(6, '0')}`;
}

function baseSelect() {
  return `
    SELECT
      f.*,
      responsavel.nome AS responsavel_nome,
      criado_por.nome AS criado_por_nome,
      encerrado_por.nome AS encerrado_por_nome
    FROM fiscalizacoes_ambientais f
    LEFT JOIN usuarios_internos responsavel ON responsavel.id = f.responsavel_id
    LEFT JOIN usuarios_internos criado_por ON criado_por.id = f.criado_por_id
    LEFT JOIN usuarios_internos encerrado_por ON encerrado_por.id = f.encerrado_por_id
  `;
}

async function createFiscalizacaoFromDemand(client, demand, payload, userId) {
  const id = await getNextFiscalizacaoId(client);
  const protocoloFiscalizacao = buildProtocol(id);
  const assunto = [demand.categoria, demand.subcategoria].filter(Boolean).join(' / ');

  const result = await client.query(
    `
      INSERT INTO fiscalizacoes_ambientais (
        id,
        protocolo_fiscalizacao,
        demanda_publica_id,
        protocolo_demanda,
        categoria,
        subcategoria,
        assunto,
        descricao_resumida,
        localidade,
        endereco_referencia,
        ponto_referencia,
        status,
        prioridade,
        responsavel_id,
        criado_por_id,
        justificativa_conversao,
        observacoes_internas
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, 'aberta', $12, $13::integer, $14::integer, $15, $16
      )
      RETURNING *;
    `,
    [
      id,
      protocoloFiscalizacao,
      demand.id,
      demand.protocolo,
      demand.categoria,
      demand.subcategoria,
      assunto || null,
      demand.descricao,
      demand.bairro_localidade,
      demand.endereco_referencia,
      demand.ponto_referencia,
      demand.prioridade || 'normal',
      payload.responsavel_id || demand.responsavel_id || null,
      userId || null,
      payload.justificativa_conversao,
      payload.observacoes_internas || null,
    ]
  );

  return result.rows[0];
}

async function insertMovement(client, payload) {
  const result = await client.query(
    `
      INSERT INTO fiscalizacoes_ambientais_movimentacoes (
        fiscalizacao_id,
        tipo,
        status_anterior,
        status_novo,
        descricao,
        usuario_id,
        origem,
        dados
      )
      VALUES ($1, $2, $3, $4, $5, $6::integer, $7, $8::jsonb)
      RETURNING *;
    `,
    [
      payload.fiscalizacao_id,
      payload.tipo || 'movimentacao',
      payload.status_anterior || null,
      payload.status_novo || null,
      payload.descricao,
      payload.usuario_id || null,
      payload.origem || 'area_interna_sigma',
      JSON.stringify(payload.dados || {}),
    ]
  );

  return result.rows[0];
}

async function findByDemandId(demandId, client = db, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      ${baseSelect()}
      WHERE f.demanda_publica_id = $1
        AND f.deleted_at IS NULL
      ${forUpdate ? 'FOR UPDATE OF f' : ''}
      LIMIT 1;
    `,
    [demandId]
  );

  return result.rows[0] || null;
}

async function listFiscalizacoes(filters) {
  const where = ['f.deleted_at IS NULL'];
  const params = [];

  if (filters.protocolo) {
    params.push(`%${filters.protocolo.toUpperCase()}%`);
    where.push(`(
      UPPER(f.protocolo_fiscalizacao) LIKE $${params.length}
      OR UPPER(f.protocolo_demanda) LIKE $${params.length}
    )`);
  }

  if (filters.status) {
    params.push(filters.status);
    where.push(`f.status = $${params.length}`);
  }

  if (filters.categoria) {
    params.push(filters.categoria);
    where.push(`f.categoria = $${params.length}`);
  }

  if (filters.prioridade) {
    params.push(filters.prioridade);
    where.push(`f.prioridade = $${params.length}`);
  }

  if (filters.responsavel_id) {
    params.push(filters.responsavel_id);
    where.push(`f.responsavel_id = $${params.length}`);
  }

  if (filters.demanda_publica_id) {
    params.push(filters.demanda_publica_id);
    where.push(`f.demanda_publica_id = $${params.length}`);
  }

  if (filters.data_inicio) {
    params.push(filters.data_inicio);
    where.push(`f.created_at >= $${params.length}::timestamp`);
  }

  if (filters.data_fim) {
    params.push(filters.data_fim);
    where.push(`f.created_at <= $${params.length}::timestamp`);
  }

  if (filters.busca) {
    params.push(`%${filters.busca.toLowerCase()}%`);
    where.push(`(
      LOWER(f.protocolo_fiscalizacao) LIKE $${params.length}
      OR LOWER(f.protocolo_demanda) LIKE $${params.length}
      OR LOWER(f.assunto) LIKE $${params.length}
      OR LOWER(f.localidade) LIKE $${params.length}
      OR LOWER(f.endereco_referencia) LIKE $${params.length}
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
          f.id,
          f.protocolo_fiscalizacao,
          f.demanda_publica_id,
          f.protocolo_demanda,
          f.categoria,
          f.subcategoria,
          f.assunto,
          f.localidade,
          f.status,
          f.prioridade,
          f.responsavel_id,
          responsavel.nome AS responsavel_nome,
          f.created_at,
          f.updated_at,
          f.data_conversao,
          f.data_encerramento_preliminar
        FROM fiscalizacoes_ambientais f
        LEFT JOIN usuarios_internos responsavel ON responsavel.id = f.responsavel_id
        WHERE ${where.join(' AND ')}
        ORDER BY f.created_at DESC, f.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      params
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM fiscalizacoes_ambientais f
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

async function listMovements(fiscalizacaoId) {
  const result = await db.query(
    `
      SELECT
        m.*,
        ui.nome AS usuario_nome
      FROM fiscalizacoes_ambientais_movimentacoes m
      LEFT JOIN usuarios_internos ui ON ui.id = m.usuario_id
      WHERE m.fiscalizacao_id = $1
      ORDER BY m.created_at DESC, m.id DESC;
    `,
    [fiscalizacaoId]
  );

  return result.rows;
}

async function getFiscalizacaoById(id, client = db, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      ${baseSelect()}
      WHERE f.id = $1
        AND f.deleted_at IS NULL
      ${forUpdate ? 'FOR UPDATE OF f' : ''};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getFiscalizacaoDetail(id) {
  const fiscalizacao = await getFiscalizacaoById(id);

  if (!fiscalizacao) {
    return null;
  }

  const demandResult = await db.query(
    `
      SELECT
        id,
        protocolo,
        categoria,
        subcategoria,
        status,
        prioridade,
        modulo_responsavel,
        data_recebimento
      FROM sigma_demandas_publicas
      WHERE id = $1
        AND deleted_at IS NULL;
    `,
    [fiscalizacao.demanda_publica_id]
  );

  return {
    ...fiscalizacao,
    demanda_origem: demandResult.rows[0] || null,
    movimentacoes: await listMovements(id),
  };
}

async function updateStatus(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE fiscalizacoes_ambientais
      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [payload.status, id]
  );

  const updated = result.rows[0] || null;

  if (updated) {
    await insertMovement(client, {
      fiscalizacao_id: id,
      tipo: 'status',
      status_anterior: payload.status_anterior,
      status_novo: payload.status,
      descricao: payload.descricao,
      usuario_id: userId,
      dados: {
        status_anterior: payload.status_anterior,
        status_novo: payload.status,
      },
    });
  }

  return updated;
}

async function assignResponsible(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE fiscalizacoes_ambientais
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
      fiscalizacao_id: id,
      tipo: 'responsavel',
      status_anterior: updated.status,
      status_novo: updated.status,
      descricao: payload.descricao || (
        payload.responsavel_id
          ? `Responsavel interno atribuido: usuario #${payload.responsavel_id}.`
          : 'Responsavel interno removido da fiscalizacao.'
      ),
      usuario_id: userId,
      dados: {
        responsavel_id: payload.responsavel_id,
      },
    });
  }

  return updated;
}

async function closePreliminarily(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE fiscalizacoes_ambientais
      SET
        status = $1,
        data_encerramento_preliminar = CURRENT_TIMESTAMP,
        encerrado_por_id = $2::integer,
        justificativa_encerramento_preliminar = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [payload.status, userId || null, payload.justificativa_encerramento_preliminar, id]
  );

  const updated = result.rows[0] || null;

  if (updated) {
    await insertMovement(client, {
      fiscalizacao_id: id,
      tipo: 'encerramento_preliminar',
      status_anterior: payload.status_anterior,
      status_novo: payload.status,
      descricao: payload.justificativa_encerramento_preliminar,
      usuario_id: userId,
    });
  }

  return updated;
}

module.exports = {
  db,
  withTransaction,
  buildProtocol,
  createFiscalizacaoFromDemand,
  insertMovement,
  findByDemandId,
  listFiscalizacoes,
  getFiscalizacaoById,
  getFiscalizacaoDetail,
  updateStatus,
  assignResponsible,
  closePreliminarily,
};
