const {
  AULA_DEFINITION,
  CURADORIA_STATUS,
  ENTITY_DEFINITIONS,
  FONTES_ESFERAS,
  GRAUS_CONFIABILIDADE,
  NIVEIS_SENSIBILIDADE,
  STATUS_FONTES,
  STATUS_REFERENCIAS,
  TIPOS_ENTIDADE_REFERENCIA,
  TIPOS_EVIDENCIA,
  TIPOS_FONTE,
} = require('./educacaoAmbiental.constants');

const FONTE_DEFINITION = {
  jsonFields: ['temas_relacionados'],
  enumFields: {
    tipo_fonte: TIPOS_FONTE,
    esfera: FONTES_ESFERAS,
    confiabilidade_padrao: GRAUS_CONFIABILIDADE,
    status: STATUS_FONTES,
  },
};

const REFERENCIA_DEFINITION = {
  integerFields: ['entidade_id', 'fonte_id'],
  dateFields: ['data_acesso'],
  enumFields: {
    entidade_tipo: TIPOS_ENTIDADE_REFERENCIA,
    tipo_evidencia: TIPOS_EVIDENCIA,
    confiabilidade: GRAUS_CONFIABILIDADE,
    status: STATUS_REFERENCIAS,
  },
};

const FONTE_FIELDS = [
  'nome',
  'tipo_fonte',
  'esfera',
  'orgao_responsavel',
  'descricao',
  'url',
  'temas_relacionados',
  'confiabilidade_padrao',
  'periodicidade_atualizacao',
  'observacoes',
  'status',
];

const REFERENCIA_FIELDS = [
  'entidade_tipo',
  'entidade_id',
  'fonte_id',
  'titulo_referencia',
  'descricao',
  'url',
  'trecho_relevante',
  'pagina',
  'data_acesso',
  'tipo_evidencia',
  'confiabilidade',
  'observacoes',
  'status',
];

const CURADORIA_PATCH_FIELDS = [
  'status_curadoria',
  'grau_confiabilidade',
  'fonte_principal_id',
  'exige_validacao_tecnica',
  'exige_validacao_juridica',
  'responsavel_curadoria_id',
  'responsavel_validacao_tecnica_id',
  'responsavel_validacao_juridica_id',
  'data_inicio_curadoria',
  'data_validacao_tecnica',
  'data_validacao_juridica',
  'parecer_curadoria',
  'observacoes_validacao',
  'justificativa_publicacao',
  'justificativa_sem_referencia',
  'revisao_periodica_em',
  'validade_revisao_meses',
  'nivel_sensibilidade',
  'apto_para_ia',
  'apto_para_portal_publico',
  'conteudo_local_especifico',
];

function createValidationError(message, details = null) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details;
  return error;
}

function normalizeString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function slugify(value) {
  const normalized = normalizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || '';
}

function normalizeInteger(value, fieldName, { required = false, min = null, max = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createValidationError(`Campo obrigatorio: ${fieldName}.`, { field: fieldName });
    }
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw createValidationError(`Campo invalido: ${fieldName}.`, { field: fieldName });
  }

  if (min !== null && parsed < min) {
    throw createValidationError(`Campo abaixo do minimo permitido: ${fieldName}.`, { field: fieldName, min });
  }

  if (max !== null && parsed > max) {
    throw createValidationError(`Campo acima do maximo permitido: ${fieldName}.`, { field: fieldName, max });
  }

  return parsed;
}

function normalizePositiveId(value, fieldName = 'id') {
  const parsed = normalizeInteger(value, fieldName, { required: true, min: 1 });
  return parsed;
}

function normalizeNumeric(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw createValidationError(`Campo invalido: ${fieldName}.`, { field: fieldName });
  }

  return parsed;
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return Boolean(value);
}

function normalizeJson(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : item)).filter((item) => item !== '');
  }

  if (typeof value === 'object') {
    return value;
  }

  const normalized = normalizeString(value);

  if (!normalized) {
    return [];
  }

  if (normalized.startsWith('{') || normalized.startsWith('[')) {
    try {
      return JSON.parse(normalized);
    } catch {
      throw createValidationError(`JSON invalido: ${fieldName}.`, { field: fieldName });
    }
  }

  return normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDateLike(value, fieldName) {
  const normalized = normalizeNullableString(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw createValidationError(`Data invalida: ${fieldName}.`, { field: fieldName });
  }

  return normalized;
}

function getDefinition(entityKey) {
  const definition = ENTITY_DEFINITIONS[entityKey];

  if (!definition) {
    throw createValidationError('Entidade de educacao ambiental invalida.', { entityKey });
  }

  return definition;
}

function normalizeByDefinition(definition, payload = {}, allowedFields = []) {
  const normalized = {};

  allowedFields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      return;
    }

    if (definition.jsonFields?.includes(field)) {
      normalized[field] = normalizeJson(payload[field], field);
      return;
    }

    if (definition.booleanFields?.includes(field)) {
      normalized[field] = normalizeBoolean(payload[field]);
      return;
    }

    if (definition.integerFields?.includes(field)) {
      normalized[field] = normalizeInteger(payload[field], field);
      return;
    }

    if (definition.numericFields?.includes(field)) {
      normalized[field] = normalizeNumeric(payload[field], field);
      return;
    }

    if (definition.dateFields?.includes(field) || definition.timestampFields?.includes(field)) {
      normalized[field] = normalizeDateLike(payload[field], field);
      return;
    }

    normalized[field] = normalizeNullableString(payload[field]);
  });

  if (definition.key === 'conteudos') {
    const title = normalized.titulo ?? normalizeNullableString(payload.titulo);
    if (!normalizeString(payload.slug) && title && allowedFields.includes('slug')) {
      normalized.slug = slugify(title);
    } else if (Object.prototype.hasOwnProperty.call(normalized, 'slug')) {
      normalized.slug = slugify(normalized.slug);
    }
  }

  return normalized;
}

function requireOneOf(value, allowedValues, fieldName) {
  if (value === null || value === undefined || value === '') {
    return;
  }

  if (!allowedValues.includes(value)) {
    throw createValidationError(`Valor invalido para ${fieldName}.`, {
      field: fieldName,
      allowedValues,
    });
  }
}

function validateEnums(definition, payload) {
  Object.entries(definition.enumFields || {}).forEach(([field, allowedValues]) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      requireOneOf(payload[field], allowedValues, field);
    }
  });
}

function validateRequiredFields(payload, fields, contextLabel = 'registro') {
  fields.forEach((field) => {
    if (!normalizeString(payload[field])) {
      throw createValidationError(`Campo obrigatorio para ${contextLabel}: ${field}.`, { field });
    }
  });
}

function validateGenericBusinessRules(definition, normalized, existing = {}) {
  const next = { ...existing, ...normalized };

  if (definition.titleField && Object.prototype.hasOwnProperty.call(normalized, definition.titleField)) {
    if (!normalizeString(normalized[definition.titleField])) {
      throw createValidationError('Titulo/nome obrigatorio para o registro.', {
        field: definition.titleField,
      });
    }
  }

  if (definition.key === 'normas') {
    if (!normalizeString(next.titulo)) {
      throw createValidationError('Titulo da norma obrigatorio.', { field: 'titulo' });
    }

    if (!normalizeString(next.tipo_norma)) {
      throw createValidationError('Tipo da norma obrigatorio.', { field: 'tipo_norma' });
    }

    if (!normalizeString(next.esfera)) {
      throw createValidationError('Esfera da norma obrigatoria.', { field: 'esfera' });
    }

    if (!next.ano && !normalizeString(next.observacoes)) {
      throw createValidationError('Norma exige ano ou justificativa em observacoes.', {
        field: 'ano',
      });
    }
  }

  if (definition.key === 'especies' && next.status === 'publicado') {
    if (!normalizeString(next.nome_popular) && !normalizeString(next.nome_cientifico)) {
      throw createValidationError('Especie publicada exige nome popular ou cientifico.', {
        field: 'nome_popular',
      });
    }
  }
}

function validatePublicationRules(definition, next) {
  const statusField = definition.statusField || 'status';

  if (next[statusField] !== 'publicado') {
    return;
  }

  validateRequiredFields(next, definition.publicationRequiredFields || [], 'publicacao');

  if (definition.key === 'conteudos' && !normalizeString(next.fonte_referencia) && !normalizeString(next.observacoes_validacao)) {
    throw createValidationError('Conteudo publicado exige fonte/referencia ou observacao de validacao.', {
      field: 'fonte_referencia',
    });
  }

  if (definition.key === 'conteudos') {
    const curadoriaStatus = normalizeString(next.status_curadoria || 'nao_iniciado');
    const validatedTechnically = Boolean(next.data_validacao_tecnica)
      || ['validado_tecnicamente', 'validado_juridicamente', 'apto_publicacao', 'publicado'].includes(curadoriaStatus);
    const validatedLegally = Boolean(next.data_validacao_juridica)
      || ['validado_juridicamente', 'apto_publicacao', 'publicado'].includes(curadoriaStatus);

    if (next.exige_validacao_tecnica !== false && !validatedTechnically) {
      throw createValidationError('Conteudo publicado exige validacao tecnica na curadoria.', {
        field: 'data_validacao_tecnica',
      });
    }

    if (next.exige_validacao_juridica === true && !validatedLegally) {
      throw createValidationError('Conteudo publicado exige validacao juridica na curadoria.', {
        field: 'data_validacao_juridica',
      });
    }

    if (next.apto_para_portal_publico !== true) {
      throw createValidationError('Conteudo publicado deve estar marcado como apto para portal publico.', {
        field: 'apto_para_portal_publico',
      });
    }
  }

  if (definition.key === 'normas') {
    if (!normalizeString(next.link_fonte) && !normalizeString(next.observacoes)) {
      throw createValidationError('Norma publicada exige fonte/link ou observacao justificativa.', {
        field: 'link_fonte',
      });
    }
  }

  if (definition.key === 'materiais') {
    const hasLocation = normalizeString(next.url_externa) || normalizeString(next.arquivo_url);
    const hasDescription = normalizeString(next.descricao).length >= 20;

    if (!hasLocation && !hasDescription) {
      throw createValidationError('Material publicado exige URL/arquivo ou descricao suficiente.', {
        field: 'url_externa',
      });
    }
  }

  if (definition.key === 'especies' && !normalizeString(next.fonte_referencia) && !normalizeString(next.observacoes_validacao)) {
    throw createValidationError('Especie publicada exige fonte/referencia ou observacao de validacao.', {
      field: 'fonte_referencia',
    });
  }

  if (definition.key === 'areas') {
    if (next.status_validacao !== 'validado') {
      throw createValidationError('Area ambiental publicada exige status de validacao validado.', {
        field: 'status_validacao',
      });
    }

    if (!normalizeString(next.fonte_referencia)) {
      throw createValidationError('Area ambiental publicada exige fonte/referencia.', {
        field: 'fonte_referencia',
      });
    }
  }

  if (definition.key === 'faq' && !normalizeString(next.fonte_referencia)) {
    throw createValidationError('FAQ publicado exige fonte/referencia para futura base de conhecimento.', {
      field: 'fonte_referencia',
    });
  }
}

function validateCreatePayload(entityKey, payload = {}) {
  const definition = getDefinition(entityKey);
  const normalized = normalizeByDefinition(definition, payload, definition.createFields);

  validateEnums(definition, normalized);
  validateGenericBusinessRules(definition, normalized);
  validatePublicationRules(definition, normalized);

  return normalized;
}

function validateUpdatePayload(entityKey, payload = {}, existing = {}) {
  const definition = getDefinition(entityKey);
  const normalized = normalizeByDefinition(definition, payload, definition.updateFields);

  validateEnums(definition, normalized);
  validateGenericBusinessRules(definition, normalized, existing);
  validatePublicationRules(definition, { ...existing, ...normalized });

  return normalized;
}

function validateStatusPayload(entityKey, payload = {}, existing = {}) {
  const definition = getDefinition(entityKey);
  const statusField = definition.statusField || 'status';
  const status = normalizeString(payload.status || payload[statusField]);

  if (!status) {
    throw createValidationError('Status obrigatorio.', { field: 'status' });
  }

  requireOneOf(status, definition.allowedStatuses, 'status');

  const normalized = {
    [statusField]: status,
  };

  if (status === 'publicado' && definition.key === 'conteudos') {
    normalized.publicado_em = normalizeDateLike(payload.publicado_em, 'publicado_em') || new Date().toISOString();
  }

  validatePublicationRules(definition, { ...existing, ...normalized });

  return normalized;
}

function validateAulaCreatePayload(trilhaId, payload = {}) {
  const normalized = normalizeByDefinition(AULA_DEFINITION, { ...payload, trilha_id: trilhaId }, AULA_DEFINITION.createFields);
  validateEnums(AULA_DEFINITION, normalized);
  validateRequiredFields(normalized, ['trilha_id', 'titulo'], 'aula');
  validatePublicationRules(AULA_DEFINITION, normalized);
  return normalized;
}

function validateAulaUpdatePayload(payload = {}, existing = {}) {
  const normalized = normalizeByDefinition(AULA_DEFINITION, payload, AULA_DEFINITION.updateFields);
  validateEnums(AULA_DEFINITION, normalized);
  validatePublicationRules(AULA_DEFINITION, { ...existing, ...normalized });
  return normalized;
}

function normalizeListFilters(definition, query = {}) {
  const page = normalizeInteger(query.page, 'page') || 1;
  const limit = Math.min(normalizeInteger(query.limit || query.page_size, 'limit') || 20, 100);
  const orderBy = definition.orderColumns.includes(query.orderBy) ? query.orderBy : 'created_at';
  const orderDirection = String(query.orderDirection || query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    orderBy,
    orderDirection,
    q: normalizeNullableString(query.q || query.busca),
    raw: query,
  };
}

function normalizeSimpleFilters(query = {}, allowedOrderColumns = ['created_at', 'updated_at', 'nome']) {
  const page = normalizeInteger(query.page, 'page') || 1;
  const limit = Math.min(normalizeInteger(query.limit || query.page_size, 'limit') || 20, 100);
  const orderBy = allowedOrderColumns.includes(query.orderBy) ? query.orderBy : allowedOrderColumns[0];
  const orderDirection = String(query.orderDirection || query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    orderBy,
    orderDirection,
    q: normalizeNullableString(query.q || query.busca),
    raw: query,
  };
}

function validateFontePayload(payload = {}, { partial = false } = {}) {
  const normalized = normalizeByDefinition(FONTE_DEFINITION, payload, FONTE_FIELDS);
  validateEnums(FONTE_DEFINITION, normalized);

  if (!partial || Object.prototype.hasOwnProperty.call(normalized, 'nome')) {
    if (!normalizeString(normalized.nome)) {
      throw createValidationError('Nome da fonte obrigatorio.', { field: 'nome' });
    }
  }

  return normalized;
}

function validateFonteStatusPayload(payload = {}) {
  const status = normalizeString(payload.status);
  requireOneOf(status, STATUS_FONTES, 'status');
  return { status };
}

function validateReferenciaPayload(payload = {}, { partial = false } = {}) {
  const normalized = normalizeByDefinition(REFERENCIA_DEFINITION, payload, REFERENCIA_FIELDS);
  validateEnums(REFERENCIA_DEFINITION, normalized);

  if (!partial) {
    validateRequiredFields(normalized, ['entidade_tipo', 'entidade_id', 'titulo_referencia'], 'referencia');
  }

  if (Object.prototype.hasOwnProperty.call(normalized, 'entidade_id') && !normalized.entidade_id) {
    throw createValidationError('Referencia exige entidade_id valido.', { field: 'entidade_id' });
  }

  return normalized;
}

function validateCuradoriaPatchPayload(payload = {}) {
  const definition = ENTITY_DEFINITIONS.conteudos;
  const normalized = normalizeByDefinition(definition, payload, CURADORIA_PATCH_FIELDS);
  validateEnums(definition, normalized);
  return normalized;
}

function validateCuradoriaStatusPayload(payload = {}) {
  const normalized = validateCuradoriaPatchPayload(payload);

  if (!normalizeString(normalized.status_curadoria)) {
    throw createValidationError('Status de curadoria obrigatorio.', { field: 'status_curadoria' });
  }

  requireOneOf(normalized.status_curadoria, CURADORIA_STATUS, 'status_curadoria');
  return normalized;
}

function validateAptoPayload(payload = {}, fieldName) {
  if (
    !Object.prototype.hasOwnProperty.call(payload, fieldName)
    && !Object.prototype.hasOwnProperty.call(payload, 'apto')
  ) {
    throw createValidationError('Marcacao de aptidao obrigatoria.', { field: fieldName });
  }

  const normalized = {
    [fieldName]: normalizeBoolean(
      Object.prototype.hasOwnProperty.call(payload, fieldName) ? payload[fieldName] : payload.apto
    ),
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'parecer_curadoria')) {
    normalized.parecer_curadoria = normalizeNullableString(payload.parecer_curadoria);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'justificativa_publicacao')) {
    normalized.justificativa_publicacao = normalizeNullableString(payload.justificativa_publicacao);
  }

  return normalized;
}

module.exports = {
  createValidationError,
  getDefinition,
  normalizeInteger,
  normalizeListFilters,
  normalizeNullableString,
  normalizePositiveId,
  normalizeSimpleFilters,
  normalizeString,
  slugify,
  validateAulaCreatePayload,
  validateAulaUpdatePayload,
  validateAptoPayload,
  validateCuradoriaPatchPayload,
  validateCuradoriaStatusPayload,
  validateCreatePayload,
  validateFontePayload,
  validateFonteStatusPayload,
  validateReferenciaPayload,
  validateStatusPayload,
  validateUpdatePayload,
};
