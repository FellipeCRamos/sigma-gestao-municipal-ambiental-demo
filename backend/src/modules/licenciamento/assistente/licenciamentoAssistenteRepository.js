const db = require('../../../config/db');

function toJson(value) {
  return JSON.stringify(value ?? null);
}

function mapHistoricoRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    analiseId: row.analise_id,
    acao: row.acao,
    statusAnterior: row.status_anterior,
    statusNovo: row.status_novo,
    decisao: row.decisao,
    observacao: row.observacao,
    usuarioId: row.usuario_id,
    criadoEm: row.criado_em,
    metadados: row.metadados || {},
  };
}

function mapAnaliseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigoPreliminar: row.codigo_preliminar,
    descricaoOriginal: row.descricao_original,
    perfilUsuario: row.perfil_usuario,
    atividadeProvavel: row.atividade_provavel,
    slugAtividade: row.slug_atividade,
    grupoAtividade: row.grupo_atividade,
    confianca: row.confianca === null || row.confianca === undefined ? null : Number(row.confianca),
    nivelAtencao: row.nivel_atencao,
    palavrasChaveDetectadas: row.palavras_chave_detectadas || [],
    respostasFormulario: row.respostas_formulario || {},
    pendencias: row.pendencias || [],
    checklistDocumental: row.checklist_documental || [],
    resumoCidadao: row.resumo_cidadao,
    resumoTecnico: row.resumo_tecnico,
    recomendacaoTramitacao: row.recomendacao_tramitacao,
    versaoMotor: row.versao_motor,
    origem: row.origem,
    status: row.status,
    nomeInteressado: row.nome_interessado,
    emailInteressado: row.email_interessado,
    telefoneInteressado: row.telefone_interessado,
    tipoPessoa: row.tipo_pessoa,
    tipoImovel: row.tipo_imovel,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    validadoEm: row.validado_em,
    validadoPor: row.validado_por,
    validadoPorNome: row.validado_por_nome,
    observacaoValidacao: row.observacao_validacao,
    decisaoValidacao: row.decisao_validacao,
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

async function nextAnaliseIdentity(client) {
  const result = await client.query(
    "SELECT nextval(pg_get_serial_sequence('licenciamento_assistente_analises', 'id'))::int AS id;"
  );
  const id = result.rows[0].id;
  const year = new Date().getFullYear();
  return {
    id,
    codigoPreliminar: `AE-${year}-${String(id).padStart(6, '0')}`,
  };
}

async function createAnalise(client, payload) {
  const identity = await nextAnaliseIdentity(client);
  const result = await client.query(
    `
      INSERT INTO licenciamento_assistente_analises (
        id,
        codigo_preliminar,
        descricao_original,
        perfil_usuario,
        atividade_provavel,
        slug_atividade,
        grupo_atividade,
        confianca,
        nivel_atencao,
        palavras_chave_detectadas,
        respostas_formulario,
        pendencias,
        checklist_documental,
        resumo_cidadao,
        resumo_tecnico,
        recomendacao_tramitacao,
        versao_motor,
        origem,
        status,
        nome_interessado,
        email_interessado,
        telefone_interessado,
        tipo_pessoa,
        tipo_imovel
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
        $14, $15, $16, $17, 'publico', 'enviado',
        $18, $19, $20, $21, $22
      )
      RETURNING *;
    `,
    [
      identity.id,
      identity.codigoPreliminar,
      payload.descricaoOriginal,
      payload.perfilUsuario,
      payload.atividadeProvavel,
      payload.slugAtividade,
      payload.grupoAtividade,
      payload.confianca,
      payload.nivelAtencao,
      toJson(payload.palavrasChaveDetectadas),
      toJson(payload.respostasFormulario),
      toJson(payload.pendencias),
      toJson(payload.checklistDocumental),
      payload.resumoCidadao,
      payload.resumoTecnico,
      payload.recomendacaoTramitacao,
      payload.versaoMotor,
      payload.nomeInteressado,
      payload.emailInteressado,
      payload.telefoneInteressado,
      payload.tipoPessoa,
      payload.tipoImovel,
    ]
  );

  return mapAnaliseRow(result.rows[0]);
}

async function addHistorico(client, payload) {
  const result = await client.query(
    `
      INSERT INTO licenciamento_assistente_analises_historico (
        analise_id,
        acao,
        status_anterior,
        status_novo,
        decisao,
        observacao,
        usuario_id,
        metadados
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING *;
    `,
    [
      payload.analiseId,
      payload.acao,
      payload.statusAnterior || null,
      payload.statusNovo || null,
      payload.decisao || null,
      payload.observacao || null,
      payload.usuarioId || null,
      toJson(payload.metadados || {}),
    ]
  );

  return mapHistoricoRow(result.rows[0]);
}

function buildListWhere(filters, values) {
  const clauses = [];
  if (filters.status) {
    values.push(filters.status);
    clauses.push(`a.status = $${values.length}`);
  }
  if (filters.slugAtividade) {
    values.push(filters.slugAtividade);
    clauses.push(`a.slug_atividade = $${values.length}`);
  }
  if (filters.nivelAtencao) {
    values.push(filters.nivelAtencao);
    clauses.push(`a.nivel_atencao = $${values.length}`);
  }
  if (filters.tipoPessoa) {
    values.push(filters.tipoPessoa);
    clauses.push(`a.tipo_pessoa = $${values.length}`);
  }
  if (filters.tipoImovel) {
    values.push(filters.tipoImovel);
    clauses.push(`a.tipo_imovel = $${values.length}`);
  }
  if (filters.nomeInteressado) {
    values.push(`%${filters.nomeInteressado}%`);
    clauses.push(`a.nome_interessado ILIKE $${values.length}`);
  }
  if (filters.dataInicial) {
    values.push(filters.dataInicial);
    clauses.push(`a.criado_em >= $${values.length}::timestamp`);
  }
  if (filters.dataFinal) {
    values.push(filters.dataFinal);
    clauses.push(`a.criado_em <= ($${values.length}::timestamp + INTERVAL '1 day')`);
  }
  if (filters.busca) {
    values.push(`%${filters.busca}%`);
    clauses.push(`(
      a.codigo_preliminar ILIKE $${values.length}
      OR a.descricao_original ILIKE $${values.length}
      OR a.atividade_provavel ILIKE $${values.length}
      OR COALESCE(a.nome_interessado, '') ILIKE $${values.length}
      OR COALESCE(a.email_interessado, '') ILIKE $${values.length}
    )`);
  }

  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

async function listAnalises(filters) {
  const values = [];
  const where = buildListWhere(filters, values);
  const offset = (filters.page - 1) * filters.pageSize;

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM licenciamento_assistente_analises a ${where};`,
    values
  );

  values.push(filters.pageSize);
  const limitIndex = values.length;
  values.push(offset);
  const offsetIndex = values.length;

  const result = await db.query(
    `
      SELECT
        a.*,
        u.nome AS validado_por_nome
      FROM licenciamento_assistente_analises a
      LEFT JOIN usuarios_internos u ON u.id = a.validado_por
      ${where}
      ORDER BY a.criado_em DESC, a.id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex};
    `,
    values
  );

  const total = countResult.rows[0].total;
  return {
    items: result.rows.map(mapAnaliseRow),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
  };
}

async function getAnaliseById(id) {
  const result = await db.query(
    `
      SELECT
        a.*,
        u.nome AS validado_por_nome
      FROM licenciamento_assistente_analises a
      LEFT JOIN usuarios_internos u ON u.id = a.validado_por
      WHERE a.id = $1
      LIMIT 1;
    `,
    [id]
  );
  return mapAnaliseRow(result.rows[0]);
}

async function getAnaliseByIdForUpdate(client, id) {
  const result = await client.query(
    'SELECT * FROM licenciamento_assistente_analises WHERE id = $1 FOR UPDATE;',
    [id]
  );
  return mapAnaliseRow(result.rows[0]);
}

async function updateStatus(client, id, status) {
  const result = await client.query(
    `
      UPDATE licenciamento_assistente_analises
      SET status = $2,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `,
    [id, status]
  );
  return mapAnaliseRow(result.rows[0]);
}

async function updateValidacao(client, id, payload, usuario) {
  const result = await client.query(
    `
      UPDATE licenciamento_assistente_analises
      SET status = $2,
          decisao_validacao = $3,
          observacao_validacao = $4,
          validado_por = $5,
          validado_em = CURRENT_TIMESTAMP,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `,
    [
      id,
      payload.status,
      payload.decisaoValidacao,
      payload.observacaoValidacao,
      usuario?.id || null,
    ]
  );
  return mapAnaliseRow(result.rows[0]);
}

async function listHistorico(analiseId) {
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_assistente_analises_historico
      WHERE analise_id = $1
      ORDER BY criado_em DESC, id DESC;
    `,
    [analiseId]
  );
  return result.rows.map(mapHistoricoRow);
}

module.exports = {
  withTransaction,
  createAnalise,
  addHistorico,
  listAnalises,
  getAnaliseById,
  getAnaliseByIdForUpdate,
  updateStatus,
  updateValidacao,
  listHistorico,
};
