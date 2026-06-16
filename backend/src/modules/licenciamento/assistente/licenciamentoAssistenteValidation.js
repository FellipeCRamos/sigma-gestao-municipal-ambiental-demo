const STATUS_ANALISE_ASSISTENTE = Object.freeze([
  'rascunho',
  'enviado',
  'em_analise',
  'aguardando_complementacao',
  'validado_para_prosseguimento',
  'convertido_em_requerimento',
  'arquivado',
  'indeferido_preliminarmente',
]);

const DECISOES_VALIDACAO_ASSISTENTE = Object.freeze([
  'confirmar_enquadramento',
  'alterar_enquadramento',
  'solicitar_complementacao',
  'encaminhar_semob',
  'encaminhar_fiscalizacao',
  'prosseguir_requerimento',
  'arquivar',
  'indeferir_preliminarmente',
]);

const NIVEIS_ATENCAO_ASSISTENTE = Object.freeze(['baixo', 'medio', 'alto']);

function buildError(message, details = undefined) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details;
  return error;
}

function trimString(value, maxLength = null) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return maxLength ? text.slice(0, maxLength) : text;
}

function requiredText(value, field, maxLength = null) {
  const text = trimString(value, maxLength);
  if (!text) {
    throw buildError(`Campo obrigatorio ausente: ${field}.`, { field });
  }
  return text;
}

function optionalText(value, maxLength = null) {
  const text = trimString(value, maxLength);
  return text || null;
}

function ensureObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw buildError(`Campo invalido: ${field}.`, { field });
  }
  return value;
}

function ensureArray(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw buildError(`Campo invalido: ${field}.`, { field });
  }
  return value;
}

function validateEmail(email) {
  if (!email) return null;
  const normalized = trimString(email, 180);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw buildError('Email do interessado invalido.', { field: 'emailInteressado' });
  }
  return normalized;
}

function normalizeConfianca(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw buildError('Confianca deve ser numero entre 0 e 1.', { field: 'confianca' });
  }
  return numeric;
}

function validateNivelAtencao(value) {
  const nivel = requiredText(value, 'nivelAtencao', 20);
  if (!NIVEIS_ATENCAO_ASSISTENTE.includes(nivel)) {
    throw buildError('Nivel de atencao invalido.', { field: 'nivelAtencao' });
  }
  return nivel;
}

function validateStatus(value, field = 'status') {
  const status = requiredText(value, field, 60);
  if (!STATUS_ANALISE_ASSISTENTE.includes(status)) {
    throw buildError('Status da analise invalido.', { field });
  }
  return status;
}

function validateDecisao(value) {
  const decisao = requiredText(value, 'decisaoValidacao', 80);
  if (!DECISOES_VALIDACAO_ASSISTENTE.includes(decisao)) {
    throw buildError('Decisao de validacao invalida.', { field: 'decisaoValidacao' });
  }
  return decisao;
}

function validateCreateAnalise(payload = {}) {
  const descricaoOriginal = requiredText(payload.descricaoOriginal, 'descricaoOriginal', 3000);
  const perfilUsuario = requiredText(payload.perfilUsuario, 'perfilUsuario', 60);
  const atividadeProvavel = requiredText(payload.atividadeProvavel, 'atividadeProvavel', 500);
  const slugAtividade = requiredText(payload.slugAtividade, 'slugAtividade', 120);
  const nivelAtencao = validateNivelAtencao(payload.nivelAtencao);
  const respostasFormulario = ensureObject(payload.respostasFormulario, 'respostasFormulario');
  const versaoMotor = requiredText(payload.versaoMotor, 'versaoMotor', 80);

  return {
    descricaoOriginal,
    perfilUsuario,
    atividadeProvavel,
    slugAtividade,
    grupoAtividade: optionalText(payload.grupoAtividade, 160),
    confianca: normalizeConfianca(payload.confianca),
    nivelAtencao,
    palavrasChaveDetectadas: ensureArray(payload.palavrasChaveDetectadas, 'palavrasChaveDetectadas'),
    respostasFormulario,
    pendencias: ensureArray(payload.pendencias, 'pendencias'),
    checklistDocumental: ensureArray(payload.checklistDocumental, 'checklistDocumental'),
    resumoCidadao: optionalText(payload.resumoCidadao, 8000),
    resumoTecnico: optionalText(payload.resumoTecnico, 8000),
    recomendacaoTramitacao: optionalText(payload.recomendacaoTramitacao, 4000),
    versaoMotor,
    nomeInteressado: optionalText(payload.nomeInteressado, 180),
    emailInteressado: validateEmail(payload.emailInteressado),
    telefoneInteressado: optionalText(payload.telefoneInteressado, 60),
    tipoPessoa: optionalText(payload.tipoPessoa, 80),
    tipoImovel: optionalText(payload.tipoImovel, 80),
  };
}

function validateListFilters(query = {}) {
  return {
    status: query.status ? validateStatus(query.status) : null,
    slugAtividade: optionalText(query.slugAtividade, 120),
    nivelAtencao: query.nivelAtencao ? validateNivelAtencao(query.nivelAtencao) : null,
    dataInicial: optionalText(query.dataInicial, 30),
    dataFinal: optionalText(query.dataFinal, 30),
    busca: optionalText(query.busca || query.q, 180),
    nomeInteressado: optionalText(query.nomeInteressado, 180),
    tipoPessoa: optionalText(query.tipoPessoa, 80),
    tipoImovel: optionalText(query.tipoImovel, 80),
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    pageSize: Math.min(100, Math.max(1, Number.parseInt(query.pageSize || query.page_size, 10) || 30)),
  };
}

function validateStatusUpdate(payload = {}) {
  return {
    status: validateStatus(payload.status),
    observacao: optionalText(payload.observacao || payload.observacaoValidacao, 4000),
  };
}

function statusFromDecision(decisao) {
  const map = {
    confirmar_enquadramento: 'validado_para_prosseguimento',
    alterar_enquadramento: 'em_analise',
    solicitar_complementacao: 'aguardando_complementacao',
    encaminhar_semob: 'em_analise',
    encaminhar_fiscalizacao: 'em_analise',
    prosseguir_requerimento: 'validado_para_prosseguimento',
    arquivar: 'arquivado',
    indeferir_preliminarmente: 'indeferido_preliminarmente',
  };

  return map[decisao] || 'em_analise';
}

function validateValidacao(payload = {}) {
  const decisaoValidacao = validateDecisao(payload.decisaoValidacao);
  const status = payload.status ? validateStatus(payload.status) : statusFromDecision(decisaoValidacao);
  const observacaoValidacao = requiredText(payload.observacaoValidacao, 'observacaoValidacao', 4000);

  return {
    decisaoValidacao,
    observacaoValidacao,
    status,
  };
}

module.exports = {
  STATUS_ANALISE_ASSISTENTE,
  DECISOES_VALIDACAO_ASSISTENTE,
  NIVEIS_ATENCAO_ASSISTENTE,
  validateCreateAnalise,
  validateListFilters,
  validateStatusUpdate,
  validateValidacao,
};
