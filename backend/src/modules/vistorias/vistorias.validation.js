const VISTORIA_STATUS_OPTIONS = Object.freeze([
  'planejada',
  'agendada',
  'em_execucao',
  'realizada',
  'relatorio_em_elaboracao',
  'relatorio_emitido',
  'cancelada',
  'arquivada',
]);

const VISTORIA_CLOSING_STATUS_OPTIONS = Object.freeze(['cancelada', 'arquivada']);
const VISTORIA_PRIORITY_OPTIONS = Object.freeze(['baixa', 'normal', 'alta', 'urgente']);

const RELATORIO_STATUS_OPTIONS = Object.freeze([
  'rascunho',
  'em_revisao',
  'revisado',
  'emitido_preliminarmente',
  'arquivado',
]);

function createValidationError(message, details = null) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details || undefined;
  return error;
}

function sanitizeText(value, maxLength, fieldName, { required = false, minLength = 0 } = {}) {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n/g, '\n')
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

function sanitizeDate(value, fieldName) {
  const text = sanitizeText(value, 40, fieldName);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw createValidationError(`Data invalida: ${fieldName}.`, { field: fieldName });
  }

  return text;
}

function normalizePriority(value) {
  const prioridade = String(value || 'normal').trim().toLowerCase();
  return VISTORIA_PRIORITY_OPTIONS.includes(prioridade) ? prioridade : 'normal';
}

function validateCreateVistoriaPayload(payload = {}) {
  return {
    tipo_vistoria: sanitizeText(payload.tipo_vistoria || 'vistoria_ambiental', 60, 'tipo_vistoria') || 'vistoria_ambiental',
    finalidade: sanitizeText(payload.finalidade, 160, 'finalidade'),
    prioridade: normalizePriority(payload.prioridade),
    data_planejada: sanitizeDate(payload.data_planejada, 'data_planejada'),
    equipe_responsavel: sanitizeText(payload.equipe_responsavel, 1000, 'equipe_responsavel'),
    responsavel_id: normalizeOptionalInteger(payload.responsavel_id, 'responsavel_id'),
    objetivo: sanitizeText(payload.objetivo, 3000, 'objetivo', { required: true, minLength: 10 }),
    metodologia_resumida: sanitizeText(payload.metodologia_resumida, 3000, 'metodologia_resumida'),
    observacoes_internas: sanitizeText(payload.observacoes_internas, 3000, 'observacoes_internas'),
  };
}

function validateVistoriaStatusPayload(payload = {}) {
  const status = String(payload.status || '').trim().toLowerCase();

  if (!VISTORIA_STATUS_OPTIONS.includes(status)) {
    throw createValidationError('Status de vistoria invalido.', {
      field: 'status',
      allowed: VISTORIA_STATUS_OPTIONS,
    });
  }

  if (status === 'cancelada') {
    throw createValidationError('Use o endpoint de cancelamento para cancelar vistoria.', {
      field: 'status',
      allowed_endpoint: 'cancelar',
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

function validateRealizacaoPayload(payload = {}) {
  const constatacoes = sanitizeText(payload.constatacoes, 5000, 'constatacoes');
  const objetivo = sanitizeText(payload.objetivo, 3000, 'objetivo');

  if (!constatacoes && !objetivo) {
    throw createValidationError('Informe objetivo ou constatacoes minimas da vistoria realizada.', {
      fields: ['objetivo', 'constatacoes'],
    });
  }

  return {
    data_realizada: sanitizeDate(payload.data_realizada || new Date().toISOString(), 'data_realizada'),
    objetivo,
    metodologia_resumida: sanitizeText(payload.metodologia_resumida, 3000, 'metodologia_resumida'),
    constatacoes,
    evidencias_observadas: sanitizeText(payload.evidencias_observadas, 5000, 'evidencias_observadas'),
    riscos_identificados: sanitizeText(payload.riscos_identificados, 3000, 'riscos_identificados'),
    providencias_recomendadas: sanitizeText(payload.providencias_recomendadas, 3000, 'providencias_recomendadas'),
    observacoes_internas: sanitizeText(payload.observacoes_internas, 3000, 'observacoes_internas'),
  };
}

function validateCancelPayload(payload = {}) {
  return {
    justificativa_cancelamento: sanitizeText(
      payload.justificativa_cancelamento || payload.justificativa,
      2000,
      'justificativa_cancelamento',
      { required: true, minLength: 10 }
    ),
  };
}

function validateCreateRelatorioPayload(payload = {}) {
  const normalized = validateRelatorioContentPayload(payload, { requireMinimum: true });
  return {
    tipo_relatorio: sanitizeText(payload.tipo_relatorio || 'tecnico_preliminar', 60, 'tipo_relatorio') || 'tecnico_preliminar',
    ...normalized,
  };
}

function validateRelatorioContentPayload(payload = {}, { requireMinimum = false } = {}) {
  const normalized = {
    introducao: sanitizeText(payload.introducao, 6000, 'introducao'),
    historico: sanitizeText(payload.historico, 6000, 'historico'),
    caracterizacao_area: sanitizeText(payload.caracterizacao_area, 6000, 'caracterizacao_area'),
    caracterizacao_demanda: sanitizeText(payload.caracterizacao_demanda, 6000, 'caracterizacao_demanda'),
    metodologia: sanitizeText(payload.metodologia, 6000, 'metodologia'),
    constatacoes_tecnicas: sanitizeText(payload.constatacoes_tecnicas, 8000, 'constatacoes_tecnicas'),
    analise_tecnica_preliminar: sanitizeText(payload.analise_tecnica_preliminar, 8000, 'analise_tecnica_preliminar'),
    registros_fotograficos_descricao: sanitizeText(
      payload.registros_fotograficos_descricao,
      6000,
      'registros_fotograficos_descricao'
    ),
    conclusao_preliminar: sanitizeText(payload.conclusao_preliminar, 6000, 'conclusao_preliminar'),
    recomendacoes: sanitizeText(payload.recomendacoes, 6000, 'recomendacoes'),
    encaminhamentos_sugeridos: sanitizeText(payload.encaminhamentos_sugeridos, 6000, 'encaminhamentos_sugeridos'),
    limitacoes: sanitizeText(payload.limitacoes, 4000, 'limitacoes'),
    observacoes_internas: sanitizeText(payload.observacoes_internas, 3000, 'observacoes_internas'),
  };

  if (requireMinimum && !normalized.constatacoes_tecnicas && !normalized.conclusao_preliminar) {
    throw createValidationError('Relatorio preliminar exige constatacoes tecnicas ou conclusao preliminar.', {
      fields: ['constatacoes_tecnicas', 'conclusao_preliminar'],
    });
  }

  return normalized;
}

function validateRelatorioStatusPayload(payload = {}) {
  const status = String(payload.status || '').trim().toLowerCase();

  if (!RELATORIO_STATUS_OPTIONS.includes(status)) {
    throw createValidationError('Status de relatorio preliminar invalido.', {
      field: 'status',
      allowed: RELATORIO_STATUS_OPTIONS,
    });
  }

  return {
    status,
    descricao: sanitizeText(payload.descricao, 1200, 'descricao', { required: true, minLength: 5 }),
  };
}

function normalizeVistoriaFilters(query = {}) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || 20);
  const status = String(query.status || '').trim().toLowerCase();
  const prioridade = String(query.prioridade || '').trim().toLowerCase();

  return {
    protocolo: sanitizeText(query.protocolo, 80, 'protocolo'),
    status: VISTORIA_STATUS_OPTIONS.includes(status) ? status : null,
    prioridade: VISTORIA_PRIORITY_OPTIONS.includes(prioridade) ? prioridade : null,
    fiscalizacao_id: query.fiscalizacao_id ? normalizeOptionalInteger(query.fiscalizacao_id, 'fiscalizacao_id') : null,
    responsavel_id: query.responsavel_id ? normalizeOptionalInteger(query.responsavel_id, 'responsavel_id') : null,
    localidade: sanitizeText(query.localidade, 120, 'localidade'),
    data_inicio: sanitizeText(query.data_inicio, 30, 'data_inicio'),
    data_fim: sanitizeText(query.data_fim, 30, 'data_fim'),
    busca: sanitizeText(query.busca, 160, 'busca'),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    page_size: Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 50) : 20,
  };
}

function normalizeRelatorioFilters(query = {}) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || 20);
  const status = String(query.status || '').trim().toLowerCase();

  return {
    protocolo: sanitizeText(query.protocolo, 80, 'protocolo'),
    status: RELATORIO_STATUS_OPTIONS.includes(status) ? status : null,
    vistoria_id: query.vistoria_id ? normalizeOptionalInteger(query.vistoria_id, 'vistoria_id') : null,
    fiscalizacao_id: query.fiscalizacao_id ? normalizeOptionalInteger(query.fiscalizacao_id, 'fiscalizacao_id') : null,
    elaborado_por_id: query.elaborado_por_id
      ? normalizeOptionalInteger(query.elaborado_por_id, 'elaborado_por_id')
      : null,
    data_inicio: sanitizeText(query.data_inicio, 30, 'data_inicio'),
    data_fim: sanitizeText(query.data_fim, 30, 'data_fim'),
    busca: sanitizeText(query.busca, 160, 'busca'),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    page_size: Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 50) : 20,
  };
}

module.exports = {
  VISTORIA_STATUS_OPTIONS,
  VISTORIA_CLOSING_STATUS_OPTIONS,
  VISTORIA_PRIORITY_OPTIONS,
  RELATORIO_STATUS_OPTIONS,
  createValidationError,
  sanitizeText,
  normalizeInteger,
  validateCreateVistoriaPayload,
  validateVistoriaStatusPayload,
  validateResponsiblePayload,
  validateMovementPayload,
  validateRealizacaoPayload,
  validateCancelPayload,
  validateCreateRelatorioPayload,
  validateRelatorioContentPayload,
  validateRelatorioStatusPayload,
  normalizeVistoriaFilters,
  normalizeRelatorioFilters,
};
