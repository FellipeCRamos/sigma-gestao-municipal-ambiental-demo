const db = require('../../../config/db');

function toJson(value) {
  return JSON.stringify(value ?? null);
}

function mapHistoricoRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    preRequerimentoId: row.pre_requerimento_id,
    acao: row.acao,
    statusAnterior: row.status_anterior,
    statusNovo: row.status_novo,
    observacao: row.observacao,
    usuarioId: row.usuario_id,
    criadoEm: row.criado_em,
    metadados: row.metadados || {},
  };
}

function mapPreRequerimentoRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigoPreRequerimento: row.codigo_pre_requerimento,
    analiseAssistenteId: row.analise_assistente_id,
    codigoAnaliseAssistente: row.codigo_analise_assistente,
    perfilUsuarioAnalise: row.perfil_usuario_analise,
    criadoEmAnalise: row.criado_em_analise,
    interessadoNome: row.interessado_nome,
    interessadoEmail: row.interessado_email,
    interessadoTelefone: row.interessado_telefone,
    tipoPessoa: row.tipo_pessoa,
    tipoImovel: row.tipo_imovel,
    atividadeEnquadrada: row.atividade_enquadrada,
    slugAtividade: row.slug_atividade,
    grupoAtividade: row.grupo_atividade,
    descricaoOriginal: row.descricao_original,
    resumoCidadao: row.resumo_cidadao,
    resumoTecnico: row.resumo_tecnico,
    nivelAtencao: row.nivel_atencao,
    recomendacaoTramitacao: row.recomendacao_tramitacao,
    sidDigital: row.sid_digital || {},
    checklistDocumental: row.checklist_documental || [],
    pendencias: row.pendencias || [],
    documentos: row.documentos || [],
    minutaDespacho: row.minuta_despacho,
    status: row.status,
    criadoPor: row.criado_por,
    criadoPorNome: row.criado_por_nome,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    convertidoEmProcesso: row.convertido_em_processo,
    numeroProcessoEdocs: row.numero_processo_edocs,
    observacoesInternas: row.observacoes_internas,
  };
}

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

async function nextCodigoPreRequerimento(client) {
  const year = new Date().getFullYear();
  await client.query('LOCK TABLE licenciamento_pre_requerimentos IN EXCLUSIVE MODE;');
  const result = await client.query(
    `
      SELECT COALESCE(MAX((regexp_match(codigo_pre_requerimento, $1))[1]::int), 0) + 1 AS next_number
      FROM licenciamento_pre_requerimentos
      WHERE codigo_pre_requerimento LIKE $2;
    `,
    [`^PR-LA-${year}-([0-9]{6})$`, `PR-LA-${year}-%`]
  );
  const nextNumber = Number(result.rows[0].next_number || 1);
  return `PR-LA-${year}-${String(nextNumber).padStart(6, '0')}`;
}

async function findByAnaliseId(client, analiseId) {
  const result = await client.query(
    'SELECT * FROM licenciamento_pre_requerimentos WHERE analise_assistente_id = $1 LIMIT 1;',
    [analiseId]
  );
  return mapPreRequerimentoRow(result.rows[0]);
}

async function createPreRequerimento(client, payload) {
  const codigo = await nextCodigoPreRequerimento(client);
  const result = await client.query(
    `
      INSERT INTO licenciamento_pre_requerimentos (
        codigo_pre_requerimento,
        analise_assistente_id,
        interessado_nome,
        interessado_email,
        interessado_telefone,
        tipo_pessoa,
        tipo_imovel,
        atividade_enquadrada,
        slug_atividade,
        grupo_atividade,
        descricao_original,
        resumo_cidadao,
        resumo_tecnico,
        nivel_atencao,
        recomendacao_tramitacao,
        sid_digital,
        checklist_documental,
        pendencias,
        documentos,
        minuta_despacho,
        status,
        criado_por,
        observacoes_internas
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb,
        $20, $21, $22, $23
      )
      RETURNING *;
    `,
    [
      codigo,
      payload.analiseAssistenteId,
      payload.interessadoNome,
      payload.interessadoEmail,
      payload.interessadoTelefone,
      payload.tipoPessoa,
      payload.tipoImovel,
      payload.atividadeEnquadrada,
      payload.slugAtividade,
      payload.grupoAtividade,
      payload.descricaoOriginal,
      payload.resumoCidadao,
      payload.resumoTecnico,
      payload.nivelAtencao,
      payload.recomendacaoTramitacao,
      toJson(payload.sidDigital),
      toJson(payload.checklistDocumental),
      toJson(payload.pendencias),
      toJson(payload.documentos),
      payload.minutaDespacho,
      payload.status,
      payload.criadoPor,
      payload.observacoesInternas,
    ]
  );
  return mapPreRequerimentoRow(result.rows[0]);
}

async function addHistorico(client, payload) {
  const result = await client.query(
    `
      INSERT INTO licenciamento_pre_requerimentos_historico (
        pre_requerimento_id,
        acao,
        status_anterior,
        status_novo,
        observacao,
        usuario_id,
        metadados
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *;
    `,
    [
      payload.preRequerimentoId,
      payload.acao,
      payload.statusAnterior || null,
      payload.statusNovo || null,
      payload.observacao || null,
      payload.usuarioId || null,
      toJson(payload.metadados || {}),
    ]
  );
  return mapHistoricoRow(result.rows[0]);
}

function buildWhere(filters, values) {
  const clauses = [];
  if (filters.status) {
    values.push(filters.status);
    clauses.push(`p.status = $${values.length}`);
  }
  if (filters.atividade) {
    values.push(`%${filters.atividade}%`);
    clauses.push(`p.atividade_enquadrada ILIKE $${values.length}`);
  }
  if (filters.nivelAtencao) {
    values.push(filters.nivelAtencao);
    clauses.push(`p.nivel_atencao = $${values.length}`);
  }
  if (filters.interessado) {
    values.push(`%${filters.interessado}%`);
    clauses.push(`(COALESCE(p.interessado_nome, '') ILIKE $${values.length} OR COALESCE(p.interessado_email, '') ILIKE $${values.length})`);
  }
  if (filters.codigo) {
    values.push(`%${filters.codigo}%`);
    clauses.push(`p.codigo_pre_requerimento ILIKE $${values.length}`);
  }
  if (filters.dataInicial) {
    values.push(filters.dataInicial);
    clauses.push(`p.criado_em >= $${values.length}::timestamp`);
  }
  if (filters.dataFinal) {
    values.push(filters.dataFinal);
    clauses.push(`p.criado_em <= ($${values.length}::timestamp + INTERVAL '1 day')`);
  }
  if (filters.busca) {
    values.push(`%${filters.busca}%`);
    clauses.push(`(
      p.codigo_pre_requerimento ILIKE $${values.length}
      OR p.descricao_original ILIKE $${values.length}
      OR p.atividade_enquadrada ILIKE $${values.length}
      OR COALESCE(p.interessado_nome, '') ILIKE $${values.length}
      OR COALESCE(p.interessado_email, '') ILIKE $${values.length}
      OR COALESCE(a.codigo_preliminar, '') ILIKE $${values.length}
    )`);
  }
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

async function listPreRequerimentos(filters) {
  const values = [];
  const where = buildWhere(filters, values);
  const offset = (filters.page - 1) * filters.pageSize;

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM licenciamento_pre_requerimentos p
      LEFT JOIN licenciamento_assistente_analises a ON a.id = p.analise_assistente_id
      ${where};
    `,
    values
  );

  values.push(filters.pageSize);
  const limitIndex = values.length;
  values.push(offset);
  const offsetIndex = values.length;

  const result = await db.query(
    `
      SELECT
        p.*,
        a.codigo_preliminar AS codigo_analise_assistente,
        a.perfil_usuario AS perfil_usuario_analise,
        a.criado_em AS criado_em_analise,
        u.nome AS criado_por_nome
      FROM licenciamento_pre_requerimentos p
      LEFT JOIN licenciamento_assistente_analises a ON a.id = p.analise_assistente_id
      LEFT JOIN usuarios_internos u ON u.id = p.criado_por
      ${where}
      ORDER BY p.criado_em DESC, p.id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex};
    `,
    values
  );

  const total = countResult.rows[0].total;
  return {
    items: result.rows.map(mapPreRequerimentoRow),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
  };
}

async function getPreRequerimentoById(id) {
  const result = await db.query(
    `
      SELECT
        p.*,
        a.codigo_preliminar AS codigo_analise_assistente,
        a.perfil_usuario AS perfil_usuario_analise,
        a.criado_em AS criado_em_analise,
        u.nome AS criado_por_nome
      FROM licenciamento_pre_requerimentos p
      LEFT JOIN licenciamento_assistente_analises a ON a.id = p.analise_assistente_id
      LEFT JOIN usuarios_internos u ON u.id = p.criado_por
      WHERE p.id = $1
      LIMIT 1;
    `,
    [id]
  );
  return mapPreRequerimentoRow(result.rows[0]);
}

async function getPreRequerimentoByIdForUpdate(client, id) {
  const result = await client.query(
    'SELECT * FROM licenciamento_pre_requerimentos WHERE id = $1 FOR UPDATE;',
    [id]
  );
  return mapPreRequerimentoRow(result.rows[0]);
}

async function updateStatus(client, id, status) {
  const result = await client.query(
    `
      UPDATE licenciamento_pre_requerimentos
      SET status = $2,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `,
    [id, status]
  );
  return mapPreRequerimentoRow(result.rows[0]);
}

async function updateMinuta(client, id, minutaDespacho) {
  const result = await client.query(
    `
      UPDATE licenciamento_pre_requerimentos
      SET minuta_despacho = $2,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `,
    [id, minutaDespacho]
  );
  return mapPreRequerimentoRow(result.rows[0]);
}

async function updateDocumentos(client, id, documentos, checklistDocumental) {
  const result = await client.query(
    `
      UPDATE licenciamento_pre_requerimentos
      SET documentos = $2::jsonb,
          checklist_documental = $3::jsonb,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `,
    [id, toJson(documentos), toJson(checklistDocumental)]
  );
  return mapPreRequerimentoRow(result.rows[0]);
}

async function listHistorico(preRequerimentoId) {
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_pre_requerimentos_historico
      WHERE pre_requerimento_id = $1
      ORDER BY criado_em DESC, id DESC;
    `,
    [preRequerimentoId]
  );
  return result.rows.map(mapHistoricoRow);
}

module.exports = {
  withTransaction,
  createPreRequerimento,
  findByAnaliseId,
  addHistorico,
  listPreRequerimentos,
  getPreRequerimentoById,
  getPreRequerimentoByIdForUpdate,
  updateStatus,
  updateMinuta,
  updateDocumentos,
  listHistorico,
};
