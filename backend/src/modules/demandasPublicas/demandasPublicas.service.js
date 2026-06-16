const auditService = require('../../services/auditService');
const repository = require('./demandasPublicas.repository');
const {
  CLOSING_STATUS_OPTIONS,
  validatePublicDemandPayload,
  validateStatusUpdatePayload,
  validateMovementPayload,
  validateResponsiblePayload,
  validateClosePayload,
  normalizeListFilters,
  createValidationError,
} = require('./demandasPublicas.validation');

function getSuggestedModule(categoria) {
  const map = {
    bem_estar_animal: 'bem_estar_animal',
    licenciamento: 'triagem_geral',
    fiscalizacao: 'fiscalizacao',
    poluicao_residuos: 'fiscalizacao',
    outros: 'triagem_geral',
  };

  return map[categoria] || 'triagem_geral';
}

function normalizeInternalUserId(user) {
  const id = Number(user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sanitizeDemandForAudit(demand = {}) {
  return {
    id: demand.id,
    protocolo: demand.protocolo,
    categoria: demand.categoria,
    subcategoria: demand.subcategoria,
    status: demand.status,
    prioridade: demand.prioridade,
    modulo_sugerido: demand.modulo_sugerido,
    modulo_responsavel: demand.modulo_responsavel,
    responsavel_id: demand.responsavel_id,
    identificacao_tipo: demand.identificacao_tipo,
    data_recebimento: demand.data_recebimento,
    data_encerramento: demand.data_encerramento,
    encerrado_por_id: demand.encerrado_por_id,
  };
}

function redactSensitiveDemand(demand, includeSensitive = false) {
  if (!demand || includeSensitive) {
    return demand;
  }

  return {
    ...demand,
    nome_comunicante: null,
    telefone_comunicante: null,
    email_comunicante: null,
    dados_sensiveis_restritos: true,
  };
}

function assertDemandCanMove(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return;
  }

  if (CLOSING_STATUS_OPTIONS.includes(currentStatus)) {
    throw createValidationError('Demandas encerradas ou arquivadas nao podem ser movimentadas para novo status nesta sprint.', {
      field: 'status',
      currentStatus,
      nextStatus,
    });
  }
}

async function createPublicDemand(payload, req) {
  const normalized = validatePublicDemandPayload(payload);
  const created = await repository.withTransaction(async (client) => {
    const demand = await repository.createPublicDemand(client, {
      ...normalized,
      modulo_sugerido: getSuggestedModule(normalized.categoria),
    });

    await repository.insertMovement(client, {
      demanda_id: demand.id,
      status_novo: demand.status,
      descricao: 'Comunicação pública registrada no Painel Público SIGMA.',
      origem: 'painel_publico_sigma',
    });

    return demand;
  });

  await auditService.log({
    ator_tipo: 'publico',
    acao: 'demandas_publicas.create',
    entidade: 'sigma_demandas_publicas',
    entidade_id: created.id,
    request_id: req?.requestId || null,
    dados: {
      protocolo: created.protocolo,
      categoria: created.categoria,
      subcategoria: created.subcategoria,
      modulo_sugerido: created.modulo_sugerido,
      origem: created.origem,
    },
  });

  return {
    protocolo: created.protocolo,
    categoria: created.categoria,
    subcategoria: created.subcategoria,
    status: created.status,
    modulo_sugerido: created.modulo_sugerido,
    data_recebimento: created.data_recebimento,
  };
}

async function listDemands(query = {}) {
  return repository.listDemands(normalizeListFilters(query));
}

async function getDemand(id, options = {}) {
  const demand = await repository.getDemandDetail(id);

  if (demand && options.includeSensitive) {
    await auditService.log({
      ator_tipo: 'usuario_interno',
      ator_id: options.user?.id || null,
      acao: 'demandas_publicas.detail_sensitive_view',
      entidade: 'sigma_demandas_publicas',
      entidade_id: id,
      dados: {
        protocolo: demand.protocolo,
        perfil: options.user?.perfil || null,
      },
      req: options.req,
    });
  }

  return redactSensitiveDemand(demand, options.includeSensitive);
}

async function updateStatus(id, payload, user, req, options = {}) {
  const normalized = validateStatusUpdatePayload(payload);
  const userId = normalizeInternalUserId(user);
  const isClosing = CLOSING_STATUS_OPTIONS.includes(normalized.status);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getDemandById(id, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    assertDemandCanMove(before.status, normalized.status);

    const after = await repository.updateDemandStatus(
      client,
      id,
      {
        ...normalized,
        status_anterior: before.status,
        is_closing: isClosing,
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
    acao: 'demandas_publicas.status_update',
    entidade: 'sigma_demandas_publicas',
    entidade_id: result.after.id,
    before: sanitizeDemandForAudit(result.before),
    after: sanitizeDemandForAudit(result.after),
    req,
  });

  return getDemand(id, options);
}

async function createMovement(id, payload, user, req, options = {}) {
  const normalized = validateMovementPayload(payload);
  const userId = normalizeInternalUserId(user);

  const created = await repository.withTransaction(async (client) => {
    const demand = await repository.getDemandById(id, client, { forUpdate: true });

    if (!demand) {
      return null;
    }

    await repository.insertMovement(client, {
      demanda_id: id,
      status_anterior: demand.status,
      status_novo: demand.status,
      descricao: normalized.descricao,
      usuario_id: userId,
      origem: 'area_interna_sigma',
    });

    return demand;
  });

  if (!created) {
    return null;
  }

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'demandas_publicas.movimentacao_create',
    entidade: 'sigma_demandas_publicas',
    entidade_id: id,
    dados: {
      descricao: normalized.descricao,
    },
    req,
  });

  return getDemand(id, options);
}

async function assignResponsible(id, payload, user, req, options = {}) {
  const normalized = validateResponsiblePayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getDemandById(id, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    if (CLOSING_STATUS_OPTIONS.includes(before.status)) {
      throw createValidationError('Demandas encerradas ou arquivadas nao podem receber nova atribuicao nesta sprint.', {
        field: 'status',
      });
    }

    const after = await repository.assignResponsible(client, id, normalized, userId);
    return { before, after };
  });

  if (!result) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'demandas_publicas.responsavel_assign',
    entidade: 'sigma_demandas_publicas',
    entidade_id: result.after.id,
    before: sanitizeDemandForAudit(result.before),
    after: sanitizeDemandForAudit(result.after),
    req,
  });

  return getDemand(id, options);
}

async function closeDemand(id, payload, user, req, options = {}) {
  const normalized = validateClosePayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getDemandById(id, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    if (CLOSING_STATUS_OPTIONS.includes(before.status)) {
      throw createValidationError('Demanda publica ja encerrada ou arquivada.', {
        field: 'status',
        currentStatus: before.status,
      });
    }

    const after = await repository.closeDemand(
      client,
      id,
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
    acao: 'demandas_publicas.close',
    entidade: 'sigma_demandas_publicas',
    entidade_id: result.after.id,
    before: sanitizeDemandForAudit(result.before),
    after: sanitizeDemandForAudit(result.after),
    req,
  });

  return getDemand(id, options);
}

module.exports = {
  getSuggestedModule,
  createPublicDemand,
  listDemands,
  getDemand,
  updateStatus,
  createMovement,
  assignResponsible,
  closeDemand,
  redactSensitiveDemand,
  sanitizeDemandForAudit,
  normalizeInternalUserId,
};
