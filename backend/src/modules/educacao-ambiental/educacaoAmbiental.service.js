const auditService = require('../../services/auditService');
const {
  AULA_DEFINITION,
  ENTITY_DEFINITIONS,
  GRAUS_CONFIABILIDADE_BLOQUEADOS,
} = require('./educacaoAmbiental.constants');
const repository = require('./educacaoAmbiental.repository');
const {
  createValidationError,
  getDefinition,
  normalizeListFilters,
  normalizePositiveId,
  normalizeSimpleFilters,
  normalizeString,
  validateAulaCreatePayload,
  validateAulaUpdatePayload,
  validateAptoPayload,
  validateCreatePayload,
  validateCuradoriaPatchPayload,
  validateCuradoriaStatusPayload,
  validateFontePayload,
  validateFonteStatusPayload,
  validateReferenciaPayload,
  validateStatusPayload,
  validateUpdatePayload,
} = require('./educacaoAmbiental.validation');

function normalizeInternalUserId(user) {
  const id = Number(user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function auditEntitySnapshot(record = {}) {
  const snapshot = { ...record };
  delete snapshot.corpo;
  delete snapshot.conteudo;
  return snapshot;
}

function handleUniqueError(error, definition) {
  if (error?.code !== '23505') {
    throw error;
  }

  const field = definition.key === 'conteudos' ? 'slug' : definition.titleField || 'id';
  throw createValidationError('Registro duplicado para o modulo de educacao ambiental.', {
    field,
    constraint: error.constraint,
  });
}

async function ensureTrilhaCanPublish(id, client = repository.db) {
  const totalAulasPublicadas = await repository.countAulasByStatus(id, 'publicado', client);

  if (totalAulasPublicadas <= 0) {
    throw createValidationError('Trilha publicada exige pelo menos uma aula publicada.', {
      field: 'aulas',
    });
  }
}

async function ensureConteudoCuradoriaCanPublish(conteudo, client = repository.db) {
  const referencesTotal = await repository.countReferenciasByEntity('conteudo', conteudo.id, client);
  const hasReference = referencesTotal > 0
    || Boolean(conteudo.fonte_principal_id)
    || Boolean(normalizeString(conteudo.fonte_referencia));
  const hasFormalException = Boolean(normalizeString(conteudo.justificativa_sem_referencia))
    || Boolean(normalizeString(conteudo.justificativa_publicacao));

  if (conteudo.conteudo_local_especifico === true && !hasReference && !hasFormalException) {
    throw createValidationError('Conteudo local especifico exige referencia ou justificativa formal antes da publicacao.', {
      field: 'referencias',
    });
  }

  if (GRAUS_CONFIABILIDADE_BLOQUEADOS.includes(conteudo.grau_confiabilidade)) {
    throw createValidationError('Conteudo com confiabilidade nao verificada nao pode ser publicado no portal.', {
      field: 'grau_confiabilidade',
    });
  }

  if (conteudo.apto_para_portal_publico !== true) {
    throw createValidationError('Conteudo deve estar marcado como apto para portal publico.', {
      field: 'apto_para_portal_publico',
    });
  }
}

async function listCategories() {
  return repository.listCategories();
}

async function getDashboard() {
  return {
    totais: await repository.getDashboardCounts(),
    avisos: [
      'Conteudos publicados aparecem no portal publico.',
      'Normas nao verificadas nao devem ser usadas como base definitiva.',
      'Areas ambientais publicas exigem validacao tecnica.',
      'IA educativa preparada apenas como base de conhecimento futura.',
    ],
  };
}

async function getCuradoriaDashboard() {
  return {
    totais: await repository.getCuradoriaDashboard(),
    avisos: [
      'Conteudo local especifico exige fonte, evidencia ou justificativa formal.',
      'Conteudos nao verificados nao devem ser marcados como aptos para IA.',
      'Portal publico deve exibir somente itens publicados e aptos para consulta.',
      'IA Educadora Ambiental permanece apenas preparada, sem chamada externa nesta sprint.',
    ],
  };
}

async function listEntity(entityKey, query = {}, { publicOnly = false } = {}) {
  const definition = getDefinition(entityKey);
  const filters = normalizeListFilters(definition, query);
  return repository.listEntity(definition, filters, { publicOnly });
}

async function getEntity(entityKey, id, { publicOnly = false } = {}) {
  const definition = getDefinition(entityKey);
  const normalizedId = normalizePositiveId(id, `${definition.singular}_id`);
  const record = await repository.getEntityById(definition, normalizedId, { publicOnly });

  if (!record) {
    return null;
  }

  if (entityKey === 'trilhas') {
    return {
      ...record,
      aulas: await repository.listAulas(record.id, { publicOnly }),
    };
  }

  if (entityKey === 'programas') {
    const metas = await repository.listEntity(
      ENTITY_DEFINITIONS.metas,
      normalizeListFilters(ENTITY_DEFINITIONS.metas, {
        programa_id: record.id,
        limit: 100,
        orderBy: 'ano_alvo',
        orderDirection: 'asc',
      }),
      { publicOnly }
    );

    return {
      ...record,
      metas: metas.items,
    };
  }

  return record;
}

async function getPublicConteudoBySlug(slug) {
  const normalizedSlug = normalizeString(slug);
  if (!normalizedSlug) {
    throw createValidationError('Slug obrigatorio.', { field: 'slug' });
  }

  return repository.getConteudoBySlug(normalizedSlug, { publicOnly: true });
}

async function createEntity(entityKey, payload = {}, user, req) {
  const definition = getDefinition(entityKey);
  const userId = normalizeInternalUserId(user);
  const normalized = validateCreatePayload(entityKey, payload);

  if (definition.key === 'trilhas' && normalized.status === 'publicado') {
    throw createValidationError('Crie aulas publicadas antes de publicar uma trilha.', { field: 'status' });
  }

  if (definition.key === 'conteudos' && normalized.status === 'publicado') {
    throw createValidationError('Use o fluxo de curadoria para publicar conteudos educativos.', { field: 'status' });
  }

  try {
    const created = await repository.createEntity(definition, normalized, userId);

    await auditService.log({
      ator_tipo: 'usuario_interno',
      ator_id: userId,
      acao: `educacao_ambiental.${definition.key}.create`,
      entidade: definition.table,
      entidade_id: created.id,
      dados: auditEntitySnapshot(created),
      req,
    });

    return getEntity(entityKey, created.id);
  } catch (error) {
    handleUniqueError(error, definition);
  }
}

async function updateEntity(entityKey, id, payload = {}, user, req) {
  const definition = getDefinition(entityKey);
  const normalizedId = normalizePositiveId(id, `${definition.singular}_id`);
  const userId = normalizeInternalUserId(user);

  try {
    const result = await repository.withTransaction(async (client) => {
      const before = await repository.getEntityById(definition, normalizedId, { client, forUpdate: true });

      if (!before) {
        return null;
      }

      const normalized = validateUpdatePayload(entityKey, payload, before);
      const nextStatus = normalized[definition.statusField || 'status'];

      if (definition.key === 'trilhas' && nextStatus === 'publicado') {
        await ensureTrilhaCanPublish(normalizedId, client);
      }

      if (definition.key === 'conteudos' && nextStatus === 'publicado') {
        await ensureConteudoCuradoriaCanPublish({ ...before, ...normalized }, client);
        normalized.status_curadoria = 'publicado';
      }

      const after = await repository.updateEntity(definition, normalizedId, normalized, userId, client);
      return { before, after };
    });

    if (!result) {
      return null;
    }

    await auditService.logChange({
      ator_tipo: 'usuario_interno',
      ator_id: userId,
      acao: `educacao_ambiental.${definition.key}.update`,
      entidade: definition.table,
      entidade_id: normalizedId,
      before: auditEntitySnapshot(result.before),
      after: auditEntitySnapshot(result.after),
      req,
    });

    return getEntity(entityKey, normalizedId);
  } catch (error) {
    handleUniqueError(error, definition);
  }
}

async function updateEntityStatus(entityKey, id, payload = {}, user, req) {
  const definition = getDefinition(entityKey);
  const normalizedId = normalizePositiveId(id, `${definition.singular}_id`);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getEntityById(definition, normalizedId, { client, forUpdate: true });

    if (!before) {
      return null;
    }

    const normalized = validateStatusPayload(entityKey, payload, before);
    const statusField = definition.statusField || 'status';
    const nextStatus = normalized[statusField];

    if (definition.key === 'trilhas' && nextStatus === 'publicado') {
      await ensureTrilhaCanPublish(normalizedId, client);
    }

    if (definition.key === 'conteudos' && nextStatus === 'publicado') {
      await ensureConteudoCuradoriaCanPublish({ ...before, ...normalized }, client);
      normalized.status_curadoria = 'publicado';
    }

    if (definition.key === 'conteudos') {
      if (nextStatus === 'aprovado' || nextStatus === 'publicado') {
        normalized.aprovado_por_id = userId;
        normalized.data_aprovacao = new Date().toISOString();
      }

      if (nextStatus === 'em_revisao' || nextStatus === 'aprovado') {
        normalized.revisado_por_id = userId;
        normalized.data_revisao = new Date().toISOString();
      }
    }

    if (definition.key === 'normas' && nextStatus === 'aprovado') {
      normalized.validado_por_id = userId;
      normalized.data_validacao = new Date().toISOString();
    }

    const after = await repository.setStatus(definition, normalizedId, normalized, userId, client);
    return { before, after };
  });

  if (!result) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: `educacao_ambiental.${definition.key}.status`,
    entidade: definition.table,
    entidade_id: normalizedId,
    before: auditEntitySnapshot(result.before),
    after: auditEntitySnapshot(result.after),
    req,
  });

  return getEntity(entityKey, normalizedId);
}

async function archiveEntity(entityKey, id, user, req) {
  const definition = getDefinition(entityKey);
  const normalizedId = normalizePositiveId(id, `${definition.singular}_id`);
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getEntityById(definition, normalizedId, { client, forUpdate: true });

    if (!before) {
      return null;
    }

    const after = await repository.archiveEntity(definition, normalizedId, userId, client);
    return { before, after };
  });

  if (!result) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: `educacao_ambiental.${definition.key}.archive`,
    entidade: definition.table,
    entidade_id: normalizedId,
    before: auditEntitySnapshot(result.before),
    after: auditEntitySnapshot(result.after),
    req,
  });

  return getEntity(entityKey, normalizedId);
}

async function createAula(trilhaId, payload = {}, user, req) {
  const normalizedTrilhaId = normalizePositiveId(trilhaId, 'trilha_id');
  const userId = normalizeInternalUserId(user);
  const trilha = await repository.getEntityById(ENTITY_DEFINITIONS.trilhas, normalizedTrilhaId);

  if (!trilha) {
    throw createNotFoundError('Trilha educativa nao encontrada.');
  }

  const normalized = validateAulaCreatePayload(normalizedTrilhaId, payload);
  const created = await repository.createAula(AULA_DEFINITION, normalized);

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'educacao_ambiental.trilhas.aula_create',
    entidade: AULA_DEFINITION.table,
    entidade_id: created.id,
    dados: auditEntitySnapshot(created),
    req,
  });

  return getEntity('trilhas', normalizedTrilhaId);
}

async function updateAula(trilhaId, aulaId, payload = {}, user, req) {
  const normalizedTrilhaId = normalizePositiveId(trilhaId, 'trilha_id');
  const normalizedAulaId = normalizePositiveId(aulaId, 'aula_id');
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getAulaById(normalizedAulaId, { client, forUpdate: true });

    if (!before || Number(before.trilha_id) !== Number(normalizedTrilhaId)) {
      return null;
    }

    const normalized = validateAulaUpdatePayload(payload, before);
    const after = await repository.updateAula(AULA_DEFINITION, normalizedAulaId, normalized, client);
    return { before, after };
  });

  if (!result) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'educacao_ambiental.trilhas.aula_update',
    entidade: AULA_DEFINITION.table,
    entidade_id: normalizedAulaId,
    before: auditEntitySnapshot(result.before),
    after: auditEntitySnapshot(result.after),
    req,
  });

  return getEntity('trilhas', normalizedTrilhaId);
}

async function getPublicHome() {
  return repository.getPublicHome();
}

async function listFontes(query = {}) {
  const filters = normalizeSimpleFilters(query, [
    'updated_at',
    'created_at',
    'nome',
    'tipo_fonte',
    'esfera',
    'status',
    'confiabilidade_padrao',
  ]);
  return repository.listFontes(filters);
}

async function createFonte(payload = {}, user, req) {
  const userId = normalizeInternalUserId(user);
  const normalized = validateFontePayload(payload);

  try {
    const created = await repository.createFonte(normalized, userId);

    await auditService.log({
      ator_tipo: 'usuario_interno',
      ator_id: userId,
      acao: 'educacao_ambiental.fontes.create',
      entidade: 'educacao_fontes',
      entidade_id: created.id,
      dados: auditEntitySnapshot(created),
      req,
    });

    return created;
  } catch (error) {
    handleUniqueError(error, { key: 'fontes', titleField: 'nome' });
  }
}

async function updateFonte(id, payload = {}, user, req) {
  const normalizedId = normalizePositiveId(id, 'fonte_id');
  const userId = normalizeInternalUserId(user);
  const normalized = validateFontePayload(payload, { partial: true });

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getFonteById(normalizedId, { client, forUpdate: true });
    if (!before) return null;
    const after = await repository.updateFonte(normalizedId, normalized, userId, client);
    return { before, after };
  });

  if (!result) return null;

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'educacao_ambiental.fontes.update',
    entidade: 'educacao_fontes',
    entidade_id: normalizedId,
    before: auditEntitySnapshot(result.before),
    after: auditEntitySnapshot(result.after),
    req,
  });

  return result.after;
}

async function updateFonteStatus(id, payload = {}, user, req) {
  const normalizedId = normalizePositiveId(id, 'fonte_id');
  const userId = normalizeInternalUserId(user);
  const normalized = validateFonteStatusPayload(payload);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getFonteById(normalizedId, { client, forUpdate: true });
    if (!before) return null;
    const after = await repository.updateFonteStatus(normalizedId, normalized.status, userId, client);
    return { before, after };
  });

  if (!result) return null;

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'educacao_ambiental.fontes.status',
    entidade: 'educacao_fontes',
    entidade_id: normalizedId,
    before: auditEntitySnapshot(result.before),
    after: auditEntitySnapshot(result.after),
    req,
  });

  return result.after;
}

async function listReferencias(query = {}) {
  const filters = normalizeSimpleFilters(query, [
    'created_at',
    'updated_at',
    'titulo_referencia',
    'entidade_tipo',
    'tipo_evidencia',
    'confiabilidade',
    'status',
  ]);
  return repository.listReferencias(filters);
}

async function createReferencia(payload = {}, user, req) {
  const userId = normalizeInternalUserId(user);
  const normalized = validateReferenciaPayload(payload);
  const created = await repository.createReferencia(normalized, userId);

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'educacao_ambiental.referencias.create',
    entidade: 'educacao_referencias',
    entidade_id: created.id,
    dados: auditEntitySnapshot(created),
    req,
  });

  return created;
}

async function updateReferencia(id, payload = {}, user, req) {
  const normalizedId = normalizePositiveId(id, 'referencia_id');
  const userId = normalizeInternalUserId(user);
  const normalized = validateReferenciaPayload(payload, { partial: true });

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getReferenciaById(normalizedId, { client, forUpdate: true });
    if (!before) return null;
    const after = await repository.updateReferencia(normalizedId, normalized, userId, client);
    return { before, after };
  });

  if (!result) return null;

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'educacao_ambiental.referencias.update',
    entidade: 'educacao_referencias',
    entidade_id: normalizedId,
    before: auditEntitySnapshot(result.before),
    after: auditEntitySnapshot(result.after),
    req,
  });

  return result.after;
}

async function archiveReferencia(id, user, req) {
  const normalizedId = normalizePositiveId(id, 'referencia_id');
  const userId = normalizeInternalUserId(user);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getReferenciaById(normalizedId, { client, forUpdate: true });
    if (!before) return null;
    const after = await repository.archiveReferencia(normalizedId, userId, client);
    return { before, after };
  });

  if (!result) return null;

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'educacao_ambiental.referencias.archive',
    entidade: 'educacao_referencias',
    entidade_id: normalizedId,
    before: auditEntitySnapshot(result.before),
    after: auditEntitySnapshot(result.after),
    req,
  });

  return result.after;
}

async function listCuradoriaPendencias(query = {}) {
  const filters = normalizeSimpleFilters(query, [
    'updated_at',
    'created_at',
    'titulo',
    'status_curadoria',
    'grau_confiabilidade',
    'revisao_periodica_em',
  ]);
  return repository.listCuradoriaPendencias(filters);
}

async function updateConteudoCuradoria(id, payload = {}, user, req, action = 'curadoria.update') {
  const normalizedId = normalizePositiveId(id, 'conteudo_id');
  const userId = normalizeInternalUserId(user);
  const normalized = validateCuradoriaPatchPayload(payload);

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getEntityById(ENTITY_DEFINITIONS.conteudos, normalizedId, { client, forUpdate: true });
    if (!before) return null;
    const after = await repository.updateConteudoCuradoria(normalizedId, normalized, userId, client);
    return { before, after };
  });

  if (!result) return null;

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: `educacao_ambiental.${action}`,
    entidade: ENTITY_DEFINITIONS.conteudos.table,
    entidade_id: normalizedId,
    before: auditEntitySnapshot(result.before),
    after: auditEntitySnapshot(result.after),
    req,
  });

  return getEntity('conteudos', normalizedId);
}

async function updateConteudoStatusCuradoria(id, payload = {}, user, req) {
  const normalized = validateCuradoriaStatusPayload(payload);
  const status = normalized.status_curadoria;

  if (['em_levantamento', 'em_curadoria'].includes(status) && !normalized.data_inicio_curadoria) {
    normalized.data_inicio_curadoria = new Date().toISOString();
  }

  return updateConteudoCuradoria(id, normalized, user, req, 'curadoria.status');
}

async function validarConteudoTecnicamente(id, payload = {}, user, req) {
  const userId = normalizeInternalUserId(user);
  const normalized = validateCuradoriaPatchPayload(payload);

  return updateConteudoCuradoria(
    id,
    {
      ...normalized,
      status_curadoria: 'validado_tecnicamente',
      responsavel_validacao_tecnica_id: userId,
      data_validacao_tecnica: new Date().toISOString(),
    },
    user,
    req,
    'curadoria.validacao_tecnica'
  );
}

async function validarConteudoJuridicamente(id, payload = {}, user, req) {
  const userId = normalizeInternalUserId(user);
  const normalized = validateCuradoriaPatchPayload(payload);

  return updateConteudoCuradoria(
    id,
    {
      ...normalized,
      status_curadoria: 'validado_juridicamente',
      responsavel_validacao_juridica_id: userId,
      data_validacao_juridica: new Date().toISOString(),
    },
    user,
    req,
    'curadoria.validacao_juridica'
  );
}

async function setConteudoAptoIa(id, payload = {}, user, req) {
  const normalizedId = normalizePositiveId(id, 'conteudo_id');
  const normalized = validateAptoPayload(payload, 'apto_para_ia');
  const conteudo = await repository.getEntityById(ENTITY_DEFINITIONS.conteudos, normalizedId);

  if (!conteudo) {
    return null;
  }

  if (normalized.apto_para_ia === true) {
    if (GRAUS_CONFIABILIDADE_BLOQUEADOS.includes(conteudo.grau_confiabilidade)) {
      throw createValidationError('Conteudo nao verificado nao pode ser marcado como apto para IA.', {
        field: 'grau_confiabilidade',
      });
    }

    if (!conteudo.data_validacao_tecnica && !['validado_tecnicamente', 'validado_juridicamente', 'apto_publicacao', 'publicado'].includes(conteudo.status_curadoria)) {
      throw createValidationError('Conteudo apto para IA exige validacao tecnica.', {
        field: 'data_validacao_tecnica',
      });
    }
  }

  return updateConteudoCuradoria(normalizedId, normalized, user, req, 'curadoria.apto_ia');
}

async function setConteudoAptoPortal(id, payload = {}, user, req) {
  const normalizedId = normalizePositiveId(id, 'conteudo_id');
  const normalized = validateAptoPayload(payload, 'apto_para_portal_publico');
  const conteudo = await repository.getEntityById(ENTITY_DEFINITIONS.conteudos, normalizedId);

  if (!conteudo) {
    return null;
  }

  if (normalized.apto_para_portal_publico === true) {
    await ensureConteudoCuradoriaCanPublish({ ...conteudo, ...normalized }, repository.db);
  }

  return updateConteudoCuradoria(normalizedId, normalized, user, req, 'curadoria.apto_portal');
}

async function marcarConteudoAptoPublicacao(id, payload = {}, user, req) {
  return updateConteudoCuradoria(
    id,
    {
      ...validateCuradoriaPatchPayload(payload),
      status_curadoria: 'apto_publicacao',
      apto_para_portal_publico: true,
    },
    user,
    req,
    'curadoria.apto_publicacao'
  );
}

async function listBaseConhecimentoValidada() {
  return repository.listBaseConhecimentoValidada();
}

module.exports = {
  archiveEntity,
  archiveReferencia,
  createAula,
  createEntity,
  createFonte,
  createReferencia,
  getCuradoriaDashboard,
  getDashboard,
  getEntity,
  getPublicConteudoBySlug,
  getPublicHome,
  listBaseConhecimentoValidada,
  listCategories,
  listCuradoriaPendencias,
  listEntity,
  listFontes,
  listReferencias,
  marcarConteudoAptoPublicacao,
  setConteudoAptoIa,
  setConteudoAptoPortal,
  updateAula,
  updateConteudoCuradoria,
  updateConteudoStatusCuradoria,
  updateEntity,
  updateEntityStatus,
  updateFonte,
  updateFonteStatus,
  updateReferencia,
  validarConteudoJuridicamente,
  validarConteudoTecnicamente,
};
