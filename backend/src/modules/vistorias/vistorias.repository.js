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

async function getNextVistoriaId(client) {
  const result = await client.query(
    "SELECT nextval(pg_get_serial_sequence('fiscalizacao_vistorias', 'id')) AS id;"
  );
  return Number(result.rows[0].id);
}

async function getNextRelatorioId(client) {
  const result = await client.query(
    "SELECT nextval(pg_get_serial_sequence('fiscalizacao_relatorios_preliminares', 'id')) AS id;"
  );
  return Number(result.rows[0].id);
}

function buildVistoriaProtocol(id, date = new Date()) {
  return `SIGMA-VIST-${date.getFullYear()}-${String(id).padStart(6, '0')}`;
}

function buildRelatorioProtocol(id, date = new Date()) {
  return `SIGMA-REL-${date.getFullYear()}-${String(id).padStart(6, '0')}`;
}

function vistoriaBaseSelect() {
  return `
    SELECT
      v.*,
      f.protocolo_demanda,
      f.status AS fiscalizacao_status,
      f.categoria,
      f.subcategoria,
      f.assunto,
      responsavel.nome AS responsavel_nome,
      criado_por.nome AS criado_por_nome,
      cancelado_por.nome AS cancelado_por_nome
    FROM fiscalizacao_vistorias v
    INNER JOIN fiscalizacoes_ambientais f ON f.id = v.fiscalizacao_id
    LEFT JOIN usuarios_internos responsavel ON responsavel.id = v.responsavel_id
    LEFT JOIN usuarios_internos criado_por ON criado_por.id = v.criado_por_id
    LEFT JOIN usuarios_internos cancelado_por ON cancelado_por.id = v.cancelado_por_id
  `;
}

function relatorioBaseSelect() {
  return `
    SELECT
      r.*,
      v.protocolo_vistoria,
      v.demanda_publica_id,
      v.protocolo_fiscalizacao,
      elaborado_por.nome AS elaborado_por_nome,
      revisado_por.nome AS revisado_por_nome,
      aprovado_por.nome AS aprovado_por_nome
    FROM fiscalizacao_relatorios_preliminares r
    INNER JOIN fiscalizacao_vistorias v ON v.id = r.vistoria_id
    LEFT JOIN usuarios_internos elaborado_por ON elaborado_por.id = r.elaborado_por_id
    LEFT JOIN usuarios_internos revisado_por ON revisado_por.id = r.revisado_por_id
    LEFT JOIN usuarios_internos aprovado_por ON aprovado_por.id = r.aprovado_por_id
  `;
}

async function createVistoria(client, fiscalizacao, payload, userId) {
  const id = await getNextVistoriaId(client);
  const protocoloVistoria = buildVistoriaProtocol(id);

  const result = await client.query(
    `
      INSERT INTO fiscalizacao_vistorias (
        id,
        protocolo_vistoria,
        fiscalizacao_id,
        protocolo_fiscalizacao,
        demanda_publica_id,
        tipo_vistoria,
        finalidade,
        status,
        prioridade,
        data_planejada,
        localidade,
        endereco_referencia,
        coordenadas,
        equipe_responsavel,
        responsavel_id,
        criado_por_id,
        objetivo,
        metodologia_resumida,
        observacoes_internas
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'planejada', $8, $9::timestamp,
        $10, $11, $12::jsonb, $13, $14::integer, $15::integer, $16, $17, $18
      )
      RETURNING *;
    `,
    [
      id,
      protocoloVistoria,
      fiscalizacao.id,
      fiscalizacao.protocolo_fiscalizacao,
      fiscalizacao.demanda_publica_id || null,
      payload.tipo_vistoria,
      payload.finalidade,
      payload.prioridade,
      payload.data_planejada,
      fiscalizacao.localidade || null,
      fiscalizacao.endereco_referencia || null,
      JSON.stringify(fiscalizacao.coordenadas || null),
      payload.equipe_responsavel,
      payload.responsavel_id || fiscalizacao.responsavel_id || null,
      userId || null,
      payload.objetivo,
      payload.metodologia_resumida,
      payload.observacoes_internas,
    ]
  );

  return result.rows[0];
}

async function insertVistoriaMovement(client, payload) {
  const result = await client.query(
    `
      INSERT INTO fiscalizacao_vistorias_movimentacoes (
        vistoria_id,
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
      payload.vistoria_id,
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

async function listVistorias(filters) {
  const where = ['v.deleted_at IS NULL'];
  const params = [];

  if (filters.protocolo) {
    params.push(`%${filters.protocolo.toUpperCase()}%`);
    where.push(`(
      UPPER(v.protocolo_vistoria) LIKE $${params.length}
      OR UPPER(v.protocolo_fiscalizacao) LIKE $${params.length}
      OR UPPER(f.protocolo_demanda) LIKE $${params.length}
    )`);
  }

  if (filters.status) {
    params.push(filters.status);
    where.push(`v.status = $${params.length}`);
  }

  if (filters.prioridade) {
    params.push(filters.prioridade);
    where.push(`v.prioridade = $${params.length}`);
  }

  if (filters.fiscalizacao_id) {
    params.push(filters.fiscalizacao_id);
    where.push(`v.fiscalizacao_id = $${params.length}`);
  }

  if (filters.responsavel_id) {
    params.push(filters.responsavel_id);
    where.push(`v.responsavel_id = $${params.length}`);
  }

  if (filters.localidade) {
    params.push(`%${filters.localidade.toLowerCase()}%`);
    where.push(`LOWER(v.localidade) LIKE $${params.length}`);
  }

  if (filters.data_inicio) {
    params.push(filters.data_inicio);
    where.push(`v.created_at >= $${params.length}::timestamp`);
  }

  if (filters.data_fim) {
    params.push(filters.data_fim);
    where.push(`v.created_at <= $${params.length}::timestamp`);
  }

  if (filters.busca) {
    params.push(`%${filters.busca.toLowerCase()}%`);
    where.push(`(
      LOWER(v.protocolo_vistoria) LIKE $${params.length}
      OR LOWER(v.protocolo_fiscalizacao) LIKE $${params.length}
      OR LOWER(v.finalidade) LIKE $${params.length}
      OR LOWER(v.localidade) LIKE $${params.length}
      OR LOWER(v.endereco_referencia) LIKE $${params.length}
      OR LOWER(v.objetivo) LIKE $${params.length}
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
          v.id,
          v.protocolo_vistoria,
          v.fiscalizacao_id,
          v.protocolo_fiscalizacao,
          v.demanda_publica_id,
          f.protocolo_demanda,
          f.categoria,
          f.subcategoria,
          v.tipo_vistoria,
          v.finalidade,
          v.status,
          v.prioridade,
          v.data_planejada,
          v.data_realizada,
          v.localidade,
          v.responsavel_id,
          responsavel.nome AS responsavel_nome,
          v.created_at,
          v.updated_at,
          rel.id AS relatorio_id,
          rel.protocolo_relatorio,
          rel.status AS relatorio_status
        FROM fiscalizacao_vistorias v
        INNER JOIN fiscalizacoes_ambientais f ON f.id = v.fiscalizacao_id
        LEFT JOIN usuarios_internos responsavel ON responsavel.id = v.responsavel_id
        LEFT JOIN LATERAL (
          SELECT id, protocolo_relatorio, status
          FROM fiscalizacao_relatorios_preliminares r
          WHERE r.vistoria_id = v.id
            AND r.deleted_at IS NULL
          ORDER BY r.created_at DESC, r.id DESC
          LIMIT 1
        ) rel ON TRUE
        WHERE ${where.join(' AND ')}
        ORDER BY v.created_at DESC, v.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      params
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM fiscalizacao_vistorias v
        INNER JOIN fiscalizacoes_ambientais f ON f.id = v.fiscalizacao_id
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

async function listVistoriasByFiscalizacao(fiscalizacaoId) {
  const result = await db.query(
    `
      SELECT
        v.id,
        v.protocolo_vistoria,
        v.fiscalizacao_id,
        v.status,
        v.prioridade,
        v.finalidade,
        v.data_planejada,
        v.data_realizada,
        v.responsavel_id,
        ui.nome AS responsavel_nome,
        v.created_at,
        rel.id AS relatorio_id,
        rel.protocolo_relatorio,
        rel.status AS relatorio_status
      FROM fiscalizacao_vistorias v
      LEFT JOIN usuarios_internos ui ON ui.id = v.responsavel_id
      LEFT JOIN LATERAL (
        SELECT id, protocolo_relatorio, status
        FROM fiscalizacao_relatorios_preliminares r
        WHERE r.vistoria_id = v.id
          AND r.deleted_at IS NULL
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT 1
      ) rel ON TRUE
      WHERE v.fiscalizacao_id = $1
        AND v.deleted_at IS NULL
      ORDER BY v.created_at DESC, v.id DESC;
    `,
    [fiscalizacaoId]
  );

  return result.rows;
}

async function listVistoriaMovements(vistoriaId) {
  const result = await db.query(
    `
      SELECT
        m.*,
        ui.nome AS usuario_nome
      FROM fiscalizacao_vistorias_movimentacoes m
      LEFT JOIN usuarios_internos ui ON ui.id = m.usuario_id
      WHERE m.vistoria_id = $1
      ORDER BY m.created_at DESC, m.id DESC;
    `,
    [vistoriaId]
  );

  return result.rows;
}

async function getVistoriaById(id, client = db, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      ${vistoriaBaseSelect()}
      WHERE v.id = $1
        AND v.deleted_at IS NULL
      ${forUpdate ? 'FOR UPDATE OF v' : ''};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getVistoriaDetail(id) {
  const vistoria = await getVistoriaById(id);

  if (!vistoria) {
    return null;
  }

  const relatorios = await listRelatorios({ vistoria_id: id, page: 1, page_size: 20 });

  return {
    ...vistoria,
    relatorios: relatorios.items,
    movimentacoes: await listVistoriaMovements(id),
  };
}

async function updateVistoriaStatus(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE fiscalizacao_vistorias
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
    await insertVistoriaMovement(client, {
      vistoria_id: id,
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

async function assignVistoriaResponsible(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE fiscalizacao_vistorias
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
    await insertVistoriaMovement(client, {
      vistoria_id: id,
      tipo: 'responsavel',
      status_anterior: updated.status,
      status_novo: updated.status,
      descricao: payload.descricao || (
        payload.responsavel_id
          ? `Responsavel interno atribuido: usuario #${payload.responsavel_id}.`
          : 'Responsavel interno removido da vistoria.'
      ),
      usuario_id: userId,
      dados: {
        responsavel_id: payload.responsavel_id,
      },
    });
  }

  return updated;
}

async function registerVistoriaRealizacao(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE fiscalizacao_vistorias
      SET
        status = 'realizada',
        data_realizada = $1::timestamp,
        objetivo = COALESCE($2, objetivo),
        metodologia_resumida = COALESCE($3, metodologia_resumida),
        constatacoes = COALESCE($4, constatacoes),
        evidencias_observadas = COALESCE($5, evidencias_observadas),
        riscos_identificados = COALESCE($6, riscos_identificados),
        providencias_recomendadas = COALESCE($7, providencias_recomendadas),
        observacoes_internas = COALESCE($8, observacoes_internas),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [
      payload.data_realizada,
      payload.objetivo,
      payload.metodologia_resumida,
      payload.constatacoes,
      payload.evidencias_observadas,
      payload.riscos_identificados,
      payload.providencias_recomendadas,
      payload.observacoes_internas,
      id,
    ]
  );

  const updated = result.rows[0] || null;

  if (updated) {
    await insertVistoriaMovement(client, {
      vistoria_id: id,
      tipo: 'realizacao',
      status_anterior: payload.status_anterior,
      status_novo: 'realizada',
      descricao: payload.constatacoes || payload.objetivo || 'Vistoria realizada e registrada internamente.',
      usuario_id: userId,
      dados: {
        data_realizada: payload.data_realizada,
      },
    });
  }

  return updated;
}

async function cancelVistoria(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE fiscalizacao_vistorias
      SET
        status = 'cancelada',
        data_cancelamento = CURRENT_TIMESTAMP,
        cancelado_por_id = $1::integer,
        justificativa_cancelamento = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [userId || null, payload.justificativa_cancelamento, id]
  );

  const updated = result.rows[0] || null;

  if (updated) {
    await insertVistoriaMovement(client, {
      vistoria_id: id,
      tipo: 'cancelamento',
      status_anterior: payload.status_anterior,
      status_novo: 'cancelada',
      descricao: payload.justificativa_cancelamento,
      usuario_id: userId,
    });
  }

  return updated;
}

async function createRelatorio(client, vistoria, payload, userId) {
  const id = await getNextRelatorioId(client);
  const protocoloRelatorio = buildRelatorioProtocol(id);

  const result = await client.query(
    `
      INSERT INTO fiscalizacao_relatorios_preliminares (
        id,
        protocolo_relatorio,
        vistoria_id,
        fiscalizacao_id,
        tipo_relatorio,
        status,
        elaborado_por_id,
        introducao,
        historico,
        caracterizacao_area,
        caracterizacao_demanda,
        metodologia,
        constatacoes_tecnicas,
        analise_tecnica_preliminar,
        registros_fotograficos_descricao,
        conclusao_preliminar,
        recomendacoes,
        encaminhamentos_sugeridos,
        limitacoes,
        observacoes_internas
      )
      VALUES (
        $1, $2, $3, $4, $5, 'rascunho', $6::integer, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING *;
    `,
    [
      id,
      protocoloRelatorio,
      vistoria.id,
      vistoria.fiscalizacao_id,
      payload.tipo_relatorio,
      userId || null,
      payload.introducao,
      payload.historico,
      payload.caracterizacao_area,
      payload.caracterizacao_demanda,
      payload.metodologia,
      payload.constatacoes_tecnicas,
      payload.analise_tecnica_preliminar,
      payload.registros_fotograficos_descricao,
      payload.conclusao_preliminar,
      payload.recomendacoes,
      payload.encaminhamentos_sugeridos,
      payload.limitacoes,
      payload.observacoes_internas,
    ]
  );

  return result.rows[0];
}

async function insertRelatorioMovement(client, payload) {
  const result = await client.query(
    `
      INSERT INTO fiscalizacao_relatorios_movimentacoes (
        relatorio_id,
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
      payload.relatorio_id,
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

async function listRelatorios(filters) {
  const where = ['r.deleted_at IS NULL'];
  const params = [];

  if (filters.protocolo) {
    params.push(`%${filters.protocolo.toUpperCase()}%`);
    where.push(`(
      UPPER(r.protocolo_relatorio) LIKE $${params.length}
      OR UPPER(v.protocolo_vistoria) LIKE $${params.length}
      OR UPPER(v.protocolo_fiscalizacao) LIKE $${params.length}
    )`);
  }

  if (filters.status) {
    params.push(filters.status);
    where.push(`r.status = $${params.length}`);
  }

  if (filters.vistoria_id) {
    params.push(filters.vistoria_id);
    where.push(`r.vistoria_id = $${params.length}`);
  }

  if (filters.fiscalizacao_id) {
    params.push(filters.fiscalizacao_id);
    where.push(`r.fiscalizacao_id = $${params.length}`);
  }

  if (filters.elaborado_por_id) {
    params.push(filters.elaborado_por_id);
    where.push(`r.elaborado_por_id = $${params.length}`);
  }

  if (filters.data_inicio) {
    params.push(filters.data_inicio);
    where.push(`r.created_at >= $${params.length}::timestamp`);
  }

  if (filters.data_fim) {
    params.push(filters.data_fim);
    where.push(`r.created_at <= $${params.length}::timestamp`);
  }

  if (filters.busca) {
    params.push(`%${filters.busca.toLowerCase()}%`);
    where.push(`(
      LOWER(r.protocolo_relatorio) LIKE $${params.length}
      OR LOWER(r.constatacoes_tecnicas) LIKE $${params.length}
      OR LOWER(r.conclusao_preliminar) LIKE $${params.length}
      OR LOWER(r.recomendacoes) LIKE $${params.length}
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
          r.id,
          r.protocolo_relatorio,
          r.vistoria_id,
          r.fiscalizacao_id,
          v.protocolo_vistoria,
          v.protocolo_fiscalizacao,
          v.demanda_publica_id,
          r.tipo_relatorio,
          r.status,
          r.elaborado_por_id,
          elaborado_por.nome AS elaborado_por_nome,
          r.data_elaboracao,
          r.data_revisao,
          r.created_at,
          r.updated_at
        FROM fiscalizacao_relatorios_preliminares r
        INNER JOIN fiscalizacao_vistorias v ON v.id = r.vistoria_id
        LEFT JOIN usuarios_internos elaborado_por ON elaborado_por.id = r.elaborado_por_id
        WHERE ${where.join(' AND ')}
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      params
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM fiscalizacao_relatorios_preliminares r
        INNER JOIN fiscalizacao_vistorias v ON v.id = r.vistoria_id
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

async function listRelatorioMovements(relatorioId) {
  const result = await db.query(
    `
      SELECT
        m.*,
        ui.nome AS usuario_nome
      FROM fiscalizacao_relatorios_movimentacoes m
      LEFT JOIN usuarios_internos ui ON ui.id = m.usuario_id
      WHERE m.relatorio_id = $1
      ORDER BY m.created_at DESC, m.id DESC;
    `,
    [relatorioId]
  );

  return result.rows;
}

async function getRelatorioById(id, client = db, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      ${relatorioBaseSelect()}
      WHERE r.id = $1
        AND r.deleted_at IS NULL
      ${forUpdate ? 'FOR UPDATE OF r' : ''};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getRelatorioDetail(id) {
  const relatorio = await getRelatorioById(id);

  if (!relatorio) {
    return null;
  }

  return {
    ...relatorio,
    movimentacoes: await listRelatorioMovements(id),
  };
}

async function updateRelatorio(client, id, payload) {
  const result = await client.query(
    `
      UPDATE fiscalizacao_relatorios_preliminares
      SET
        introducao = COALESCE($1, introducao),
        historico = COALESCE($2, historico),
        caracterizacao_area = COALESCE($3, caracterizacao_area),
        caracterizacao_demanda = COALESCE($4, caracterizacao_demanda),
        metodologia = COALESCE($5, metodologia),
        constatacoes_tecnicas = COALESCE($6, constatacoes_tecnicas),
        analise_tecnica_preliminar = COALESCE($7, analise_tecnica_preliminar),
        registros_fotograficos_descricao = COALESCE($8, registros_fotograficos_descricao),
        conclusao_preliminar = COALESCE($9, conclusao_preliminar),
        recomendacoes = COALESCE($10, recomendacoes),
        encaminhamentos_sugeridos = COALESCE($11, encaminhamentos_sugeridos),
        limitacoes = COALESCE($12, limitacoes),
        observacoes_internas = COALESCE($13, observacoes_internas),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [
      payload.introducao,
      payload.historico,
      payload.caracterizacao_area,
      payload.caracterizacao_demanda,
      payload.metodologia,
      payload.constatacoes_tecnicas,
      payload.analise_tecnica_preliminar,
      payload.registros_fotograficos_descricao,
      payload.conclusao_preliminar,
      payload.recomendacoes,
      payload.encaminhamentos_sugeridos,
      payload.limitacoes,
      payload.observacoes_internas,
      id,
    ]
  );

  return result.rows[0] || null;
}

async function updateRelatorioStatus(client, id, payload, userId) {
  const result = await client.query(
    `
      UPDATE fiscalizacao_relatorios_preliminares
      SET
        status = $1::varchar,
        revisado_por_id = CASE WHEN $1::varchar IN ('revisado', 'emitido_preliminarmente') THEN $2::integer ELSE revisado_por_id END,
        data_revisao = CASE WHEN $1::varchar IN ('revisado', 'emitido_preliminarmente') THEN CURRENT_TIMESTAMP ELSE data_revisao END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [payload.status, userId || null, id]
  );

  const updated = result.rows[0] || null;

  if (updated) {
    await insertRelatorioMovement(client, {
      relatorio_id: id,
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

async function syncVistoriaRelatorioStatus(client, vistoriaId, status, userId, descricao) {
  const before = await getVistoriaById(vistoriaId, client, { forUpdate: true });
  if (!before || before.status === status) {
    return before;
  }

  const result = await client.query(
    `
      UPDATE fiscalizacao_vistorias
      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [status, vistoriaId]
  );

  const updated = result.rows[0] || null;

  if (updated) {
    await insertVistoriaMovement(client, {
      vistoria_id: vistoriaId,
      tipo: 'relatorio',
      status_anterior: before.status,
      status_novo: status,
      descricao,
      usuario_id: userId,
    });
  }

  return updated;
}

module.exports = {
  db,
  withTransaction,
  buildVistoriaProtocol,
  buildRelatorioProtocol,
  createVistoria,
  insertVistoriaMovement,
  listVistorias,
  listVistoriasByFiscalizacao,
  getVistoriaById,
  getVistoriaDetail,
  updateVistoriaStatus,
  assignVistoriaResponsible,
  registerVistoriaRealizacao,
  cancelVistoria,
  createRelatorio,
  insertRelatorioMovement,
  listRelatorios,
  getRelatorioById,
  getRelatorioDetail,
  updateRelatorio,
  updateRelatorioStatus,
  syncVistoriaRelatorioStatus,
};
