const PROCESSO_STATUS = Object.freeze([
  'protocolado',
  'em_triagem',
  'em_diligencia',
  'em_analise_tecnica',
  'aguardando_manifestacao',
  'apto_para_decisao',
  'deferido',
  'indeferido',
  'arquivado',
  'licenca_emitida',
  'suspenso',
  'cancelado',
]);

function createValidationError(message, details = null) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details || undefined;
  return error;
}

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizePositiveInteger(value, fieldName, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createValidationError(`Campo obrigatorio: ${fieldName}.`, { field: fieldName });
    }

    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createValidationError(`Campo invalido: ${fieldName}.`, { field: fieldName });
  }

  return parsed;
}

function normalizeYear(value) {
  const currentYear = new Date().getFullYear();

  if (value === undefined || value === null || value === '') {
    return currentYear;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > currentYear + 2) {
    throw createValidationError('Ano do processo invalido.', { field: 'ano' });
  }

  return parsed;
}

function normalizeDateOnly(value, fieldName) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const date = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw createValidationError(`Data invalida: ${fieldName}.`, { field: fieldName });
  }

  return normalized.slice(0, 10);
}

function normalizeStatus(status, { required = false } = {}) {
  const normalized = normalizeString(status);

  if (!normalized) {
    if (required) {
      throw createValidationError('Status do processo obrigatorio.', { field: 'status' });
    }

    return 'protocolado';
  }

  if (!PROCESSO_STATUS.includes(normalized)) {
    throw createValidationError('Status do processo invalido.', {
      field: 'status',
      allowed: PROCESSO_STATUS,
    });
  }

  return normalized;
}

function requireString(value, fieldName) {
  const normalized = normalizeString(value);

  if (!normalized) {
    throw createValidationError(`Campo obrigatorio: ${fieldName}.`, { field: fieldName });
  }

  return normalized;
}

function normalizeRequerente(payload = {}) {
  return {
    id: normalizePositiveInteger(payload.id, 'requerente_id'),
    nome_razao_social: requireString(payload.nome_razao_social || payload.nome, 'requerente.nome_razao_social'),
    documento: normalizeOptionalString(payload.documento),
    tipo: normalizeOptionalString(payload.tipo) || 'nao_informado',
    email: normalizeOptionalString(payload.email),
    telefone: normalizeOptionalString(payload.telefone),
    endereco: normalizeOptionalString(payload.endereco),
  };
}

function normalizeEmpreendimento(payload = {}) {
  return {
    id: normalizePositiveInteger(payload.id, 'empreendimento_id'),
    nome: requireString(payload.nome, 'empreendimento.nome'),
    atividade_principal: normalizeOptionalString(payload.atividade_principal),
    endereco: normalizeOptionalString(payload.endereco),
    bairro: normalizeOptionalString(payload.bairro),
    territorio_id: normalizePositiveInteger(payload.territorio_id, 'territorio_id'),
    latitude: payload.latitude === undefined || payload.latitude === null || payload.latitude === ''
      ? null
      : Number(payload.latitude),
    longitude: payload.longitude === undefined || payload.longitude === null || payload.longitude === ''
      ? null
      : Number(payload.longitude),
  };
}

function validateCoordinates(entity) {
  if (entity.latitude !== null && (!Number.isFinite(entity.latitude) || entity.latitude < -90 || entity.latitude > 90)) {
    throw createValidationError('Latitude invalida.', { field: 'latitude' });
  }

  if (entity.longitude !== null && (!Number.isFinite(entity.longitude) || entity.longitude < -180 || entity.longitude > 180)) {
    throw createValidationError('Longitude invalida.', { field: 'longitude' });
  }
}

function validateProcessoCreatePayload(payload = {}) {
  const requerente = payload.requerente_id
    ? { id: normalizePositiveInteger(payload.requerente_id, 'requerente_id', { required: true }) }
    : normalizeRequerente(payload.requerente || {});

  const empreendimento = payload.empreendimento_id
    ? { id: normalizePositiveInteger(payload.empreendimento_id, 'empreendimento_id', { required: true }) }
    : normalizeEmpreendimento(payload.empreendimento || {});

  if (!empreendimento.id) {
    validateCoordinates(empreendimento);
  }

  const tipoLicenca = requireString(payload.tipo_licenca, 'tipo_licenca');
  const atividadePrincipal = requireString(
    payload.atividade_principal || empreendimento.atividade_principal,
    'atividade_principal'
  );

  return {
    numero_processo: normalizeOptionalString(payload.numero_processo),
    ano: normalizeYear(payload.ano),
    requerente,
    empreendimento: {
      ...empreendimento,
      atividade_principal: empreendimento.atividade_principal || atividadePrincipal,
    },
    tipo_licenca: tipoLicenca,
    classe: normalizeOptionalString(payload.classe),
    porte: normalizeOptionalString(payload.porte),
    atividade_principal: atividadePrincipal,
    status: normalizeStatus(payload.status),
    responsavel_id: normalizePositiveInteger(payload.responsavel_id, 'responsavel_id'),
    data_protocolo: normalizeDateOnly(payload.data_protocolo, 'data_protocolo'),
    observacoes: normalizeOptionalString(payload.observacoes),
  };
}

function validateProcessoUpdatePayload(payload = {}) {
  const update = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'numero_processo')) {
    update.numero_processo = requireString(payload.numero_processo, 'numero_processo');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'ano')) {
    update.ano = normalizeYear(payload.ano);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tipo_licenca')) {
    update.tipo_licenca = requireString(payload.tipo_licenca, 'tipo_licenca');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'classe')) {
    update.classe = normalizeOptionalString(payload.classe);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'porte')) {
    update.porte = normalizeOptionalString(payload.porte);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'atividade_principal')) {
    update.atividade_principal = requireString(payload.atividade_principal, 'atividade_principal');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    update.status = normalizeStatus(payload.status, { required: true });
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'responsavel_id')) {
    update.responsavel_id = normalizePositiveInteger(payload.responsavel_id, 'responsavel_id');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'data_protocolo')) {
    update.data_protocolo = normalizeDateOnly(payload.data_protocolo, 'data_protocolo');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'observacoes')) {
    update.observacoes = normalizeOptionalString(payload.observacoes);
  }

  if (Object.keys(update).length === 0) {
    throw createValidationError('Informe ao menos um campo para atualizacao.');
  }

  return update;
}

function normalizeListFilters(query = {}) {
  const page = normalizePositiveInteger(query.page, 'page') || 1;
  const pageSize = normalizePositiveInteger(query.page_size, 'page_size') || 15;

  return {
    busca: normalizeOptionalString(query.busca),
    status: normalizeOptionalString(query.status),
    ano: query.ano ? normalizeYear(query.ano) : null,
    page,
    page_size: Math.min(pageSize, 50),
    limit: Math.min(pageSize, 50),
    offset: (page - 1) * Math.min(pageSize, 50),
  };
}

module.exports = {
  PROCESSO_STATUS,
  createValidationError,
  normalizeString,
  normalizeOptionalString,
  normalizePositiveInteger,
  validateProcessoCreatePayload,
  validateProcessoUpdatePayload,
  normalizeListFilters,
};
