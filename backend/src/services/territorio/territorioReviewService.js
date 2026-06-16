const {
  db,
  auditService,
  normalizeTerritorioName,
  parseNullablePositiveId,
  normalizeDisplayName,
  REVIEW_MODULOS,
  createValidationError,
  REVIEW_DECISOES,
  getTerritorioById,
  createInvalidTerritorioError,
  TARGETS,
  ORIGEM_CATALOGO,
  ORIGEM_NAO_INFORMADO,
  getActorId,
} = require('./shared');

exports.listLegado = async ({ modulo = '', limit = 100 } = {}) => {
  const normalizedModulo = normalizeTerritorioName(modulo);
  const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

  if (normalizedModulo && !REVIEW_MODULOS.has(normalizedModulo)) {
    throw createValidationError('Modulo de revisao territorial invalido.');
  }

  const result = await db.query(
    `
      WITH pendentes AS (
        SELECT
          'animal' AS modulo,
          a.id AS registro_id,
          a.nome AS titulo,
          a.bairro AS valor_legado,
          a.territorio_origem,
          a.created_at,
          a.updated_at,
          (
            SELECT tr.created_at
            FROM territorio_revisoes tr
            WHERE tr.modulo = 'animal'
              AND tr.registro_id = a.id
            ORDER BY tr.created_at DESC
            LIMIT 1
          ) AS ultima_revisao_em
        FROM animais a
        WHERE a.territorio_id IS NULL
          AND a.territorio_origem = 'legado_textual'
          AND NULLIF(TRIM(COALESCE(a.bairro, '')), '') IS NOT NULL
          AND COALESCE(a.status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')

        UNION ALL

        SELECT
          'tutor' AS modulo,
          t.id AS registro_id,
          t.nome AS titulo,
          t.bairro AS valor_legado,
          t.territorio_origem,
          t.created_at,
          t.updated_at,
          (
            SELECT tr.created_at
            FROM territorio_revisoes tr
            WHERE tr.modulo = 'tutor'
              AND tr.registro_id = t.id
            ORDER BY tr.created_at DESC
            LIMIT 1
          ) AS ultima_revisao_em
        FROM tutores t
        WHERE t.territorio_id IS NULL
          AND t.territorio_origem = 'legado_textual'
          AND NULLIF(TRIM(COALESCE(t.bairro, '')), '') IS NOT NULL
          AND COALESCE(t.status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')

        UNION ALL

        SELECT
          'ocorrencia' AS modulo,
          o.id AS registro_id,
          COALESCE(o.titulo, o.tipo, 'Ocorrencia') AS titulo,
          o.bairro AS valor_legado,
          o.territorio_origem,
          o.created_at,
          o.updated_at,
          (
            SELECT tr.created_at
            FROM territorio_revisoes tr
            WHERE tr.modulo = 'ocorrencia'
              AND tr.registro_id = o.id
            ORDER BY tr.created_at DESC
            LIMIT 1
          ) AS ultima_revisao_em
        FROM animal_ocorrencias o
        WHERE o.territorio_id IS NULL
          AND o.territorio_origem = 'legado_textual'
          AND NULLIF(TRIM(COALESCE(o.bairro, '')), '') IS NOT NULL

        UNION ALL

        SELECT
          'campanha_inscricao' AS modulo,
          i.id AS registro_id,
          COALESCE(i.protocolo, i.animal_nome, 'Inscricao de campanha') AS titulo,
          NULLIF(TRIM(COALESCE(i.animal_endereco, '')), '') AS valor_legado,
          i.territorio_origem,
          i.created_at,
          i.updated_at,
          (
            SELECT tr.created_at
            FROM territorio_revisoes tr
            WHERE tr.modulo = 'campanha_inscricao'
              AND tr.registro_id = i.id
            ORDER BY tr.created_at DESC
            LIMIT 1
          ) AS ultima_revisao_em
        FROM campanha_inscricoes i
        WHERE i.territorio_id IS NULL
          AND i.territorio_origem = 'legado_textual'
      )
      SELECT *
      FROM pendentes
      WHERE ($1::text = '' OR modulo = $1::text)
      ORDER BY ultima_revisao_em ASC NULLS FIRST, updated_at DESC NULLS LAST, created_at DESC
      LIMIT $2;
    `,
    [normalizedModulo, parsedLimit]
  );

  return result.rows;
};

async function getTargetRecord(client, modulo, registroId) {
  const target = TARGETS[modulo];

  if (!target) {
    throw createValidationError('Modulo de revisao territorial invalido.');
  }

  const result = await client.query(
    `
      SELECT *
      FROM ${target.table}
      WHERE id = $1
        AND ${target.where}
      LIMIT 1;
    `,
    [registroId]
  );

  return result.rows[0] || null;
}

exports.reviewLegado = async (payload = {}, actor = null, req = null) => {
  const modulo = normalizeTerritorioName(payload.modulo);
  const registroId = parseNullablePositiveId(payload.registro_id, 'Registro');
  const decisao = normalizeTerritorioName(payload.decisao || 'classificado');
  const observacao = normalizeDisplayName(payload.observacao);
  const aliasId = parseNullablePositiveId(payload.alias_id, 'Alias');

  if (!REVIEW_MODULOS.has(modulo)) {
    throw createValidationError('Modulo de revisao territorial invalido.');
  }

  if (!REVIEW_DECISOES.has(decisao)) {
    throw createValidationError('Decisao de revisao territorial invalida.');
  }

  const territorioId = decisao === 'classificado'
    ? parseNullablePositiveId(payload.territorio_id, 'Territorio')
    : null;

  if (decisao === 'classificado' && !territorioId) {
    throw createValidationError('Territorio controlado e obrigatorio para classificar legado.');
  }

  const client = await db.connect();
  let revision = null;
  let before = null;
  let after = null;
  let territorio = null;
  let alias = null;

  try {
    await client.query('BEGIN');

    before = await getTargetRecord(client, modulo, registroId);

    if (!before) {
      throw createValidationError('Registro territorial legado nao encontrado.', 404);
    }

    if (decisao === 'classificado') {
      territorio = await getTerritorioById(territorioId, { incluir_inativos: false, client });

      if (!territorio) {
        throw createInvalidTerritorioError();
      }

      if (aliasId) {
        const aliasResult = await client.query(
          `
            SELECT *
            FROM territorio_aliases
            WHERE id = $1
              AND territorio_id = $2
              AND status = 'ativo';
          `,
          [aliasId, territorioId]
        );
        alias = aliasResult.rows[0] || null;

        if (!alias) {
          throw createValidationError('Alias territorial nao pertence ao territorio informado ou esta inativo.');
        }
      }

      const target = TARGETS[modulo];
      const bairroSet = target.hasBairro ? ', bairro = $3' : '';
      const params = target.hasBairro
        ? [territorio.id, ORIGEM_CATALOGO, territorio.nome, registroId]
        : [territorio.id, ORIGEM_CATALOGO, registroId];
      const idParam = target.hasBairro ? '$4' : '$3';

      await client.query(
        `
          UPDATE ${target.table}
          SET
            territorio_id = $1,
            territorio_origem = $2
            ${bairroSet},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${idParam};
        `,
        params
      );
    } else if (decisao === 'nao_informado') {
      const target = TARGETS[modulo];
      await client.query(
        `
          UPDATE ${target.table}
          SET
            territorio_id = NULL,
            territorio_origem = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2;
        `,
        [ORIGEM_NAO_INFORMADO, registroId]
      );
    }

    const revisionResult = await client.query(
      `
        INSERT INTO territorio_revisoes (
          modulo,
          registro_id,
          valor_legado,
          territorio_id,
          alias_id,
          decisao,
          observacao,
          reviewed_by_interno_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `,
      [
        modulo,
        registroId,
        before[TARGETS[modulo].legacyValue] || null,
        territorioId,
        aliasId,
        decisao,
        observacao,
        getActorId(actor)
      ]
    );

    revision = revisionResult.rows[0];
    after = await getTargetRecord(client, modulo, registroId);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: getActorId(actor),
    acao: 'territorio_legado.revisado',
    entidade: TARGETS[modulo].entity,
    entidade_id: registroId,
    before,
    after,
    dados: {
      modulo,
      decisao,
      territorio_id: territorioId,
      territorio_nome: territorio?.nome || null,
      alias_id: alias?.id || null,
      observacao,
      revisao_id: revision.id,
      origem: 'gestao_territorial_5d'
    },
    req
  });

  return {
    revisao: revision,
    registro: after,
    territorio,
    alias
  };
};
