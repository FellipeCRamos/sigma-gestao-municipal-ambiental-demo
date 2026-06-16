const CATEGORIES = Object.freeze({
  bem_estar_animal: new Set([
    'maus_tratos',
    'abandono',
    'animal_ferido_risco',
    'animal_errante',
    'acumulo_inadequado_animais',
    'outros_animais',
  ]),
  licenciamento: new Set([
    'empreendimento_sem_licenca',
    'licenca_vencida',
    'descumprimento_condicionantes',
    'atividade_desacordo_licenca',
    'obra_atividade_sem_autorizacao',
    'outros_licenciamento',
  ]),
  fiscalizacao: new Set([
    'corte_arvore',
    'supressao_vegetacao',
    'queimada',
    'descarte_irregular_residuos',
    'intervencao_app',
    'terraplenagem_irregular',
    'poluicao_solo_ar_agua',
    'outros_fiscalizacao',
  ]),
  poluicao_residuos: new Set([
    'descarte_entulho',
    'lancamento_efluentes',
    'poluicao_curso_hidrico',
    'fumaca',
    'odor',
    'residuos_local_inadequado',
    'outros_poluicao_residuos',
  ]),
  outros: new Set([
    'orientacao_ambiental',
    'solicitacao_geral',
    'informacao_complementar',
    'outros',
  ]),
});

const STATUS_OPTIONS = Object.freeze([
  'recebida',
  'em_triagem',
  'encaminhada',
  'em_atendimento',
  'aguardando_informacao',
  'encerrada_procedente',
  'encerrada_improcedente',
  'encerrada_sem_elementos',
  'arquivada',
  'em_analise',
  'em_vistoria',
  'respondida',
  'cancelada',
]);

const CLOSING_STATUS_OPTIONS = Object.freeze([
  'encerrada_procedente',
  'encerrada_improcedente',
  'encerrada_sem_elementos',
  'arquivada',
]);

const MODULE_OPTIONS = Object.freeze([
  'bem_estar_animal',
  'licenciamento',
  'fiscalizacao',
  'triagem_geral',
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

function normalizeCategory(value) {
  const category = String(value || '').trim().toLowerCase().replace(/-/g, '_');

  if (!CATEGORIES[category]) {
    throw createValidationError('Categoria invalida.', {
      field: 'categoria',
      allowed: Object.keys(CATEGORIES),
    });
  }

  return category;
}

function normalizeSubcategory(category, value) {
  const subcategory = String(value || '').trim().toLowerCase().replace(/-/g, '_');

  if (!subcategory || !CATEGORIES[category].has(subcategory)) {
    throw createValidationError('Subcategoria invalida para a categoria selecionada.', {
      field: 'subcategoria',
    });
  }

  return subcategory;
}

function validateEmail(value) {
  const email = sanitizeText(value, 160, 'email_comunicante');

  if (!email) return null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createValidationError('E-mail invalido.', { field: 'email_comunicante' });
  }

  return email;
}

function validatePhone(value) {
  const phone = sanitizeText(value, 40, 'telefone_comunicante');

  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');

  if (digits.length < 8) {
    throw createValidationError('Telefone invalido.', { field: 'telefone_comunicante' });
  }

  return phone;
}

function validatePublicDemandPayload(payload = {}) {
  const categoria = normalizeCategory(payload.categoria);
  const subcategoria = normalizeSubcategory(categoria, payload.subcategoria);
  const identificacaoTipo = String(payload.identificacao_tipo || 'anonima').trim().toLowerCase();

  if (!['anonima', 'identificada'].includes(identificacaoTipo)) {
    throw createValidationError('Tipo de identificacao invalido.', { field: 'identificacao_tipo' });
  }

  if (payload.aceite_lgpd !== true) {
    throw createValidationError('A ciencia sobre o uso das informacoes e obrigatoria.', { field: 'aceite_lgpd' });
  }

  const nome = sanitizeText(payload.nome_comunicante, 160, 'nome_comunicante');
  const telefone = validatePhone(payload.telefone_comunicante);
  const email = validateEmail(payload.email_comunicante);

  if (identificacaoTipo === 'identificada' && (!nome || (!telefone && !email))) {
    throw createValidationError('Para identificacao, informe nome e ao menos um contato.', {
      field: 'identificacao_tipo',
    });
  }

  return {
    categoria,
    subcategoria,
    descricao: sanitizeText(payload.descricao, 3000, 'descricao', { required: true, minLength: 20 }),
    endereco_referencia: sanitizeText(payload.endereco_referencia, 600, 'endereco_referencia', { required: true }),
    bairro_localidade: sanitizeText(payload.bairro_localidade, 140, 'bairro_localidade', { required: true }),
    ponto_referencia: sanitizeText(payload.ponto_referencia, 300, 'ponto_referencia'),
    identificacao_tipo: identificacaoTipo,
    nome_comunicante: identificacaoTipo === 'identificada' ? nome : null,
    telefone_comunicante: identificacaoTipo === 'identificada' ? telefone : null,
    email_comunicante: identificacaoTipo === 'identificada' ? email : null,
    aceite_lgpd: true,
  };
}

function validateStatusUpdatePayload(payload = {}) {
  const status = String(payload.status || '').trim().toLowerCase();
  const moduloResponsavel = payload.modulo_responsavel
    ? String(payload.modulo_responsavel).trim().toLowerCase()
    : null;

  if (!STATUS_OPTIONS.includes(status)) {
    throw createValidationError('Status invalido.', { field: 'status', allowed: STATUS_OPTIONS });
  }

  if (moduloResponsavel && !MODULE_OPTIONS.includes(moduloResponsavel)) {
    throw createValidationError('Modulo responsavel invalido.', {
      field: 'modulo_responsavel',
      allowed: MODULE_OPTIONS,
    });
  }

  const isClosing = CLOSING_STATUS_OPTIONS.includes(status);

  return {
    status,
    modulo_responsavel: moduloResponsavel,
    descricao: sanitizeText(payload.descricao, 1000, 'descricao', { required: true, minLength: 5 }),
    motivo_encerramento: sanitizeText(
      isClosing ? payload.motivo_encerramento || payload.justificativa || payload.descricao : payload.motivo_encerramento,
      2000,
      'motivo_encerramento',
      { required: isClosing, minLength: isClosing ? 10 : 0 }
    ),
  };
}

function validateMovementPayload(payload = {}) {
  return {
    descricao: sanitizeText(payload.descricao, 1000, 'descricao', { required: true, minLength: 5 }),
  };
}

function validateResponsiblePayload(payload = {}) {
  if (payload.responsavel_id === null || payload.responsavel_id === '') {
    return {
      responsavel_id: null,
      descricao: sanitizeText(payload.descricao, 1000, 'descricao'),
    };
  }

  const responsavelId = Number(payload.responsavel_id);

  if (!Number.isInteger(responsavelId) || responsavelId <= 0) {
    throw createValidationError('Responsavel invalido.', { field: 'responsavel_id' });
  }

  return {
    responsavel_id: responsavelId,
    descricao: sanitizeText(payload.descricao, 1000, 'descricao'),
  };
}

function validateClosePayload(payload = {}) {
  const status = String(payload.status || 'encerrada_sem_elementos').trim().toLowerCase();

  if (!CLOSING_STATUS_OPTIONS.includes(status)) {
    throw createValidationError('Status de encerramento invalido.', {
      field: 'status',
      allowed: CLOSING_STATUS_OPTIONS,
    });
  }

  return {
    status,
    justificativa: sanitizeText(payload.justificativa || payload.motivo_encerramento, 2000, 'justificativa', {
      required: true,
      minLength: 10,
    }),
  };
}

function normalizeListFilters(query = {}) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || 20);
  const dataInicio = sanitizeText(query.data_inicio, 30, 'data_inicio');
  const dataFim = sanitizeText(query.data_fim, 30, 'data_fim');
  const prioridade = query.prioridade
    ? String(query.prioridade).trim().toLowerCase()
    : null;
  const moduloResponsavel = query.modulo_responsavel
    ? String(query.modulo_responsavel).trim().toLowerCase()
    : null;

  return {
    categoria: query.categoria ? normalizeCategory(query.categoria) : null,
    status: query.status && STATUS_OPTIONS.includes(String(query.status).trim().toLowerCase())
      ? String(query.status).trim().toLowerCase()
      : null,
    prioridade: prioridade && PRIORITY_OPTIONS.includes(prioridade) ? prioridade : null,
    modulo_responsavel: moduloResponsavel && MODULE_OPTIONS.includes(moduloResponsavel) ? moduloResponsavel : null,
    localidade: sanitizeText(query.localidade || query.bairro_localidade, 140, 'localidade'),
    data_inicio: dataInicio,
    data_fim: dataFim,
    busca: sanitizeText(query.busca, 120, 'busca'),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    page_size: Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 50) : 20,
  };
}

module.exports = {
  CATEGORIES,
  STATUS_OPTIONS,
  CLOSING_STATUS_OPTIONS,
  MODULE_OPTIONS,
  PRIORITY_OPTIONS,
  createValidationError,
  validatePublicDemandPayload,
  validateStatusUpdatePayload,
  validateMovementPayload,
  validateResponsiblePayload,
  validateClosePayload,
  normalizeListFilters,
};
