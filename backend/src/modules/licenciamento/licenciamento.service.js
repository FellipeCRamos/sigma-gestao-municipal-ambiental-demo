const auditService = require('../../services/auditService');
const repository = require('./licenciamento.repository');
const {
  validateProcessoCreatePayload,
  validateProcessoUpdatePayload,
  normalizeListFilters,
} = require('./licenciamento.validation');

function getActor(user) {
  return {
    ator_tipo: 'usuario_interno',
    ator_id: user?.id || null,
  };
}

async function getResumo() {
  return repository.getResumo();
}

async function listProcessos(query = {}) {
  return repository.listProcessos(normalizeListFilters(query));
}

async function getProcesso(id) {
  return repository.getProcessoById(id);
}

async function getHistorico(id) {
  const processo = await repository.getProcessoById(id);

  if (!processo) {
    return null;
  }

  return repository.listHistorico(id);
}

async function createProcesso(payload, user, req) {
  const normalized = validateProcessoCreatePayload(payload);
  const userId = user?.id || null;

  const processoId = await repository.withTransaction(async (client) => {
    const requerenteId = normalized.requerente.id
      ? normalized.requerente.id
      : (await repository.createRequerente(client, normalized.requerente, userId)).id;

    const empreendimentoId = normalized.empreendimento.id
      ? normalized.empreendimento.id
      : (await repository.createEmpreendimento(client, normalized.empreendimento, requerenteId, userId)).id;

    const processo = await repository.createProcesso(
      client,
      {
        ...normalized,
        requerente_id: requerenteId,
        empreendimento_id: empreendimentoId,
      },
      userId
    );

    await repository.insertMovimentacao(client, {
      processo_id: processo.id,
      tipo: 'protocolo',
      status_novo: processo.status,
      descricao: 'Processo de licenciamento ambiental protocolado.',
      dados: {
        numero_processo: processo.numero_processo,
        tipo_licenca: processo.tipo_licenca,
      },
      created_by_interno_id: userId,
    });

    return processo.id;
  });

  const created = await repository.getProcessoById(processoId);

  await auditService.logChange({
    ...getActor(user),
    acao: 'licenciamento.processo.create',
    entidade: 'licenciamento_processos',
    entidade_id: created.id,
    before: null,
    after: created,
    req,
  });

  return created;
}

async function updateProcesso(id, payload, user, req) {
  const normalized = validateProcessoUpdatePayload(payload);
  const userId = user?.id || null;

  const updated = await repository.withTransaction(async (client) => {
    const before = await repository.getProcessoBase(client, id, { forUpdate: true });

    if (!before) {
      return null;
    }

    const processo = await repository.updateProcesso(client, id, normalized, userId);
    const statusChanged = normalized.status && normalized.status !== before.status;

    await repository.insertMovimentacao(client, {
      processo_id: id,
      tipo: statusChanged ? 'alteracao_status' : 'atualizacao',
      status_anterior: before.status,
      status_novo: processo.status,
      descricao: statusChanged
        ? `Status alterado de ${before.status} para ${processo.status}.`
        : 'Dados cadastrais do processo atualizados.',
      dados: {
        campos_atualizados: Object.keys(normalized),
      },
      created_by_interno_id: userId,
    });

    return {
      before,
      processo_id: processo.id,
    };
  });

  if (!updated) {
    return null;
  }

  const after = await repository.getProcessoById(updated.processo_id);

  await auditService.logChange({
    ...getActor(user),
    acao: 'licenciamento.processo.update',
    entidade: 'licenciamento_processos',
    entidade_id: after.id,
    before: updated.before,
    after,
    req,
  });

  return after;
}

module.exports = {
  getResumo,
  listProcessos,
  getProcesso,
  getHistorico,
  createProcesso,
  updateProcesso,
};
