const auditService = require('../../services/auditService');
const anexosService = require('../anexos/anexos.service');
const fiscalizacaoRepository = require('../fiscalizacao/fiscalizacao.repository');
const { CLOSING_STATUS_OPTIONS: FISCALIZACAO_CLOSING_STATUS_OPTIONS } = require('../fiscalizacao/fiscalizacao.validation');
const repository = require('./vistorias.repository');
const {
  VISTORIA_CLOSING_STATUS_OPTIONS,
  createValidationError,
  normalizeInteger,
  normalizeRelatorioFilters,
  normalizeVistoriaFilters,
  validateCancelPayload,
  validateCreateRelatorioPayload,
  validateCreateVistoriaPayload,
  validateMovementPayload,
  validateRealizacaoPayload,
  validateRelatorioContentPayload,
  validateRelatorioStatusPayload,
  validateResponsiblePayload,
  validateVistoriaStatusPayload,
} = require('./vistorias.validation');

function normalizeInternalUserId(user) {
  const id = Number(user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function sanitizeForAuditVistoria(vistoria = {}) {
  return {
    id: vistoria.id,
    protocolo_vistoria: vistoria.protocolo_vistoria,
    fiscalizacao_id: vistoria.fiscalizacao_id,
    protocolo_fiscalizacao: vistoria.protocolo_fiscalizacao,
    demanda_publica_id: vistoria.demanda_publica_id,
    status: vistoria.status,
    prioridade: vistoria.prioridade,
    responsavel_id: vistoria.responsavel_id,
    criado_por_id: vistoria.criado_por_id,
    data_planejada: vistoria.data_planejada,
    data_realizada: vistoria.data_realizada,
    data_cancelamento: vistoria.data_cancelamento,
  };
}

function sanitizeForAuditRelatorio(relatorio = {}) {
  return {
    id: relatorio.id,
    protocolo_relatorio: relatorio.protocolo_relatorio,
    vistoria_id: relatorio.vistoria_id,
    fiscalizacao_id: relatorio.fiscalizacao_id,
    status: relatorio.status,
    tipo_relatorio: relatorio.tipo_relatorio,
    elaborado_por_id: relatorio.elaborado_por_id,
    revisado_por_id: relatorio.revisado_por_id,
    data_elaboracao: relatorio.data_elaboracao,
    data_revisao: relatorio.data_revisao,
  };
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

function isFiscalizacaoClosed(status) {
  return FISCALIZACAO_CLOSING_STATUS_OPTIONS.includes(status);
}

function isVistoriaClosed(status) {
  return VISTORIA_CLOSING_STATUS_OPTIONS.includes(status);
}

function assertCanOperateVistoria(vistoria, nextStatus = null) {
  if (isVistoriaClosed(vistoria?.status) && vistoria.status !== nextStatus) {
    throw createValidationError('Vistorias canceladas ou arquivadas nao podem ser movimentadas nesta sprint.', {
      field: 'status',
      currentStatus: vistoria.status,
      nextStatus,
    });
  }
}

async function listVistorias(query = {}) {
  return repository.listVistorias(normalizeVistoriaFilters(query));
}

async function listVistoriasByFiscalizacao(fiscalizacaoId) {
  const normalizedFiscalizacaoId = normalizeInteger(fiscalizacaoId, 'fiscalizacao_id');
  const fiscalizacao = await fiscalizacaoRepository.getFiscalizacaoById(normalizedFiscalizacaoId);

  if (!fiscalizacao) {
    return null;
  }

  return repository.listVistoriasByFiscalizacao(normalizedFiscalizacaoId);
}

async function getVistoria(id) {
  return repository.getVistoriaDetail(normalizeInteger(id, 'vistoria_id'));
}

async function createVistoria(fiscalizacaoId, payload, user, req) {
  const normalizedFiscalizacaoId = normalizeInteger(fiscalizacaoId, 'fiscalizacao_id');
  const normalized = validateCreateVistoriaPayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const fiscalizacao = await fiscalizacaoRepository.getFiscalizacaoById(normalizedFiscalizacaoId, client, {
      forUpdate: true,
    });

    if (!fiscalizacao) {
      throw createNotFoundError('Fiscalizacao ambiental nao encontrada para criacao de vistoria.');
    }

    if (isFiscalizacaoClosed(fiscalizacao.status)) {
      throw createValidationError('Fiscalizacao encerrada ou arquivada nao pode receber vistoria nesta sprint.', {
        field: 'fiscalizacao_id',
        currentStatus: fiscalizacao.status,
      });
    }

    const created = await repository.createVistoria(client, fiscalizacao, normalized, userId);

    await repository.insertVistoriaMovement(client, {
      vistoria_id: created.id,
      tipo: 'criacao',
      status_novo: created.status,
      descricao: normalized.objetivo,
      usuario_id: userId,
      dados: {
        fiscalizacao_id: fiscalizacao.id,
        protocolo_fiscalizacao: fiscalizacao.protocolo_fiscalizacao,
      },
    });

    if (!['vistoria_planejada', 'vistoria_realizada'].includes(fiscalizacao.status)) {
      await fiscalizacaoRepository.updateStatus(
        client,
        fiscalizacao.id,
        {
          status: 'vistoria_planejada',
          status_anterior: fiscalizacao.status,
          descricao: `Vistoria interna ${created.protocolo_vistoria} criada. Objetivo: ${normalized.objetivo}`,
        },
        userId
      );
    } else {
      await fiscalizacaoRepository.insertMovement(client, {
        fiscalizacao_id: fiscalizacao.id,
        tipo: 'movimentacao',
        status_anterior: fiscalizacao.status,
        status_novo: fiscalizacao.status,
        descricao: `Vistoria interna ${created.protocolo_vistoria} criada. Objetivo: ${normalized.objetivo}`,
        usuario_id: userId,
      });
    }

    return { fiscalizacao, created };
  });

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'vistoria.create',
    entidade: 'fiscalizacao_vistorias',
    entidade_id: result.created.id,
    dados: {
      protocolo_vistoria: result.created.protocolo_vistoria,
      fiscalizacao_id: result.fiscalizacao.id,
      protocolo_fiscalizacao: result.fiscalizacao.protocolo_fiscalizacao,
      demanda_publica_id: result.created.demanda_publica_id,
      status: result.created.status,
    },
    req,
  });

  return getVistoria(result.created.id);
}

async function updateVistoriaStatus(id, payload, user, req) {
  const vistoriaId = normalizeInteger(id, 'vistoria_id');
  const normalized = validateVistoriaStatusPayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getVistoriaById(vistoriaId, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    assertCanOperateVistoria(before, normalized.status);

    if (before.status === normalized.status) {
      throw createValidationError('Vistoria ja esta no status informado.', { field: 'status' });
    }

    const after = await repository.updateVistoriaStatus(
      client,
      vistoriaId,
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
    acao: 'vistoria.status_update',
    entidade: 'fiscalizacao_vistorias',
    entidade_id: vistoriaId,
    before: sanitizeForAuditVistoria(result.before),
    after: sanitizeForAuditVistoria(result.after),
    req,
  });

  return getVistoria(vistoriaId);
}

async function assignVistoriaResponsible(id, payload, user, req) {
  const vistoriaId = normalizeInteger(id, 'vistoria_id');
  const normalized = validateResponsiblePayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getVistoriaById(vistoriaId, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    assertCanOperateVistoria(before);

    const after = await repository.assignVistoriaResponsible(client, vistoriaId, normalized, userId);
    return { before, after };
  });

  if (!result) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'vistoria.responsavel_assign',
    entidade: 'fiscalizacao_vistorias',
    entidade_id: vistoriaId,
    before: sanitizeForAuditVistoria(result.before),
    after: sanitizeForAuditVistoria(result.after),
    req,
  });

  return getVistoria(vistoriaId);
}

async function createVistoriaMovement(id, payload, user, req) {
  const vistoriaId = normalizeInteger(id, 'vistoria_id');
  const normalized = validateMovementPayload(payload);
  const userId = normalizeInternalUserId(user);

  const vistoria = await repository.withTransaction(async (client) => {
    const current = await repository.getVistoriaById(vistoriaId, client, { forUpdate: true });

    if (!current) {
      return null;
    }

    assertCanOperateVistoria(current);

    await repository.insertVistoriaMovement(client, {
      vistoria_id: vistoriaId,
      tipo: 'movimentacao',
      status_anterior: current.status,
      status_novo: current.status,
      descricao: normalized.descricao,
      usuario_id: userId,
    });

    return current;
  });

  if (!vistoria) {
    return null;
  }

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'vistoria.movimentacao_create',
    entidade: 'fiscalizacao_vistorias',
    entidade_id: vistoriaId,
    dados: {
      descricao: normalized.descricao,
    },
    req,
  });

  return getVistoria(vistoriaId);
}

async function registerVistoriaRealizacao(id, payload, user, req) {
  const vistoriaId = normalizeInteger(id, 'vistoria_id');
  const normalized = validateRealizacaoPayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getVistoriaById(vistoriaId, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    assertCanOperateVistoria(before, 'realizada');

    const after = await repository.registerVistoriaRealizacao(
      client,
      vistoriaId,
      {
        ...normalized,
        status_anterior: before.status,
      },
      userId
    );

    await fiscalizacaoRepository.updateStatus(
      client,
      before.fiscalizacao_id,
      {
        status: 'vistoria_realizada',
        status_anterior: before.fiscalizacao_status || null,
        descricao: `Vistoria interna ${before.protocolo_vistoria} realizada. Registro tecnico preliminar inserido.`,
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
    acao: 'vistoria.register_realizacao',
    entidade: 'fiscalizacao_vistorias',
    entidade_id: vistoriaId,
    before: sanitizeForAuditVistoria(result.before),
    after: sanitizeForAuditVistoria(result.after),
    req,
  });

  return getVistoria(vistoriaId);
}

async function cancelVistoria(id, payload, user, req) {
  const vistoriaId = normalizeInteger(id, 'vistoria_id');
  const normalized = validateCancelPayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getVistoriaById(vistoriaId, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    assertCanOperateVistoria(before, 'cancelada');

    const after = await repository.cancelVistoria(
      client,
      vistoriaId,
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
    acao: 'vistoria.cancel',
    entidade: 'fiscalizacao_vistorias',
    entidade_id: vistoriaId,
    before: sanitizeForAuditVistoria(result.before),
    after: sanitizeForAuditVistoria(result.after),
    req,
  });

  return getVistoria(vistoriaId);
}

async function listVistoriaAnexos(id, { includeSensitive = false } = {}) {
  const vistoria = await repository.getVistoriaById(normalizeInteger(id, 'vistoria_id'));

  if (!vistoria) {
    return null;
  }

  const [herdadosDemanda, proprios] = await Promise.all([
    vistoria.demanda_publica_id ? anexosService.listDemandAnexos(vistoria.demanda_publica_id) : Promise.resolve([]),
    anexosService.listAnexos({
      modulo_origem: 'fiscalizacao',
      entidade_tipo: 'vistoria_ambiental',
      entidade_id: vistoria.id,
    }),
  ]);

  return {
    herdados: herdadosDemanda.map((anexo) => ({
      ...sanitizeSensitiveAnexo(anexo, includeSensitive),
      origem_vinculo: 'demanda_publica',
    })),
    proprios: proprios.map((anexo) => ({
      ...sanitizeSensitiveAnexo(anexo, includeSensitive),
      origem_vinculo: 'vistoria_ambiental',
    })),
  };
}

async function createVistoriaAnexo(id, payload, file, user, req) {
  const vistoriaId = normalizeInteger(id, 'vistoria_id');
  const vistoria = await repository.getVistoriaById(vistoriaId);

  if (!vistoria) {
    throw createNotFoundError('Vistoria ambiental nao encontrada para vinculo de anexo.');
  }

  assertCanOperateVistoria(vistoria);

  return anexosService.createAnexo(payload, file, user, req, {
    modulo_origem: 'fiscalizacao',
    entidade_tipo: 'vistoria_ambiental',
    entidade_id: vistoriaId,
  });
}

async function getVistoriaAnexoForDownload(vistoriaId, anexoId, user, req) {
  normalizeInteger(vistoriaId, 'vistoria_id');
  const vistoria = await repository.getVistoriaById(vistoriaId);

  if (!vistoria) {
    return null;
  }

  return anexosService.getAnexoForDownload(anexoId, user, req, {
    modulo_origem: 'fiscalizacao',
    entidade_tipo: 'vistoria_ambiental',
    entidade_id: vistoria.id,
  });
}

async function listRelatorios(query = {}) {
  return repository.listRelatorios(normalizeRelatorioFilters(query));
}

async function getRelatorio(id) {
  return repository.getRelatorioDetail(normalizeInteger(id, 'relatorio_id'));
}

async function createRelatorio(vistoriaId, payload, user, req) {
  const normalizedVistoriaId = normalizeInteger(vistoriaId, 'vistoria_id');
  const normalized = validateCreateRelatorioPayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const vistoria = await repository.getVistoriaById(normalizedVistoriaId, client, { forUpdate: true });

    if (!vistoria) {
      throw createNotFoundError('Vistoria ambiental nao encontrada para criacao de relatorio preliminar.');
    }

    assertCanOperateVistoria(vistoria);

    const created = await repository.createRelatorio(client, vistoria, normalized, userId);

    await repository.insertRelatorioMovement(client, {
      relatorio_id: created.id,
      tipo: 'criacao',
      status_novo: created.status,
      descricao: 'Relatorio tecnico preliminar criado como peca interna de instrucao.',
      usuario_id: userId,
      dados: {
        vistoria_id: vistoria.id,
        protocolo_vistoria: vistoria.protocolo_vistoria,
      },
    });

    await repository.syncVistoriaRelatorioStatus(
      client,
      vistoria.id,
      'relatorio_em_elaboracao',
      userId,
      `Relatorio tecnico preliminar ${created.protocolo_relatorio} criado.`
    );

    await fiscalizacaoRepository.insertMovement(client, {
      fiscalizacao_id: vistoria.fiscalizacao_id,
      tipo: 'movimentacao',
      status_anterior: null,
      status_novo: null,
      descricao: `Relatorio tecnico preliminar ${created.protocolo_relatorio} criado para a vistoria ${vistoria.protocolo_vistoria}.`,
      usuario_id: userId,
    });

    return { vistoria, created };
  });

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'relatorio_preliminar.create',
    entidade: 'fiscalizacao_relatorios_preliminares',
    entidade_id: result.created.id,
    dados: {
      protocolo_relatorio: result.created.protocolo_relatorio,
      vistoria_id: result.vistoria.id,
      fiscalizacao_id: result.vistoria.fiscalizacao_id,
      status: result.created.status,
    },
    req,
  });

  return getRelatorio(result.created.id);
}

async function updateRelatorio(id, payload, user, req) {
  const relatorioId = normalizeInteger(id, 'relatorio_id');
  const normalized = validateRelatorioContentPayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getRelatorioById(relatorioId, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    if (before.status === 'arquivado') {
      throw createValidationError('Relatorio arquivado nao pode ser editado nesta sprint.', {
        field: 'status',
        currentStatus: before.status,
      });
    }

    const after = await repository.updateRelatorio(client, relatorioId, normalized);

    await repository.insertRelatorioMovement(client, {
      relatorio_id: relatorioId,
      tipo: 'edicao',
      status_anterior: before.status,
      status_novo: after.status,
      descricao: 'Relatorio tecnico preliminar atualizado internamente.',
      usuario_id: userId,
    });

    return { before, after };
  });

  if (!result) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'relatorio_preliminar.update',
    entidade: 'fiscalizacao_relatorios_preliminares',
    entidade_id: relatorioId,
    before: sanitizeForAuditRelatorio(result.before),
    after: sanitizeForAuditRelatorio(result.after),
    req,
  });

  return getRelatorio(relatorioId);
}

async function updateRelatorioStatus(id, payload, user, req) {
  const relatorioId = normalizeInteger(id, 'relatorio_id');
  const normalized = validateRelatorioStatusPayload(payload);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getRelatorioById(relatorioId, client, { forUpdate: true });

    if (!before) {
      return null;
    }

    if (before.status === normalized.status) {
      throw createValidationError('Relatorio preliminar ja esta no status informado.', { field: 'status' });
    }

    const after = await repository.updateRelatorioStatus(
      client,
      relatorioId,
      {
        ...normalized,
        status_anterior: before.status,
      },
      userId
    );

    if (normalized.status === 'emitido_preliminarmente') {
      await repository.syncVistoriaRelatorioStatus(
        client,
        before.vistoria_id,
        'relatorio_emitido',
        userId,
        `Relatorio tecnico preliminar ${before.protocolo_relatorio} emitido internamente.`
      );
    }

    return { before, after };
  });

  if (!result) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'relatorio_preliminar.status_update',
    entidade: 'fiscalizacao_relatorios_preliminares',
    entidade_id: relatorioId,
    before: sanitizeForAuditRelatorio(result.before),
    after: sanitizeForAuditRelatorio(result.after),
    req,
  });

  return getRelatorio(relatorioId);
}

async function createRelatorioMovement(id, payload, user, req) {
  const relatorioId = normalizeInteger(id, 'relatorio_id');
  const normalized = validateMovementPayload(payload);
  const userId = normalizeInternalUserId(user);

  const relatorio = await repository.withTransaction(async (client) => {
    const current = await repository.getRelatorioById(relatorioId, client, { forUpdate: true });

    if (!current) {
      return null;
    }

    await repository.insertRelatorioMovement(client, {
      relatorio_id: relatorioId,
      tipo: 'movimentacao',
      status_anterior: current.status,
      status_novo: current.status,
      descricao: normalized.descricao,
      usuario_id: userId,
    });

    return current;
  });

  if (!relatorio) {
    return null;
  }

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'relatorio_preliminar.movimentacao_create',
    entidade: 'fiscalizacao_relatorios_preliminares',
    entidade_id: relatorioId,
    dados: {
      descricao: normalized.descricao,
    },
    req,
  });

  return getRelatorio(relatorioId);
}

module.exports = {
  listVistorias,
  listVistoriasByFiscalizacao,
  getVistoria,
  createVistoria,
  updateVistoriaStatus,
  assignVistoriaResponsible,
  createVistoriaMovement,
  registerVistoriaRealizacao,
  cancelVistoria,
  listVistoriaAnexos,
  createVistoriaAnexo,
  getVistoriaAnexoForDownload,
  listRelatorios,
  getRelatorio,
  createRelatorio,
  updateRelatorio,
  updateRelatorioStatus,
  createRelatorioMovement,
};
