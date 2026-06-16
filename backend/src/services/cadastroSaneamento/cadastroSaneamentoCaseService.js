const { db, auditService, FINAL_STATUSES, REVIEW_STATUSES, normalizeStatus, createServiceError } = require('./shared');
const syncService = require('./cadastroSaneamentoSyncService');

function caseSelectSql(where = '') {
  return `
    SELECT
      c.*,
      ui.nome AS responsavel_nome,
      CASE
        WHEN c.entidade = 'tutor' THEN jsonb_build_object(
          'id', t.id,
          'nome', t.nome,
          'cpf', t.cpf,
          'email', t.email,
          'telefone', t.telefone,
          'endereco', t.endereco,
          'bairro', t.bairro,
          'status_cadastral', t.status_cadastral,
          'confiabilidade_score', t.confiabilidade_score,
          'confiabilidade_nivel', t.confiabilidade_nivel,
          'confiabilidade_pendencias', t.confiabilidade_pendencias,
          'duplicidade_alertas', t.duplicidade_alertas
        )
        ELSE jsonb_build_object(
          'id', a.id,
          'nome', a.nome,
          'especie', a.especie,
          'sexo', a.sexo,
          'raca', a.raca,
          'microchip', a.microchip,
          'tutor_id', a.tutor_id,
          'tutor_nome', at.nome,
          'status_cadastral', a.status_cadastral,
          'confiabilidade_score', a.confiabilidade_score,
          'confiabilidade_nivel', a.confiabilidade_nivel,
          'confiabilidade_pendencias', a.confiabilidade_pendencias,
          'duplicidade_alertas', a.duplicidade_alertas
        )
      END AS entidade_principal,
      CASE
        WHEN c.entidade = 'tutor' AND c.entidade_relacionada_id IS NOT NULL THEN jsonb_build_object(
          'id', tr.id,
          'nome', tr.nome,
          'cpf', tr.cpf,
          'email', tr.email,
          'telefone', tr.telefone,
          'endereco', tr.endereco,
          'bairro', tr.bairro,
          'status_cadastral', tr.status_cadastral,
          'confiabilidade_score', tr.confiabilidade_score,
          'confiabilidade_nivel', tr.confiabilidade_nivel,
          'confiabilidade_pendencias', tr.confiabilidade_pendencias,
          'duplicidade_alertas', tr.duplicidade_alertas
        )
        WHEN c.entidade = 'animal' AND c.entidade_relacionada_id IS NOT NULL THEN jsonb_build_object(
          'id', ar.id,
          'nome', ar.nome,
          'especie', ar.especie,
          'sexo', ar.sexo,
          'raca', ar.raca,
          'microchip', ar.microchip,
          'tutor_id', ar.tutor_id,
          'tutor_nome', art.nome,
          'status_cadastral', ar.status_cadastral,
          'confiabilidade_score', ar.confiabilidade_score,
          'confiabilidade_nivel', ar.confiabilidade_nivel,
          'confiabilidade_pendencias', ar.confiabilidade_pendencias,
          'duplicidade_alertas', ar.duplicidade_alertas
        )
        ELSE NULL
      END AS entidade_relacionada
    FROM cadastro_saneamento_casos c
    LEFT JOIN usuarios_internos ui ON ui.id = c.responsavel_interno_id
    LEFT JOIN tutores t ON c.entidade = 'tutor' AND t.id = c.entidade_id
    LEFT JOIN tutores tr ON c.entidade = 'tutor' AND tr.id = c.entidade_relacionada_id
    LEFT JOIN animais a ON c.entidade = 'animal' AND a.id = c.entidade_id
    LEFT JOIN tutores at ON at.id = a.tutor_id
    LEFT JOIN animais ar ON c.entidade = 'animal' AND ar.id = c.entidade_relacionada_id
    LEFT JOIN tutores art ON art.id = ar.tutor_id
    ${where}
  `;
}

exports.listCases = async ({ status = '', entidade = '', tipo = '' } = {}) => {
  await syncService.syncCases();

  const values = [];
  const conditions = [];

  if (status) {
    values.push(status);
    conditions.push(`c.status = $${values.length}`);
  }

  if (entidade) {
    values.push(entidade);
    conditions.push(`c.entidade = $${values.length}`);
  }

  if (tipo) {
    values.push(tipo);
    conditions.push(`c.tipo = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `${caseSelectSql(where)}
     ORDER BY
       CASE c.criticidade
         WHEN 'critica' THEN 1
         WHEN 'alta' THEN 2
         WHEN 'media' THEN 3
         ELSE 4
       END,
       CASE c.status
         WHEN 'pendente' THEN 1
         WHEN 'em_revisao' THEN 2
         WHEN 'aprovado_para_merge' THEN 3
         WHEN 'revisar_depois' THEN 4
         ELSE 5
       END,
       c.updated_at DESC
     LIMIT 200;`,
    values
  );

  return result.rows;
};

exports.findCaseById = async (id) => {
  const result = await db.query(`${caseSelectSql('WHERE c.id = $1')};`, [id]);
  return result.rows[0];
};

exports.reviewCase = async (id, data, actor, req = null) => {
  const nextStatus = normalizeStatus(data.status);

  if (!REVIEW_STATUSES.has(nextStatus)) {
    throw createServiceError(400, 'SIGBA_INVALID_REVIEW_STATUS', 'Status de saneamento invalido.');
  }

  const before = await exports.findCaseById(id);

  if (!before) {
    return null;
  }

  const result = await db.query(
    `
      UPDATE cadastro_saneamento_casos
      SET
        status = $1,
        responsavel_interno_id = $2,
        decisao = $3,
        observacao = $4,
        resolved_at = CASE WHEN $5 THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `,
    [
      nextStatus,
      actor?.id || null,
      data.decisao || nextStatus,
      data.observacao || null,
      FINAL_STATUSES.has(nextStatus),
      id
    ]
  );

  const after = await exports.findCaseById(id);

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor?.id,
    acao: 'revisar_caso_saneamento',
    entidade: 'cadastro_saneamento_casos',
    entidade_id: Number(id),
    before,
    after,
    dados: {
      status_anterior: before.status,
      status_novo: result.rows[0].status,
      decisao: data.decisao || nextStatus
    },
    req
  });

  return after;
};

exports.getStats = async () => {
  await syncService.syncCases();

  const result = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
      COUNT(*) FILTER (WHERE status = 'em_revisao')::int AS em_revisao,
      COUNT(*) FILTER (WHERE status = 'falso_positivo')::int AS falsos_positivos,
      COUNT(*) FILTER (WHERE status = 'mesclado')::int AS mesclados,
      COUNT(*) FILTER (WHERE entidade = 'tutor')::int AS tutores,
      COUNT(*) FILTER (WHERE entidade = 'animal')::int AS animais,
      COUNT(*) FILTER (WHERE criticidade IN ('alta', 'critica') AND status IN ('pendente', 'em_revisao', 'aprovado_para_merge'))::int AS criticos_abertos
    FROM cadastro_saneamento_casos;
  `);

  const mergesResult = await db.query(`
    SELECT COUNT(*)::int AS total
    FROM cadastro_merges
    WHERE status = 'concluido';
  `);

  return {
    ...(result.rows[0] || {}),
    merges_realizados: mergesResult.rows[0]?.total || 0
  };
};


