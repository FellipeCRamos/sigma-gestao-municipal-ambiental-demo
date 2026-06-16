const STATUS_PRE_REQUERIMENTO = Object.freeze([
  'pre_requerimento_criado',
  'aguardando_documentos',
  'em_conferencia',
  'apto_para_autuacao',
  'convertido_em_processo',
  'diligencia',
  'arquivado',
  'cancelado',
]);

const STATUS_DOCUMENTAL = Object.freeze([
  'pendente',
  'apresentado',
  'em_conferencia',
  'aceito',
  'recusado',
  'dispensado',
  'nao_se_aplica',
]);

function buildError(message, details = undefined) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details;
  return error;
}

function text(value, maxLength = null) {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim();
  return maxLength ? normalized.slice(0, maxLength) : normalized;
}

function optionalText(value, maxLength = null) {
  const normalized = text(value, maxLength);
  return normalized || null;
}

function validateStatus(status, field = 'status') {
  const normalized = text(status, 60);
  if (!STATUS_PRE_REQUERIMENTO.includes(normalized)) {
    throw buildError('Status do pre-requerimento invalido.', { field });
  }
  return normalized;
}

function validateConversionPayload(payload = {}) {
  return {
    observacaoConversao: optionalText(payload.observacaoConversao, 4000)
      || 'Analise convertida em pre-requerimento para conferencia documental e instrucao preliminar.',
    statusInicial: payload.statusInicial ? validateStatus(payload.statusInicial, 'statusInicial') : 'pre_requerimento_criado',
  };
}

function validateListFilters(query = {}) {
  return {
    status: query.status ? validateStatus(query.status) : null,
    atividade: optionalText(query.atividade, 160),
    nivelAtencao: optionalText(query.nivelAtencao, 20),
    interessado: optionalText(query.interessado, 180),
    codigo: optionalText(query.codigo, 80),
    dataInicial: optionalText(query.dataInicial, 30),
    dataFinal: optionalText(query.dataFinal, 30),
    busca: optionalText(query.busca || query.q, 180),
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    pageSize: Math.min(100, Math.max(1, Number.parseInt(query.pageSize || query.page_size, 10) || 30)),
  };
}

function validateStatusUpdate(payload = {}) {
  return {
    status: validateStatus(payload.status),
    observacao: optionalText(payload.observacao, 4000),
  };
}

function validateMinutaUpdate(payload = {}) {
  const minuta = text(payload.minutaDespacho, 12000);
  if (!minuta) {
    throw buildError('Minuta de despacho e obrigatoria.', { field: 'minutaDespacho' });
  }
  return {
    minutaDespacho: minuta,
    observacao: optionalText(payload.observacao, 4000),
  };
}

function validateDocumentoUpdate(payload = {}) {
  const codigo = text(payload.codigo || payload.codigoDocumento, 120);
  if (!codigo) {
    throw buildError('Codigo do documento e obrigatorio.', { field: 'codigo' });
  }

  const status = text(payload.status, 60);
  if (!STATUS_DOCUMENTAL.includes(status)) {
    throw buildError('Status documental invalido.', { field: 'status' });
  }

  return {
    codigo,
    status,
    observacao: optionalText(payload.observacao, 4000),
    arquivoId: optionalText(payload.arquivoId, 120),
  };
}

module.exports = {
  STATUS_PRE_REQUERIMENTO,
  STATUS_DOCUMENTAL,
  validateConversionPayload,
  validateListFilters,
  validateStatusUpdate,
  validateMinutaUpdate,
  validateDocumentoUpdate,
};
