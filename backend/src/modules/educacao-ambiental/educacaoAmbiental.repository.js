const db = require('../../config/db');
const { ENTITY_DEFINITIONS } = require('./educacaoAmbiental.constants');

const USER_TRACKED_ENTITIES = new Set([
  'conteudos',
  'normas',
  'agenda',
  'materiais',
  'trilhas',
  'especies',
  'areas',
  'programas',
  'faq',
]);

const FONTE_REPO_DEFINITION = {
  key: 'fontes',
  table: 'educacao_fontes',
  jsonFields: ['temas_relacionados'],
  integerFields: ['criado_por_id', 'atualizado_por_id'],
};

const REFERENCIA_REPO_DEFINITION = {
  key: 'referencias',
  table: 'educacao_referencias',
  integerFields: ['entidade_id', 'fonte_id', 'criado_por_id', 'atualizado_por_id'],
  dateFields: ['data_acesso'],
};

function getClient(client = db) {
  return client || db;
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

function fieldExpression(alias, field) {
  if (field.endsWith('::text')) {
    return `${alias}.${field.replace('::text', '')}::text`;
  }

  return `${alias}.${field}`;
}

function castPlaceholder(definition, field, placeholder) {
  if (definition.jsonFields?.includes(field)) return `${placeholder}::jsonb`;
  if (definition.dateFields?.includes(field)) return `${placeholder}::date`;
  if (definition.timestampFields?.includes(field)) return `${placeholder}::timestamp`;
  if (definition.integerFields?.includes(field)) return `${placeholder}::integer`;
  if (definition.numericFields?.includes(field)) return `${placeholder}::numeric`;
  if (definition.booleanFields?.includes(field)) return `${placeholder}::boolean`;
  return placeholder;
}

function serializeValue(definition, field, value) {
  if (definition.jsonFields?.includes(field)) {
    return JSON.stringify(value ?? []);
  }

  return value;
}

function addFilter(definition, filters, where, params, alias, publicOnly) {
  const raw = filters.raw || {};

  if (publicOnly) {
    where.push(definition.publicFilter({ alias }));
  }

  (definition.filterFields || []).forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(raw, field)) {
      return;
    }

    const value = raw[field];
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (definition.booleanFields?.includes(field)) {
      params.push(value === true || value === 'true' || value === '1');
      where.push(`${alias}.${field} = $${params.length}::boolean`);
      return;
    }

    if (definition.integerFields?.includes(field)) {
      params.push(Number(value));
      where.push(`${alias}.${field} = $${params.length}::integer`);
      return;
    }

    params.push(value);
    where.push(`${alias}.${field} = $${params.length}`);
  });

  if (definition.key === 'agenda' && raw.mes) {
    params.push(Number(raw.mes));
    where.push(`EXTRACT(MONTH FROM ${alias}.data_inicio) = $${params.length}::integer`);
  }

  if (filters.q) {
    params.push(`%${String(filters.q).toLowerCase()}%`);
    const paramRef = `$${params.length}`;
    const clauses = (definition.searchFields || []).map((field) => `LOWER(COALESCE(${fieldExpression(alias, field)}, '')) LIKE ${paramRef}`);
    if (clauses.length) {
      where.push(`(${clauses.join(' OR ')})`);
    }
  }
}

async function listEntity(definition, filters, { publicOnly = false, client = db } = {}) {
  const alias = 'e';
  const params = [];
  const where = ['1 = 1'];

  addFilter(definition, filters, where, params, alias, publicOnly);

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const orderBy = `${alias}.${filters.orderBy}`;
  const orderDirection = filters.orderDirection;
  const listParams = [...params, filters.limit, filters.offset];

  const [itemsResult, countResult] = await Promise.all([
    getClient(client).query(
      `
        SELECT ${alias}.*
        FROM ${definition.table} ${alias}
        WHERE ${where.join(' AND ')}
        ORDER BY ${orderBy} ${orderDirection}, ${alias}.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      listParams
    ),
    getClient(client).query(
      `
        SELECT COUNT(*)::int AS total
        FROM ${definition.table} ${alias}
        WHERE ${where.join(' AND ')};
      `,
      params
    ),
  ]);

  return {
    items: itemsResult.rows,
    pagination: {
      page: filters.page,
      page_size: filters.limit,
      total_items: countResult.rows[0]?.total || 0,
      total_pages: Math.max(1, Math.ceil((countResult.rows[0]?.total || 0) / filters.limit)),
    },
  };
}

async function getEntityById(definition, id, { client = db, forUpdate = false, publicOnly = false } = {}) {
  const alias = 'e';
  const where = [`${alias}.id = $1`];

  if (publicOnly) {
    where.push(definition.publicFilter({ alias }));
  }

  const result = await getClient(client).query(
    `
      SELECT ${alias}.*
      FROM ${definition.table} ${alias}
      WHERE ${where.join(' AND ')}
      ${forUpdate ? `FOR UPDATE OF ${alias}` : ''};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getConteudoBySlug(slug, { publicOnly = false, client = db } = {}) {
  const alias = 'e';
  const where = [`${alias}.slug = $1`];

  if (publicOnly) {
    where.push(`${alias}.status = 'publicado' AND ${alias}.arquivado_em IS NULL AND ${alias}.apto_para_portal_publico = true`);
  }

  const result = await getClient(client).query(
    `
      SELECT ${alias}.*
      FROM educacao_conteudos ${alias}
      WHERE ${where.join(' AND ')};
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function createEntity(definition, payload, userId, client = db) {
  const columns = [];
  const values = [];
  const params = [];

  Object.entries(payload).forEach(([field, value]) => {
    if (value === undefined) {
      return;
    }

    columns.push(field);
    params.push(serializeValue(definition, field, value));
    values.push(castPlaceholder(definition, field, `$${params.length}`));
  });

  if (USER_TRACKED_ENTITIES.has(definition.key)) {
    columns.push('criado_por_id');
    params.push(userId || null);
    values.push(`$${params.length}::integer`);

    columns.push('atualizado_por_id');
    params.push(userId || null);
    values.push(`$${params.length}::integer`);
  }

  const result = await getClient(client).query(
    `
      INSERT INTO ${definition.table} (${columns.join(', ')})
      VALUES (${values.join(', ')})
      RETURNING *;
    `,
    params
  );

  return result.rows[0];
}

async function updateEntity(definition, id, payload, userId, client = db) {
  const assignments = [];
  const params = [];

  Object.entries(payload).forEach(([field, value]) => {
    if (value === undefined) {
      return;
    }

    params.push(serializeValue(definition, field, value));
    assignments.push(`${field} = ${castPlaceholder(definition, field, `$${params.length}`)}`);
  });

  assignments.push('updated_at = CURRENT_TIMESTAMP');

  if (USER_TRACKED_ENTITIES.has(definition.key)) {
    params.push(userId || null);
    assignments.push(`atualizado_por_id = $${params.length}::integer`);
  }

  params.push(id);

  const result = await getClient(client).query(
    `
      UPDATE ${definition.table}
      SET ${assignments.join(', ')}
      WHERE id = $${params.length}
      RETURNING *;
    `,
    params
  );

  return result.rows[0] || null;
}

async function setStatus(definition, id, payload, userId, client = db) {
  return updateEntity(definition, id, payload, userId, client);
}

async function archiveEntity(definition, id, userId, client = db) {
  const statusField = definition.statusField || 'status';
  const payload = {
    [statusField]: 'arquivado',
  };

  if (definition.key === 'conteudos') {
    payload.arquivado_em = new Date().toISOString();
  }

  return updateEntity(definition, id, payload, userId, client);
}

async function listCategories() {
  const result = await db.query(
    `
      SELECT *
      FROM educacao_categorias
      ORDER BY ordem_exibicao ASC, nome ASC;
    `
  );

  return result.rows;
}

async function countAulasByStatus(trilhaId, status = 'publicado', client = db) {
  const result = await getClient(client).query(
    `
      SELECT COUNT(*)::int AS total
      FROM educacao_trilha_aulas
      WHERE trilha_id = $1
        AND status = $2;
    `,
    [trilhaId, status]
  );

  return result.rows[0]?.total || 0;
}

async function listAulas(trilhaId, { publicOnly = false, client = db } = {}) {
  const params = [trilhaId];
  const where = ['trilha_id = $1'];

  if (publicOnly) {
    params.push('publicado');
    where.push(`status = $${params.length}`);
  }

  const result = await getClient(client).query(
    `
      SELECT *
      FROM educacao_trilha_aulas
      WHERE ${where.join(' AND ')}
      ORDER BY ordem ASC, id ASC;
    `,
    params
  );

  return result.rows;
}

async function getAulaById(id, { client = db, forUpdate = false } = {}) {
  const result = await getClient(client).query(
    `
      SELECT *
      FROM educacao_trilha_aulas
      WHERE id = $1
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function createAula(definition, payload, client = db) {
  return createEntity(definition, payload, null, client);
}

async function updateAula(definition, id, payload, client = db) {
  return updateEntity(definition, id, payload, null, client);
}

async function getDashboardCounts() {
  const result = await db.query(
    `
      SELECT
        (SELECT COUNT(*)::int FROM educacao_conteudos) AS conteudos_total,
        (SELECT COUNT(*)::int FROM educacao_conteudos WHERE status = 'publicado' AND arquivado_em IS NULL) AS conteudos_publicados,
        (SELECT COUNT(*)::int FROM educacao_conteudos WHERE status = 'em_revisao') AS conteudos_em_revisao,
        (SELECT COUNT(*)::int FROM educacao_normas) AS normas_total,
        (SELECT COUNT(*)::int FROM educacao_normas WHERE status_vigencia = 'nao_verificada') AS normas_nao_verificadas,
        (SELECT COUNT(*)::int FROM educacao_agenda WHERE data_inicio >= date_trunc('month', CURRENT_DATE) AND data_inicio < date_trunc('month', CURRENT_DATE) + interval '1 month') AS agenda_mes,
        (SELECT COUNT(*)::int FROM educacao_materiais WHERE status = 'publicado') AS materiais_publicados,
        (SELECT COUNT(*)::int FROM educacao_trilhas) AS trilhas_total,
        (SELECT COUNT(*)::int FROM educacao_especies) AS especies_total,
        (SELECT COUNT(*)::int FROM educacao_areas_ambientais) AS areas_total,
        (
          (SELECT COUNT(*) FROM educacao_normas WHERE necessita_revisao = true)::int
          + (SELECT COUNT(*) FROM educacao_areas_ambientais WHERE status_validacao <> 'validado')::int
          + (SELECT COUNT(*) FROM educacao_conteudos WHERE status IN ('rascunho', 'em_revisao'))::int
        ) AS pendencias_validacao;
    `
  );

  return result.rows[0] || {};
}

async function getPublicHome() {
  const [categorias, destaques, normas, agenda, materiais, trilhas, faq, counts] = await Promise.all([
    listCategories(),
    db.query(
      `
        SELECT id, titulo, slug, resumo, categoria, publicado_em, destaque
        FROM educacao_conteudos
        WHERE status = 'publicado'
          AND arquivado_em IS NULL
          AND apto_para_portal_publico = true
        ORDER BY destaque DESC, ordem_exibicao ASC, publicado_em DESC NULLS LAST, id DESC
        LIMIT 6;
      `
    ),
    db.query(
      `
        SELECT id, titulo, numero, ano, tipo_norma, esfera, status_vigencia, resumo_cidadao, link_fonte
        FROM educacao_normas
        WHERE status_publicacao = 'publicado'
          AND status_vigencia <> 'nao_verificada'
        ORDER BY ano DESC NULLS LAST, titulo ASC
        LIMIT 6;
      `
    ),
    db.query(
      `
        SELECT id, titulo, descricao, data_inicio, data_fim, tipo_agenda, abrangencia, local, campanha_especial
        FROM educacao_agenda
        WHERE status = 'publicado'
        ORDER BY data_inicio ASC NULLS LAST, id DESC
        LIMIT 6;
      `
    ),
    db.query(
      `
        SELECT id, titulo, descricao, tipo_material, categoria, url_externa, arquivo_url
        FROM educacao_materiais
        WHERE status = 'publicado'
        ORDER BY created_at DESC, id DESC
        LIMIT 6;
      `
    ),
    db.query(
      `
        SELECT id, titulo, descricao, publico_alvo, nivel, carga_horaria_estimada, certificado_disponivel
        FROM educacao_trilhas
        WHERE status = 'publicado'
        ORDER BY ordem_exibicao ASC, id DESC
        LIMIT 6;
      `
    ),
    db.query(
      `
        SELECT id, pergunta, resposta, categoria
        FROM educacao_faq
        WHERE status = 'publicado'
        ORDER BY ordem_exibicao ASC, id DESC
        LIMIT 6;
      `
    ),
    db.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM educacao_conteudos WHERE status = 'publicado' AND arquivado_em IS NULL AND apto_para_portal_publico = true) AS conteudos,
          (SELECT COUNT(*)::int FROM educacao_normas WHERE status_publicacao = 'publicado' AND status_vigencia <> 'nao_verificada') AS normas,
          (SELECT COUNT(*)::int FROM educacao_agenda WHERE status = 'publicado') AS agenda,
          (SELECT COUNT(*)::int FROM educacao_materiais WHERE status = 'publicado') AS materiais,
          (SELECT COUNT(*)::int FROM educacao_trilhas WHERE status = 'publicado') AS trilhas,
          (SELECT COUNT(*)::int FROM educacao_especies WHERE status = 'publicado') AS especies,
          (SELECT COUNT(*)::int FROM educacao_areas_ambientais WHERE status_publicacao = 'publicado' AND status_validacao = 'validado') AS areas,
          (SELECT COUNT(*)::int FROM educacao_programas WHERE status IN ('planejado', 'em_execucao', 'concluido')) AS programas,
          (SELECT COUNT(*)::int FROM educacao_faq WHERE status = 'publicado') AS faq;
      `
    ),
  ]);

  return {
    nome_publico: 'Educação Ambiental Demonstrativa',
    aviso_institucional: 'Conteúdos educativos não substituem análise técnica formal da SMAD.',
    mensagem_base: 'Base pública em estruturação. Informações sujeitas à validação técnica.',
    categorias,
    destaques: destaques.rows,
    normas: normas.rows,
    agenda: agenda.rows,
    materiais: materiais.rows,
    trilhas: trilhas.rows,
    faq: faq.rows,
    indicadores: counts.rows[0] || {},
  };
}

function addCuradoriaSearch(filters, where, params, alias, fields) {
  if (!filters.q) {
    return;
  }

  params.push(`%${String(filters.q).toLowerCase()}%`);
  const ref = `$${params.length}`;
  where.push(`(${fields.map((field) => `LOWER(COALESCE(${alias}.${field}, '')) LIKE ${ref}`).join(' OR ')})`);
}

function addRawEquals(filters, where, params, alias, fields) {
  const raw = filters.raw || {};

  fields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(raw, field)) {
      return;
    }

    const value = raw[field];
    if (value === undefined || value === null || value === '') {
      return;
    }

    params.push(value);
    where.push(`${alias}.${field} = $${params.length}`);
  });
}

async function listFontes(filters, { client = db } = {}) {
  const alias = 'f';
  const params = [];
  const where = ['1 = 1'];

  addRawEquals(filters, where, params, alias, ['status', 'tipo_fonte', 'esfera', 'confiabilidade_padrao']);
  addCuradoriaSearch(filters, where, params, alias, ['nome', 'descricao', 'orgao_responsavel', 'observacoes']);

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const listParams = [...params, filters.limit, filters.offset];

  const [itemsResult, countResult] = await Promise.all([
    getClient(client).query(
      `
        SELECT ${alias}.*
        FROM educacao_fontes ${alias}
        WHERE ${where.join(' AND ')}
        ORDER BY ${alias}.${filters.orderBy} ${filters.orderDirection}, ${alias}.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      listParams
    ),
    getClient(client).query(
      `
        SELECT COUNT(*)::int AS total
        FROM educacao_fontes ${alias}
        WHERE ${where.join(' AND ')};
      `,
      params
    ),
  ]);

  return {
    items: itemsResult.rows,
    pagination: {
      page: filters.page,
      page_size: filters.limit,
      total_items: countResult.rows[0]?.total || 0,
      total_pages: Math.max(1, Math.ceil((countResult.rows[0]?.total || 0) / filters.limit)),
    },
  };
}

async function getFonteById(id, { client = db, forUpdate = false } = {}) {
  const result = await getClient(client).query(
    `
      SELECT *
      FROM educacao_fontes
      WHERE id = $1
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function createFonte(payload, userId, client = db) {
  return createEntity(
    FONTE_REPO_DEFINITION,
    {
      ...payload,
      criado_por_id: userId || null,
      atualizado_por_id: userId || null,
    },
    null,
    client
  );
}

async function updateFonte(id, payload, userId, client = db) {
  return updateEntity(
    FONTE_REPO_DEFINITION,
    id,
    {
      ...payload,
      atualizado_por_id: userId || null,
    },
    null,
    client
  );
}

async function updateFonteStatus(id, status, userId, client = db) {
  return updateFonte(id, { status }, userId, client);
}

async function listReferencias(filters, { client = db } = {}) {
  const alias = 'r';
  const params = [];
  const where = ['1 = 1'];
  const raw = filters.raw || {};

  addRawEquals(filters, where, params, alias, [
    'entidade_tipo',
    'tipo_evidencia',
    'confiabilidade',
    'status',
  ]);

  ['entidade_id', 'fonte_id'].forEach((field) => {
    if (raw[field] === undefined || raw[field] === null || raw[field] === '') {
      return;
    }
    params.push(Number(raw[field]));
    where.push(`${alias}.${field} = $${params.length}::integer`);
  });

  addCuradoriaSearch(filters, where, params, alias, ['titulo_referencia', 'descricao', 'observacoes']);

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const listParams = [...params, filters.limit, filters.offset];

  const [itemsResult, countResult] = await Promise.all([
    getClient(client).query(
      `
        SELECT ${alias}.*, f.nome AS fonte_nome
        FROM educacao_referencias ${alias}
        LEFT JOIN educacao_fontes f ON f.id = ${alias}.fonte_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${alias}.${filters.orderBy} ${filters.orderDirection}, ${alias}.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      listParams
    ),
    getClient(client).query(
      `
        SELECT COUNT(*)::int AS total
        FROM educacao_referencias ${alias}
        WHERE ${where.join(' AND ')};
      `,
      params
    ),
  ]);

  return {
    items: itemsResult.rows,
    pagination: {
      page: filters.page,
      page_size: filters.limit,
      total_items: countResult.rows[0]?.total || 0,
      total_pages: Math.max(1, Math.ceil((countResult.rows[0]?.total || 0) / filters.limit)),
    },
  };
}

async function getReferenciaById(id, { client = db, forUpdate = false } = {}) {
  const result = await getClient(client).query(
    `
      SELECT *
      FROM educacao_referencias
      WHERE id = $1
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function createReferencia(payload, userId, client = db) {
  return createEntity(
    REFERENCIA_REPO_DEFINITION,
    {
      ...payload,
      status: payload.status || 'ativo',
      criado_por_id: userId || null,
      atualizado_por_id: userId || null,
    },
    null,
    client
  );
}

async function updateReferencia(id, payload, userId, client = db) {
  return updateEntity(
    REFERENCIA_REPO_DEFINITION,
    id,
    {
      ...payload,
      atualizado_por_id: userId || null,
    },
    null,
    client
  );
}

async function archiveReferencia(id, userId, client = db) {
  return updateReferencia(id, { status: 'arquivado' }, userId, client);
}

async function countReferenciasByEntity(entidadeTipo, entidadeId, client = db) {
  const result = await getClient(client).query(
    `
      SELECT COUNT(*)::int AS total
      FROM educacao_referencias
      WHERE entidade_tipo = $1
        AND entidade_id = $2
        AND status = 'ativo';
    `,
    [entidadeTipo, entidadeId]
  );

  return result.rows[0]?.total || 0;
}

async function getCuradoriaDashboard() {
  const result = await db.query(
    `
      SELECT
        (SELECT COUNT(*)::int FROM educacao_conteudos WHERE status_curadoria IN ('em_levantamento', 'em_curadoria')) AS conteudos_em_curadoria,
        (
          SELECT COUNT(*)::int
          FROM educacao_conteudos c
          WHERE c.arquivado_em IS NULL
            AND c.status <> 'arquivado'
            AND COALESCE(c.fonte_referencia, '') = ''
            AND c.fonte_principal_id IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM educacao_referencias r
              WHERE r.entidade_tipo = 'conteudo'
                AND r.entidade_id = c.id
                AND r.status = 'ativo'
            )
        ) AS conteudos_sem_fonte,
        (SELECT COUNT(*)::int FROM educacao_conteudos WHERE status_curadoria = 'pendente_validacao_tecnica') AS pendentes_validacao_tecnica,
        (SELECT COUNT(*)::int FROM educacao_conteudos WHERE status_curadoria = 'pendente_validacao_juridica') AS pendentes_validacao_juridica,
        (SELECT COUNT(*)::int FROM educacao_normas WHERE status_vigencia = 'nao_verificada') AS normas_vigencia_nao_verificada,
        (
          SELECT COUNT(*)::int
          FROM educacao_especies
          WHERE status <> 'arquivado'
            AND COALESCE(fonte_referencia, '') = ''
        ) AS especies_sem_fonte,
        (SELECT COUNT(*)::int FROM educacao_areas_ambientais WHERE status_validacao <> 'validado') AS areas_sem_validacao,
        (SELECT COUNT(*)::int FROM educacao_conteudos WHERE status_curadoria = 'apto_publicacao' AND apto_para_portal_publico = true) AS aptos_publicacao,
        (SELECT COUNT(*)::int FROM educacao_conteudos WHERE apto_para_ia = true) AS aptos_ia,
        (SELECT COUNT(*)::int FROM educacao_conteudos WHERE status = 'publicado' AND apto_para_portal_publico = true AND arquivado_em IS NULL) AS publicados,
        (SELECT COUNT(*)::int FROM educacao_conteudos WHERE revisao_periodica_em IS NOT NULL AND revisao_periodica_em < CURRENT_DATE) AS revisao_vencida,
        (SELECT COUNT(*)::int FROM educacao_fontes WHERE status IN ('referencial_para_curadoria', 'a_verificar')) AS fontes_a_verificar,
        (SELECT COUNT(*)::int FROM educacao_referencias WHERE status = 'ativo') AS referencias_ativas;
    `
  );

  return result.rows[0] || {};
}

async function listCuradoriaPendencias(filters, { client = db } = {}) {
  const alias = 'c';
  const params = [];
  const where = [`${alias}.status <> 'arquivado'`];
  const raw = filters.raw || {};

  addRawEquals(filters, where, params, alias, [
    'status_curadoria',
    'grau_confiabilidade',
    'categoria',
    'eixo_tematico',
  ]);

  if (raw.responsavel) {
    params.push(Number(raw.responsavel));
    where.push(`${alias}.responsavel_curadoria_id = $${params.length}::integer`);
  }

  if (raw.sem_fonte === 'true' || raw.sem_fonte === true || raw.alerta === 'sem_fonte') {
    where.push(`(
      ${alias}.fonte_principal_id IS NULL
      AND COALESCE(${alias}.fonte_referencia, '') = ''
      AND ref.total = 0
    )`);
  }

  if (raw.revisao_vencida === 'true' || raw.alerta === 'revisao_vencida') {
    where.push(`${alias}.revisao_periodica_em IS NOT NULL AND ${alias}.revisao_periodica_em < CURRENT_DATE`);
  }

  if (raw.nao_apto_ia === 'true' || raw.alerta === 'nao_apto_ia') {
    where.push(`${alias}.apto_para_ia = false`);
  }

  addCuradoriaSearch(filters, where, params, alias, ['titulo', 'resumo', 'categoria', 'eixo_tematico']);

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const listParams = [...params, filters.limit, filters.offset];

  const [itemsResult, countResult] = await Promise.all([
    getClient(client).query(
      `
        SELECT
          ${alias}.*,
          f.nome AS fonte_principal_nome,
          ref.total AS referencias_total,
          (
            ${alias}.fonte_principal_id IS NULL
            AND COALESCE(${alias}.fonte_referencia, '') = ''
            AND ref.total = 0
          ) AS alerta_sem_fonte,
          (${alias}.grau_confiabilidade IN ('nao_verificado', 'relato_comunitario', 'levantamento_interno_sem_validacao')) AS alerta_confiabilidade_baixa,
          (${alias}.status_curadoria = 'pendente_validacao_tecnica') AS alerta_validacao_tecnica,
          (${alias}.status_curadoria = 'pendente_validacao_juridica') AS alerta_validacao_juridica,
          (${alias}.revisao_periodica_em IS NOT NULL AND ${alias}.revisao_periodica_em < CURRENT_DATE) AS alerta_revisao_vencida,
          (${alias}.apto_para_ia = false) AS alerta_nao_apto_ia
        FROM educacao_conteudos ${alias}
        LEFT JOIN educacao_fontes f ON f.id = ${alias}.fonte_principal_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS total
          FROM educacao_referencias r
          WHERE r.entidade_tipo = 'conteudo'
            AND r.entidade_id = ${alias}.id
            AND r.status = 'ativo'
        ) ref ON true
        WHERE ${where.join(' AND ')}
        ORDER BY ${alias}.${filters.orderBy} ${filters.orderDirection}, ${alias}.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      listParams
    ),
    getClient(client).query(
      `
        SELECT COUNT(*)::int AS total
        FROM educacao_conteudos ${alias}
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS total
          FROM educacao_referencias r
          WHERE r.entidade_tipo = 'conteudo'
            AND r.entidade_id = ${alias}.id
            AND r.status = 'ativo'
        ) ref ON true
        WHERE ${where.join(' AND ')};
      `,
      params
    ),
  ]);

  return {
    items: itemsResult.rows,
    pagination: {
      page: filters.page,
      page_size: filters.limit,
      total_items: countResult.rows[0]?.total || 0,
      total_pages: Math.max(1, Math.ceil((countResult.rows[0]?.total || 0) / filters.limit)),
    },
  };
}

async function updateConteudoCuradoria(id, payload, userId, client = db) {
  return updateEntity(ENTITY_DEFINITIONS.conteudos, id, payload, userId, client);
}

async function listBaseConhecimentoValidada() {
  const [conteudos, normas, faq, materiais, trilhas] = await Promise.all([
    db.query(
      `
        SELECT id, titulo, slug, resumo, categoria, eixo_tematico, publico_alvo, nivel, fonte_referencia, publicado_em
        FROM educacao_conteudos
        WHERE status = 'publicado'
          AND apto_para_ia = true
          AND apto_para_portal_publico = true
          AND arquivado_em IS NULL
        ORDER BY publicado_em DESC NULLS LAST, updated_at DESC
        LIMIT 200;
      `
    ),
    db.query(
      `
        SELECT id, titulo, numero, ano, tipo_norma, esfera, resumo_cidadao, status_vigencia, link_fonte
        FROM educacao_normas
        WHERE status_publicacao = 'publicado'
          AND status_vigencia <> 'nao_verificada'
        ORDER BY ano DESC NULLS LAST, titulo ASC
        LIMIT 200;
      `
    ),
    db.query(
      `
        SELECT id, pergunta, resposta, categoria, fonte_referencia
        FROM educacao_faq
        WHERE status = 'publicado'
        ORDER BY ordem_exibicao ASC, id DESC
        LIMIT 200;
      `
    ),
    db.query(
      `
        SELECT id, titulo, descricao, tipo_material, categoria, url_externa, arquivo_url, fonte
        FROM educacao_materiais
        WHERE status = 'publicado'
        ORDER BY updated_at DESC
        LIMIT 200;
      `
    ),
    db.query(
      `
        SELECT id, titulo, descricao, publico_alvo, nivel, carga_horaria_estimada
        FROM educacao_trilhas
        WHERE status = 'publicado'
        ORDER BY ordem_exibicao ASC, id DESC
        LIMIT 200;
      `
    ),
  ]);

  return {
    criterios: {
      escopo: 'Somente conteúdos publicados, validados e marcados como aptos para IA.',
      limite_institucional: 'Não substitui análise técnica formal, parecer, licença, autorização ou decisão administrativa.',
    },
    conteudos: conteudos.rows,
    normas: normas.rows,
    faq: faq.rows,
    materiais: materiais.rows,
    trilhas: trilhas.rows,
  };
}

module.exports = {
  archiveEntity,
  archiveReferencia,
  countAulasByStatus,
  countReferenciasByEntity,
  createAula,
  createEntity,
  createFonte,
  createReferencia,
  db,
  getAulaById,
  getClient,
  getConteudoBySlug,
  getCuradoriaDashboard,
  getDashboardCounts,
  getEntityById,
  getFonteById,
  getPublicHome,
  getReferenciaById,
  listBaseConhecimentoValidada,
  listAulas,
  listCategories,
  listCuradoriaPendencias,
  listEntity,
  listFontes,
  listReferencias,
  setStatus,
  updateAula,
  updateConteudoCuradoria,
  updateEntity,
  updateFonte,
  updateFonteStatus,
  updateReferencia,
  withTransaction,
};
