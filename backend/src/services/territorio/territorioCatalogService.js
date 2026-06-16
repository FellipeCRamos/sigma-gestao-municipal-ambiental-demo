const {
  db,
  auditService,
  normalizeTerritorioName,
  parseNullablePositiveId,
  normalizeDisplayName,
  createValidationError,
  ensureCategoria,
  ensureOrigem,
  ensureStatus,
  parseNullableInteger,
  toBoolean,
  getActorId,
  getTerritorioById,
} = require('./shared');

exports.findAll = async ({ incluir_inativos = false, busca = '', categoria = '' } = {}) => {
  const result = await db.query(
    `
      SELECT
        t.id,
        t.municipio_id,
        m.nome AS municipio_nome,
        t.nome,
        t.nome_normalizado,
        t.categoria,
        t.aliases,
        t.origem,
        t.status,
        t.ordem_exibicao,
        t.observacoes,
        t.homologado,
        t.homologado_em,
        t.homologado_por,
        t.created_at,
        t.updated_at,
        ${buildAliasAggregate()}
      FROM territorios t
      LEFT JOIN municipios m ON m.id = t.municipio_id
      LEFT JOIN territorio_aliases ta ON ta.territorio_id = t.id
      WHERE ($1::boolean = true OR t.status = 'ativo')
        AND ($2::text = '' OR t.nome_normalizado LIKE '%' || $2::text || '%')
        AND ($3::text = '' OR t.categoria = $3::text)
      GROUP BY t.id, m.nome
      ORDER BY COALESCE(t.ordem_exibicao, 999999) ASC, t.categoria ASC, t.nome ASC, t.id ASC;
    `,
    [Boolean(incluir_inativos), normalizeTerritorioName(busca), normalizeTerritorioName(categoria)]
  );

  return result.rows.map(mapTerritorioRow);
};

exports.findByIdAdmin = async (id) => {
  const parsedId = parseNullablePositiveId(id, 'Territorio');
  return getTerritorioById(parsedId, { incluir_inativos: true });
};

exports.createTerritorio = async (payload = {}, actor = null, req = null) => {
  const nome = normalizeDisplayName(payload.nome);

  if (!nome) {
    throw createValidationError('Nome do territorio e obrigatorio.');
  }

  const nomeNormalizado = normalizeTerritorioName(nome);
  const municipioId = parseNullablePositiveId(payload.municipio_id, 'Municipio');
  const categoria = ensureCategoria(payload.categoria);
  const origem = ensureOrigem(payload.origem || 'manual');
  const status = ensureStatus(payload.status || 'ativo');
  const ordemExibicao = parseNullableInteger(payload.ordem_exibicao, 'Ordem de exibicao');
  const observacoes = normalizeDisplayName(payload.observacoes);
  const homologado = toBoolean(payload.homologado, false);

  try {
    const result = await db.query(
      `
        INSERT INTO territorios (
          municipio_id,
          nome,
          nome_normalizado,
          categoria,
          origem,
          status,
          ordem_exibicao,
          observacoes,
          homologado,
          homologado_em,
          homologado_por,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $9::boolean THEN CURRENT_TIMESTAMP ELSE NULL END, $10, CURRENT_TIMESTAMP)
        RETURNING id;
      `,
      [
        municipioId,
        nome,
        nomeNormalizado,
        categoria,
        origem,
        status,
        ordemExibicao,
        observacoes,
        homologado,
        homologado ? getActorId(actor) : null
      ]
    );

    const created = await getTerritorioById(result.rows[0].id, { incluir_inativos: true });

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: getActorId(actor),
      acao: 'territorio.criado',
      entidade: 'territorio',
      entidade_id: created.id,
      before: null,
      after: created,
      dados: { origem: 'gestao_territorial_5d' },
      req
    });

    return created;
  } catch (error) {
    if (error.code === '23505') {
      throw createValidationError('Ja existe territorio com esse nome normalizado.', 409);
    }

    throw error;
  }
};

exports.updateTerritorio = async (id, payload = {}, actor = null, req = null) => {
  const parsedId = parseNullablePositiveId(id, 'Territorio');
  const before = await getTerritorioById(parsedId, { incluir_inativos: true });

  if (!before) {
    return null;
  }

  const nome = payload.nome !== undefined ? normalizeDisplayName(payload.nome) : before.nome;
  if (!nome) {
    throw createValidationError('Nome do territorio e obrigatorio.');
  }

  const categoria = payload.categoria !== undefined ? ensureCategoria(payload.categoria) : before.categoria;
  const origem = payload.origem !== undefined ? ensureOrigem(payload.origem) : before.origem;
  const status = payload.status !== undefined ? ensureStatus(payload.status) : before.status;
  const municipioId = payload.municipio_id !== undefined
    ? parseNullablePositiveId(payload.municipio_id, 'Municipio')
    : before.municipio_id;
  const ordemExibicao = payload.ordem_exibicao !== undefined
    ? parseNullableInteger(payload.ordem_exibicao, 'Ordem de exibicao')
    : before.ordem_exibicao;
  const observacoes = payload.observacoes !== undefined
    ? normalizeDisplayName(payload.observacoes)
    : before.observacoes;
  const homologado = payload.homologado !== undefined
    ? toBoolean(payload.homologado, before.homologado)
    : before.homologado;
  const nomeNormalizado = normalizeTerritorioName(nome);
  const homologadoEm = homologado
    ? (before.homologado ? before.homologado_em : new Date())
    : null;
  const homologadoPor = homologado
    ? (before.homologado_por || getActorId(actor))
    : null;

  try {
    await db.query(
      `
        UPDATE territorios
        SET
          municipio_id = $2,
          nome = $3,
          nome_normalizado = $4,
          categoria = $5,
          origem = $6,
          status = $7,
          ordem_exibicao = $8,
          observacoes = $9,
          homologado = $10,
          homologado_em = $11,
          homologado_por = $12,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [
        parsedId,
        municipioId,
        nome,
        nomeNormalizado,
        categoria,
        origem,
        status,
        ordemExibicao,
        observacoes,
        homologado,
        homologadoEm,
        homologadoPor
      ]
    );

    const after = await getTerritorioById(parsedId, { incluir_inativos: true });

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: getActorId(actor),
      acao: 'territorio.atualizado',
      entidade: 'territorio',
      entidade_id: parsedId,
      before,
      after,
      dados: { origem: 'gestao_territorial_5d' },
      req
    });

    return after;
  } catch (error) {
    if (error.code === '23505') {
      throw createValidationError('Ja existe territorio com esse nome normalizado.', 409);
    }

    throw error;
  }
};

exports.updateTerritorioStatus = async (id, status, actor = null, req = null) => {
  return exports.updateTerritorio(id, { status }, actor, req);
};
