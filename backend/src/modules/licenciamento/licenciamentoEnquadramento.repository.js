const db = require('../../config/db');

const ENTITY_CONFIG = Object.freeze({
  atividades: {
    table: 'licenciamento_atividades',
    search: ['codigo', 'nome', 'categoria', 'cnae'],
    order: 'nome ASC, id ASC',
    fields: [
      'codigo',
      'nome',
      'descricao',
      'categoria',
      'cnae',
      'unidade_parametro_principal',
      'parametro_principal_label',
      'potencial_poluidor_padrao',
      'limite_impacto_local_tipo',
      'limite_impacto_local_valor',
      'limite_impacto_local_unidade',
      'mensagem_extrapolacao_competencia',
      'expressao_original',
      'fundamento_normativo',
      'tipo_atividade',
      'formula_codigo',
      'parametros_entrada',
      'perguntas_publicas',
      'bloqueios_publicos',
      'alertas_publicos',
      'validacoes_requeridas',
      'seed_piloto_codigo',
      'ativo',
      'observacoes',
    ],
  },
  tiposLicenca: {
    table: 'licenciamento_tipos_licenca',
    search: ['codigo', 'nome', 'natureza'],
    order: 'codigo ASC, id ASC',
    fields: [
      'codigo',
      'nome',
      'descricao',
      'natureza',
      'exige_analise_tecnica',
      'permite_emissao_publica',
      'ativo',
    ],
  },
  potenciaisPoluidor: {
    table: 'licenciamento_potenciais_poluidor',
    search: ['codigo', 'nome'],
    order: 'peso ASC, nome ASC',
    fields: ['codigo', 'nome', 'peso', 'descricao', 'ativo'],
  },
  classes: {
    table: 'licenciamento_classes',
    search: ['codigo', 'nome'],
    order: 'ordem ASC, nome ASC',
    fields: ['codigo', 'nome', 'descricao', 'ordem', 'ativo'],
  },
  regrasEnquadramento: {
    table: 'licenciamento_regras_enquadramento',
    search: ['parametro_nome', 'porte_resultante', 'fundamento_normativo', 'observacao_publica'],
    order: 'id DESC',
    fields: [
      'atividade_id',
      'tipo_licenca_id',
      'classe_id',
      'potencial_poluidor_id',
      'parametro_nome',
      'parametro_unidade',
      'valor_minimo',
      'valor_maximo',
      'operador',
      'porte_resultante',
      'dispensa_possivel',
      'exige_vistoria',
      'exige_estudo_ambiental',
      'exige_anuencia',
      'exige_georreferenciamento',
      'observacao_publica',
      'observacao_interna',
      'fundamento_normativo',
      'expressao_original',
      'requer_validacao_tecnica',
      'limite_impacto_local_tipo',
      'limite_impacto_local_valor',
      'limite_impacto_local_unidade',
      'mensagem_extrapolacao_competencia',
      'tipo_calculo',
      'formula_codigo',
      'parametros_entrada',
      'status_resultado',
      'tipo_resultado',
      'alertas_tecnicos',
      'bloqueios',
      'seed_piloto_codigo',
      'vigencia_inicio',
      'vigencia_fim',
      'ativo',
    ],
  },
  regraParametros: {
    table: 'licenciamento_regra_parametros',
    search: ['parametro_chave', 'parametro_label', 'parametro_unidade', 'expressao_original'],
    order: 'regra_enquadramento_id ASC, ordem ASC, id ASC',
    fields: [
      'regra_enquadramento_id',
      'parametro_chave',
      'parametro_label',
      'parametro_unidade',
      'operador',
      'valor_minimo',
      'valor_maximo',
      'inclui_minimo',
      'inclui_maximo',
      'obrigatorio',
      'ordem',
      'expressao_original',
    ],
  },
  documentosExigidos: {
    table: 'licenciamento_documentos_exigidos',
    search: ['nome_documento', 'descricao', 'fundamento'],
    order: 'ordem ASC, nome_documento ASC, id ASC',
    fields: [
      'atividade_id',
      'regra_enquadramento_id',
      'tipo_licenca_id',
      'nome_documento',
      'descricao',
      'obrigatorio',
      'aplicavel_pessoa_fisica',
      'aplicavel_pessoa_juridica',
      'aplicavel_imovel_rural',
      'aplicavel_imovel_urbano',
      'exige_responsavel_tecnico',
      'exige_art_rrt',
      'ordem',
      'fundamento',
      'ativo',
    ],
  },
  regrasTaxas: {
    table: 'licenciamento_regras_taxas',
    search: ['porte', 'formula', 'unidade_referencia', 'observacao'],
    order: 'id DESC',
    fields: [
      'tipo_licenca_id',
      'classe_id',
      'porte',
      'potencial_poluidor_id',
      'valor_fixo',
      'quantidade_vrte',
      'fator_padrao',
      'tipo_taxa',
      'tipo_atividade',
      'servico_administrativo_codigo',
      'formula',
      'formula_codigo',
      'formula_descricao',
      'usa_formula',
      'unidade_referencia',
      'observacao',
      'fundamento_normativo',
      'vigencia_inicio',
      'vigencia_fim',
      'ativo',
    ],
  },
  normas: {
    table: 'licenciamento_normas',
    search: ['titulo', 'numero', 'orgao', 'ementa'],
    order: 'ano DESC NULLS LAST, titulo ASC',
    fields: [
      'titulo',
      'codigo',
      'tipo',
      'numero',
      'ano',
      'esfera',
      'orgao',
      'ementa',
      'link_url',
      'arquivo_documento_id',
      'observacao',
      'ativo',
    ],
  },
  vrte: {
    table: 'licenciamento_vrte_exercicios',
    search: ['ano', 'fundamento_normativo', 'observacao'],
    order: 'ano DESC, id DESC',
    fields: [
      'ano',
      'valor_vrte',
      'data_inicio_vigencia',
      'data_fim_vigencia',
      'ativo',
      'fundamento_normativo',
      'observacao',
    ],
  },
});

function getEntityConfig(entityKey) {
  const config = ENTITY_CONFIG[entityKey];

  if (!config) {
    const error = new Error('Entidade de parametrizacao invalida.');
    error.statusCode = 400;
    throw error;
  }

  return config;
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

function appendSearchFilter(where, params, config, filters) {
  if (filters.q && config.search?.length) {
    params.push(`%${filters.q.toLowerCase()}%`);
    const param = params.length;
    where.push(`(${config.search.map((field) => `LOWER(COALESCE(${field}::text, '')) LIKE $${param}`).join(' OR ')})`);
  }

  if (filters.categoria && config.fields.includes('categoria')) {
    params.push(filters.categoria);
    where.push(`categoria = $${params.length}`);
  }

  if (filters.codigo && config.fields.includes('codigo')) {
    params.push(filters.codigo.toLowerCase());
    where.push(`LOWER(codigo) = $${params.length}`);
  }

  if (filters.tipo && config.fields.includes('tipo')) {
    params.push(filters.tipo);
    where.push(`tipo = $${params.length}`);
  }

  if (filters.esfera && config.fields.includes('esfera')) {
    params.push(filters.esfera);
    where.push(`esfera = $${params.length}`);
  }

  if (filters.atividade_id && config.fields.includes('atividade_id')) {
    params.push(filters.atividade_id);
    where.push(`atividade_id = $${params.length}`);
  }

  if (filters.regra_enquadramento_id && config.fields.includes('regra_enquadramento_id')) {
    params.push(filters.regra_enquadramento_id);
    where.push(`regra_enquadramento_id = $${params.length}`);
  }
}

async function listEntity(entityKey, filters) {
  const config = getEntityConfig(entityKey);
  const where = ['deleted_at IS NULL'];
  const params = [];
  appendSearchFilter(where, params, config, filters);

  params.push(filters.page_size);
  const limitParam = params.length;
  params.push((filters.page - 1) * filters.page_size);
  const offsetParam = params.length;

  const [itemsResult, countResult] = await Promise.all([
    db.query(
      `
        SELECT *
        FROM ${config.table}
        WHERE ${where.join(' AND ')}
        ORDER BY ${config.order}
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      params
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM ${config.table}
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

async function getEntityById(entityKey, id, client = db, { forUpdate = false } = {}) {
  const config = getEntityConfig(entityKey);
  const result = await client.query(
    `
      SELECT *
      FROM ${config.table}
      WHERE id = $1
        AND deleted_at IS NULL
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function createEntity(entityKey, payload, client = db) {
  const config = getEntityConfig(entityKey);
  const fields = config.fields.filter((field) => Object.prototype.hasOwnProperty.call(payload, field));
  const values = fields.map((field) => payload[field]);
  const placeholders = fields.map((_, index) => `$${index + 1}`);

  const result = await client.query(
    `
      INSERT INTO ${config.table} (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *;
    `,
    values
  );

  return result.rows[0];
}

async function updateEntity(entityKey, id, payload, client = db) {
  const config = getEntityConfig(entityKey);
  const fields = config.fields.filter((field) => Object.prototype.hasOwnProperty.call(payload, field));

  if (fields.length === 0) {
    const error = new Error('Informe ao menos um campo para atualizacao.');
    error.statusCode = 400;
    throw error;
  }

  const values = fields.map((field) => payload[field]);
  const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
  values.push(id);

  const result = await client.query(
    `
      UPDATE ${config.table}
      SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
        AND deleted_at IS NULL
      RETURNING *;
    `,
    values
  );

  return result.rows[0] || null;
}

async function softDeleteEntity(entityKey, id, client = db) {
  const config = getEntityConfig(entityKey);
  const ativoAssignment = config.fields.includes('ativo') ? 'ativo = false,' : '';
  const result = await client.query(
    `
      UPDATE ${config.table}
      SET deleted_at = CURRENT_TIMESTAMP,
          ${ativoAssignment}
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function listRegras(filters) {
  const params = [];
  const where = ['r.deleted_at IS NULL'];

  if (filters.atividade_id) {
    params.push(filters.atividade_id);
    where.push(`r.atividade_id = $${params.length}`);
  }

  if (filters.q) {
    params.push(`%${filters.q.toLowerCase()}%`);
    where.push(`(
      LOWER(a.nome) LIKE $${params.length}
      OR LOWER(COALESCE(t.nome, '')) LIKE $${params.length}
      OR LOWER(COALESCE(c.nome, '')) LIKE $${params.length}
      OR LOWER(COALESCE(r.porte_resultante, '')) LIKE $${params.length}
    )`);
  }

  params.push(filters.page_size);
  const limitParam = params.length;
  params.push((filters.page - 1) * filters.page_size);
  const offsetParam = params.length;

  const [itemsResult, countResult] = await Promise.all([
    db.query(
      `
        SELECT
          r.*,
          a.codigo AS atividade_codigo,
          a.nome AS atividade_nome,
          t.codigo AS tipo_licenca_codigo,
          t.nome AS tipo_licenca_nome,
          c.codigo AS classe_codigo,
          c.nome AS classe_nome,
          p.codigo AS potencial_codigo,
          p.nome AS potencial_nome
        FROM licenciamento_regras_enquadramento r
        JOIN licenciamento_atividades a ON a.id = r.atividade_id
        LEFT JOIN licenciamento_tipos_licenca t ON t.id = r.tipo_licenca_id
        LEFT JOIN licenciamento_classes c ON c.id = r.classe_id
        LEFT JOIN licenciamento_potenciais_poluidor p ON p.id = r.potencial_poluidor_id
        WHERE ${where.join(' AND ')}
        ORDER BY r.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      params
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM licenciamento_regras_enquadramento r
        JOIN licenciamento_atividades a ON a.id = r.atividade_id
        LEFT JOIN licenciamento_tipos_licenca t ON t.id = r.tipo_licenca_id
        LEFT JOIN licenciamento_classes c ON c.id = r.classe_id
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

async function listNormasPublicas(filters) {
  const params = [];
  const where = ['n.deleted_at IS NULL', 'n.ativo = true'];

  if (filters.q) {
    params.push(`%${filters.q.toLowerCase()}%`);
    where.push(`(
      LOWER(n.titulo) LIKE $${params.length}
      OR LOWER(COALESCE(n.ementa, '')) LIKE $${params.length}
      OR LOWER(COALESCE(n.numero, '')) LIKE $${params.length}
    )`);
  }

  if (filters.tipo) {
    params.push(filters.tipo);
    where.push(`n.tipo = $${params.length}`);
  }

  if (filters.esfera) {
    params.push(filters.esfera);
    where.push(`n.esfera = $${params.length}`);
  }

  if (filters.atividade_id) {
    params.push(filters.atividade_id);
    where.push(`EXISTS (
      SELECT 1
      FROM licenciamento_normas_vinculos nv
      WHERE nv.norma_id = n.id
        AND nv.deleted_at IS NULL
        AND nv.atividade_id = $${params.length}
    )`);
  }

  const result = await db.query(
    `
      SELECT n.id, n.titulo, n.tipo, n.numero, n.ano, n.esfera, n.orgao, n.ementa, n.link_url, n.observacao
      FROM licenciamento_normas n
      WHERE ${where.join(' AND ')}
      ORDER BY n.ano DESC NULLS LAST, n.titulo ASC
      LIMIT 100;
    `,
    params
  );

  return result.rows;
}

async function listPublicActivities(filters) {
  const params = [];
  const where = ['deleted_at IS NULL', 'ativo = true'];

  if (filters.q) {
    params.push(`%${filters.q.toLowerCase()}%`);
    where.push(`(
      LOWER(codigo) LIKE $${params.length}
      OR LOWER(nome) LIKE $${params.length}
      OR LOWER(COALESCE(categoria, '')) LIKE $${params.length}
      OR LOWER(COALESCE(cnae, '')) LIKE $${params.length}
    )`);
  }

  if (filters.categoria) {
    params.push(filters.categoria);
    where.push(`categoria = $${params.length}`);
  }

  if (filters.codigo) {
    params.push(filters.codigo.toLowerCase());
    where.push(`LOWER(codigo) = $${params.length}`);
  }

  const result = await db.query(
    `
      SELECT
        id,
        codigo,
        nome,
        descricao,
        categoria,
        cnae,
        unidade_parametro_principal,
        parametro_principal_label,
        potencial_poluidor_padrao,
        tipo_atividade,
        formula_codigo,
        parametros_entrada,
        perguntas_publicas,
        bloqueios_publicos,
        alertas_publicos,
        validacoes_requeridas,
        limite_impacto_local_tipo,
        limite_impacto_local_valor,
        limite_impacto_local_unidade,
        mensagem_extrapolacao_competencia
      FROM licenciamento_atividades
      WHERE ${where.join(' AND ')}
      ORDER BY codigo ASC, nome ASC
      LIMIT 100;
    `,
    params
  );

  if (result.rows.length === 0) return [];

  const activityIds = result.rows.map((row) => row.id);
  const parametrosResult = await db.query(
    `
      SELECT DISTINCT ON (rp.parametro_chave, r.atividade_id)
        r.atividade_id,
        rp.parametro_chave,
        rp.parametro_label,
        rp.parametro_unidade,
        rp.obrigatorio,
        rp.ordem,
        rp.expressao_original
      FROM licenciamento_regra_parametros rp
      JOIN licenciamento_regras_enquadramento r ON r.id = rp.regra_enquadramento_id
      WHERE rp.deleted_at IS NULL
        AND r.deleted_at IS NULL
        AND r.ativo = true
        AND r.atividade_id = ANY($1::int[])
      ORDER BY rp.parametro_chave, r.atividade_id, rp.ordem ASC, rp.id ASC;
    `,
    [activityIds]
  );

  const parametrosByActivity = parametrosResult.rows.reduce((acc, row) => {
    if (!acc[row.atividade_id]) acc[row.atividade_id] = [];
    acc[row.atividade_id].push({
      parametro_chave: row.parametro_chave,
      parametro_label: row.parametro_label,
      parametro_unidade: row.parametro_unidade,
      obrigatorio: row.obrigatorio,
      ordem: row.ordem,
      expressao_original: row.expressao_original,
    });
    return acc;
  }, {});

  return result.rows.map((row) => ({
    ...row,
    parametros_regras: parametrosByActivity[row.id] || [],
  }));
}

async function getAtividadePublica(id) {
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_atividades
      WHERE id = $1
        AND ativo = true
        AND deleted_at IS NULL;
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function listActiveRulesForActivity(atividadeId) {
  const result = await db.query(
    `
      SELECT
        r.*,
        t.codigo AS tipo_licenca_codigo,
        t.nome AS tipo_licenca_nome,
        t.descricao AS tipo_licenca_descricao,
        c.codigo AS classe_codigo,
        c.nome AS classe_nome,
        c.descricao AS classe_descricao,
        p.codigo AS potencial_codigo,
        p.nome AS potencial_nome,
        p.descricao AS potencial_descricao
      FROM licenciamento_regras_enquadramento r
      LEFT JOIN licenciamento_tipos_licenca t ON t.id = r.tipo_licenca_id
      LEFT JOIN licenciamento_classes c ON c.id = r.classe_id
      LEFT JOIN licenciamento_potenciais_poluidor p ON p.id = r.potencial_poluidor_id
      WHERE r.atividade_id = $1
        AND r.ativo = true
        AND r.deleted_at IS NULL
        AND (r.vigencia_inicio IS NULL OR r.vigencia_inicio <= CURRENT_DATE)
        AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= CURRENT_DATE)
      ORDER BY
        CASE WHEN r.valor_minimo IS NULL AND r.valor_maximo IS NULL THEN 1 ELSE 0 END,
        r.valor_minimo NULLS FIRST,
        r.valor_maximo NULLS LAST,
        r.id ASC;
    `,
    [atividadeId]
  );

  return result.rows;
}

async function listParametrosForRules(ruleIds) {
  if (!ruleIds?.length) return {};

  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_regra_parametros
      WHERE deleted_at IS NULL
        AND regra_enquadramento_id = ANY($1::int[])
      ORDER BY regra_enquadramento_id ASC, ordem ASC, id ASC;
    `,
    [ruleIds]
  );

  return result.rows.reduce((acc, row) => {
    if (!acc[row.regra_enquadramento_id]) acc[row.regra_enquadramento_id] = [];
    acc[row.regra_enquadramento_id].push(row);
    return acc;
  }, {});
}

async function listDocumentosForSimulation({ atividadeId, regraId, tipoLicencaId, tipoPessoa, tipoImovel }) {
  const params = [atividadeId || null, regraId || null, tipoLicencaId || null];
  const pessoaField = tipoPessoa === 'fisica' ? 'aplicavel_pessoa_fisica' : 'aplicavel_pessoa_juridica';
  const imovelField = tipoImovel === 'rural' ? 'aplicavel_imovel_rural' : 'aplicavel_imovel_urbano';

  const result = await db.query(
    `
      SELECT DISTINCT ON (nome_documento)
        id,
        nome_documento,
        descricao,
        obrigatorio,
        exige_responsavel_tecnico,
        exige_art_rrt,
        ordem,
        fundamento
      FROM licenciamento_documentos_exigidos
      WHERE deleted_at IS NULL
        AND ativo = true
        AND ${pessoaField} = true
        AND ${imovelField} = true
        AND (
          atividade_id = $1
          OR regra_enquadramento_id = $2
          OR tipo_licenca_id = $3
        )
      ORDER BY nome_documento, obrigatorio DESC, ordem ASC, id ASC;
    `,
    params
  );

  return result.rows.sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
}

async function listNormasForSimulation({ atividadeId, regraId, tipoLicencaId }) {
  const result = await db.query(
    `
      SELECT DISTINCT
        n.id,
        n.titulo,
        n.tipo,
        n.numero,
        n.ano,
        n.esfera,
        n.orgao,
        n.ementa,
        n.link_url,
        nv.descricao_vinculo
      FROM licenciamento_normas n
      JOIN licenciamento_normas_vinculos nv ON nv.norma_id = n.id
      WHERE n.deleted_at IS NULL
        AND n.ativo = true
        AND nv.deleted_at IS NULL
        AND (
          nv.atividade_id = $1
          OR nv.regra_enquadramento_id = $2
          OR nv.tipo_licenca_id = $3
        )
      ORDER BY n.ano DESC NULLS LAST, n.titulo ASC;
    `,
    [atividadeId || null, regraId || null, tipoLicencaId || null]
  );

  return result.rows;
}

async function findTaxaRule({ tipoLicencaId, classeId, porte, potencialPoluidorId, tipoAtividade }) {
  if (!tipoLicencaId) return null;

  const result = await db.query(
    `
      SELECT
        rt.*,
        tt.codigo AS tabela_taxa_codigo,
        tt.nome AS tabela_taxa_nome,
        tt.status AS tabela_taxa_status,
        tt.operacional AS tabela_taxa_operacional,
        tt.piloto AS tabela_taxa_piloto,
        tt.requer_conferencia_juridica AS tabela_taxa_requer_conferencia_juridica,
        tt.validada_para_cobranca AS tabela_taxa_validada_para_cobranca
      FROM licenciamento_regras_taxas rt
      LEFT JOIN licenciamento_tabelas_taxas tt ON tt.id = rt.tabela_taxa_id
      WHERE rt.deleted_at IS NULL
        AND rt.ativo = true
        AND rt.tipo_licenca_id = $1
        AND (rt.classe_id = $2 OR rt.classe_id IS NULL)
        AND (rt.porte = $3 OR rt.porte IS NULL)
        AND (rt.potencial_poluidor_id = $4 OR rt.potencial_poluidor_id IS NULL)
        AND (rt.tipo_atividade = $5 OR rt.tipo_atividade IS NULL)
        AND (rt.vigencia_inicio IS NULL OR rt.vigencia_inicio <= CURRENT_DATE)
        AND (rt.vigencia_fim IS NULL OR rt.vigencia_fim >= CURRENT_DATE)
      ORDER BY
        CASE WHEN rt.tipo_atividade IS NULL THEN 1 ELSE 0 END,
        CASE WHEN rt.classe_id IS NULL THEN 1 ELSE 0 END,
        CASE WHEN rt.porte IS NULL THEN 1 ELSE 0 END,
        CASE WHEN rt.potencial_poluidor_id IS NULL THEN 1 ELSE 0 END,
        rt.id DESC
      LIMIT 1;
    `,
    [tipoLicencaId, classeId || null, porte || null, potencialPoluidorId || null, tipoAtividade || null]
  );

  return result.rows[0] || null;
}

async function findTaxaServicoAdministrativo(servicoCodigo) {
  if (!servicoCodigo) return null;

  const result = await db.query(
    `
      SELECT
        rt.*,
        tt.codigo AS tabela_taxa_codigo,
        tt.nome AS tabela_taxa_nome,
        tt.status AS tabela_taxa_status,
        tt.operacional AS tabela_taxa_operacional,
        tt.piloto AS tabela_taxa_piloto,
        tt.requer_conferencia_juridica AS tabela_taxa_requer_conferencia_juridica,
        tt.validada_para_cobranca AS tabela_taxa_validada_para_cobranca
      FROM licenciamento_regras_taxas rt
      LEFT JOIN licenciamento_tabelas_taxas tt ON tt.id = rt.tabela_taxa_id
      WHERE rt.deleted_at IS NULL
        AND rt.ativo = true
        AND rt.tipo_taxa = 'servico_administrativo'
        AND rt.servico_administrativo_codigo = $1
        AND (rt.vigencia_inicio IS NULL OR rt.vigencia_inicio <= CURRENT_DATE)
        AND (rt.vigencia_fim IS NULL OR rt.vigencia_fim >= CURRENT_DATE)
      ORDER BY rt.id DESC
      LIMIT 1;
    `,
    [servicoCodigo]
  );

  return result.rows[0] || null;
}

async function getActiveVrte({ year = null, date = new Date() } = {}) {
  const targetYear = year || date.getFullYear();
  const dateValue = date.toISOString().slice(0, 10);
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_vrte_exercicios
      WHERE deleted_at IS NULL
        AND ativo = true
        AND ano = $1
        AND (data_inicio_vigencia IS NULL OR data_inicio_vigencia <= $2::date)
        AND (data_fim_vigencia IS NULL OR data_fim_vigencia >= $2::date)
      ORDER BY data_inicio_vigencia DESC NULLS LAST, id DESC
      LIMIT 1;
    `,
    [targetYear, dateValue]
  );

  return result.rows[0] || null;
}

async function getNextSimulationId(client) {
  const result = await client.query(
    "SELECT nextval(pg_get_serial_sequence('licenciamento_simulacoes', 'id')) AS id;"
  );
  return Number(result.rows[0].id);
}

function buildSimulationProtocol(id, date = new Date()) {
  return `SIGMA-LIC-SIM-${date.getFullYear()}-${String(id).padStart(6, '0')}`;
}

async function createSimulation(client, payload, respostas = []) {
  const id = await getNextSimulationId(client);
  const protocolo = buildSimulationProtocol(id);

  const result = await client.query(
    `
      INSERT INTO licenciamento_simulacoes (
        id,
        protocolo_simulacao,
        atividade_id,
        regra_enquadramento_id,
        tipo_licenca_sugerida_id,
        classe_sugerida_id,
        potencial_poluidor_sugerido_id,
        parametro_informado,
        parametro_unidade,
        valor_parametro,
        porte_estimado,
        dispensa_possivel,
        taxa_estimativa,
        taxa_status,
        taxa_regra_id,
        taxa_quantidade_vrte,
        taxa_valor_unitario_vrte,
        taxa_fator,
        taxa_valor_total_calculado,
        taxa_ano_exercicio_vrte,
        taxa_memoria_calculo,
        taxa_data_calculo,
        parametros_informados,
        status_resultado,
        indice_calculado,
        formula_codigo_usado,
        alertas_tecnicos,
        bloqueios,
        resultado_resumo,
        alertas,
        nome_interessado,
        email_interessado,
        telefone_interessado,
        identificacao_tipo,
        origem
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22,
        $23::jsonb, $24, $25, $26, $27::jsonb, $28::jsonb, $29, $30::jsonb, $31, $32, $33, $34, $35
      )
      RETURNING *;
    `,
    [
      id,
      protocolo,
      payload.atividade_id,
      payload.regra_enquadramento_id,
      payload.tipo_licenca_sugerida_id,
      payload.classe_sugerida_id,
      payload.potencial_poluidor_sugerido_id,
      payload.parametro_informado,
      payload.parametro_unidade,
      payload.valor_parametro,
      payload.porte_estimado,
      payload.dispensa_possivel,
      payload.taxa_estimativa,
      payload.taxa_status,
      payload.taxa_regra_id || null,
      payload.taxa_quantidade_vrte || null,
      payload.taxa_valor_unitario_vrte || null,
      payload.taxa_fator || null,
      payload.taxa_valor_total_calculado || null,
      payload.taxa_ano_exercicio_vrte || null,
      payload.taxa_memoria_calculo || null,
      payload.taxa_data_calculo || null,
      JSON.stringify(payload.parametros_informados || {}),
      payload.status_resultado || null,
      payload.indice_calculado || null,
      payload.formula_codigo_usado || null,
      JSON.stringify(payload.alertas_tecnicos || []),
      JSON.stringify(payload.bloqueios || []),
      payload.resultado_resumo,
      JSON.stringify(payload.alertas || []),
      payload.nome_interessado,
      payload.email_interessado,
      payload.telefone_interessado,
      payload.identificacao_tipo || 'anonima',
      payload.origem || 'painel_publico_sigma',
    ]
  );

  if (payload.taxa_status) {
    await createSimulationTaxa(client, id, {
      regra_taxa_id: payload.taxa_regra_id || null,
      quantidade_vrte: payload.taxa_quantidade_vrte || null,
      valor_unitario_vrte: payload.taxa_valor_unitario_vrte || null,
      fator: payload.taxa_fator || null,
      valor_total_calculado: payload.taxa_valor_total_calculado || null,
      ano_exercicio_vrte: payload.taxa_ano_exercicio_vrte || null,
      memoria_calculo: payload.taxa_memoria_calculo || null,
      status: payload.taxa_status,
      observacao: payload.taxa_observacao || null,
    });
  }

  for (const resposta of respostas) {
    await client.query(
      `
        INSERT INTO licenciamento_simulacao_respostas (
          simulacao_id,
          pergunta_chave,
          pergunta_texto,
          resposta_valor,
          resposta_texto
        )
        VALUES ($1, $2, $3, $4, $5);
      `,
      [
        id,
        resposta.pergunta_chave,
        resposta.pergunta_texto,
        resposta.resposta_valor,
        resposta.resposta_texto,
      ]
    );
  }

  return result.rows[0];
}

async function createSimulationTaxa(client, simulacaoId, payload) {
  const result = await client.query(
    `
      INSERT INTO licenciamento_simulacao_taxas (
        simulacao_id,
        regra_taxa_id,
        quantidade_vrte,
        valor_unitario_vrte,
        fator,
        valor_total_calculado,
        ano_exercicio_vrte,
        memoria_calculo,
        status,
        observacao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `,
    [
      simulacaoId,
      payload.regra_taxa_id,
      payload.quantidade_vrte,
      payload.valor_unitario_vrte,
      payload.fator,
      payload.valor_total_calculado,
      payload.ano_exercicio_vrte,
      payload.memoria_calculo,
      payload.status,
      payload.observacao,
    ]
  );

  return result.rows[0];
}

async function getPublicSimulationByProtocol(protocolo) {
  const result = await db.query(
    `
      SELECT
        s.protocolo_simulacao,
        s.parametro_informado,
        s.parametro_unidade,
        s.valor_parametro,
        s.porte_estimado,
        s.dispensa_possivel,
        s.taxa_estimativa,
        s.taxa_status,
        s.taxa_regra_id,
        s.taxa_quantidade_vrte,
        s.taxa_valor_unitario_vrte,
        s.taxa_fator,
        s.taxa_valor_total_calculado,
        s.taxa_ano_exercicio_vrte,
        s.taxa_memoria_calculo,
        s.taxa_data_calculo,
        s.parametros_informados,
        s.status_resultado,
        s.indice_calculado,
        s.formula_codigo_usado,
        s.alertas_tecnicos,
        s.bloqueios,
        s.resultado_resumo,
        s.alertas,
        s.created_at,
        a.codigo AS atividade_codigo,
        a.nome AS atividade_nome,
        t.codigo AS tipo_licenca_codigo,
        t.nome AS tipo_licenca_nome,
        c.codigo AS classe_codigo,
        c.nome AS classe_nome,
        p.codigo AS potencial_codigo,
        p.nome AS potencial_nome
      FROM licenciamento_simulacoes s
      LEFT JOIN licenciamento_atividades a ON a.id = s.atividade_id
      LEFT JOIN licenciamento_tipos_licenca t ON t.id = s.tipo_licenca_sugerida_id
      LEFT JOIN licenciamento_classes c ON c.id = s.classe_sugerida_id
      LEFT JOIN licenciamento_potenciais_poluidor p ON p.id = s.potencial_poluidor_sugerido_id
      WHERE s.protocolo_simulacao = $1
        AND s.deleted_at IS NULL;
    `,
    [protocolo]
  );

  return result.rows[0] || null;
}

async function createNormaVinculo(client, normaId, payload) {
  const result = await client.query(
    `
      INSERT INTO licenciamento_normas_vinculos (
        norma_id,
        atividade_id,
        regra_enquadramento_id,
        tipo_licenca_id,
        descricao_vinculo
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `,
    [
      normaId,
      payload.atividade_id,
      payload.regra_enquadramento_id,
      payload.tipo_licenca_id,
      payload.descricao_vinculo,
    ]
  );

  return result.rows[0];
}

async function softDeleteNormaVinculo(client, vinculoId) {
  const result = await client.query(
    `
      UPDATE licenciamento_normas_vinculos
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING *;
    `,
    [vinculoId]
  );

  return result.rows[0] || null;
}

async function listSimulacoes(filters) {
  const params = [];
  const where = ['s.deleted_at IS NULL'];

  if (filters.q) {
    params.push(`%${filters.q.toLowerCase()}%`);
    where.push(`(
      LOWER(s.protocolo_simulacao) LIKE $${params.length}
      OR LOWER(COALESCE(a.nome, '')) LIKE $${params.length}
    )`);
  }

  params.push(filters.page_size);
  const limitParam = params.length;
  params.push((filters.page - 1) * filters.page_size);
  const offsetParam = params.length;

  const [itemsResult, countResult] = await Promise.all([
    db.query(
      `
        SELECT
          s.id,
          s.protocolo_simulacao,
          s.valor_parametro,
          s.parametro_unidade,
          s.porte_estimado,
          s.status_resultado,
          s.dispensa_possivel,
          s.taxa_status,
          s.created_at,
          a.codigo AS atividade_codigo,
          a.nome AS atividade_nome,
          t.codigo AS tipo_licenca_codigo,
          t.nome AS tipo_licenca_nome,
          c.nome AS classe_nome,
          p.nome AS potencial_nome
        FROM licenciamento_simulacoes s
        LEFT JOIN licenciamento_atividades a ON a.id = s.atividade_id
        LEFT JOIN licenciamento_tipos_licenca t ON t.id = s.tipo_licenca_sugerida_id
        LEFT JOIN licenciamento_classes c ON c.id = s.classe_sugerida_id
        LEFT JOIN licenciamento_potenciais_poluidor p ON p.id = s.potencial_poluidor_sugerido_id
        WHERE ${where.join(' AND ')}
        ORDER BY s.created_at DESC, s.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam};
      `,
      params
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM licenciamento_simulacoes s
        LEFT JOIN licenciamento_atividades a ON a.id = s.atividade_id
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

async function getParametrizacaoStatus() {
  const result = await db.query(
    `
      SELECT
        EXISTS (
          SELECT 1
          FROM licenciamento_vrte_exercicios
          WHERE deleted_at IS NULL AND ativo = true AND ano = 2026
        ) AS vrte_2026_cadastrada,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_regras_taxas
          WHERE deleted_at IS NULL AND ativo = true
        ) AS taxas_cadastradas,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_normas
          WHERE deleted_at IS NULL AND ativo = true
        ) AS normas_cadastradas,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_atividades
          WHERE deleted_at IS NULL AND ativo = true AND seed_piloto_codigo = 'fase2b'
        ) AS atividades_piloto,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_regras_enquadramento
          WHERE deleted_at IS NULL AND ativo = true AND seed_piloto_codigo LIKE 'fase2b:%'
        ) AS regras_piloto,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_regra_parametros rp
          JOIN licenciamento_regras_enquadramento r ON r.id = rp.regra_enquadramento_id
          WHERE rp.deleted_at IS NULL AND r.deleted_at IS NULL AND r.seed_piloto_codigo LIKE 'fase2b:%'
        ) AS parametros_piloto,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_documentos_exigidos d
          JOIN licenciamento_atividades a ON a.id = d.atividade_id
          WHERE d.deleted_at IS NULL AND d.ativo = true AND a.seed_piloto_codigo = 'fase2b'
        ) AS documentos_piloto;
    `
  );

  return result.rows[0];
}

module.exports = {
  ENTITY_CONFIG,
  db,
  withTransaction,
  getEntityConfig,
  listEntity,
  getEntityById,
  createEntity,
  updateEntity,
  softDeleteEntity,
  listRegras,
  listPublicActivities,
  listNormasPublicas,
  getAtividadePublica,
  listActiveRulesForActivity,
  listParametrosForRules,
  listDocumentosForSimulation,
  listNormasForSimulation,
  findTaxaRule,
  findTaxaServicoAdministrativo,
  getActiveVrte,
  createSimulation,
  createSimulationTaxa,
  getPublicSimulationByProtocol,
  createNormaVinculo,
  softDeleteNormaVinculo,
  listSimulacoes,
  getParametrizacaoStatus,
};
