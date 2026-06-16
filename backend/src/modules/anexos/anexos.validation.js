const path = require('path');

const MODULE_OPTIONS = Object.freeze([
  'demandas_publicas',
  'licenciamento',
  'anuencia',
  'fiscalizacao',
  'viveiro',
  'bem_estar_animal',
]);

const ENTITY_OPTIONS = Object.freeze([
  'demanda_publica',
  'processo_licenciamento',
  'anuencia',
  'fiscalizacao',
  'vistoria_ambiental',
  'relatorio_tecnico_preliminar',
  'solicitacao_viveiro',
  'animal',
]);

const VISIBILITY_OPTIONS = Object.freeze(['restrito', 'interno', 'publico_mascarado']);

function createValidationError(message, details = null) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details || undefined;
  return error;
}

function sanitizeText(value, maxLength, fieldName, { required = false, fallback = null } = {}) {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (required && !text) {
    throw createValidationError(`Campo obrigatorio: ${fieldName}.`, { field: fieldName });
  }

  if (text.length > maxLength) {
    throw createValidationError(`Campo muito longo: ${fieldName}.`, { field: fieldName, maxLength });
  }

  return text || fallback;
}

function normalizeInteger(value, fieldName, { required = true } = {}) {
  if ((value === null || value === undefined || value === '') && !required) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createValidationError(`Campo invalido: ${fieldName}.`, { field: fieldName });
  }

  return parsed;
}

function normalizeBoolean(value) {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  return false;
}

function validateUploadMetadata(payload = {}, defaults = {}) {
  const modulo = sanitizeText(payload.modulo_origem ?? defaults.modulo_origem, 60, 'modulo_origem', {
    required: true,
  });
  const entidadeTipo = sanitizeText(payload.entidade_tipo ?? defaults.entidade_tipo, 80, 'entidade_tipo', {
    required: true,
  });
  const entidadeId = normalizeInteger(payload.entidade_id ?? defaults.entidade_id, 'entidade_id');
  const visibilidade = sanitizeText(payload.visibilidade, 30, 'visibilidade', { fallback: 'restrito' });

  if (!MODULE_OPTIONS.includes(modulo)) {
    throw createValidationError('Modulo de origem invalido.', { field: 'modulo_origem', allowed: MODULE_OPTIONS });
  }

  if (!ENTITY_OPTIONS.includes(entidadeTipo)) {
    throw createValidationError('Tipo de entidade invalido.', { field: 'entidade_tipo', allowed: ENTITY_OPTIONS });
  }

  if (!VISIBILITY_OPTIONS.includes(visibilidade)) {
    throw createValidationError('Visibilidade invalida.', { field: 'visibilidade', allowed: VISIBILITY_OPTIONS });
  }

  return {
    modulo_origem: modulo,
    entidade_tipo: entidadeTipo,
    entidade_id: entidadeId,
    categoria_documental: sanitizeText(payload.categoria_documental, 80, 'categoria_documental', {
      fallback: 'documento',
    }),
    descricao: sanitizeText(payload.descricao, 1000, 'descricao'),
    visibilidade,
    sensivel: normalizeBoolean(payload.sensivel),
  };
}

function validateRemovePayload(payload = {}) {
  return {
    motivo_remocao: sanitizeText(payload.motivo_remocao || payload.motivo, 1000, 'motivo_remocao', {
      required: true,
    }),
  };
}

function getExtension(file) {
  return path.extname(file?.originalname || '').toLowerCase();
}

module.exports = {
  MODULE_OPTIONS,
  ENTITY_OPTIONS,
  VISIBILITY_OPTIONS,
  createValidationError,
  sanitizeText,
  normalizeInteger,
  normalizeBoolean,
  validateUploadMetadata,
  validateRemovePayload,
  getExtension,
};
