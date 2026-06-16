const STATUS_OPTIONS = Object.freeze([
  'aberta',
  'em_analise',
  'vistoria_planejada',
  'vistoria_realizada',
  'aguardando_informacao',
  'encaminhada_para_providencias',
  'encerrada_sem_elementos',
  'encerrada_preliminarmente',
  'arquivada',
]);

const CLOSING_STATUS_OPTIONS = Object.freeze([
  'encerrada_sem_elementos',
  'encerrada_preliminarmente',
  'arquivada',
]);

const PRIORITY_OPTIONS = Object.freeze(['baixa', 'normal', 'alta', 'urgente']);

function createValidationError(message, details = null) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details || undefined;
  return error;
}

function sanitizeText(value, maxLength, fieldName, { required = false, minLength = 0 } = {}) {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (required && !text) {
    throw createValidationError(`Campo obrigatorio: ${fieldName}.`, { field: fieldName });
  }

  if (text && text.length < minLength) {
    throw createValidationError(`Campo muito curto: ${fieldName}.`, { field: fieldName, minLength });
  }

  if (text.length > maxLength) {
    throw createValidationError(`Campo muito longo: ${fieldName}.`, { field: fieldName, maxLength });
  }

  return text || null;
}

function normalizeInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createValidationError(`Parametro invalido: ${fieldName}.`, { field: fieldName });
  }

  return parsed;
}

function normalizeOptionalInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return normalizeInteger(value, fieldName);
}

function validateConversionPayload(payload = {}) {
  return {
    justificativa_conversao: sanitizeText(
      payload.justificativa_conversao || payload.justificativa,
      2000,
      'justificativa_conversao',
      { required: true, minLength: 10 }
    ),
    responsavel_id: normalizeOptionalInteger(payload.responsavel_id, 'responsavel_id'),
    observacoes_internas: sanitizeText(payload.observacoes_internas, 2000, 'observacoes_internas'),
  };
}

function validateStatusPayload(payload = {}) {
  const status = String(payload.status || '').trim().toLowerCase();

  if (!STATUS_OPTIONS.includes(status)) {
    throw createValidationError('Status invalido.', { field: 'status', allowed: STATUS_OPTIONS });
  }

  if (CLOSING_STATUS_OPTIONS.includes(status)) {
    throw createValidationError('Use o endpoint de encerramento preliminar para status de encerramento.', {
      field: 'status',
      allowed_endpoint: 'encerrar-preliminarmente',
    });
  }

  return {
    status,
    descricao: sanitizeText(payload.descricao, 1200, 'descricao', { required: true, minLength: 5 }),
  };
}

function validateResponsiblePayload(payload = {}) {
  return {
    responsavel_id: normalizeOptionalInteger(payload.responsavel_id, 'responsavel_id'),
    descricao: sanitizeText(payload.descricao, 1200, 'descricao'),
  };
}

function validateMovementPayload(payload = {}) {
  return {
    descricao: sanitizeText(payload.descricao, 1200, 'descricao', { required: true, minLength: 5 }),
  };
}

function validateClosePayload(payload = {}) {
  const status = String(payload.status || 'encerrada_preliminarmente').trim().toLowerCase();

  if (!CLOSING_STATUS_OPTIONS.includes(status)) {
    throw createValidationError('Status de encerramento preliminar invalido.', {
      field: 'status',
      allowed: CLOSING_STATUS_OPTIONS,
    });
  }

  return {
    status,
    justificativa_encerramento_preliminar: sanitizeText(
      payload.justificativa_encerramento_preliminar || payload.justificativa,
      2000,
      'justificativa_encerramento_preliminar',
      { required: true, minLength: 10 }
    ),
  };
}

function normalizeListFilters(query = {}) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || 20);
  const status = String(query.status || '').trim().toLowerCase();
  const prioridade = String(query.prioridade || '').trim().toLowerCase();

  return {
    protocolo: sanitizeText(query.protocolo, 80, 'protocolo'),
    status: STATUS_OPTIONS.includes(status) ? status : null,
    categoria: sanitizeText(query.categoria, 40, 'categoria'),
    prioridade: PRIORITY_OPTIONS.includes(prioridade) ? prioridade : null,
    responsavel_id: query.responsavel_id ? normalizeOptionalInteger(query.responsavel_id, 'responsavel_id') : null,
    demanda_publica_id: query.demanda_publica_id
      ? normalizeOptionalInteger(query.demanda_publica_id, 'demanda_publica_id')
      : null,
    data_inicio: sanitizeText(query.data_inicio, 30, 'data_inicio'),
    data_fim: sanitizeText(query.data_fim, 30, 'data_fim'),
    busca: sanitizeText(query.busca, 120, 'busca'),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    page_size: Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 50) : 20,
  };
}

module.exports = {
  STATUS_OPTIONS,
  CLOSING_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  createValidationError,
  sanitizeText,
  normalizeInteger,
  validateConversionPayload,
  validateStatusPayload,
  validateResponsiblePayload,
  validateMovementPayload,
  validateClosePayload,
  normalizeListFilters,
};
