const auditService = require('../../services/auditService');
const repository = require('./licenciamentoFechamentoHomologacao.repository');
const governancaService = require('./licenciamentoGovernancaNormativa.service');

const RECOMENDACAO_LIBERADA = 'Fase 2C.3 homologada. Sistema apto a iniciar a Fase 2D — Parametrização Completa Controlada do Decreto Municipal nº 021/2020 por grupos, mantendo bloqueados DAM real, cobrança oficial, protocolo definitivo e decisão administrativa automática.';
const RECOMENDACAO_BLOQUEADA = 'Fase 2D bloqueada. Concluir homologação obrigatória e corrigir pendências antes de iniciar a parametrização completa do Decreto Municipal nº 021/2020.';

function getActor(user) {
  return {
    ator_tipo: 'usuario_interno',
    ator_id: user?.id || null,
  };
}

function getUserLabel(user) {
  return user?.nome || user?.email || user?.login || (user?.id ? `usuario:${user.id}` : null);
}

function countChecklist(items) {
  return items.reduce((acc, item) => {
    acc.total_itens += 1;
    if (item.status === 'pendente') acc.pendentes += 1;
    if (item.status === 'reprovado') acc.reprovados += 1;
    if (item.status === 'aprovado') acc.aprovados += 1;
    if (item.status === 'aprovado_com_observacao') acc.aprovados_com_observacao += 1;
    if (item.status === 'nao_aplicavel') acc.nao_aplicaveis += 1;
    if (item.obrigatorio && item.status === 'pendente') acc.obrigatorios_pendentes += 1;
    if (item.obrigatorio && item.status === 'reprovado') acc.obrigatorios_reprovados += 1;
    return acc;
  }, {
    total_itens: 0,
    pendentes: 0,
    reprovados: 0,
    aprovados: 0,
    aprovados_com_observacao: 0,
    nao_aplicaveis: 0,
    obrigatorios_pendentes: 0,
    obrigatorios_reprovados: 0,
  });
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function inferTipoValidacao(item) {
  const codigo = normalizeText(item.codigo);
  const grupo = normalizeText(item.grupo);
  const texto = `${codigo} ${grupo} ${normalizeText(item.item)} ${normalizeText(item.descricao)}`;

  if (texto.includes('18.06') || texto.includes('simul')) return 'simulacao';
  if (texto.includes('dam') || texto.includes('cobranca') || texto.includes('protocolo definitivo') || texto.includes('decisao automatica')) return 'bloqueio_producao';
  if (grupo.includes('normativo') || texto.includes('lei') || texto.includes('decreto') || texto.includes('divergencia')) return 'normativa';
  if (grupo.includes('nao regressao') || texto.includes('regressao')) return 'nao_regressao';
  if (grupo.includes('admin') || texto.includes('endpoint')) return 'funcional';
  if (item.rota_relacionada) return 'visual';
  return 'mista';
}

function observationForType(type, item) {
  const codigo = normalizeText(item.codigo);
  const texto = `${codigo} ${normalizeText(item.item)} ${normalizeText(item.descricao)}`;

  if (texto.includes('18.06')) {
    return 'Validado por simulacao. A atividade 18.06 retornou porte medio, classe II, status requer_validacao_tecnica e taxa estimada de R$ 956,01, com memoria de calculo em VRTE.';
  }

  if (type === 'bloqueio_producao') {
    return 'Validado. Permanecem bloqueados DAM real, cobranca oficial, protocolo definitivo e decisao administrativa automatica.';
  }

  if (type === 'normativa') {
    return 'Validado. A norma consta cadastrada na Governanca Normativa, com classificacao institucional adequada ao uso no modulo Licenciamento Ambiental.';
  }

  if (type === 'nao_regressao' || item.rota_relacionada) {
    return 'Validado manualmente. A rota foi acessada no ambiente local e carregou sem erro aparente, mantendo conteudo institucional compativel com a Plataforma SIGMA.';
  }

  return 'Validado manualmente no ambiente local, com evidencia registrada para fechamento da Fase 2C.3.';
}

function expectedResultForType(type, item) {
  if (normalizeText(item.codigo).includes('1806') || normalizeText(item.item).includes('18.06')) {
    return 'Simulacao 18.06 deve retornar status requer_validacao_tecnica, porte medio, classe II, 194 VRTE e taxa R$ 956,01.';
  }

  if (type === 'bloqueio_producao') {
    return 'DAM real, cobranca oficial, protocolo definitivo e decisao administrativa automatica permanecem bloqueados.';
  }

  if (type === 'normativa') {
    return 'Norma, matriz, taxa ou divergencia deve aparecer na Governanca Normativa sem liberar cobranca oficial.';
  }

  if (item.rota_relacionada) {
    return 'Rota relacionada deve carregar sem tela branca, erro bruto ou loading infinito.';
  }

  return 'Item deve ser conferido e registrado com observacao ou evidencia compativel.';
}

function actionForType(type, item) {
  if (type === 'simulacao') return 'Executar a simulacao indicada, conferir status, classe, taxa e memoria de calculo, e registrar evidencia.';
  if (type === 'bloqueio_producao') return 'Conferir o painel de bloqueios e confirmar que nenhuma funcionalidade de cobranca, DAM, protocolo definitivo ou decisao automatica foi liberada.';
  if (type === 'normativa') return 'Abrir Governanca Normativa, conferir o cadastro ou divergencia correspondente e registrar a validacao.';
  if (type === 'nao_regressao') return 'Abrir a rota relacionada e validar que o modulo segue carregando sem regressao.';
  if (type === 'funcional') return 'Validar o endpoint ou tela administrativa indicada e registrar o resultado.';
  if (item.rota_relacionada) return 'Abrir a rota indicada, validar visualmente e registrar evidencia.';
  return 'Revisar o item conforme seu contexto e registrar a evidencia de homologacao.';
}

function enrichChecklistItem(item) {
  const type = item.tipo_validacao || inferTipoValidacao(item);
  const diagnosticoCodes = {
    simulacao: 'simulacao_1806',
    bloqueio_producao: 'bloqueios_producao',
    normativa: 'normas_1191',
    nao_regressao: null,
    funcional: 'admin_governanca_status',
  };

  return {
    ...item,
    tipo_validacao: type,
    acao_recomendada: item.acao_recomendada || actionForType(type, item),
    observacao_sugerida: item.observacao_sugerida || observationForType(type, item),
    rota_validacao: item.rota_validacao || item.rota_relacionada || null,
    resultado_esperado: item.resultado_esperado || expectedResultForType(type, item),
    pode_validar_por_diagnostico: Boolean(item.pode_validar_por_diagnostico || ['simulacao', 'bloqueio_producao', 'normativa', 'funcional'].includes(type)),
    requer_validacao_visual: Boolean(item.requer_validacao_visual || ['visual', 'nao_regressao', 'mista'].includes(type)),
    requer_confirmacao_manual: item.requer_confirmacao_manual !== false,
    fase_relacionada: item.fase_relacionada || '2C.3',
    diagnostico_relacionado: diagnosticoCodes[type] || null,
    motivo_pendencia: item.status === 'pendente'
      ? 'Item obrigatorio ainda pendente de homologacao manual.'
      : item.status === 'reprovado'
        ? 'Item obrigatorio reprovado. Corrigir a pendencia e revalidar.'
        : null,
  };
}

function check(codigo, descricao, passed, evidenciaTextual, evidenciaJson = {}, itemChecklistRelacionado = null) {
  return {
    codigo,
    descricao,
    status: passed ? 'ok' : 'falha',
    evidencia_textual: evidenciaTextual,
    evidencia_json: evidenciaJson,
    pode_sugerir_aprovacao: Boolean(passed && itemChecklistRelacionado),
    item_checklist_relacionado: itemChecklistRelacionado,
  };
}

function findCheck(diagnostico, codigo) {
  return (diagnostico.checks || []).find((item) => item.codigo === codigo);
}

async function runDiagnosticoFinal(user = null, req = null, options = {}) {
  const [status, divergencias, legislacao, diagnosticoParcial] = await Promise.all([
    governancaService.getStatus(),
    governancaService.listDivergencias(),
    governancaService.listLegislacaoPublica(),
    governancaService.runHomologacaoDiagnostico(user, req, { skipAudit: true }),
  ]);

  const legislacaoCodes = new Set(legislacao.map((item) => item.codigo));
  const divergenciaCodes = new Set(divergencias.map((item) => item.codigo));
  const partial = (codigo) => findCheck(diagnosticoParcial, codigo)?.status === 'ok';
  const checks = [
    check('normas_1191', 'Lei Municipal n. 1.191/2019 cadastrada.', Boolean(status.normas.lei_1191), 'Lei 1.191/2019 encontrada na governanca normativa.', { lei_1191: status.normas.lei_1191 }, 'NORMATIVO_LEI_1191'),
    check('normas_1192_taxas', 'Lei Municipal n. 1.192/2019 preferencial de taxas.', Boolean(status.normas.lei_1192), 'Lei 1.192/2019 marcada como preferencial de taxas.', { lei_1192: status.normas.lei_1192 }, 'NORMATIVO_LEI_1192'),
    check('normas_1093_historica', 'Lei Municipal n. 1.093/2017 historica/anterior.', Boolean(status.normas.lei_1093), 'Lei 1.093/2017 preservada como norma historica.', { lei_1093: status.normas.lei_1093 }, 'NORMATIVO_LEI_1093'),
    check('normas_decreto_021', 'Decreto Municipal n. 021/2020 operacional.', Boolean(status.normas.decreto_021), 'Decreto 021/2020 encontrado como base operacional.', { decreto_021: status.normas.decreto_021 }, 'NORMATIVO_DECRETO_021'),
    check('normas_consema_referencia', 'CONSEMA n. 001/2022 como referencia comparativa.', legislacaoCodes.has('CONSEMA_001_2022_REFERENCIA'), 'CONSEMA 001/2022 aparece como referencia comparativa publica.', { codigos: Array.from(legislacaoCodes) }, 'NORMATIVO_CONSEMA'),
    check('taxas_tabela_piloto', 'Tabela Fase 2B operacional_piloto.', Boolean(status.taxas.tabela_operacional_piloto), 'Tabela de taxas Fase 2B segue operacional para simulacao.', status.taxas, 'NORMATIVO_TABELA_TAXAS'),
    check('taxas_sem_cobranca_oficial', 'Tabela Fase 2B nao validada para cobranca.', status.taxas.validada_para_cobranca === false, 'Nenhuma tabela esta validada para cobranca oficial.', status.taxas, 'BLOQUEIO_COBRANCA_OFICIAL'),
    check('matriz_fase2b_operacional', 'Matriz Fase 2B piloto operacional.', Boolean(status.matriz.operacional_piloto), 'Matriz Fase 2B operacional segue cadastrada.', status.matriz, 'NORMATIVO_MATRIZ_FASE2B'),
    check('matriz_1192_conferencia', 'Matriz Lei 1.192/2019 em conferencia.', Boolean(status.matriz.lei_1192_em_conferencia), 'Matriz da Lei 1.192/2019 permanece em conferencia, sem substituir a operacional.', status.matriz, 'NORMATIVO_MATRIZ_1192'),
    check('divergencia_grande_baixo', 'Divergencia Grande + Baixo registrada.', divergenciaCodes.has('DIVERGENCIA_MATRIZ_GRANDE_BAIXO'), 'Divergencia Grande + Baixo permanece visivel no admin.', { codigos: Array.from(divergenciaCodes) }, 'NORMATIVO_DIVERGENCIA_GRANDE_BAIXO'),
    check('divergencia_tabela_taxas', 'Divergencia de tabela de taxas registrada.', divergenciaCodes.has('DIVERGENCIA_TABELA_TAXAS_LEI_1192_DECRETO_021'), 'Divergencia de tabela de taxas permanece registrada.', { codigos: Array.from(divergenciaCodes) }, 'NORMATIVO_DIVERGENCIA_TAXAS'),
    check('bloqueio_dam_real', 'Bloqueio DAM real ativo.', status.bloqueios_operacionais.dam_real === true, 'DAM real permanece bloqueado.', status.bloqueios_operacionais, 'BLOQUEIO_DAM_REAL'),
    check('bloqueio_cobranca_oficial', 'Bloqueio cobranca oficial ativo.', status.bloqueios_operacionais.cobranca_oficial === true, 'Cobranca oficial permanece bloqueada.', status.bloqueios_operacionais, 'BLOQUEIO_COBRANCA_OFICIAL'),
    check('bloqueio_protocolo_definitivo', 'Bloqueio protocolo definitivo ativo.', status.bloqueios_operacionais.protocolo_definitivo === true, 'Protocolo definitivo permanece bloqueado.', status.bloqueios_operacionais, 'BLOQUEIO_PROTOCOLO_DEFINITIVO'),
    check('bloqueio_decisao_automatica', 'Bloqueio decisao automatica ativo.', status.bloqueios_operacionais.decisao_automatica === true, 'Decisao administrativa automatica permanece bloqueada.', status.bloqueios_operacionais, 'BLOQUEIO_DECISAO_AUTOMATICA'),
    check('simulacao_1806', 'Simulacao 18.06 OK.', partial('simulacao_1806'), '18.06 manteve status, porte, classe, taxa e memoria de calculo esperados.', findCheck(diagnosticoParcial, 'simulacao_1806')?.evidencia || {}, 'PUBLICO_SIMULADOR_1806'),
    check('bloqueio_2001_residuo_perigoso', 'Bloqueio 20.01 com residuo perigoso OK.', partial('bloqueio_2001_residuo_perigoso'), '20.01 bloqueia residuo perigoso ou contaminado.', findCheck(diagnosticoParcial, 'bloqueio_2001_residuo_perigoso')?.evidencia || {}, 'PUBLICO_SIMULADOR_2001_BLOQUEIO'),
    check('limite_1903_extrapolado', 'Limite 19.03 com 600.000 m2 OK.', partial('limite_1903_extrapolado'), '19.03 retorna limite de impacto local excedido.', findCheck(diagnosticoParcial, 'limite_1903_extrapolado')?.evidencia || {}, 'PUBLICO_SIMULADOR_1903_LIMITE'),
    check('bloqueio_1606_artesanal', 'Bloqueio 16.06 artesanal OK.', partial('bloqueio_1606_artesanal'), '16.06 artesanal permanece bloqueada ou direcionada a atividade associada.', findCheck(diagnosticoParcial, 'bloqueio_1606_artesanal')?.evidencia || {}, 'PUBLICO_SIMULADOR_1606_ARTESANAL'),
    check('publico_legislacao', 'Endpoint publico de legislacao OK.', partial('legislacao_publica_segura'), 'Legislacao publica retorna normas essenciais sem observacoes juridicas internas.', findCheck(diagnosticoParcial, 'legislacao_publica_segura')?.evidencia || {}, 'PUBLICO_LEGISLACAO'),
    check('publico_avisos_normativos', 'Endpoint publico de avisos normativos OK.', partial('avisos_normativos_publicos'), 'Avisos normativos publicos retornam resposta controlada.', findCheck(diagnosticoParcial, 'avisos_normativos_publicos')?.evidencia || {}, 'PUBLICO_AVISOS_NORMATIVOS'),
    check('admin_governanca_status', 'Endpoint admin de governanca OK.', Boolean(status.ready_for_fase2d), 'Status de governanca normativa retornou ready_for_fase2d e criterios.', { criterios: status.ready_for_fase2d?.criterios?.length || 0 }, 'ADMIN_GOVERNANCA_STATUS'),
  ];

  const falhas = checks.filter((item) => item.status === 'falha').length;
  const diagnostico = {
    status: falhas > 0 ? 'falha' : 'ok',
    executado_em: new Date().toISOString(),
    checks,
    recomendacao: falhas > 0
      ? 'Corrigir falhas criticas antes de iniciar a Fase 2D.'
      : 'Diagnostico automatico final sem falhas criticas. Itens manuais ainda dependem de validacao institucional.',
  };

  if (!options.skipAudit) {
    await auditService.log({
      ...getActor(user),
      acao: 'licenciamento.homologacao_fechamento.diagnostico_final',
      entidade: 'licenciamento_homologacao_checklists',
      dados: {
        status: diagnostico.status,
        checks_total: checks.length,
        falhas,
      },
      req,
    });
  }

  return diagnostico;
}

async function avaliarProntidaoFase2D(options = {}) {
  const [checklist, status, diagnostico, divergencias] = await Promise.all([
    repository.listChecklist(),
    governancaService.getStatus(),
    runDiagnosticoFinal(null, null, { skipAudit: true }),
    governancaService.listDivergencias(),
  ]);
  const totais = countChecklist(checklist);
  const byCode = Object.fromEntries(diagnostico.checks.map((item) => [item.codigo, item.status === 'ok']));
  const bloqueiosProducaoOk = status.bloqueios_operacionais.dam_real === true
    && status.bloqueios_operacionais.cobranca_oficial === true
    && status.bloqueios_operacionais.protocolo_definitivo === true
    && status.bloqueios_operacionais.decisao_automatica === true;
  const checksCriticos = {
    simulacao_1806_ok: Boolean(byCode.simulacao_1806),
    bloqueios_producao_ok: bloqueiosProducaoOk,
    endpoints_publicos_ok: Boolean(byCode.publico_legislacao && byCode.publico_avisos_normativos),
    governanca_ok: Boolean(byCode.admin_governanca_status && byCode.taxas_tabela_piloto && byCode.matriz_fase2b_operacional),
    divergencias_registradas_ok: Boolean(byCode.divergencia_grande_baixo && byCode.divergencia_tabela_taxas),
  };

  const bloqueios = [];
  if (totais.obrigatorios_pendentes > 0) bloqueios.push(`${totais.obrigatorios_pendentes} item(ns) obrigatorio(s) pendente(s).`);
  if (totais.obrigatorios_reprovados > 0) bloqueios.push(`${totais.obrigatorios_reprovados} item(ns) obrigatorio(s) reprovado(s).`);
  if (diagnostico.status !== 'ok') bloqueios.push('Diagnostico automatico final possui falhas criticas.');
  if (!checksCriticos.simulacao_1806_ok) bloqueios.push('Simulacao 18.06 inconsistente.');
  if (!checksCriticos.bloqueios_producao_ok) bloqueios.push('Bloqueios de producao inconsistentes.');
  if (!checksCriticos.endpoints_publicos_ok) bloqueios.push('Endpoints publicos de legislacao/avisos inconsistentes.');
  if (!checksCriticos.governanca_ok) bloqueios.push('Governanca normativa incompleta.');
  if (!checksCriticos.divergencias_registradas_ok) bloqueios.push('Divergencias normativas obrigatorias ausentes.');

  const ready = bloqueios.length === 0;

  return {
    ready,
    status: ready ? 'apta' : 'bloqueada',
    totais,
    checks_criticos: checksCriticos,
    bloqueios,
    checklist: options.includeChecklist ? checklist.map(enrichChecklistItem) : undefined,
    diagnostico,
    bloqueios_producao: status.bloqueios_operacionais,
    divergencias_pendentes: divergencias
      .filter((item) => !['resolvida', 'resolvido', 'encerrada'].includes(item.status))
      .map((item) => ({
        codigo: item.codigo,
        titulo: item.titulo,
        criticidade: item.criticidade,
        status: item.status,
      })),
    recomendacao: ready ? RECOMENDACAO_LIBERADA : RECOMENDACAO_BLOQUEADA,
  };
}

async function getStatus() {
  const avaliacao = await avaliarProntidaoFase2D();
  return {
    ready_for_fase2d: {
      ready: avaliacao.ready,
      status: avaliacao.status,
      totais: avaliacao.totais,
      checks_criticos: avaliacao.checks_criticos,
      bloqueios: avaliacao.bloqueios,
      recomendacao: avaliacao.recomendacao,
    },
    diagnostico_status: avaliacao.diagnostico.status,
    bloqueios_producao: avaliacao.bloqueios_producao,
    relatorio_liberacao: avaliacao.ready ? 'disponivel' : 'indisponivel',
  };
}

async function listPendencias() {
  const items = await repository.listChecklist();
  return items
    .filter((item) => item.obrigatorio && ['pendente', 'reprovado'].includes(item.status))
    .map(enrichChecklistItem);
}

async function getRoteiro() {
  return {
    passos: [
      'Executar diagnostico automatico final.',
      'Revisar itens pendentes obrigatorios.',
      'Validar visualmente rotas publicas.',
      'Validar Admin Licenciamento.',
      'Validar Governanca Normativa.',
      'Validar simulador 18.06.',
      'Registrar observacoes e evidencias.',
      'Corrigir itens reprovados.',
      'Gerar relatorio de homologacao.',
      'Liberar inicio da Fase 2D somente se ready = true.',
    ],
    observacoes_sugeridas: {
      rota_publica: 'Validado manualmente. A rota foi acessada no ambiente local e carregou sem erro aparente, mantendo conteudo institucional compativel com a Plataforma SIGMA.',
      simulador_1806: 'Validado por simulacao. A atividade 18.06 retornou porte medio, classe II, status requer_validacao_tecnica e taxa estimada de R$ 956,01, com memoria de calculo em VRTE.',
      taxa_estimada: 'Validado. O sistema apresenta a taxa como valor estimado para orientacao, sem caracterizar cobranca oficial, DAM real ou decisao administrativa.',
      bloqueio_producao: 'Validado. Permanecem bloqueados DAM real, cobranca oficial, protocolo definitivo e decisao administrativa automatica.',
      norma_cadastrada: 'Validado. A norma consta cadastrada na Governanca Normativa, com classificacao institucional adequada ao uso no modulo Licenciamento Ambiental.',
      nao_aplicavel: 'Marcado como nao aplicavel nesta fase, pois a validacao depende de funcionalidade que permanece fora do escopo da Fase 2C.3.',
    },
  };
}

async function updateChecklistItem(id, payload, user, req) {
  return governancaService.updateHomologacaoItem(id, {
    ...payload,
    evidencias_json: {
      ...(payload.evidencias_json || {}),
      origem_validacao: 'fechamento_homologacao_2c3',
    },
  }, user, req);
}

function buildRelatorio(avaliacao, user = null) {
  const checksOk = avaliacao.diagnostico.checks.filter((item) => item.status === 'ok').length;
  const checksFalha = avaliacao.diagnostico.checks.filter((item) => item.status === 'falha').length;

  return {
    identificacao: {
      fase: '2C.3',
      modulo: 'Licenciamento Ambiental',
      plataforma: 'SIGMA',
      gerado_em: new Date().toISOString(),
      responsavel: getUserLabel(user),
    },
    resultado: {
      homologada: avaliacao.ready,
      ready_for_fase2d: avaliacao.ready,
      status: avaliacao.status,
      recomendacao: avaliacao.ready ? RECOMENDACAO_LIBERADA : 'Recomendação: Fase 2C.3 não homologada. Corrigir as pendências listadas antes de iniciar a Fase 2D.',
    },
    totais_checklist: avaliacao.totais,
    diagnostico_automatico: {
      status: avaliacao.diagnostico.status,
      total_checks: avaliacao.diagnostico.checks.length,
      checks_ok: checksOk,
      checks_falha: checksFalha,
      checks_pendentes: avaliacao.diagnostico.checks.filter((item) => item.status === 'pendente').length,
    },
    simulacoes_criticas: avaliacao.diagnostico.checks
      .filter((item) => ['simulacao_1806', 'bloqueio_2001_residuo_perigoso', 'limite_1903_extrapolado', 'bloqueio_1606_artesanal'].includes(item.codigo)),
    bloqueios_preservados: avaliacao.bloqueios_producao,
    divergencias_normativas: avaliacao.divergencias_pendentes,
    conclusao: avaliacao.ready
      ? `Recomendação: ${RECOMENDACAO_LIBERADA}`
      : 'Recomendação: Fase 2C.3 não homologada. Corrigir as pendências listadas antes de iniciar a Fase 2D.',
  };
}

async function getRelatorio(user, req) {
  const avaliacao = await avaliarProntidaoFase2D();
  const relatorio = buildRelatorio(avaliacao, user);

  await auditService.log({
    ...getActor(user),
    acao: 'licenciamento.homologacao_fechamento.relatorio',
    entidade: 'licenciamento_homologacao_liberacoes',
    dados: {
      ready: avaliacao.ready,
      status: avaliacao.status,
      total_itens: avaliacao.totais.total_itens,
      obrigatorios_pendentes: avaliacao.totais.obrigatorios_pendentes,
      obrigatorios_reprovados: avaliacao.totais.obrigatorios_reprovados,
    },
    req,
  });

  return relatorio;
}

function buildLiberacaoCodigo(now = new Date()) {
  const stamp = now.toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  return `HOMOLOGACAO_FASE_2C3_LIBERACAO_FASE_2D_${stamp}`;
}

function validateConfirmacao(confirmacao) {
  if (!confirmacao || confirmacao.explicita !== true) {
    const error = new Error('Confirmacao explicita obrigatoria para registrar liberacao tecnica da Fase 2D.');
    error.statusCode = 400;
    throw error;
  }

  const texto = String(confirmacao.texto || confirmacao.confirmacao_texto || '');
  if (!texto.includes('Fase 2D') || !texto.includes('DAM real')) {
    const error = new Error('Texto de confirmacao deve registrar Fase 2D e manutencao dos bloqueios de producao.');
    error.statusCode = 400;
    throw error;
  }
}

async function registrarLiberacaoFase2D(confirmacao, user, req) {
  const avaliacao = await avaliarProntidaoFase2D();

  if (!avaliacao.ready) {
    await auditService.log({
      ...getActor(user),
      acao: 'licenciamento.homologacao_fechamento.liberacao_bloqueada',
      entidade: 'licenciamento_homologacao_liberacoes',
      dados: {
        status: avaliacao.status,
        bloqueios: avaliacao.bloqueios,
        obrigatorios_pendentes: avaliacao.totais.obrigatorios_pendentes,
        obrigatorios_reprovados: avaliacao.totais.obrigatorios_reprovados,
      },
      req,
    });

    const error = new Error(RECOMENDACAO_BLOQUEADA);
    error.statusCode = 409;
    error.details = {
      ready: false,
      bloqueios: avaliacao.bloqueios,
      totais: avaliacao.totais,
    };
    throw error;
  }

  validateConfirmacao(confirmacao);

  const relatorio = buildRelatorio(avaliacao, user);
  const now = new Date();
  const liberacao = await repository.createLiberacao({
    codigo: buildLiberacaoCodigo(now),
    fase: '2C.3',
    status: 'liberada_tecnicamente',
    ready: true,
    total_itens: avaliacao.totais.total_itens,
    obrigatorios_pendentes: avaliacao.totais.obrigatorios_pendentes,
    obrigatorios_reprovados: avaliacao.totais.obrigatorios_reprovados,
    aprovados: avaliacao.totais.aprovados,
    aprovados_com_observacao: avaliacao.totais.aprovados_com_observacao,
    nao_aplicaveis: avaliacao.totais.nao_aplicaveis,
    diagnostico_status: avaliacao.diagnostico.status,
    bloqueios_producao_json: avaliacao.bloqueios_producao,
    divergencias_pendentes_json: avaliacao.divergencias_pendentes,
    relatorio_json: relatorio,
    confirmado_por_usuario_id: user?.id || null,
    confirmado_por_nome: getUserLabel(user),
    confirmado_em: now,
    observacao: confirmacao.observacao || confirmacao.texto || null,
  });

  await auditService.log({
    ...getActor(user),
    acao: 'licenciamento.homologacao_fechamento.liberacao_fase2d',
    entidade: 'licenciamento_homologacao_liberacoes',
    entidade_id: liberacao.id,
    dados: {
      codigo: liberacao.codigo,
      fase: liberacao.fase,
      status: liberacao.status,
      ready: liberacao.ready,
      bloqueios_producao: avaliacao.bloqueios_producao,
    },
    req,
  });

  return {
    liberacao,
    relatorio,
    mensagem: RECOMENDACAO_LIBERADA,
  };
}

module.exports = {
  RECOMENDACAO_LIBERADA,
  RECOMENDACAO_BLOQUEADA,
  avaliarProntidaoFase2D,
  getStatus,
  listPendencias,
  getRoteiro,
  updateChecklistItem,
  runDiagnosticoFinal,
  getRelatorio,
  registrarLiberacaoFase2D,
};
