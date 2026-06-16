const db = require('../../config/db');
const auditService = require('../auditService');
const qualidadeService = require('../cadastroQualidadeService');

const FINAL_STATUSES = new Set(['resolvido_sem_merge', 'mesclado', 'falso_positivo']);
const REVIEW_STATUSES = new Set([
  'pendente',
  'em_revisao',
  'revisar_depois',
  'resolvido_sem_merge',
  'aprovado_para_merge',
  'falso_positivo'
]);

function toJsonb(value, fallback = {}) {
  return JSON.stringify(value ?? fallback);
}

function createServiceError(statusCode, code, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function normalizeStatus(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getRelatedKey(id) {
  const value = Number(id || 0);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function mapCriticidade(alerts = [], fallback = 'media') {
  if (alerts.some((alert) => alert?.severidade === 'bloqueio')) return 'critica';
  if (alerts.some((alert) => alert?.severidade === 'provavel')) return 'alta';
  if (alerts.some((alert) => alert?.severidade === 'possivel')) return 'media';
  return fallback;
}

function mapScoreIndicio(alerts = [], fallback = 30) {
  if (alerts.some((alert) => alert?.severidade === 'bloqueio')) return 100;
  if (alerts.some((alert) => alert?.severidade === 'provavel')) return 80;
  if (alerts.some((alert) => alert?.severidade === 'possivel')) return 60;
  return fallback;
}


module.exports = {
  db,
  auditService,
  qualidadeService,
  FINAL_STATUSES,
  REVIEW_STATUSES,
  toJsonb,
  createServiceError,
  normalizeStatus,
  getRelatedKey,
  mapCriticidade,
  mapScoreIndicio,
};
