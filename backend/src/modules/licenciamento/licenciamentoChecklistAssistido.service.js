const auditService = require('../../services/auditService');
const repository = require('./licenciamentoChecklistAssistido.repository');
const governancaService = require('./licenciamentoGovernancaNormativa.service');
const fechamentoService = require('./licenciamentoFechamentoHomologacao.service');

const STATUS_PERMITIDOS = new Set([
  'pendente',
  'aprovado',
  'aprovado_com_observacao',
  'reprovado',
  'nao_aplicavel',
]);

const STATUS_OBSERVACAO_OBRIGATORIA = new Set([
  'reprovado',
  'aprovado_com_observacao',
  'nao_aplicavel',
]);

function getActor(user) {
  return {
    ator_tipo: 'usuario_interno',
    ator_id: user?.id || null,
  };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function countChecklist(items) {
  return items.reduce((acc, item) => {
    acc.total += 1;
    acc[item.status] = (acc[item.status] || 0) + 1;
    if (item.obrigatorio && item.status === 'pendente') acc.obrigatorios_pendentes += 1;
    if (item.obrigatorio && item.status === 'reprovado') acc.obrigatorios_reprovados += 1;
    return acc;
  }, {
    total: 0,
    pendente: 0,
    aprovado: 0,
    aprovado_com_observacao: 0,
    reprovado: 0,
    nao_aplicavel: 0,
    obrigatorios_pendentes: 0,
    obrigatorios_reprovados: 0,
  });
}

function inferTipoValidacao(item) {
  const codigo = normalizeText(item.codigo);
  const grupo = normalizeText(item.grupo);
  const texto = `${codigo} ${grupo} ${normalizeText(item.item)} ${normalizeText(item.descricao)}`;

  if (texto.includes('18.06')) return 'simulacao_1806';
  if (texto.includes('20.01') || texto.includes('16.06') || texto.includes('inconsistencia')) return 'bloqueio_inconsistencia';
  if (texto.includes('19.03') || texto.includes('limite') || texto.includes('impacto local')) return 'limite_impacto_local';
  if (texto.includes('taxa') || texto.includes('vrte') || texto.includes('cobranca')) return 'taxa_estimativa';
  if (texto.includes('dam') || texto.includes('protocolo definitivo') || texto.includes('decisao automatica')) return 'bloqueio_producao';
  if (texto.includes('divergencia')) return 'divergencia_normativa';
  if (texto.includes('legislacao publica') || texto.includes('legislacao ambiental')) return 'legislacao_publica';
  if (grupo.includes('normativo') || texto.includes('lei') || texto.includes('decreto') || texto.includes('norma')) return 'norma_cadastrada';
  if (grupo.includes('nao regressao') || texto.includes('regressao')) return 'nao_regressao';
  if (grupo.includes('admin') || texto.includes('admin') || texto.includes('endpoint')) return 'visual_admin';
  if (item.rota_relacionada) return 'visual_rota_publica';
  return 'mista';
}

function diagnosticoCodeForType(type, item) {
  const texto = `${normalizeText(item.codigo)} ${normalizeText(item.item)} ${normalizeText(item.descricao)}`;

  if (type === 'simulacao_1806') return 'simulacao_1806';
  if (texto.includes('20.01')) return 'bloqueio_2001_residuo_perigoso';
  if (texto.includes('16.06')) return 'bloqueio_1606_artesanal';
  if (type === 'limite_impacto_local' || texto.includes('19.03')) return 'limite_1903_extrapolado';
  if (type === 'bloqueio_producao') return 'bloqueio_dam_real';
  if (type === 'taxa_estimativa') return 'taxas_sem_cobranca_oficial';
  if (type === 'divergencia_normativa') return texto.includes('taxa') ? 'divergencia_tabela_taxas' : 'divergencia_grande_baixo';
  if (type === 'legislacao_publica') return 'publico_legislacao';
  if (type === 'norma_cadastrada') {
    if (texto.includes('1192')) return 'normas_1192_taxas';
    if (texto.includes('1191')) return 'normas_1191';
    if (texto.includes('1093')) return 'normas_1093_historica';
    if (texto.includes('021') || texto.includes('decreto')) return 'normas_decreto_021';
    return 'normas_1191';
  }
  if (type === 'visual_admin') return 'admin_governanca_status';
  return null;
}

function gerarObservacaoSugerida(item) {
  const type = item.tipo_validacao || inferTipoValidacao(item);

  const suggestions = {
    visual_rota_publica: 'Validado manualmente no ambiente local. A rota publica foi acessada, carregou sem erro aparente e apresentou conteudo institucional compativel com a Plataforma SIGMA.',
    visual_admin: 'Validado manualmente no ambiente local. A tela administrativa carregou corretamente, com informacoes organizadas e sem erro visual ou funcional aparente.',
    simulacao_1806: 'Validado por simulacao. A atividade 18.06 - Terraplenagem retornou status requer_validacao_tecnica, porte medio, classe II, taxa estimada de R$ 956,01 e memoria de calculo com 194 VRTE.',
    bloqueio_inconsistencia: 'Validado. O sistema bloqueou corretamente a conclusao automatica diante de inconsistencia tecnica informada, preservando a necessidade de analise da SMAD.',
    limite_impacto_local: 'Validado. O sistema identificou extrapolacao do limite de impacto local e impediu decisao automatica de enquadramento municipal.',
    taxa_estimativa: 'Validado. O sistema apresenta a taxa apenas como valor estimado para orientacao, sem caracterizar cobranca oficial, DAM real ou decisao administrativa.',
    bloqueio_producao: 'Validado. Permanecem bloqueados DAM real, cobranca oficial, protocolo definitivo e decisao administrativa automatica.',
    norma_cadastrada: 'Validado. A norma consta cadastrada na Governanca Normativa, com classificacao institucional adequada e vinculo ao modulo Licenciamento Ambiental.',
    divergencia_normativa: 'Validado. A divergencia normativa permanece registrada e visivel no ambiente administrativo, impedindo tratamento da materia como decisao definitiva sem validacao juridica.',
    legislacao_publica: 'Validado. A secao publica de legislacao ambiental municipal apresenta informacoes institucionais sem expor observacoes juridicas internas sensiveis.',
    nao_regressao: 'Validado manualmente. A rota foi acessada e nao apresentou regressao funcional aparente em relacao as fases anteriores.',
    nao_aplicavel: 'Item marcado como nao aplicavel nesta fase, pois sua validacao depende de funcionalidade ou decisao institucional fora do escopo da Fase 2C.4.',
    reprovado: 'Item reprovado na homologacao. Necessaria correcao tecnica ou validacao institucional antes da liberacao da Fase 2D.',
    mista: 'Validado manualmente no ambiente local, com evidencia registrada para apoio ao preenchimento institucional da Fase 2C.4.',
  };

  return item.observacao_sugerida || suggestions[type] || suggestions.mista;
}

function gerarResultadoEsperado(item) {
  const type = item.tipo_validacao || inferTipoValidacao(item);

  if (type === 'simulacao_1806') {
    return 'Simulacao 18.06 deve retornar status requer_validacao_tecnica, porte medio, classe II, 194 VRTE e taxa R$ 956,01.';
  }
  if (type === 'bloqueio_inconsistencia') {
    return 'Sistema deve bloquear conclusao automatica quando houver inconsistencia tecnica informada.';
  }
  if (type === 'limite_impacto_local') {
    return 'Sistema deve indicar limite de impacto local excedido sem decisao automatica.';
  }
  if (type === 'bloqueio_producao') {
    return 'DAM real, cobranca oficial, protocolo definitivo e decisao administrativa automatica devem permanecer bloqueados.';
  }
  if (type === 'legislacao_publica') {
    return 'Legislacao publica deve carregar sem campos internos sensiveis.';
  }
  if (type === 'norma_cadastrada' || type === 'divergencia_normativa') {
    return 'Registro deve permanecer visivel na Governanca Normativa sem liberar cobranca oficial ou alterar matriz operacional.';
  }
  if (item.rota_relacionada) {
    return 'Rota relacionada deve carregar sem tela branca, erro bruto ou loading infinito.';
  }

  return 'Item deve ser conferido e registrado com observacao ou evidencia compativel.';
}

function gerarAcaoRecomendada(item) {
  const type = item.tipo_validacao || inferTipoValidacao(item);

  if (type === 'simulacao_1806') return 'Executar a simulacao 18.06, conferir status, classe, taxa e memoria de calculo, e registrar evidencia.';
  if (type === 'bloqueio_inconsistencia') return 'Executar o caso de bloqueio indicado e registrar a mensagem controlada retornada pelo sistema.';
  if (type === 'limite_impacto_local') return 'Executar o caso extrapolado e confirmar que o sistema nao conclui enquadramento municipal automaticamente.';
  if (type === 'bloqueio_producao') return 'Conferir os bloqueios de producao e registrar que DAM, cobranca, protocolo e decisao automatica seguem bloqueados.';
  if (type === 'norma_cadastrada' || type === 'divergencia_normativa') return 'Abrir Governanca Normativa, conferir o cadastro ou divergencia e registrar a validacao.';
  if (type === 'legislacao_publica') return 'Abrir Licenciamento Publico e conferir a secao de legislacao sem campos internos sensiveis.';
  if (item.rota_relacionada) return 'Abrir a rota indicada, validar visualmente e registrar evidencia.';
  return 'Revisar o item conforme seu contexto e registrar a evidencia de homologacao.';
}

function gerarEvidenciaSugerida(item, diagnostico) {
  const type = item.tipo_validacao || inferTipoValidacao(item);
  const checkCode = diagnosticoCodeForType(type, item);
  const relatedCheck = checkCode
    ? (diagnostico?.checks || []).find((check) => check.codigo === checkCode)
    : null;

  if (relatedCheck) {
    return {
      tipo: 'diagnostico_automatico',
      check_codigo: relatedCheck.codigo,
      status: relatedCheck.status,
      evidencia_textual: relatedCheck.evidencia_textual,
      evidencia_json: relatedCheck.evidencia_json || {},
    };
  }

  if (type === 'simulacao_1806') {
    return {
      tipo: 'simulacao',
      atividade: '18.06',
      entrada: {
        area_terraplanada_m2: 22000,
        altura_talude_m: 4,
      },
      resultado_esperado: {
        status: 'requer_validacao_tecnica',
        porte: 'medio',
        classe: 'classe_ii',
        taxa: 'R$ 956,01',
      },
    };
  }

  if (type === 'bloqueio_producao') {
    return {
      tipo: 'bloqueio_producao',
      dam_real: 'bloqueado',
      cobranca_oficial: 'bloqueada',
      protocolo_definitivo: 'bloqueado',
      decisao_automatica: 'bloqueada',
    };
  }

  if (type === 'legislacao_publica') {
    return {
      tipo: 'endpoint_publico',
      endpoint: '/publico/licenciamento/legislacao',
      resultado: 'respondido sem exposicao de campos internos sensiveis',
    };
  }

  return {
    tipo: 'validacao_manual',
    orientacao: 'Registrar evidencia textual apos conferencia institucional.',
  };
}

function requiresEvidence(item, nextStatus) {
  if (nextStatus !== 'aprovado') return false;
  if (!item.obrigatorio) return false;
  if (item.requer_confirmacao_manual === false && !item.requer_validacao_visual) return false;
  return true;
}

function enrichItem(item, diagnostico = null) {
  const tipoValidacao = item.tipo_validacao || inferTipoValidacao(item);
  const diagnosticoRelacionado = diagnosticoCodeForType(tipoValidacao, item);
  const enriched = {
    ...item,
    tipo_validacao: tipoValidacao,
    rota_validacao: item.rota_validacao || item.rota_relacionada || null,
    acao_recomendada: item.acao_recomendada || gerarAcaoRecomendada({ ...item, tipo_validacao: tipoValidacao }),
    observacao_sugerida: item.observacao_sugerida || gerarObservacaoSugerida({ ...item, tipo_validacao: tipoValidacao }),
    resultado_esperado: item.resultado_esperado || gerarResultadoEsperado({ ...item, tipo_validacao: tipoValidacao }),
    diagnostico_relacionado: diagnosticoRelacionado,
    evidencia_sugerida: gerarEvidenciaSugerida({ ...item, tipo_validacao: tipoValidacao }, diagnostico),
    requer_evidencia_para_aprovacao: requiresEvidence({ ...item, tipo_validacao: tipoValidacao }, 'aprovado'),
    requer_confirmacao_manual: item.requer_confirmacao_manual !== false,
    fase_relacionada: item.fase_relacionada || '2C.4',
  };

  return {
    ...enriched,
    sem_evidencia: !enriched.evidencias_json?.evidencia_textual,
    tem_observacao_sugerida: Boolean(enriched.observacao_sugerida),
  };
}

function applyFilters(items, filters = {}) {
  let result = [...items];

  if (filters.status) {
    result = result.filter((item) => item.status === filters.status);
  }

  if (filters.grupo) {
    result = result.filter((item) => normalizeText(item.grupo) === normalizeText(filters.grupo));
  }

  if (filters.tipo_validacao) {
    result = result.filter((item) => item.tipo_validacao === filters.tipo_validacao);
  }

  if (filters.obrigatorio !== undefined) {
    const required = String(filters.obrigatorio) === 'true';
    result = result.filter((item) => Boolean(item.obrigatorio) === required);
  }

  if (filters.pendentes === 'true') {
    result = result.filter((item) => item.obrigatorio && ['pendente', 'reprovado'].includes(item.status));
  }

  if (filters.sem_evidencia === 'true') {
    result = result.filter((item) => item.sem_evidencia);
  }

  if (filters.com_diagnostico === 'true') {
    result = result.filter((item) => Boolean(item.diagnostico_relacionado));
  }

  if (filters.com_observacao_sugerida === 'true') {
    result = result.filter((item) => item.tem_observacao_sugerida);
  }

  return result;
}

async function getDiagnosticoAssistido(user = null, req = null, options = {}) {
  const diagnostico = await fechamentoService.runDiagnosticoFinal(user, req, { skipAudit: true });

  if (!options.skipAudit) {
    await auditService.log({
      ...getActor(user),
      acao: 'licenciamento.checklist_assistido.diagnostico',
      entidade: 'licenciamento_homologacao_checklists',
      dados: {
        status: diagnostico.status,
        checks_total: diagnostico.checks?.length || 0,
      },
      req,
    });
  }

  return diagnostico;
}

async function calcularResumoChecklist() {
  const [items, fechamentoStatus, diagnostico] = await Promise.all([
    repository.listChecklist(),
    fechamentoService.getStatus(),
    getDiagnosticoAssistido(null, null, { skipAudit: true }),
  ]);
  const summary = countChecklist(items);
  const checks = diagnostico.checks || [];

  return {
    total: summary.total,
    obrigatorios_pendentes: summary.obrigatorios_pendentes,
    obrigatorios_reprovados: summary.obrigatorios_reprovados,
    aprovados: summary.aprovado,
    aprovados_com_observacao: summary.aprovado_com_observacao,
    nao_aplicaveis: summary.nao_aplicavel,
    diagnostico_tecnico: diagnostico.status,
    diagnostico_checks: {
      total: checks.length,
      ok: checks.filter((item) => item.status === 'ok').length,
      falha: checks.filter((item) => item.status === 'falha').length,
      pendente: checks.filter((item) => item.status === 'pendente').length,
    },
    ready_for_fase2d: fechamentoStatus.ready_for_fase2d,
    fase2d: fechamentoStatus.ready_for_fase2d.ready ? 'liberavel_no_gate' : 'bloqueada',
    bloqueios_producao: fechamentoStatus.bloqueios_producao,
  };
}

async function listarItensChecklistAssistido(filters = {}) {
  const [items, diagnostico] = await Promise.all([
    repository.listChecklist(),
    getDiagnosticoAssistido(null, null, { skipAudit: true }),
  ]);

  return applyFilters(items.map((item) => enrichItem(item, diagnostico)), filters);
}

async function listarPendenciasObrigatorias() {
  return listarItensChecklistAssistido({ pendentes: 'true' });
}

async function obterItem(id) {
  const item = await repository.getChecklistItem(Number(id));
  if (!item) {
    const error = new Error('Item de checklist nao encontrado.');
    error.statusCode = 404;
    throw error;
  }

  const diagnostico = await getDiagnosticoAssistido(null, null, { skipAudit: true });
  return enrichItem(item, diagnostico);
}

async function obterSugestaoItem(id) {
  const item = await obterItem(id);
  return {
    item_id: item.id,
    codigo: item.codigo,
    observacao_sugerida: item.observacao_sugerida,
    evidencia_sugerida: item.evidencia_sugerida,
    acao_recomendada: item.acao_recomendada,
    resultado_esperado: item.resultado_esperado,
    diagnostico_relacionado: item.diagnostico_relacionado,
  };
}

function normalizeStatus(status) {
  const normalized = String(status || 'pendente').trim();
  if (!STATUS_PERMITIDOS.has(normalized)) {
    const error = new Error('Status de checklist assistido invalido.');
    error.statusCode = 400;
    error.details = { allowed: Array.from(STATUS_PERMITIDOS) };
    throw error;
  }
  return normalized;
}

async function atualizarItemChecklistAssistido(id, payload, user, req) {
  const item = await obterItem(id);
  const status = normalizeStatus(payload.status || item.status);
  const observacao = String(payload.observacao || payload.resultado || '').trim();
  const evidenciaTextual = String(payload.evidencia_textual || '').trim();
  const evidencePayload = payload.evidencias_json && typeof payload.evidencias_json === 'object'
    ? { ...payload.evidencias_json }
    : {};

  if (STATUS_OBSERVACAO_OBRIGATORIA.has(status) && !observacao) {
    const error = new Error('Observacao obrigatoria para este status de checklist assistido.');
    error.statusCode = 400;
    error.details = { status };
    throw error;
  }

  if (requiresEvidence(item, status) && !observacao && !evidenciaTextual && !evidencePayload.evidencia_textual) {
    const error = new Error('Item obrigatorio aprovado exige observacao ou evidencia textual.');
    error.statusCode = 400;
    error.details = { status, item_id: item.id };
    throw error;
  }

  const result = await governancaService.updateHomologacaoItem(id, {
    status,
    observacao,
    evidencia_textual: evidenciaTextual,
    evidencias_json: {
      ...evidencePayload,
      origem_validacao: 'checklist_assistido_2c4',
      tipo_validacao: item.tipo_validacao,
      sugestao_aplicada: Boolean(payload.sugestao_aplicada),
    },
  }, user, req);

  await auditService.log({
    ...getActor(user),
    acao: 'licenciamento.checklist_assistido.update',
    entidade: 'licenciamento_homologacao_checklists',
    entidade_id: Number(id),
    dados: {
      status_anterior: item.status,
      status_novo: status,
      observacao_anterior: item.resultado || null,
      observacao_nova: observacao || null,
      evidencia_textual: evidenciaTextual || evidencePayload.evidencia_textual || null,
    },
    req,
  });

  return enrichItem(result, await getDiagnosticoAssistido(null, null, { skipAudit: true }));
}

async function aplicarObservacaoSugerida(id, user, req) {
  const item = await obterItem(id);
  const result = await governancaService.updateHomologacaoItem(id, {
    status: item.status,
    observacao: item.observacao_sugerida,
    evidencias_json: {
      ...(item.evidencias_json || {}),
      origem_validacao: 'checklist_assistido_2c4',
      sugestao_aplicada: true,
      evidencia_sugerida: item.evidencia_sugerida,
    },
  }, user, req);

  await auditService.log({
    ...getActor(user),
    acao: 'licenciamento.checklist_assistido.observacao_sugerida_aplicada',
    entidade: 'licenciamento_homologacao_checklists',
    entidade_id: Number(id),
    dados: {
      status_preservado: item.status,
      observacao_sugerida: item.observacao_sugerida,
    },
    req,
  });

  return {
    item: enrichItem(result, await getDiagnosticoAssistido(null, null, { skipAudit: true })),
    status_preservado: item.status,
    mensagem: 'Observacao sugerida aplicada sem alterar o status do item.',
  };
}

function groupPendencias(items) {
  return items.reduce((acc, item) => {
    const grupo = item.grupo || 'Sem grupo';
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push({
      id: item.id,
      codigo: item.codigo,
      descricao: item.item || item.descricao,
      status: item.status,
      acao_recomendada: item.acao_recomendada,
      observacao_sugerida: item.observacao_sugerida,
      rota_relacionada: item.rota_validacao || item.rota_relacionada,
      tipo_validacao: item.tipo_validacao,
    });
    return acc;
  }, {});
}

async function gerarRelatorioPendencias(user, req) {
  const [status, items] = await Promise.all([
    calcularResumoChecklist(),
    listarPendenciasObrigatorias(),
  ]);
  const hasPending = status.obrigatorios_pendentes > 0 || status.obrigatorios_reprovados > 0;
  const relatorio = {
    fase: '2C.4',
    gerado_em: new Date().toISOString(),
    resumo: status,
    pendencias_por_grupo: groupPendencias(items),
    recomendacao: hasPending
      ? 'Concluir validacao dos itens obrigatorios antes de iniciar a Fase 2D.'
      : 'Checklist obrigatorio concluido. Executar diagnostico final e confirmar liberacao no Fechamento de Homologacao.',
  };

  await auditService.log({
    ...getActor(user),
    acao: 'licenciamento.checklist_assistido.relatorio_pendencias',
    entidade: 'licenciamento_homologacao_checklists',
    dados: {
      obrigatorios_pendentes: status.obrigatorios_pendentes,
      obrigatorios_reprovados: status.obrigatorios_reprovados,
    },
    req,
  });

  return relatorio;
}

module.exports = {
  calcularResumoChecklist,
  listarItensChecklistAssistido,
  listarPendenciasObrigatorias,
  obterItem,
  obterSugestaoItem,
  atualizarItemChecklistAssistido,
  getDiagnosticoAssistido,
  aplicarObservacaoSugerida,
  gerarRelatorioPendencias,
  gerarObservacaoSugerida,
  gerarEvidenciaSugerida,
};
