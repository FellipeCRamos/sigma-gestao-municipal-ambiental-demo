const { db, auditService, decorateRecord } = require('./shared');
const queryService = require('./animalVacinaQueryService');

exports.importLegacyVacinasForAnimal = async (animal, actor, req = null) => {
  if (!animal?.id || !Array.isArray(animal.vacinas) || animal.vacinas.length === 0) {
    return [];
  }

  const inserted = [];

  for (const item of animal.vacinas) {
    const codigo = typeof item === 'string' ? item : item?.id || item?.value;
    const nome =
      typeof item === 'string'
        ? item
        : item?.nome_comercial || item?.nome_tecnico || item?.nome_popular || codigo;

    if (!codigo || !nome) {
      continue;
    }

    const catalogoResult = await db.query(
      `
        SELECT *
        FROM vacina_catalogo
        WHERE codigo = $1
        LIMIT 1;
      `,
      [codigo]
    );
    const catalogo = catalogoResult.rows[0] || null;

    const result = await db.query(
      `
        INSERT INTO animal_vacinacoes (
          animal_id,
          vacina_catalogo_id,
          vacina_codigo,
          vacina_nome,
          vacina_nome_popular,
          especie,
          origem_registro,
          status_registro,
          fonte_lancamento,
          created_by_interno_id,
          observacoes
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'legado_jsonb', 'registrado', 'cadastro_animal_legacy', $7, $8)
        ON CONFLICT DO NOTHING
        RETURNING *;
      `,
      [
        animal.id,
        catalogo?.id || null,
        catalogo?.codigo || codigo,
        catalogo?.nome_comercial || nome,
        catalogo?.nome_popular || item?.nome_popular || null,
        catalogo?.especie || animal.especie,
        actor?.id || null,
        'Registro importado de selecao vacinal do cadastro legado. Data de aplicacao nao informada.'
      ]
    );

    if (result.rows[0]) {
      inserted.push(result.rows[0]);
    }
  }

  if (inserted.length > 0) {
    await queryService.reconcileAnimalSummary(animal.id);

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: actor?.id || null,
      acao: 'importar_vacinas_legadas_animal',
      entidade: 'animais',
      entidade_id: animal.id,
      before: null,
      after: { total_importado: inserted.length },
      dados: {
        animal_id: animal.id,
        total_importado: inserted.length
      },
      req
    });
  }

  return inserted.map(decorateRecord);
};

exports.canUsuarioExternoAccessAnimal = async (usuarioId, animalId) => {
  const result = await db.query(
    `
      SELECT a.id
      FROM animais a
      LEFT JOIN tutores t ON t.id = a.tutor_id
      LEFT JOIN campanha_inscricoes ci ON ci.animal_id = a.id
      WHERE a.id = $1
        AND (
          t.usuario_externo_id = $2
          OR ci.usuario_id = $2
        )
      LIMIT 1;
    `,
    [animalId, usuarioId]
  );

  return Boolean(result.rows[0]);
};

