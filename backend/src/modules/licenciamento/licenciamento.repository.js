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

async function getNextProcessoId(client) {
  const result = await client.query(
    "SELECT nextval(pg_get_serial_sequence('licenciamento_processos', 'id')) AS id;"
  );
  return Number(result.rows[0].id);
}

function buildNumeroProcesso(id, ano) {
  return `LIC-${ano}-${String(id).padStart(6, '0')}`;
}

async function createRequerente(client, payload, userId) {
  const result = await client.query(
    `
      INSERT INTO licenciamento_requerentes (
        nome_razao_social,
        documento,
        tipo,
        email,
        telefone,
        endereco,
        created_by_interno_id,
        updated_by_interno_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING *;
    `,
    [
      payload.nome_razao_social,
      payload.documento,
      payload.tipo,
      payload.email,
      payload.telefone,
      payload.endereco,
      userId || null,
    ]
  );

  return result.rows[0];
}

async function createEmpreendimento(client, payload, requerenteId, userId) {
  const result = await client.query(
    `
      INSERT INTO licenciamento_empreendimentos (
        requerente_id,
        nome,
        atividade_principal,
        endereco,
        bairro,
        territorio_id,
        latitude,
        longitude,
        created_by_interno_id,
        updated_by_interno_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      RETURNING *;
    `,
    [
      requerenteId || null,
      payload.nome,
      payload.atividade_principal,
      payload.endereco,
      payload.bairro,
      payload.territorio_id,
      payload.latitude,
      payload.longitude,
      userId || null,
    ]
  );

  return result.rows[0];
}

async function createProcesso(client, payload, userId) {
  const id = await getNextProcessoId(client);
  const numeroProcesso = payload.numero_processo || buildNumeroProcesso(id, payload.ano);

  const result = await client.query(
    `
      INSERT INTO licenciamento_processos (
        id,
        numero_processo,
        ano,
        requerente_id,
        empreendimento_id,
        tipo_licenca,
        classe,
        porte,
        atividade_principal,
        status,
        responsavel_id,
        data_protocolo,
        observacoes,
        created_by_interno_id,
        updated_by_interno_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, COALESCE($12::date, CURRENT_DATE), $13, $14, $14
      )
      RETURNING *;
    `,
    [
      id,
      numeroProcesso,
      payload.ano,
      payload.requerente_id,
      payload.empreendimento_id,
      payload.tipo_licenca,
      payload.classe,
      payload.porte,
      payload.atividade_principal,
      payload.status,
      payload.responsavel_id,
      payload.data_protocolo,
      payload.observacoes,
      userId || null,
    ]
  );

  return result.rows[0];
}

async function insertMovimentacao(client, payload) {
  const result = await client.query(
    `
      INSERT INTO licenciamento_movimentacoes (
        processo_id,
        tipo,
        status_anterior,
        status_novo,
        descricao,
        dados,
        created_by_interno_id
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING *;
    `,
    [
      payload.processo_id,
      payload.tipo || 'registro',
      payload.status_anterior || null,
      payload.status_novo || null,
      payload.descricao,
      JSON.stringify(payload.dados || {}),
      payload.created_by_interno_id || null,
    ]
  );

  return result.rows[0];
}

async function getResumo() {
  const [totaisResult, statusResult, pendenciasResult, licencasResult] = await Promise.all([
    db.query(
      `
        SELECT
          COUNT(*)::int AS total_processos,
          COUNT(*) FILTER (WHERE status NOT IN ('arquivado', 'cancelado'))::int AS processos_ativos,
          COUNT(*) FILTER (WHERE status = 'em_diligencia')::int AS em_diligencia,
          COUNT(*) FILTER (WHERE status = 'em_analise_tecnica')::int AS em_analise_tecnica
        FROM licenciamento_processos
        WHERE deleted_at IS NULL;
      `
    ),
    db.query(
      `
        SELECT status, COUNT(*)::int AS total
        FROM licenciamento_processos
        WHERE deleted_at IS NULL
        GROUP BY status
        ORDER BY status;
      `
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS pendencias_abertas
        FROM licenciamento_pendencias
        WHERE deleted_at IS NULL
          AND status = 'aberta';
      `
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS licencas_emitidas
        FROM licenciamento_licencas
        WHERE deleted_at IS NULL
          AND status = 'emitida';
      `
    ),
  ]);

  return {
    ...totaisResult.rows[0],
    pendencias_abertas: pendenciasResult.rows[0]?.pendencias_abertas || 0,
    licencas_emitidas: licencasResult.rows[0]?.licencas_emitidas || 0,
    por_status: statusResult.rows,
  };
}

async function listProcessos(filters) {
  const params = [];
  const where = ['p.deleted_at IS NULL'];

  if (filters.status) {
    params.push(filters.status);
    where.push(`p.status = $${params.length}`);
  }

  if (filters.ano) {
    params.push(filters.ano);
    where.push(`p.ano = $${params.length}`);
  }

  if (filters.busca) {
    params.push(`%${filters.busca.toLowerCase()}%`);
    where.push(`(
      LOWER(p.numero_processo) LIKE $${params.length}
      OR LOWER(p.atividade_principal) LIKE $${params.length}
      OR LOWER(COALESCE(r.nome_razao_social, '')) LIKE $${params.length}
      OR LOWER(COALESCE(e.nome, '')) LIKE $${params.length}
    )`);
  }

  params.push(filters.limit);
  const limitParam = params.length;
  params.push(filters.offset);
  const offsetParam = params.length;

  const [itemsResult, countResult] = await Promise.all([
    db.query(
      `
        SELECT
          p.*,
          r.nome_razao_social AS requerente_nome,
          e.nome AS empreendimento_nome,
          ui.nome AS responsavel_nome
        FROM licenciamento_processos p
        LEFT JOIN licenciamento_requerentes r ON r.id = p.requerente_id
        LEFT JOIN licenciamento_empreendimentos e ON e.id = p.empreendimento_id
        LEFT JOIN usuarios_internos ui ON ui.id = p.responsavel_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.data_protocolo DESC, p.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      params
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM licenciamento_processos p
        LEFT JOIN licenciamento_requerentes r ON r.id = p.requerente_id
        LEFT JOIN licenciamento_empreendimentos e ON e.id = p.empreendimento_id
        WHERE ${where.join(' AND ')};
      `,
      params.slice(0, params.length - 2)
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

async function getProcessoById(id) {
  const processoResult = await db.query(
    `
      SELECT
        p.*,
        r.nome_razao_social AS requerente_nome,
        r.documento AS requerente_documento,
        r.tipo AS requerente_tipo,
        r.email AS requerente_email,
        r.telefone AS requerente_telefone,
        r.endereco AS requerente_endereco,
        e.nome AS empreendimento_nome,
        e.endereco AS empreendimento_endereco,
        e.bairro AS empreendimento_bairro,
        e.territorio_id,
        t.nome AS territorio_nome,
        ui.nome AS responsavel_nome
      FROM licenciamento_processos p
      LEFT JOIN licenciamento_requerentes r ON r.id = p.requerente_id
      LEFT JOIN licenciamento_empreendimentos e ON e.id = p.empreendimento_id
      LEFT JOIN territorios t ON t.id = e.territorio_id
      LEFT JOIN usuarios_internos ui ON ui.id = p.responsavel_id
      WHERE p.id = $1
        AND p.deleted_at IS NULL;
    `,
    [id]
  );

  const processo = processoResult.rows[0];

  if (!processo) {
    return null;
  }

  const [pendenciasResult, licencasResult, historicoResult] = await Promise.all([
    db.query(
      `
        SELECT *
        FROM licenciamento_pendencias
        WHERE processo_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at DESC, id DESC;
      `,
      [id]
    ),
    db.query(
      `
        SELECT *
        FROM licenciamento_licencas
        WHERE processo_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at DESC, id DESC;
      `,
      [id]
    ),
    listHistorico(id),
  ]);

  return {
    ...processo,
    pendencias: pendenciasResult.rows,
    licencas: licencasResult.rows,
    historico: historicoResult,
  };
}

async function updateProcesso(client, id, payload, userId) {
  const fields = [];
  const values = [];

  Object.entries(payload).forEach(([key, value]) => {
    values.push(value);
    fields.push(`${key} = $${values.length}`);
  });

  values.push(userId || null);
  fields.push(`updated_by_interno_id = $${values.length}`);
  fields.push('updated_at = CURRENT_TIMESTAMP');
  fields.push('data_ultima_movimentacao = CURRENT_TIMESTAMP');

  values.push(id);

  const result = await client.query(
    `
      UPDATE licenciamento_processos
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
        AND deleted_at IS NULL
      RETURNING *;
    `,
    values
  );

  return result.rows[0] || null;
}

async function getProcessoBase(client, id, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      SELECT *
      FROM licenciamento_processos
      WHERE id = $1
        AND deleted_at IS NULL
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function listHistorico(id) {
  const result = await db.query(
    `
      SELECT
        m.*,
        ui.nome AS criado_por_nome
      FROM licenciamento_movimentacoes m
      LEFT JOIN usuarios_internos ui ON ui.id = m.created_by_interno_id
      WHERE m.processo_id = $1
      ORDER BY m.created_at DESC, m.id DESC;
    `,
    [id]
  );

  return result.rows;
}

module.exports = {
  db,
  withTransaction,
  createRequerente,
  createEmpreendimento,
  createProcesso,
  insertMovimentacao,
  getResumo,
  listProcessos,
  getProcessoById,
  updateProcesso,
  getProcessoBase,
  listHistorico,
};
