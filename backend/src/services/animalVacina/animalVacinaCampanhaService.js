const {
  db,
  auditService,
  normalizeOptionalString,
  toDateOnly,
  findCatalogoById,
  decorateRecord,
} = require('./shared');
const mutationService = require('./animalVacinaMutationService');

function normalizeCampanhaAtendimentoItem(item = {}, fallbackDate = null) {
  const catalogoId = Number(item.vacina_catalogo_id);

  if (!Number.isInteger(catalogoId) || catalogoId <= 0) {
    const error = new Error('Informe uma vacina do catalogo para o atendimento vacinal.');
    error.statusCode = 400;
    throw error;
  }

  const id = item.id ? Number(item.id) : null;
  const documentoId = item.documento_id ? Number(item.documento_id) : null;

  if (id !== null && (!Number.isInteger(id) || id <= 0)) {
    const error = new Error('Item vacinal invalido.');
    error.statusCode = 400;
    throw error;
  }

  if (documentoId !== null && (!Number.isInteger(documentoId) || documentoId <= 0)) {
    const error = new Error('Comprovante vacinal invalido.');
    error.statusCode = 400;
    throw error;
  }

  return {
    id,
    vacina_catalogo_id: catalogoId,
    dose: normalizeOptionalString(item.dose),
    data_aplicacao: toDateOnly(item.data_aplicacao) || fallbackDate || new Date().toISOString().slice(0, 10),
    proxima_dose_em: toDateOnly(item.proxima_dose_em),
    lote: normalizeOptionalString(item.lote),
    fabricante: normalizeOptionalString(item.fabricante),
    documento_id: documentoId,
    observacoes: normalizeOptionalString(item.observacoes)
  };
}

async function findPreferredDocumentoByInscricao(inscricaoId) {
  const result = await db.query(
    `
      SELECT id
      FROM campanha_documentos
      WHERE inscricao_id = $1
      ORDER BY
        CASE
          WHEN tipo IN ('comprovante_vacinacao', 'carteira_vacinacao') THEN 0
          ELSE 1
        END,
        created_at DESC,
        id DESC
      LIMIT 1;
    `,
    [inscricaoId]
  );

  return result.rows[0] || null;
}

async function findActiveCampanhaVacinacaoItens(inscricaoId) {
  const result = await db.query(
    `
      SELECT *
      FROM campanha_vacinacao_itens
      WHERE inscricao_id = $1
        AND status = 'ativo'
      ORDER BY id ASC;
    `,
    [inscricaoId]
  );

  return result.rows;
}

async function validateCampanhaAtendimentoItens(items, fallbackDate) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('Informe pelo menos uma vacina aplicada no atendimento.');
    error.statusCode = 400;
    throw error;
  }

  const normalized = [];
  const seen = new Set();

  for (const item of items) {
    const next = normalizeCampanhaAtendimentoItem(item, fallbackDate);
    const key = `${next.vacina_catalogo_id}|${next.dose || ''}`;

    if (seen.has(key)) {
      const error = new Error('Ha vacina duplicada no atendimento. Ajuste dose ou remova a duplicidade.');
      error.statusCode = 400;
      throw error;
    }

    const catalogo = await findCatalogoById(next.vacina_catalogo_id);

    if (!catalogo) {
      const error = new Error('Vacina do catalogo nao encontrada.');
      error.statusCode = 400;
      throw error;
    }

    seen.add(key);
    normalized.push({ ...next, catalogo });
  }

  return normalized;
}

exports.validateCampanhaAtendimentoPayload = async (items, fallbackDate = null) => {
  await validateCampanhaAtendimentoItens(items, fallbackDate);
  return true;
};

function buildPayloadFromCampanhaItem(inscricao, item, documentoId) {
  return {
    vacina_catalogo_id: item.vacina_catalogo_id,
    dose: item.dose,
    data_aplicacao: item.data_aplicacao,
    proxima_dose_em: item.proxima_dose_em,
    lote: item.lote,
    fabricante: item.fabricante,
    origem_registro: 'campanha',
    status_registro: documentoId ? 'comprovado' : 'registrado',
    fonte_lancamento: 'campanha_atendimento_estruturado',
    campanha_id: inscricao.campanha_id,
    campanha_inscricao_id: inscricao.id,
    campanha_vacinacao_item_id: item.id,
    documento_id: documentoId,
    observacoes:
      item.observacoes ||
      inscricao.resultado_operacional ||
      `Vacina aplicada no atendimento da inscricao ${inscricao.protocolo}.`
  };
}

exports.syncFromCampanhaAtendimento = async (inscricao, items, actor, req = null) => {
  if (!inscricao?.animal_id || inscricao.servico_desejado !== 'vacinacao') {
    return [];
  }

  const fallbackDate = toDateOnly(inscricao.atendimento_confirmado_em || inscricao.agendamento_data);
  const normalizedItems = await validateCampanhaAtendimentoItens(items, fallbackDate);
  const preferredDocumento = await findPreferredDocumentoByInscricao(inscricao.id);
  const existing = await findActiveCampanhaVacinacaoItens(inscricao.id);
  const existingById = new Map(existing.map((item) => [Number(item.id), item]));
  const incomingIds = new Set(normalizedItems.map((item) => item.id).filter(Boolean));
  const synced = [];

  for (const oldItem of existing) {
    if (incomingIds.has(Number(oldItem.id))) {
      continue;
    }

    const cancelResult = await db.query(
      `
        UPDATE campanha_vacinacao_itens
        SET
          status = 'cancelado',
          cancelado_em = COALESCE(cancelado_em, CURRENT_TIMESTAMP),
          cancelado_por_interno_id = $1,
          updated_by_interno_id = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
      `,
      [actor?.id || null, oldItem.id]
    );

    if (oldItem.animal_vacinacao_id) {
      await mutationService.cancel(inscricao.animal_id, oldItem.animal_vacinacao_id, actor, req);
    }

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: actor?.id || null,
      acao: 'cancelar_item_vacinal_campanha',
      entidade: 'campanha_vacinacao_itens',
      entidade_id: oldItem.id,
      before: oldItem,
      after: cancelResult.rows[0],
      dados: {
        inscricao_id: inscricao.id,
        animal_id: inscricao.animal_id,
        campanha_id: inscricao.campanha_id
      },
      req
    });
  }

  for (const item of normalizedItems) {
    const documentoId = item.documento_id || preferredDocumento?.id || null;
    let currentItem = null;

    if (item.id) {
      const before = existingById.get(Number(item.id));

      if (!before) {
        const error = new Error('Item vacinal de campanha nao encontrado para esta inscricao.');
        error.statusCode = 400;
        throw error;
      }

      const updateResult = await db.query(
        `
          UPDATE campanha_vacinacao_itens
          SET
            animal_id = $1,
            vacina_catalogo_id = $2,
            documento_id = $3,
            dose = $4,
            data_aplicacao = $5,
            proxima_dose_em = $6,
            lote = $7,
            fabricante = $8,
            observacoes = $9,
            updated_by_interno_id = $10,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $11
          RETURNING *;
        `,
        [
          inscricao.animal_id,
          item.vacina_catalogo_id,
          documentoId,
          item.dose,
          item.data_aplicacao,
          item.proxima_dose_em,
          item.lote,
          item.fabricante,
          item.observacoes,
          actor?.id || null,
          item.id
        ]
      );

      currentItem = updateResult.rows[0];

      await auditService.logChange({
        ator_tipo: 'interno',
        ator_id: actor?.id || null,
        acao: 'atualizar_item_vacinal_campanha',
        entidade: 'campanha_vacinacao_itens',
        entidade_id: currentItem.id,
        before,
        after: currentItem,
        dados: {
          inscricao_id: inscricao.id,
          animal_id: inscricao.animal_id,
          campanha_id: inscricao.campanha_id,
          vacina_catalogo_id: item.vacina_catalogo_id
        },
        req
      });
    } else {
      const insertResult = await db.query(
        `
          INSERT INTO campanha_vacinacao_itens (
            inscricao_id,
            campanha_id,
            animal_id,
            vacina_catalogo_id,
            documento_id,
            dose,
            data_aplicacao,
            proxima_dose_em,
            lote,
            fabricante,
            observacoes,
            created_by_interno_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *;
        `,
        [
          inscricao.id,
          inscricao.campanha_id,
          inscricao.animal_id,
          item.vacina_catalogo_id,
          documentoId,
          item.dose,
          item.data_aplicacao,
          item.proxima_dose_em,
          item.lote,
          item.fabricante,
          item.observacoes,
          actor?.id || null
        ]
      );

      currentItem = insertResult.rows[0];

      await auditService.logChange({
        ator_tipo: 'interno',
        ator_id: actor?.id || null,
        acao: 'criar_item_vacinal_campanha',
        entidade: 'campanha_vacinacao_itens',
        entidade_id: currentItem.id,
        before: null,
        after: currentItem,
        dados: {
          inscricao_id: inscricao.id,
          animal_id: inscricao.animal_id,
          campanha_id: inscricao.campanha_id,
          vacina_catalogo_id: item.vacina_catalogo_id
        },
        req
      });
    }

    const payload = buildPayloadFromCampanhaItem(
      inscricao,
      { ...item, id: currentItem.id },
      documentoId
    );
    const vacinacao = currentItem.animal_vacinacao_id
      ? await mutationService.update(inscricao.animal_id, currentItem.animal_vacinacao_id, payload, actor, req)
      : await mutationService.create(inscricao.animal_id, payload, actor, req);

    if (!currentItem.animal_vacinacao_id && vacinacao?.id) {
      const linkedResult = await db.query(
        `
          UPDATE campanha_vacinacao_itens
          SET
            animal_vacinacao_id = $1,
            updated_by_interno_id = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *;
        `,
        [vacinacao.id, actor?.id || null, currentItem.id]
      );
      currentItem = linkedResult.rows[0];
    }

    synced.push({
      ...currentItem,
      vacinacao
    });
  }

  return synced;
};

exports.createFromCampanhaAtendida = async (inscricao, actor, req = null) => {
  if (!inscricao?.animal_id || inscricao.servico_desejado !== 'vacinacao') {
    return null;
  }

  const structuredItems = await findActiveCampanhaVacinacaoItens(inscricao.id);

  if (structuredItems.length > 0) {
    return exports.syncFromCampanhaAtendimento(inscricao, structuredItems, actor, req);
  }

  const existingResult = await db.query(
    `
      SELECT *
      FROM animal_vacinacoes
      WHERE campanha_inscricao_id = $1
        AND origem_registro = 'campanha'
        AND fonte_lancamento = 'campanha_status_atendido_auto'
        AND status_registro <> 'cancelado'
      ORDER BY id DESC
      LIMIT 1;
    `,
    [inscricao.id]
  );

  if (existingResult.rows[0]) {
    return decorateRecord(existingResult.rows[0]);
  }

  const documento = await findPreferredDocumentoByInscricao(inscricao.id);

  return exports.create(
    inscricao.animal_id,
    {
      vacina_nome: 'Vacinacao registrada em campanha',
      dose: 'Registro de atendimento',
      data_aplicacao:
        inscricao.atendimento_confirmado_em ||
        inscricao.agendamento_data ||
        new Date().toISOString().slice(0, 10),
      origem_registro: 'campanha',
      status_registro: documento ? 'comprovado' : 'registrado',
      fonte_lancamento: 'campanha_status_atendido_auto',
      campanha_id: inscricao.campanha_id,
      campanha_inscricao_id: inscricao.id,
      documento_id: documento?.id || null,
      observacoes:
        inscricao.resultado_operacional ||
        `Registro vacinal gerado a partir da inscricao ${inscricao.protocolo}.`
    },
    actor,
    req
  );
};

