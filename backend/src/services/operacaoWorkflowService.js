const CAMPANHA_STATUS = Object.freeze({
  EM_ANALISE: 'em_analise',
  PENDENTE_DOCUMENTACAO: 'pendente_documentacao',
  PRE_SELECIONADO: 'pre_selecionado',
  AGENDADO: 'agendado',
  ATENDIDO: 'atendido',
  INDEFERIDO: 'indeferido',
  AUSENTE: 'ausente',
  CANCELADO: 'cancelado',
});

const CAMPANHA_STATUS_OPTIONS = Object.freeze(Object.values(CAMPANHA_STATUS));

const CAMPANHA_STATUS_LABELS = Object.freeze({
  [CAMPANHA_STATUS.EM_ANALISE]: 'Em analise',
  [CAMPANHA_STATUS.PENDENTE_DOCUMENTACAO]: 'Pendente de informacao/documento',
  [CAMPANHA_STATUS.PRE_SELECIONADO]: 'Apto para agendamento',
  [CAMPANHA_STATUS.AGENDADO]: 'Agendado',
  [CAMPANHA_STATUS.ATENDIDO]: 'Atendido',
  [CAMPANHA_STATUS.INDEFERIDO]: 'Inapto/indeferido',
  [CAMPANHA_STATUS.AUSENTE]: 'Ausente',
  [CAMPANHA_STATUS.CANCELADO]: 'Cancelado',
});

const CAMPANHA_FINAL_STATUS = Object.freeze([
  CAMPANHA_STATUS.ATENDIDO,
  CAMPANHA_STATUS.INDEFERIDO,
  CAMPANHA_STATUS.CANCELADO,
]);

const CAMPANHA_TRANSITIONS = Object.freeze({
  [CAMPANHA_STATUS.EM_ANALISE]: [
    CAMPANHA_STATUS.PENDENTE_DOCUMENTACAO,
    CAMPANHA_STATUS.PRE_SELECIONADO,
    CAMPANHA_STATUS.INDEFERIDO,
    CAMPANHA_STATUS.CANCELADO,
  ],
  [CAMPANHA_STATUS.PENDENTE_DOCUMENTACAO]: [
    CAMPANHA_STATUS.EM_ANALISE,
    CAMPANHA_STATUS.PRE_SELECIONADO,
    CAMPANHA_STATUS.INDEFERIDO,
    CAMPANHA_STATUS.CANCELADO,
  ],
  [CAMPANHA_STATUS.PRE_SELECIONADO]: [
    CAMPANHA_STATUS.PENDENTE_DOCUMENTACAO,
    CAMPANHA_STATUS.AGENDADO,
    CAMPANHA_STATUS.INDEFERIDO,
    CAMPANHA_STATUS.CANCELADO,
  ],
  [CAMPANHA_STATUS.AGENDADO]: [
    CAMPANHA_STATUS.ATENDIDO,
    CAMPANHA_STATUS.AUSENTE,
    CAMPANHA_STATUS.CANCELADO,
  ],
  [CAMPANHA_STATUS.AUSENTE]: [
    CAMPANHA_STATUS.AGENDADO,
    CAMPANHA_STATUS.CANCELADO,
  ],
  [CAMPANHA_STATUS.INDEFERIDO]: [
    CAMPANHA_STATUS.EM_ANALISE,
    CAMPANHA_STATUS.CANCELADO,
  ],
  [CAMPANHA_STATUS.ATENDIDO]: [],
  [CAMPANHA_STATUS.CANCELADO]: [],
});

const OCORRENCIA_STATUS = Object.freeze({
  ABERTA: 'aberta',
  EM_ANALISE: 'em_analise',
  PENDENTE_INFORMACAO: 'pendente_informacao',
  EM_ATENDIMENTO: 'em_atendimento',
  ENCAMINHADA: 'encaminhada',
  RESOLVIDA: 'resolvida',
  CANCELADA: 'cancelada',
  ARQUIVADA: 'arquivada',
});

const OCORRENCIA_STATUS_OPTIONS = Object.freeze(Object.values(OCORRENCIA_STATUS));

const OCORRENCIA_STATUS_LABELS = Object.freeze({
  [OCORRENCIA_STATUS.ABERTA]: 'Recebida',
  [OCORRENCIA_STATUS.EM_ANALISE]: 'Em analise',
  [OCORRENCIA_STATUS.PENDENTE_INFORMACAO]: 'Pendente de informacao',
  [OCORRENCIA_STATUS.EM_ATENDIMENTO]: 'Em atendimento',
  [OCORRENCIA_STATUS.ENCAMINHADA]: 'Encaminhada',
  [OCORRENCIA_STATUS.RESOLVIDA]: 'Concluida/resolvida',
  [OCORRENCIA_STATUS.CANCELADA]: 'Cancelada',
  [OCORRENCIA_STATUS.ARQUIVADA]: 'Arquivada',
});

const OCORRENCIA_FINAL_STATUS = Object.freeze([
  OCORRENCIA_STATUS.RESOLVIDA,
  OCORRENCIA_STATUS.CANCELADA,
  OCORRENCIA_STATUS.ARQUIVADA,
]);

const OCORRENCIA_TRANSITIONS = Object.freeze({
  [OCORRENCIA_STATUS.ABERTA]: [
    OCORRENCIA_STATUS.EM_ANALISE,
    OCORRENCIA_STATUS.PENDENTE_INFORMACAO,
    OCORRENCIA_STATUS.EM_ATENDIMENTO,
    OCORRENCIA_STATUS.CANCELADA,
  ],
  [OCORRENCIA_STATUS.EM_ANALISE]: [
    OCORRENCIA_STATUS.PENDENTE_INFORMACAO,
    OCORRENCIA_STATUS.EM_ATENDIMENTO,
    OCORRENCIA_STATUS.ENCAMINHADA,
    OCORRENCIA_STATUS.RESOLVIDA,
    OCORRENCIA_STATUS.CANCELADA,
    OCORRENCIA_STATUS.ARQUIVADA,
  ],
  [OCORRENCIA_STATUS.PENDENTE_INFORMACAO]: [
    OCORRENCIA_STATUS.EM_ANALISE,
    OCORRENCIA_STATUS.EM_ATENDIMENTO,
    OCORRENCIA_STATUS.CANCELADA,
    OCORRENCIA_STATUS.ARQUIVADA,
  ],
  [OCORRENCIA_STATUS.EM_ATENDIMENTO]: [
    OCORRENCIA_STATUS.PENDENTE_INFORMACAO,
    OCORRENCIA_STATUS.ENCAMINHADA,
    OCORRENCIA_STATUS.RESOLVIDA,
    OCORRENCIA_STATUS.CANCELADA,
  ],
  [OCORRENCIA_STATUS.ENCAMINHADA]: [
    OCORRENCIA_STATUS.EM_ATENDIMENTO,
    OCORRENCIA_STATUS.RESOLVIDA,
    OCORRENCIA_STATUS.ARQUIVADA,
  ],
  [OCORRENCIA_STATUS.RESOLVIDA]: [],
  [OCORRENCIA_STATUS.CANCELADA]: [],
  [OCORRENCIA_STATUS.ARQUIVADA]: [],
});

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeStatus(value) {
  return String(value || '').trim();
}

function getAllowedTransitions(matrix, currentStatus) {
  return matrix[normalizeStatus(currentStatus)] || [];
}

function buildStatusOptions(currentStatus, allStatus, labels, allowed) {
  const values = [currentStatus, ...allowed].filter(Boolean);
  const uniqueValues = values.filter((value, index) => values.indexOf(value) === index);

  return uniqueValues
    .filter((value) => allStatus.includes(value))
    .map((value) => ({
      value,
      label: labels[value] || value,
    }));
}

function assertKnownStatus(status, allStatus, label) {
  if (!allStatus.includes(status)) {
    throw validationError(`${label} invalido: ${status}.`);
  }
}

function validateCampanhaTransition(currentStatus, nextStatus, data = {}) {
  const current = normalizeStatus(currentStatus) || CAMPANHA_STATUS.EM_ANALISE;
  const next = normalizeStatus(nextStatus);

  assertKnownStatus(current, CAMPANHA_STATUS_OPTIONS, 'Status atual da inscricao');
  assertKnownStatus(next, CAMPANHA_STATUS_OPTIONS, 'Status novo da inscricao');

  const allowed = getAllowedTransitions(CAMPANHA_TRANSITIONS, current);

  if (current !== next && !allowed.includes(next)) {
    throw validationError(
      `Transicao de inscricao invalida: ${CAMPANHA_STATUS_LABELS[current] || current} -> ${CAMPANHA_STATUS_LABELS[next] || next}.`
    );
  }

  if (next === CAMPANHA_STATUS.AGENDADO && !data.agendamento_data) {
    throw validationError('Informe a data de agendamento para mover a inscricao para Agendado.');
  }

  if (
    next === CAMPANHA_STATUS.PENDENTE_DOCUMENTACAO &&
    !data.pendencia_descricao &&
    !data.observacoes_tecnicas
  ) {
    throw validationError('Descreva a pendencia antes de mover a inscricao para pendente.');
  }

  return {
    current,
    next,
    allowed,
  };
}

function validateOcorrenciaTransition(currentStatus, nextStatus, data = {}) {
  const current = normalizeStatus(currentStatus) || OCORRENCIA_STATUS.ABERTA;
  const next = normalizeStatus(nextStatus);

  assertKnownStatus(current, OCORRENCIA_STATUS_OPTIONS, 'Status atual da ocorrencia');
  assertKnownStatus(next, OCORRENCIA_STATUS_OPTIONS, 'Status novo da ocorrencia');

  const allowed = getAllowedTransitions(OCORRENCIA_TRANSITIONS, current);

  if (current !== next && !allowed.includes(next)) {
    throw validationError(
      `Transicao de ocorrencia invalida: ${OCORRENCIA_STATUS_LABELS[current] || current} -> ${OCORRENCIA_STATUS_LABELS[next] || next}.`
    );
  }

  if (
    next === OCORRENCIA_STATUS.PENDENTE_INFORMACAO &&
    !data.pendencia_descricao &&
    !data.resolucao
  ) {
    throw validationError('Descreva a pendencia antes de mover a ocorrencia para pendente.');
  }

  return {
    current,
    next,
    allowed,
  };
}

function getCampanhaQueueBucket(row = {}) {
  const status = row.status;

  if (status === CAMPANHA_STATUS.EM_ANALISE) return 'triagem';
  if (status === CAMPANHA_STATUS.PENDENTE_DOCUMENTACAO || row.pendencia_aberta) return 'pendencia';
  if (status === CAMPANHA_STATUS.PRE_SELECIONADO) return 'agendamento';
  if (status === CAMPANHA_STATUS.AGENDADO) return 'atendimento';
  if (status === CAMPANHA_STATUS.AUSENTE) return 'reagendamento';
  return CAMPANHA_FINAL_STATUS.includes(status) ? 'finalizado' : 'revisao';
}

function getCampanhaNextStep(row = {}) {
  const status = row.status;

  if (status === CAMPANHA_STATUS.EM_ANALISE) return 'Realizar triagem tecnica e classificar como apta, pendente ou indeferida.';
  if (status === CAMPANHA_STATUS.PENDENTE_DOCUMENTACAO || row.pendencia_aberta) return 'Aguardar ou solicitar informacao/documento pendente ao tutor.';
  if (status === CAMPANHA_STATUS.PRE_SELECIONADO) return 'Definir data de atendimento e mover para agendado.';
  if (status === CAMPANHA_STATUS.AGENDADO) return 'Confirmar atendimento, registrar ausencia ou cancelar se necessario.';
  if (status === CAMPANHA_STATUS.AUSENTE) return 'Avaliar reagendamento ou cancelar a inscricao.';
  if (status === CAMPANHA_STATUS.ATENDIDO) return 'Caso finalizado com atendimento registrado.';
  if (status === CAMPANHA_STATUS.INDEFERIDO) return 'Caso finalizado como inapto, salvo reprocessamento autorizado.';
  if (status === CAMPANHA_STATUS.CANCELADO) return 'Caso finalizado por cancelamento.';
  return 'Revisar status operacional.';
}

function buildCampanhaWorkflow(row = {}) {
  const status = normalizeStatus(row.status) || CAMPANHA_STATUS.EM_ANALISE;
  const allowed = getAllowedTransitions(CAMPANHA_TRANSITIONS, status);

  return {
    status_label: CAMPANHA_STATUS_LABELS[status] || status,
    transicoes_permitidas: allowed,
    opcoes_status: buildStatusOptions(status, CAMPANHA_STATUS_OPTIONS, CAMPANHA_STATUS_LABELS, allowed),
    fila: getCampanhaQueueBucket(row),
    proximo_passo: getCampanhaNextStep(row),
    pendencia_aberta: Boolean(row.pendencia_aberta),
    finalizado: CAMPANHA_FINAL_STATUS.includes(status),
  };
}

function getOcorrenciaQueueBucket(row = {}) {
  const status = row.status;

  if (status === OCORRENCIA_STATUS.ABERTA) return 'recebidas';
  if (status === OCORRENCIA_STATUS.EM_ANALISE) return 'analise';
  if (status === OCORRENCIA_STATUS.PENDENTE_INFORMACAO || row.pendencia_aberta) return 'pendencia';
  if (status === OCORRENCIA_STATUS.EM_ATENDIMENTO) return 'atendimento';
  if (status === OCORRENCIA_STATUS.ENCAMINHADA) return 'encaminhadas';
  return OCORRENCIA_FINAL_STATUS.includes(status) ? 'finalizado' : 'revisao';
}

function getOcorrenciaNextStep(row = {}) {
  const status = row.status;

  if (status === OCORRENCIA_STATUS.ABERTA) return 'Fazer analise inicial e definir encaminhamento ou atendimento.';
  if (status === OCORRENCIA_STATUS.EM_ANALISE) return 'Concluir analise, encaminhar, abrir pendencia ou iniciar atendimento.';
  if (status === OCORRENCIA_STATUS.PENDENTE_INFORMACAO || row.pendencia_aberta) return 'Solicitar ou aguardar informacao complementar.';
  if (status === OCORRENCIA_STATUS.EM_ATENDIMENTO) return 'Executar atendimento em campo e registrar desfecho.';
  if (status === OCORRENCIA_STATUS.ENCAMINHADA) return 'Acompanhar retorno do encaminhamento.';
  if (status === OCORRENCIA_STATUS.RESOLVIDA) return 'Caso concluido.';
  if (status === OCORRENCIA_STATUS.CANCELADA) return 'Caso cancelado.';
  if (status === OCORRENCIA_STATUS.ARQUIVADA) return 'Caso arquivado.';
  return 'Revisar status operacional.';
}

function buildOcorrenciaWorkflow(row = {}) {
  const status = normalizeStatus(row.status) || OCORRENCIA_STATUS.ABERTA;
  const allowed = getAllowedTransitions(OCORRENCIA_TRANSITIONS, status);

  return {
    status_label: OCORRENCIA_STATUS_LABELS[status] || status,
    transicoes_permitidas: allowed,
    opcoes_status: buildStatusOptions(status, OCORRENCIA_STATUS_OPTIONS, OCORRENCIA_STATUS_LABELS, allowed),
    fila: getOcorrenciaQueueBucket(row),
    proximo_passo: getOcorrenciaNextStep(row),
    pendencia_aberta: Boolean(row.pendencia_aberta),
    finalizado: OCORRENCIA_FINAL_STATUS.includes(status),
  };
}

module.exports = {
  CAMPANHA_STATUS,
  CAMPANHA_STATUS_OPTIONS,
  CAMPANHA_STATUS_LABELS,
  CAMPANHA_FINAL_STATUS,
  CAMPANHA_TRANSITIONS,
  OCORRENCIA_STATUS,
  OCORRENCIA_STATUS_OPTIONS,
  OCORRENCIA_STATUS_LABELS,
  OCORRENCIA_FINAL_STATUS,
  OCORRENCIA_TRANSITIONS,
  validateCampanhaTransition,
  validateOcorrenciaTransition,
  buildCampanhaWorkflow,
  buildOcorrenciaWorkflow,
};
