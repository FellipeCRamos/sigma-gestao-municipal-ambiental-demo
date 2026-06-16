const {
  assertPositive,
  assertPositiveInteger,
  createValidationError,
  normalizeString,
  toNumber,
} = require('./shared');

const ESPECIE_CATEGORIAS = ['ornamental', 'frutifera', 'nativa', 'medicinal', 'arborizacao', 'hortalica', 'outra'];
const ESPECIE_PORTES = ['pequeno', 'medio', 'grande'];
const STATUS_ESPECIE = ['ativo', 'inativo'];
const STATUS_LOTE = ['ativo', 'esgotado', 'encerrado', 'bloqueado'];
const TIPOS_MOVIMENTACAO_AJUSTE = ['ajuste_positivo', 'ajuste_negativo'];
const TIPOS_SOLICITANTE = ['cidadao', 'instituicao', 'orgao_publico', 'escola', 'ong', 'empresa'];
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function requireString(value, fieldName, label) {
  const normalized = normalizeString(value);

  if (!normalized) {
    throw createValidationError(`${label} obrigatorio(a).`, { field: fieldName });
  }

  return normalized;
}

function requireOneOf(value, allowedValues, fieldName, label) {
  const normalized = requireString(value, fieldName, label);

  if (!allowedValues.includes(normalized)) {
    throw createValidationError(`${label} invalido(a).`, {
      field: fieldName,
      allowedValues,
    });
  }

  return normalized;
}

function optionalEmail(value, fieldName, label) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return null;
  }

  if (!SIMPLE_EMAIL_REGEX.test(normalized)) {
    throw createValidationError(`${label} invalido(a).`, { field: fieldName });
  }

  return normalized.toLowerCase();
}

function validateEspeciePayload(payload = {}) {
  return {
    nome: requireString(payload.nome, 'nome', 'Nome da especie'),
    nome_cientifico: normalizeString(payload.nome_cientifico) || null,
    categoria: requireOneOf(payload.categoria || 'ornamental', ESPECIE_CATEGORIAS, 'categoria', 'Categoria'),
    porte: requireOneOf(payload.porte || 'medio', ESPECIE_PORTES, 'porte', 'Porte'),
    unidade_medida: requireString(payload.unidade_medida || 'unidade', 'unidade_medida', 'Unidade de medida'),
    estoque_minimo_alerta: assertPositive(payload.estoque_minimo_alerta ?? 0, 'estoque_minimo_alerta', { allowZero: true }),
    fator_arvometro: assertPositive(payload.fator_arvometro ?? 1, 'fator_arvometro'),
    area_media_m2: assertPositive(payload.area_media_m2 ?? 1, 'area_media_m2'),
    status: requireOneOf(payload.status || 'ativo', STATUS_ESPECIE, 'status', 'Status'),
    observacoes: normalizeString(payload.observacoes) || null,
  };
}

function validateLotePayload(payload = {}) {
  return {
    especie_id: assertPositiveInteger(payload.especie_id, 'especie_id'),
    codigo: requireString(payload.codigo, 'codigo', 'Codigo do lote'),
    origem_lote: requireString(payload.origem_lote || 'producao_interna', 'origem_lote', 'Origem do lote'),
    local_armazenamento: normalizeString(payload.local_armazenamento) || null,
    data_entrada: requireString(payload.data_entrada, 'data_entrada', 'Data de entrada'),
    quantidade_inicial: assertPositive(payload.quantidade_inicial, 'quantidade_inicial'),
    status: requireOneOf(payload.status || 'ativo', STATUS_LOTE, 'status', 'Status'),
    observacoes: normalizeString(payload.observacoes) || null,
  };
}

function validateLoteUpdatePayload(payload = {}) {
  return {
    origem_lote: requireString(payload.origem_lote || 'producao_interna', 'origem_lote', 'Origem do lote'),
    local_armazenamento: normalizeString(payload.local_armazenamento) || null,
    data_entrada: requireString(payload.data_entrada, 'data_entrada', 'Data de entrada'),
    status: requireOneOf(payload.status || 'ativo', STATUS_LOTE, 'status', 'Status'),
    observacoes: normalizeString(payload.observacoes) || null,
  };
}

function validateMovimentacaoPayload(payload = {}) {
  return {
    lote_id: assertPositiveInteger(payload.lote_id, 'lote_id'),
    tipo: requireOneOf(payload.tipo, TIPOS_MOVIMENTACAO_AJUSTE, 'tipo', 'Tipo de movimentacao'),
    quantidade: assertPositive(payload.quantidade, 'quantidade'),
    observacoes: normalizeString(payload.observacoes) || null,
  };
}

function validateSolicitacaoPayload(payload = {}) {
  const itens = Array.isArray(payload.itens) ? payload.itens : [];

  if (!itens.length) {
    throw createValidationError('Informe pelo menos um item na solicitacao.', { field: 'itens' });
  }

  return {
    solicitante_nome: requireString(payload.solicitante_nome, 'solicitante_nome', 'Solicitante'),
    solicitante_documento: normalizeString(payload.solicitante_documento) || null,
    solicitante_email: optionalEmail(payload.solicitante_email, 'solicitante_email', 'Email'),
    solicitante_telefone: normalizeString(payload.solicitante_telefone) || null,
    tipo_solicitante: requireOneOf(payload.tipo_solicitante || 'cidadao', TIPOS_SOLICITANTE, 'tipo_solicitante', 'Tipo de solicitante'),
    instituicao_nome: normalizeString(payload.instituicao_nome) || null,
    finalidade: requireString(payload.finalidade, 'finalidade', 'Finalidade'),
    local_plantio: normalizeString(payload.local_plantio) || null,
    territorio_id: payload.territorio_id === '' || payload.territorio_id === null || payload.territorio_id === undefined
      ? null
      : assertPositiveInteger(payload.territorio_id, 'territorio_id'),
    observacoes: normalizeString(payload.observacoes) || null,
    itens: itens.map((item, index) => ({
      especie_id: assertPositiveInteger(item.especie_id, `itens[${index}].especie_id`),
      quantidade_solicitada: assertPositive(item.quantidade_solicitada, `itens[${index}].quantidade_solicitada`),
      observacoes: normalizeString(item.observacoes) || null,
    })),
  };
}

function validateAnalisePayload(payload = {}) {
  const itens = Array.isArray(payload.itens) ? payload.itens : [];
  const reservas = Array.isArray(payload.reservas) ? payload.reservas : [];

  if (!itens.length) {
    throw createValidationError('Informe os itens analisados da solicitacao.', { field: 'itens' });
  }

  const duplicateReservaItemIds = new Set();

  return {
    observacao_analise: normalizeString(payload.observacao_analise) || null,
    itens: itens.map((item, index) => ({
      solicitacao_item_id: assertPositiveInteger(item.solicitacao_item_id, `itens[${index}].solicitacao_item_id`),
      quantidade_aprovada: assertPositive(item.quantidade_aprovada ?? 0, `itens[${index}].quantidade_aprovada`, { allowZero: true }),
    })),
    reservas: reservas.map((item, index) => {
      const solicitacaoItemId = assertPositiveInteger(item.solicitacao_item_id, `reservas[${index}].solicitacao_item_id`);

      if (duplicateReservaItemIds.has(solicitacaoItemId)) {
        throw createValidationError('Nao repita o mesmo item na reserva.', {
          field: `reservas[${index}].solicitacao_item_id`,
        });
      }

      duplicateReservaItemIds.add(solicitacaoItemId);

      return {
        solicitacao_item_id: solicitacaoItemId,
        lote_id: assertPositiveInteger(item.lote_id, `reservas[${index}].lote_id`),
        quantidade_reservada: assertPositive(item.quantidade_reservada, `reservas[${index}].quantidade_reservada`),
        observacoes: normalizeString(item.observacoes) || null,
      };
    }),
  };
}

function validateEntregaPayload(payload = {}) {
  const itens = Array.isArray(payload.itens) ? payload.itens : [];

  if (!itens.length) {
    throw createValidationError('Informe pelo menos um item para registrar a entrega.', { field: 'itens' });
  }

  return {
    solicitacao_id: assertPositiveInteger(payload.solicitacao_id, 'solicitacao_id'),
    recebedor_nome: requireString(payload.recebedor_nome, 'recebedor_nome', 'Recebedor'),
    recebedor_documento: normalizeString(payload.recebedor_documento) || null,
    observacoes: normalizeString(payload.observacoes) || null,
    itens: itens.map((item, index) => ({
      solicitacao_item_id: assertPositiveInteger(item.solicitacao_item_id, `itens[${index}].solicitacao_item_id`),
      lote_id: assertPositiveInteger(item.lote_id, `itens[${index}].lote_id`),
      quantidade_entregue: assertPositive(item.quantidade_entregue, `itens[${index}].quantidade_entregue`),
      observacoes: normalizeString(item.observacoes) || null,
    })),
  };
}

function validateEntregaCancelamentoPayload(payload = {}) {
  return {
    motivo_cancelamento: requireString(
      payload.motivo_cancelamento,
      'motivo_cancelamento',
      'Motivo do cancelamento'
    ),
  };
}

module.exports = {
  validateEspeciePayload,
  validateLotePayload,
  validateLoteUpdatePayload,
  validateMovimentacaoPayload,
  validateSolicitacaoPayload,
  validateAnalisePayload,
  validateEntregaPayload,
  validateEntregaCancelamentoPayload,
};
