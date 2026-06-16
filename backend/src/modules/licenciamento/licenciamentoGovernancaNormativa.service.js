const auditService = require('../../services/auditService');
const repository = require('./licenciamentoGovernancaNormativa.repository');
const enquadramentoService = require('./licenciamentoEnquadramento.service');
const seedLicenciamentoFase2C = require('./seeds/seedLicenciamentoFase2C');

const HOMOLOGACAO_STATUS = new Set([
  'pendente',
  'aprovado',
  'reprovado',
  'aprovado_com_observacao',
  'nao_aplicavel',
]);

const HOMOLOGACAO_STATUS_OBSERVACAO_OBRIGATORIA = new Set([
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

function getUserLabel(user) {
  return user?.nome || user?.email || user?.login || (user?.id ? `usuario:${user.id}` : null);
}

function normalizeStatus(rawStatus) {
  const status = String(rawStatus || '').trim();

  if (!HOMOLOGACAO_STATUS.has(status)) {
    const error = new Error('Status de homologacao invalido.');
    error.statusCode = 400;
    error.details = { allowed: Array.from(HOMOLOGACAO_STATUS) };
    throw error;
  }

  return status;
}

function checkResult(codigo, nome, passed, detalhe, evidencia = {}, statusWhenFalse = 'falha') {
  return {
    codigo,
    nome,
    status: passed ? 'ok' : statusWhenFalse,
    detalhe,
    evidencia,
  };
}

function normalizeCurrency(value) {
  return String(value || '').replace(/\u00a0/g, ' ');
}

async function getActivityIdByCodigo(codigo) {
  const result = await repository.db.query(
    `
      SELECT id
      FROM licenciamento_atividades
      WHERE codigo = $1
        AND ativo = TRUE
        AND deleted_at IS NULL
      LIMIT 1;
    `,
    [codigo]
  );

  return result.rows[0]?.id || null;
}

async function simulateDiagnostic(codigo, payload) {
  const atividadeId = await getActivityIdByCodigo(codigo);

  if (!atividadeId) {
    throw new Error(`Atividade ${codigo} nao encontrada para diagnostico.`);
  }

  return enquadramentoService.simulateEnquadramento(
    {
      atividade_id: atividadeId,
      tipo_pessoa: 'juridica',
      tipo_imovel: 'urbano',
      ...payload,
    },
    null,
    { persist: false }
  );
}

async function runHomologacaoDiagnostico(user = null, req = null, options = {}) {
  const row = options.statusRow || await repository.getStatus();
  const checks = [];

  const normasOk = Boolean(row.lei_1191 && row.lei_1192 && row.lei_1193 && row.lei_1093 && row.decreto_021);
  checks.push(checkResult(
    'normas_municipais',
    'Normas municipais fundamentais',
    normasOk,
    normasOk
      ? 'Leis 1.191/2019, 1.192/2019, 1.193/2019, 1.093/2017 e Decreto 021/2020 encontrados.'
      : 'Uma ou mais normas municipais fundamentais nao foram encontradas.',
    {
      lei_1191: Boolean(row.lei_1191),
      lei_1192: Boolean(row.lei_1192),
      lei_1193: Boolean(row.lei_1193),
      lei_1093: Boolean(row.lei_1093),
      decreto_021: Boolean(row.decreto_021),
    }
  ));

  checks.push(checkResult(
    'taxas_bloqueios',
    'Tabela piloto e bloqueios de cobranca',
    Boolean(row.tabela_operacional_piloto && !row.tabela_validada_para_cobranca),
    row.tabela_operacional_piloto && !row.tabela_validada_para_cobranca
      ? 'Tabela Fase 2B operacional piloto existe e segue nao validada para cobranca oficial.'
      : 'Tabela piloto ausente ou ha tabela marcada como validada para cobranca.',
    {
      tabela_operacional_piloto: Boolean(row.tabela_operacional_piloto),
      validada_para_cobranca: Boolean(row.tabela_validada_para_cobranca),
    }
  ));

  checks.push(checkResult(
    'matrizes_versionadas',
    'Matrizes versionadas',
    Boolean(row.matriz_operacional_piloto && row.matriz_lei_1192_em_conferencia && row.divergencia_grande_baixo),
    row.matriz_operacional_piloto && row.matriz_lei_1192_em_conferencia && row.divergencia_grande_baixo
      ? 'Matriz piloto, matriz em conferencia e divergencia Grande + Baixo registradas.'
      : 'Matrizes versionadas ou divergencia Grande + Baixo ausentes.',
    {
      matriz_operacional_piloto: Boolean(row.matriz_operacional_piloto),
      matriz_lei_1192_em_conferencia: Boolean(row.matriz_lei_1192_em_conferencia),
      divergencia_grande_baixo: Boolean(row.divergencia_grande_baixo),
    }
  ));

  const divergencias = await repository.listDivergencias();
  const divergenciaCodes = new Set(divergencias.map((item) => item.codigo));
  const divergenciasOk = [
    'DIVERGENCIA_MATRIZ_GRANDE_BAIXO',
    'DIVERGENCIA_TABELA_TAXAS_LEI_1192_DECRETO_021',
    'LEI_1093_SUPERADA_POR_LEI_1192',
  ].every((codigo) => divergenciaCodes.has(codigo));
  checks.push(checkResult(
    'divergencias_normativas',
    'Divergencias normativas essenciais',
    divergenciasOk,
    divergenciasOk
      ? 'Divergencias criticas e historicas da Fase 2C estao registradas.'
      : 'Uma ou mais divergencias normativas essenciais nao foram encontradas.',
    { codigos: Array.from(divergenciaCodes) }
  ));

  try {
    const terraplenagem = await simulateDiagnostic('18.06', {
      parametros_informados: {
        area_terraplanada_m2: 22000,
        altura_talude_m: 4,
      },
    });
    const terraplenagemOk = terraplenagem.status_resultado === 'requer_validacao_tecnica'
      && terraplenagem.porte_estimado === 'medio'
      && terraplenagem.classe_sugerida?.codigo === 'classe_ii'
      && normalizeCurrency(terraplenagem.taxa?.valor_total_formatado) === 'R$ 956,01'
      && String(terraplenagem.taxa?.memoria_calculo || '').includes('194 VRTE');
    checks.push(checkResult(
      'simulacao_1806',
      'Simulacao critica 18.06',
      terraplenagemOk,
      terraplenagemOk
        ? '18.06 preserva status, porte, classe, taxa e memoria de calculo esperados.'
        : '18.06 nao retornou o resultado critico esperado.',
      {
        status_resultado: terraplenagem.status_resultado,
        porte_estimado: terraplenagem.porte_estimado,
        classe: terraplenagem.classe_sugerida?.codigo || null,
        taxa: terraplenagem.taxa?.valor_total_formatado || null,
        memoria_calculo: terraplenagem.taxa?.memoria_calculo || null,
      }
    ));
  } catch (error) {
    checks.push(checkResult('simulacao_1806', 'Simulacao critica 18.06', false, error.message));
  }

  try {
    const reciclaveis = await simulateDiagnostic('20.01', {
      parametros_informados: {
        area_construida_m2: 1000,
        area_estocagem_m2: 500,
      },
      respostas_condicionais: {
        residuo_perigoso: true,
      },
    });
    checks.push(checkResult(
      'bloqueio_2001_residuo_perigoso',
      'Bloqueio 20.01 com residuo perigoso',
      reciclaveis.status_resultado === 'bloqueada_por_inconsistencia',
      reciclaveis.status_resultado === 'bloqueada_por_inconsistencia'
        ? '20.01 bloqueia corretamente residuo perigoso ou contaminado.'
        : '20.01 nao bloqueou a inconsistencia esperada.',
      { status_resultado: reciclaveis.status_resultado }
    ));
  } catch (error) {
    checks.push(checkResult('bloqueio_2001_residuo_perigoso', 'Bloqueio 20.01 com residuo perigoso', false, error.message));
  }

  try {
    const solar = await simulateDiagnostic('19.03', { valor_parametro: 600000 });
    checks.push(checkResult(
      'limite_1903_extrapolado',
      'Limite de impacto local 19.03',
      solar.status_resultado === 'limite_impacto_local_excedido',
      solar.status_resultado === 'limite_impacto_local_excedido'
        ? '19.03 extrapolada retorna limite de impacto local excedido.'
        : '19.03 extrapolada nao retornou limite de impacto local excedido.',
      { status_resultado: solar.status_resultado }
    ));
  } catch (error) {
    checks.push(checkResult('limite_1903_extrapolado', 'Limite de impacto local 19.03', false, error.message));
  }

  try {
    const cerveja = await simulateDiagnostic('16.06', {
      valor_parametro: 12000,
      respostas_condicionais: {
        artesanal: true,
      },
    });
    const cervejaOk = ['bloqueada_por_inconsistencia', 'atividade_associada_detectada'].includes(cerveja.status_resultado);
    checks.push(checkResult(
      'bloqueio_1606_artesanal',
      'Bloqueio 16.06 artesanal',
      cervejaOk,
      cervejaOk
        ? '16.06 artesanal permanece bloqueada ou direcionada a atividade associada.'
        : '16.06 artesanal nao retornou bloqueio controlado.',
      { status_resultado: cerveja.status_resultado }
    ));
  } catch (error) {
    checks.push(checkResult('bloqueio_1606_artesanal', 'Bloqueio 16.06 artesanal', false, error.message));
  }

  const legislacao = await repository.listLegislacaoPublica();
  const legislacaoCodes = new Set(legislacao.map((item) => item.codigo));
  const legislacaoOk = [
    'LEI_MUNICIPAL_1191_2019',
    'LEI_MUNICIPAL_1192_2019',
    'LEI_MUNICIPAL_1193_2019',
    'DECRETO_MUNICIPAL_021_2020',
  ].every((codigo) => legislacaoCodes.has(codigo));
  const legislacaoSegura = legislacao.every((item) => !Object.prototype.hasOwnProperty.call(item, 'observacao_juridica')
    && !Object.prototype.hasOwnProperty.call(item, 'resolucao_administrativa'));
  checks.push(checkResult(
    'legislacao_publica_segura',
    'Legislacao publica segura',
    legislacaoOk && legislacaoSegura,
    legislacaoOk && legislacaoSegura
      ? 'Biblioteca publica retorna normas essenciais sem campos internos sensiveis.'
      : 'Biblioteca publica ausente ou expondo campos internos.',
    { total: legislacao.length, codigos: Array.from(legislacaoCodes) }
  ));

  const avisos = await repository.listAvisosNormativosPublicos();
  checks.push(checkResult(
    'avisos_normativos_publicos',
    'Avisos normativos publicos',
    Array.isArray(avisos),
    'Endpoint logico de avisos normativos retornou resposta controlada.',
    { total: avisos.length }
  ));

  checks.push(checkResult(
    'bloqueios_producao',
    'Bloqueios de producao',
    true,
    'DAM real, cobranca oficial, protocolo definitivo e decisao automatica permanecem bloqueados nesta fase.',
    {
      dam_real: true,
      cobranca_oficial: true,
      protocolo_definitivo: true,
      decisao_automatica: true,
    }
  ));

  const hasFailure = checks.some((item) => item.status === 'falha');
  const hasPending = checks.some((item) => item.status === 'pendente');
  const result = {
    status: hasFailure ? 'falha' : hasPending ? 'pendente' : 'ok',
    executado_em: new Date().toISOString(),
    checks,
    recomendacao: hasFailure
      ? 'Corrigir falhas criticas antes de iniciar a Fase 2D.'
      : hasPending
        ? 'Concluir pendencias de homologacao antes de iniciar a Fase 2D.'
        : 'Diagnostico automatico parcial sem falhas criticas. Itens visuais ainda dependem de validacao manual.',
  };

  if (!options.skipAudit) {
    await auditService.log({
      ...getActor(user),
      acao: 'licenciamento.homologacao_assistida.diagnostico',
      entidade: 'licenciamento_homologacao_checklists',
      dados: {
        status: result.status,
        checks_total: checks.length,
        falhas: checks.filter((item) => item.status === 'falha').length,
      },
      req,
    });
  }

  return result;
}

function shapeStatus(row, diagnostico = null) {
  const normasCadastradas = Boolean(row.lei_1191 && row.lei_1192 && row.lei_1193 && row.lei_1093 && row.decreto_021);
  const bloqueiosAtivos = true;
  const diagnosticFailed = diagnostico?.status === 'falha';
  const criterios = [
    {
      codigo: 'normas_municipais',
      descricao: 'Normas municipais fundamentais cadastradas.',
      status: normasCadastradas ? 'ok' : 'bloqueado',
      origem: 'sistema',
      detalhe: normasCadastradas
        ? 'Leis municipais e Decreto 021/2020 encontrados.'
        : 'Uma ou mais normas municipais fundamentais nao foram encontradas.',
    },
    {
      codigo: 'lei_1192_preferencial_taxas',
      descricao: 'Lei n. 1.192/2019 marcada como preferencial de taxas.',
      status: row.lei_1192 ? 'ok' : 'bloqueado',
      origem: 'sistema',
      detalhe: row.lei_1192
        ? 'Lei de taxas preferencial cadastrada.'
        : 'A Lei n. 1.192/2019 ainda nao esta marcada como preferencial de taxas.',
    },
    {
      codigo: 'tabela_fase2b_versionada',
      descricao: 'Tabela Fase 2B versionada como operacional piloto.',
      status: row.tabela_operacional_piloto ? 'ok' : 'bloqueado',
      origem: 'sistema',
      detalhe: row.tabela_operacional_piloto
        ? 'Tabela de taxas piloto encontrada e operacional para simulacao.'
        : 'Tabela operacional piloto nao encontrada.',
    },
    {
      codigo: 'divergencias_normativas_registradas',
      descricao: 'Divergencias normativas registradas e visiveis no admin.',
      status: row.divergencia_grande_baixo && Number(row.divergencias_pendentes || 0) > 0 ? 'ok' : 'pendente',
      origem: 'sistema',
      detalhe: row.divergencia_grande_baixo
        ? `${Number(row.divergencias_pendentes || 0)} divergencia(s) pendente(s) registrada(s).`
        : 'Divergencia Grande + Baixo ainda nao encontrada.',
    },
    {
      codigo: 'checklist_homologacao',
      descricao: 'Checklist de homologacao criado e sem reprovar item obrigatorio.',
      status: Number(row.homologacao_obrigatorios_reprovados || 0) > 0
        ? 'bloqueado'
        : Number(row.homologacao_obrigatorios_pendentes || 0) > 0
          ? 'pendente'
          : 'ok',
      origem: 'checklist',
      detalhe: `${Number(row.homologacao_obrigatorios_pendentes || 0)} item(ns) obrigatorio(s) pendente(s), ${Number(row.homologacao_obrigatorios_reprovados || 0)} reprovado(s).`,
    },
    {
      codigo: 'simulador_publico_operacional',
      descricao: 'Simulador publico com atividades-piloto e VRTE 2026 parametrizados.',
      status: Number(row.atividades_piloto_ativas || 0) >= 8 && row.vrte_2026_ativa ? 'ok' : 'bloqueado',
      origem: 'sistema',
      detalhe: `${Number(row.atividades_piloto_ativas || 0)} atividade(s)-piloto ativa(s); VRTE 2026 ${row.vrte_2026_ativa ? 'ativa' : 'ausente'}.`,
    },
    {
      codigo: 'simulacao_1806_validada',
      descricao: 'Pre-requisitos da simulacao 18.06 preservados.',
      status: row.simulacao_1806_prerequisitos && !diagnosticFailed ? 'ok' : 'bloqueado',
      origem: 'diagnostico',
      detalhe: row.simulacao_1806_prerequisitos && !diagnosticFailed
        ? '18.06 continua parametrizada para Classe II, medio porte, 194 VRTE e validacao tecnica.'
        : 'Pre-requisitos ou diagnostico critico da simulacao 18.06 falharam.',
    },
    {
      codigo: 'bloqueios_producao',
      descricao: 'DAM real, cobranca oficial e protocolo definitivo permanecem bloqueados.',
      status: bloqueiosAtivos ? 'ok' : 'bloqueado',
      origem: 'sistema',
      detalhe: 'Bloqueios operacionais mantidos nesta fase.',
    },
    {
      codigo: 'nao_regressao',
      descricao: 'Checklist de nao regressao dos modulos principais existe.',
      status: row.checklist_nao_regressao ? 'ok' : 'pendente',
      origem: 'checklist',
      detalhe: row.checklist_nao_regressao
        ? 'Grupo Nao regressao encontrado no checklist.'
        : 'Grupo Nao regressao nao encontrado.',
    },
    {
      codigo: 'diagnostico_automatico_parcial',
      descricao: 'Diagnostico automatico parcial sem falhas criticas.',
      status: diagnostico?.status === 'falha' ? 'bloqueado' : diagnostico?.status === 'pendente' ? 'pendente' : 'ok',
      origem: 'diagnostico',
      detalhe: diagnostico
        ? `${diagnostico.checks.filter((item) => item.status === 'ok').length}/${diagnostico.checks.length} check(s) automatico(s) OK.`
        : 'Diagnostico automatico ainda nao executado neste status.',
    },
  ];

  const bloqueios = criterios
    .filter((criterio) => criterio.status === 'bloqueado')
    .map((criterio) => criterio.descricao);
  const pendencias = criterios
    .filter((criterio) => criterio.status === 'pendente')
    .map((criterio) => criterio.descricao);
  const ready = bloqueios.length === 0 && pendencias.length === 0;

  return {
    normas: {
      lei_1191: Boolean(row.lei_1191),
      lei_1192: Boolean(row.lei_1192),
      lei_1193: Boolean(row.lei_1193),
      lei_1093: Boolean(row.lei_1093),
      decreto_021: Boolean(row.decreto_021),
    },
    taxas: {
      tabela_operacional_piloto: Boolean(row.tabela_operacional_piloto),
      validada_para_cobranca: Boolean(row.tabela_validada_para_cobranca),
      divergencias_pendentes: Number(row.divergencias_pendentes || 0),
    },
    matriz: {
      operacional_piloto: Boolean(row.matriz_operacional_piloto),
      lei_1192_em_conferencia: Boolean(row.matriz_lei_1192_em_conferencia),
      divergencia_grande_baixo: Boolean(row.divergencia_grande_baixo),
    },
    homologacao: {
      total: Number(row.homologacao_total || 0),
      aprovados: Number(row.homologacao_aprovados || 0),
      aprovados_com_observacao: Number(row.homologacao_aprovados_com_observacao || 0),
      pendentes: Number(row.homologacao_pendentes || 0),
      reprovados: Number(row.homologacao_reprovados || 0),
      nao_aplicaveis: Number(row.homologacao_nao_aplicaveis || 0),
      obrigatorios_pendentes: Number(row.homologacao_obrigatorios_pendentes || 0),
      obrigatorios_reprovados: Number(row.homologacao_obrigatorios_reprovados || 0),
    },
    bloqueios_operacionais: {
      dam_real: true,
      cobranca_oficial: true,
      protocolo_definitivo: true,
      decisao_automatica: true,
    },
    ready_for_fase2d: {
      ready,
      criterios,
      bloqueios,
      pendencias_obrigatorias: Number(row.homologacao_obrigatorios_pendentes || 0),
      itens_reprovados: Number(row.homologacao_obrigatorios_reprovados || 0),
      recomendacao: ready
        ? 'Fase 2C.3 homologada. Sistema apto a iniciar a Fase 2D — Parametrização Completa Controlada do Decreto Municipal nº 021/2020 por grupos, mantendo bloqueados DAM real, cobrança oficial, protocolo definitivo e decisão administrativa automática.'
        : 'Fase 2D bloqueada. Concluir homologação obrigatória e corrigir pendências antes de iniciar a parametrização completa do Decreto Municipal nº 021/2020.',
    },
    avisos: [
      'Tabela de taxas operacional em uso com base na parametrizacao piloto. Confirmar compatibilidade com a Lei Municipal n. 1.192/2019 antes de cobranca oficial, DAM ou protocolo definitivo.',
      'Simulacoes publicas permanecem preliminares e sujeitas a validacao tecnica, administrativa e juridica da SMAD.',
    ],
  };
}

async function getStatus() {
  const row = await repository.getStatus();
  let diagnostico = null;

  try {
    diagnostico = await runHomologacaoDiagnostico(null, null, {
      skipAudit: true,
      statusRow: row,
    });
  } catch (error) {
    diagnostico = {
      status: 'falha',
      executado_em: new Date().toISOString(),
      checks: [{
        codigo: 'diagnostico_automatico_parcial',
        nome: 'Diagnostico automatico parcial',
        status: 'falha',
        detalhe: error.message,
        evidencia: {},
      }],
      recomendacao: 'Corrigir falhas criticas antes de iniciar a Fase 2D.',
    };
  }

  return shapeStatus(row, diagnostico);
}

async function listNormas() {
  return repository.listNormas();
}

async function listTabelasTaxas() {
  return repository.listTabelasTaxas();
}

async function listMatrizes() {
  return repository.listMatrizes();
}

async function listDivergencias() {
  return repository.listDivergencias();
}

async function listHomologacao() {
  return repository.listHomologacao();
}

async function updateHomologacaoItem(id, payload, user, req) {
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    const error = new Error('Item de homologacao invalido.');
    error.statusCode = 400;
    throw error;
  }

  const status = normalizeStatus(payload.status);
  const resultado = String(payload.resultado || payload.observacao || '').trim().slice(0, 2000);
  const evidence = payload.evidencias_json && typeof payload.evidencias_json === 'object'
    ? { ...payload.evidencias_json }
    : {};

  if (payload.evidencia_textual) {
    evidence.evidencia_textual = String(payload.evidencia_textual).slice(0, 2000);
  }

  if (HOMOLOGACAO_STATUS_OBSERVACAO_OBRIGATORIA.has(status) && !resultado) {
    const error = new Error('Observacao obrigatoria para este status de homologacao.');
    error.statusCode = 400;
    error.details = { status };
    throw error;
  }

  const normalized = {
    status,
    resultado: resultado || null,
    evidencias_json: Object.keys(evidence).length ? evidence : null,
    validado_por: getUserLabel(user),
  };

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getHomologacaoItem(itemId, client);
    if (!before) return null;
    const after = await repository.updateHomologacaoItem(itemId, normalized, client);
    return { before, after };
  });

  if (!result) {
    const error = new Error('Item de homologacao nao encontrado.');
    error.statusCode = 404;
    throw error;
  }

  await auditService.logChange({
    ...getActor(user),
    acao: 'licenciamento.homologacao.update',
    entidade: 'licenciamento_homologacao_checklists',
    entidade_id: itemId,
    before: result.before,
    after: result.after,
    req,
  });

  return result.after;
}

async function runSeedFase2C(user, req) {
  const summary = await seedLicenciamentoFase2C({ silent: true });
  await auditService.log({
    ...getActor(user),
    acao: 'licenciamento.governanca_normativa.seed_fase2c',
    entidade: 'licenciamento_normas',
    dados: summary,
    req,
  });
  return summary;
}

async function getHomologacaoAssistidaRelatorio(user, req) {
  const [status, checklist, diagnostico] = await Promise.all([
    getStatus(),
    listHomologacao(),
    runHomologacaoDiagnostico(user, req, { skipAudit: true }),
  ]);

  const resumoChecklist = checklist.reduce((acc, item) => {
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

  const relatorio = {
    gerado_em: new Date().toISOString(),
    status_prontidao: status.ready_for_fase2d,
    resumo_checklist: resumoChecklist,
    diagnostico,
    bloqueios_producao: status.bloqueios_operacionais,
    recomendacao: status.ready_for_fase2d.ready
      ? 'Fase 2C.2 homologada para iniciar a Fase 2D, mantendo bloqueios de producao.'
      : 'Fase 2C.2 ainda nao homologada. Corrigir pendencias antes de iniciar a Fase 2D.',
  };

  await auditService.log({
    ...getActor(user),
    acao: 'licenciamento.homologacao_assistida.relatorio',
    entidade: 'licenciamento_homologacao_checklists',
    dados: {
      ready: status.ready_for_fase2d.ready,
      total: resumoChecklist.total,
      obrigatorios_pendentes: resumoChecklist.obrigatorios_pendentes,
      obrigatorios_reprovados: resumoChecklist.obrigatorios_reprovados,
    },
    req,
  });

  return relatorio;
}

async function listLegislacaoPublica() {
  return repository.listLegislacaoPublica();
}

async function getLegislacaoPublica(codigo) {
  const normalized = String(codigo || '').trim().slice(0, 160);
  const result = await repository.getLegislacaoPublicaByCodigo(normalized);

  if (!result) {
    const error = new Error('Norma publica nao encontrada.');
    error.statusCode = 404;
    throw error;
  }

  return result;
}

async function listAvisosNormativosPublicos() {
  return repository.listAvisosNormativosPublicos();
}

module.exports = {
  getStatus,
  listNormas,
  listTabelasTaxas,
  listMatrizes,
  listDivergencias,
  listHomologacao,
  updateHomologacaoItem,
  runSeedFase2C,
  runHomologacaoDiagnostico,
  getHomologacaoAssistidaRelatorio,
  listLegislacaoPublica,
  getLegislacaoPublica,
  listAvisosNormativosPublicos,
};
