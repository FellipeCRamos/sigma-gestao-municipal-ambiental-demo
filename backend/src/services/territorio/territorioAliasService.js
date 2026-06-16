const {
  db,
  auditService,
  parseNullablePositiveId,
  getTerritorioById,
  createInvalidTerritorioError,
  normalizeDisplayName,
  createValidationError,
  normalizeTerritorioName,
  assertAliasNotAmbiguous,
  ensureStatus,
  ALIAS_STATUS,
  getActorId,
} = require('./shared');

exports.listAliases = async ({ territorio_id = null, incluir_inativos = false } = {}) => {
  const territorioId = parseNullablePositiveId(territorio_id, 'Territorio');

  const result = await db.query(
    `
      SELECT
        ta.id,
        ta.territorio_id,
        t.nome AS territorio_nome,
        ta.alias,
        ta.alias_normalizado,
        ta.status,
        ta.observacoes,
        ta.created_at,
        ta.updated_at
      FROM territorio_aliases ta
      JOIN territorios t ON t.id = ta.territorio_id
      WHERE ($1::int IS NULL OR ta.territorio_id = $1::int)
        AND ($2::boolean = true OR ta.status = 'ativo')
      ORDER BY t.nome ASC, ta.alias ASC, ta.id ASC;
    `,
    [territorioId, Boolean(incluir_inativos)]
  );

  return result.rows;
};

async function getAliasById(id, { incluir_inativos = true, client = db } = {}) {
  const parsedId = parseNullablePositiveId(id, 'Alias');
  const result = await client.query(
    `
      SELECT
        ta.id,
        ta.territorio_id,
        t.nome AS territorio_nome,
        ta.alias,
        ta.alias_normalizado,
        ta.status,
        ta.observacoes,
        ta.created_by_interno_id,
        ta.updated_by_interno_id,
        ta.created_at,
        ta.updated_at
      FROM territorio_aliases ta
      JOIN territorios t ON t.id = ta.territorio_id
      WHERE ta.id = $1
        AND ($2::boolean = true OR ta.status = 'ativo');
    `,
    [parsedId, Boolean(incluir_inativos)]
  );

  return result.rows[0] || null;
}

exports.createAlias = async (territorioId, payload = {}, actor = null, req = null) => {
  const parsedTerritorioId = parseNullablePositiveId(territorioId, 'Territorio');
  const territorio = await getTerritorioById(parsedTerritorioId, { incluir_inativos: false });

  if (!territorio) {
    throw createInvalidTerritorioError();
  }

  const alias = normalizeDisplayName(payload.alias);
  if (!alias) {
    throw createValidationError('Alias territorial e obrigatorio.');
  }

  const aliasNormalizado = normalizeTerritorioName(alias);

  if (aliasNormalizado === territorio.nome_normalizado) {
    throw createValidationError('Alias nao deve repetir o nome oficial do territorio.');
  }

  await assertAliasNotAmbiguous(aliasNormalizado, parsedTerritorioId);

  try {
    const result = await db.query(
      `
        INSERT INTO territorio_aliases (
          territorio_id,
          alias,
          alias_normalizado,
          status,
          observacoes,
          created_by_interno_id,
          updated_by_interno_id,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6, CURRENT_TIMESTAMP)
        RETURNING id;
      `,
      [
        parsedTerritorioId,
        alias,
        aliasNormalizado,
        ensureStatus(payload.status || 'ativo', ALIAS_STATUS),
        normalizeDisplayName(payload.observacoes),
        getActorId(actor)
      ]
    );

    const created = await getAliasById(result.rows[0].id);

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: getActorId(actor),
      acao: 'territorio_alias.criado',
      entidade: 'territorio_alias',
      entidade_id: created.id,
      before: null,
      after: created,
      dados: { territorio_id: parsedTerritorioId, origem: 'gestao_territorial_5d' },
      req
    });

    return created;
  } catch (error) {
    if (error.code === '23505') {
      throw createValidationError('Alias territorial ja existe ativo.', 409);
    }

    throw error;
  }
};

exports.updateAlias = async (aliasId, payload = {}, actor = null, req = null) => {
  const parsedAliasId = parseNullablePositiveId(aliasId, 'Alias');
  const before = await getAliasById(parsedAliasId, { incluir_inativos: true });

  if (!before) {
    return null;
  }

  const territorio = await getTerritorioById(before.territorio_id, { incluir_inativos: true });
  const alias = payload.alias !== undefined ? normalizeDisplayName(payload.alias) : before.alias;

  if (!alias) {
    throw createValidationError('Alias territorial e obrigatorio.');
  }

  const aliasNormalizado = normalizeTerritorioName(alias);
  const status = payload.status !== undefined ? ensureStatus(payload.status, ALIAS_STATUS) : before.status;

  if (aliasNormalizado === territorio.nome_normalizado) {
    throw createValidationError('Alias nao deve repetir o nome oficial do territorio.');
  }

  await assertAliasNotAmbiguous(aliasNormalizado, before.territorio_id);

  try {
    await db.query(
      `
        UPDATE territorio_aliases
        SET
          alias = $2,
          alias_normalizado = $3,
          status = $4,
          observacoes = $5,
          updated_by_interno_id = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [
        parsedAliasId,
        alias,
        aliasNormalizado,
        status,
        payload.observacoes !== undefined ? normalizeDisplayName(payload.observacoes) : before.observacoes,
        getActorId(actor)
      ]
    );

    const after = await getAliasById(parsedAliasId, { incluir_inativos: true });

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: getActorId(actor),
      acao: 'territorio_alias.atualizado',
      entidade: 'territorio_alias',
      entidade_id: parsedAliasId,
      before,
      after,
      dados: { territorio_id: before.territorio_id, origem: 'gestao_territorial_5d' },
      req
    });

    return after;
  } catch (error) {
    if (error.code === '23505') {
      throw createValidationError('Alias territorial ja existe ativo.', 409);
    }

    throw error;
  }
};

exports.updateAliasStatus = async (aliasId, status, actor = null, req = null) => {
  return exports.updateAlias(aliasId, { status }, actor, req);
};
