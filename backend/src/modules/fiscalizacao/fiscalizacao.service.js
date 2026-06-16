const auditService = require('../../services/auditService');
const anexosService = require('../anexos/anexos.service');
const demandasRepository = require('../demandasPublicas/demandasPublicas.repository');
const { CLOSING_STATUS_OPTIONS } = require('./fiscalizacao.validation');
const repository = require('./fiscalizacao.repository');
const {
  createValidationError,
  normalizeInteger,
  normalizeListFilters,
  validateClosePayload,
  validateConversionPayload,
  validateMovementPayload,
  validateResponsiblePayload,
  validateStatusPayload,
} = require('./fiscalizacao.validation');

function normalizeInternalUserId(user) {
  const id = Number(user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createConflictError(message, details = null) {
  const error = new Error(message);
  error.statusCode = 409;
  error.details = details || undefined;
  return error;
}

function sanitizeForAudit(fiscalizacao = {}) {
  return {
    id: fiscalizacao.id,
    protocolo_fiscalizacao: fiscalizacao.protocolo_fiscalizacao,
    demanda_publica_id: fiscalizacao.demanda_publica_id,
    protocolo_demanda: fiscalizacao.protocolo_demanda,
    categoria: fiscalizacao.categoria,
    subcategoria: fiscalizacao.subcategoria,
    status: fiscalizacao.status,
    prioridade: fiscalizacao.prioridade,
    responsavel_id: fiscalizacao.responsavel_id,
    criado_por_id: fiscalizacao.criado_por_id,
    data_conversao: fiscalizacao.data_conversao,
    data_encerramento_preliminar: fiscalizacao.data_encerramento_preliminar,
    encerrado_por_id: fiscalizacao.encerrado_por_id,
  };
}

function isClosed(status) {
  return CLOSING_STATUS_OPTIONS.includes(status);
}

function assertCanMove(fiscalizacao, nextStatus = null) {
  if (!fiscalizacao) {
    return;
  }

  if (isClosed(fiscalizacao.status) && fiscalizacao.status !== nextStatus) {
    throw createValidationError('Fiscalizacoes encerradas ou arquivadas nao podem ser movimentadas nesta sprint.', {
      field: 'status',
      currentStatus: fiscalizacao.status,
      nextStatus,
    });
  }
}

function assertCanOperateOpenFiscalizacao(fiscalizacao) {
  if (isClosed(fiscalizacao?.status)) {
    throw createValidationError('Fiscalizacoes encerradas ou arquivadas nao podem receber novas movimentacoes nesta sprint.', {
      field: 'status',
      currentStatus: fiscalizacao.status,
    });
  }
}

function sanitizeSensitiveAnexo(anexo, includeSensitive = false) {
  if (!anexo?.sensivel || includeSensitive) {
    return anexo;
  }

  return {
    ...anexo,
    nome_original: 'Anexo sensivel restrito',
    descricao: null,
    hash_sha256: null,
    dados_sensiveis_restritos: true,
  };
}

async function listFiscalizacoes(query = {}) {
  return repository.listFiscalizacoes(normalizeListFilters(query));
}

async function getFiscalizacao(id) {
  return repository.getFiscalizacaoDetail(normalizeInteger(id, 'fiscalizacao_id'));
}

async function convertDemand(demandId, payload, user, req) {
  const normalizedDemandId = normalizeInteger(demandId, 'demanda_id');
  const normalized = validateConversionPayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const demand = await demandasRepository.getDemandById(normalizedDemandId, client, { forUpdate: true });

    if (!demand) {
      throw createNotFoundError('Demanda publica nao encontrada para conversao.');
    }

    const existing = await repository.findByDemandId(normalizedDemandId, client, { forUpdate: true });

    if (existing) {
      throw createConflictError('Demanda publica ja possui fiscalizacao ambiental vinculada.', {
        fiscalizacao_id: existing.id,
        protocolo_fiscalizacao: existing.protocolo_fiscalizacao,
      });
    }

    const created = await repository.createFiscalizacaoFromDemand(client, demand, normalized, userId);

    await repository.insertMovement(client, {
      fiscalizacao_id: created.id,
      tipo: 'conversao',
      status_novo: created.status,
      descricao: normalized.justificativa_conversao,
      usuario_id: userId,
      dados: {
        demanda_publica_id: demand.id,
        protocolo_demanda: demand.protocolo,
      },
    });

    await demandasRepository.insertMovement(client, {
      demanda_id: demand.id,
      status_anterior: demand.status,
      status_novo: demand.status,
      descricao: `Demanda convertida em Fiscalizacao Ambiental Interna ${created.protocolo_fiscalizacao}. Justificativa: ${normalized.justificativa_conversao}`,
      usuario_id: userId,
      origem: 'area_interna_sigma',
    });

    return { demand, created };
  });

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'fiscalizacao.convert_from_demanda',
    entidade: 'fiscalizacoes_ambientais',
    entidade_id: result.created.id,
    dados: {
      protocolo_fiscalizacao: result.created.protocolo_fiscalizacao,
      demanda_publica_id: result.demand.id,
      protocolo_demanda: result.demand.protocolo,
      status: result.created.status,
      prioridade: result.created.prioridade,
    },
    req,
  });

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'demandas_publicas.convert_to_fiscalizacao',
    entidade: 'sigma_demandas_publicas',
    entidade_id: result.demand.id,
    dados: {
      protocolo_demanda: result.demand.protocolo,
      fiscalizacao_id: result.created.id,
      protocolo_fiscalizacao: result.created.protocolo_fiscalizacao,
    },
    req,
  });

  return getFiscalizacao(result.created.id);
}

async function updateStatus(id, payload, user, req) {
  const fiscalizacaoId = normalizeInteger(id, 'fiscalizacao_id');
  const normalized = validateStatusPayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getFiscalizacaoById(fiscalizacaoId, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    assertCanMove(before, normalized.status);

    if (before.status === normalized.status) {
      throw createValidationError('Fiscalizacao ja esta no status informado.', { field: 'status' });
    }

    const after = await repository.updateStatus(
      client,
      fiscalizacaoId,
      {
        ...normalized,
        status_anterior: before.status,
      },
      userId
    );

    return { before, after };
  });

  if (!result) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'fiscalizacao.status_update',
    entidade: 'fiscalizacoes_ambientais',
    entidade_id: fiscalizacaoId,
    before: sanitizeForAudit(result.before),
    after: sanitizeForAudit(result.after),
    req,
  });

  return getFiscalizacao(fiscalizacaoId);
}

async function assignResponsible(id, payload, user, req) {
  const fiscalizacaoId = normalizeInteger(id, 'fiscalizacao_id');
  const normalized = validateResponsiblePayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getFiscalizacaoById(fiscalizacaoId, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    assertCanOperateOpenFiscalizacao(before);

    const after = await repository.assignResponsible(client, fiscalizacaoId, normalized, userId);
    return { before, after };
  });

  if (!result) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'fiscalizacao.responsavel_assign',
    entidade: 'fiscalizacoes_ambientais',
    entidade_id: fiscalizacaoId,
    before: sanitizeForAudit(result.before),
    after: sanitizeForAudit(result.after),
    req,
  });

  return getFiscalizacao(fiscalizacaoId);
}

async function createMovement(id, payload, user, req) {
  const fiscalizacaoId = normalizeInteger(id, 'fiscalizacao_id');
  const normalized = validateMovementPayload(payload);
  const userId = normalizeInternalUserId(user);

  const fiscalizacao = await repository.withTransaction(async (client) => {
    const current = await repository.getFiscalizacaoById(fiscalizacaoId, client, { forUpdate: true });

    if (!current) {
      return null;
    }

    assertCanOperateOpenFiscalizacao(current);

    await repository.insertMovement(client, {
      fiscalizacao_id: fiscalizacaoId,
      tipo: 'movimentacao',
      status_anterior: current.status,
      status_novo: current.status,
      descricao: normalized.descricao,
      usuario_id: userId,
    });

    return current;
  });

  if (!fiscalizacao) {
    return null;
  }

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'fiscalizacao.movimentacao_create',
    entidade: 'fiscalizacoes_ambientais',
    entidade_id: fiscalizacaoId,
    dados: {
      descricao: normalized.descricao,
    },
    req,
  });

  return getFiscalizacao(fiscalizacaoId);
}

async function closePreliminarily(id, payload, user, req) {
  const fiscalizacaoId = normalizeInteger(id, 'fiscalizacao_id');
  const normalized = validateClosePayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getFiscalizacaoById(fiscalizacaoId, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    if (isClosed(before.status)) {
      throw createValidationError('Fiscalizacao ja encerrada ou arquivada.', {
        field: 'status',
        currentStatus: before.status,
      });
    }

    const after = await repository.closePreliminarily(
      client,
      fiscalizacaoId,
      {
        ...normalized,
        status_anterior: before.status,
      },
      userId
    );

    return { before, after };
  });

  if (!result) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'fiscalizacao.close_preliminar',
    entidade: 'fiscalizacoes_ambientais',
    entidade_id: fiscalizacaoId,
    before: sanitizeForAudit(result.before),
    after: sanitizeForAudit(result.after),
    req,
  });

  return getFiscalizacao(fiscalizacaoId);
}

async function listInheritedAnexos(id, { includeSensitive = false } = {}) {
  const fiscalizacao = await repository.getFiscalizacaoById(normalizeInteger(id, 'fiscalizacao_id'));

  if (!fiscalizacao) {
    return null;
  }

  const anexos = await anexosService.listDemandAnexos(fiscalizacao.demanda_publica_id);

  return anexos.map((anexo) => sanitizeSensitiveAnexo(anexo, includeSensitive));
}

module.exports = {
  listFiscalizacoes,
  getFiscalizacao,
  convertDemand,
  updateStatus,
  assignResponsible,
  createMovement,
  closePreliminarily,
  listInheritedAnexos,
  sanitizeForAudit,
};
