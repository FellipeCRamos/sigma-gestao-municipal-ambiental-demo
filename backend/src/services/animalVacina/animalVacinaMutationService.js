const {
  db,
  auditService,
  findAnimal,
  enrichCampanhaDocumentos,
  normalizePayload,
  findCatalogoById,
  decorateRecord,
  hasOwn,
} = require('./shared');
const queryService = require('./animalVacinaQueryService');

exports.create = async (animalId, payload, actor, req = null) => {
  const animal = await findAnimal(animalId);

  if (!animal) {
    return null;
  }

  const data = await enrichCampanhaDocumentos(animalId, normalizePayload(payload));
  const catalogo = await findCatalogoById(data.vacina_catalogo_id);

  if (data.vacina_catalogo_id && !catalogo) {
    const error = new Error('Vacina do catalogo nao encontrada.');
    error.statusCode = 400;
    throw error;
  }

  const vacinaNome = catalogo?.nome_comercial || data.vacina_nome;

  if (!vacinaNome) {
    const error = new Error('Informe a vacina ou selecione um item do catalogo.');
    error.statusCode = 400;
    throw error;
  }

  const result = await db.query(
    `
      INSERT INTO animal_vacinacoes (
        animal_id,
        vacina_catalogo_id,
        vacina_codigo,
        vacina_nome,
        vacina_nome_popular,
        especie,
        dose,
        data_aplicacao,
        proxima_dose_em,
        lote,
        fabricante,
        origem_registro,
        status_registro,
        fonte_lancamento,
        campanha_id,
        campanha_inscricao_id,
        campanha_vacinacao_item_id,
        documento_id,
        created_by_interno_id,
        observacoes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20
      )
      RETURNING *;
    `,
    [
      animalId,
      catalogo?.id || null,
      catalogo?.codigo || data.vacina_codigo,
      vacinaNome,
      catalogo?.nome_popular || data.vacina_nome_popular,
      catalogo?.especie || data.especie || animal.especie,
      data.dose,
      data.data_aplicacao,
      data.proxima_dose_em,
      data.lote,
      data.fabricante,
      data.origem_registro,
      data.status_registro,
      data.fonte_lancamento || 'lancamento_interno',
      data.campanha_id,
      data.campanha_inscricao_id,
      data.campanha_vacinacao_item_id,
      data.documento_id,
      actor?.id || null,
      data.observacoes
    ]
  );

  const vacinacao = decorateRecord(result.rows[0]);

  await insertTimelineEvent(vacinacao, actor);
  await queryService.reconcileAnimalSummary(animalId);

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor?.id || null,
    acao: 'criar_registro_vacinal',
    entidade: 'animal_vacinacoes',
    entidade_id: vacinacao.id,
    before: null,
    after: vacinacao,
    dados: {
      animal_id: animalId,
      vacina_nome: vacinacao.vacina_nome,
      origem_registro: vacinacao.origem_registro,
      status_registro: vacinacao.status_registro,
      campanha_id: vacinacao.campanha_id,
      campanha_inscricao_id: vacinacao.campanha_inscricao_id,
      campanha_vacinacao_item_id: vacinacao.campanha_vacinacao_item_id,
      documento_id: vacinacao.documento_id
    },
    req
  });

  return vacinacao;
};

exports.update = async (animalId, vacinacaoId, payload, actor, req = null) => {
  const beforeResult = await db.query(
    `
      SELECT *
      FROM animal_vacinacoes
      WHERE id = $1
        AND animal_id = $2;
    `,
    [vacinacaoId, animalId]
  );
  const before = beforeResult.rows[0] || null;

  if (!before) {
    return null;
  }

  const provided = (key) => hasOwn(payload, key);
  const data = await enrichCampanhaDocumentos(animalId, normalizePayload(payload, {
    origem_registro: before.origem_registro,
    status_registro: before.status_registro,
    fonte_lancamento: before.fonte_lancamento
  }));
  const catalogoLookupId = provided('vacina_catalogo_id')
    ? data.vacina_catalogo_id
    : before.vacina_catalogo_id;
  const catalogo = await findCatalogoById(catalogoLookupId);
  const next = {
    vacina_catalogo_id: catalogo?.id || (provided('vacina_catalogo_id') ? data.vacina_catalogo_id : before.vacina_catalogo_id) || null,
    vacina_codigo: catalogo?.codigo || (provided('vacina_codigo') ? data.vacina_codigo : before.vacina_codigo),
    vacina_nome: catalogo?.nome_comercial || (provided('vacina_nome') ? data.vacina_nome : before.vacina_nome),
    vacina_nome_popular: catalogo?.nome_popular || (provided('vacina_nome_popular') ? data.vacina_nome_popular : before.vacina_nome_popular),
    especie: catalogo?.especie || (provided('especie') ? data.especie : before.especie),
    dose: provided('dose') ? data.dose : before.dose,
    data_aplicacao: provided('data_aplicacao') ? data.data_aplicacao : before.data_aplicacao,
    proxima_dose_em: provided('proxima_dose_em') ? data.proxima_dose_em : before.proxima_dose_em,
    lote: provided('lote') ? data.lote : before.lote,
    fabricante: provided('fabricante') ? data.fabricante : before.fabricante,
    origem_registro: provided('origem_registro') ? data.origem_registro : before.origem_registro,
    status_registro: provided('status_registro') ? data.status_registro : before.status_registro,
    fonte_lancamento: provided('fonte_lancamento') ? data.fonte_lancamento : before.fonte_lancamento,
    campanha_id: provided('campanha_id') || provided('documento_id') || provided('campanha_inscricao_id') ? data.campanha_id : before.campanha_id,
    campanha_inscricao_id: provided('campanha_inscricao_id') || provided('documento_id') ? data.campanha_inscricao_id : before.campanha_inscricao_id,
    campanha_vacinacao_item_id: provided('campanha_vacinacao_item_id') ? data.campanha_vacinacao_item_id : before.campanha_vacinacao_item_id,
    documento_id: provided('documento_id') ? data.documento_id : before.documento_id,
    observacoes: provided('observacoes') ? data.observacoes : before.observacoes
  };

  if (catalogoLookupId && !catalogo) {
    const error = new Error('Vacina do catalogo nao encontrada.');
    error.statusCode = 400;
    throw error;
  }

  if (!next.vacina_nome) {
    const error = new Error('Informe a vacina ou selecione um item do catalogo.');
    error.statusCode = 400;
    throw error;
  }

  const result = await db.query(
    `
      UPDATE animal_vacinacoes
      SET
        vacina_catalogo_id = $1,
        vacina_codigo = $2,
        vacina_nome = $3,
        vacina_nome_popular = $4,
        especie = $5,
        dose = $6,
        data_aplicacao = $7,
        proxima_dose_em = $8,
        lote = $9,
        fabricante = $10,
        origem_registro = $11,
        status_registro = $12,
        fonte_lancamento = $13,
        campanha_id = $14,
        campanha_inscricao_id = $15,
        campanha_vacinacao_item_id = $16,
        documento_id = $17,
        observacoes = $18,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $19
        AND animal_id = $20
      RETURNING *;
    `,
    [
      next.vacina_catalogo_id,
      next.vacina_codigo,
      next.vacina_nome,
      next.vacina_nome_popular,
      next.especie,
      next.dose,
      next.data_aplicacao,
      next.proxima_dose_em,
      next.lote,
      next.fabricante,
      next.origem_registro,
      next.status_registro,
      next.fonte_lancamento,
      next.campanha_id,
      next.campanha_inscricao_id,
      next.campanha_vacinacao_item_id,
      next.documento_id,
      next.observacoes,
      vacinacaoId,
      animalId
    ]
  );

  const after = decorateRecord(result.rows[0]);
  await queryService.reconcileAnimalSummary(animalId);

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor?.id || null,
    acao: 'atualizar_registro_vacinal',
    entidade: 'animal_vacinacoes',
    entidade_id: after.id,
    before,
    after,
    dados: {
      animal_id: animalId,
      vacina_nome: after.vacina_nome,
      status_registro: after.status_registro,
      campanha_id: after.campanha_id,
      campanha_inscricao_id: after.campanha_inscricao_id,
      campanha_vacinacao_item_id: after.campanha_vacinacao_item_id,
      documento_id: after.documento_id
    },
    req
  });

  return after;
};

exports.cancel = async (animalId, vacinacaoId, actor, req = null) => {
  const beforeResult = await db.query(
    `
      SELECT *
      FROM animal_vacinacoes
      WHERE id = $1
        AND animal_id = $2;
    `,
    [vacinacaoId, animalId]
  );
  const before = beforeResult.rows[0] || null;

  if (!before) {
    return null;
  }

  const result = await db.query(
    `
      UPDATE animal_vacinacoes
      SET
        status_registro = 'cancelado',
        cancelado_em = COALESCE(cancelado_em, CURRENT_TIMESTAMP),
        cancelado_por_interno_id = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND animal_id = $3
      RETURNING *;
    `,
    [actor?.id || null, vacinacaoId, animalId]
  );

  const after = decorateRecord(result.rows[0]);
  await queryService.reconcileAnimalSummary(animalId);

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor?.id || null,
    acao: 'cancelar_registro_vacinal',
    entidade: 'animal_vacinacoes',
    entidade_id: after.id,
    before,
    after,
    dados: {
      animal_id: animalId,
      vacina_nome: after.vacina_nome
    },
    req
  });

  return after;
};

