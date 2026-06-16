const db = require('../../config/db');
const { PERMISSIONS, hasPermission } = require('../../config/permissions');
const enquadramentoService = require('./licenciamentoEnquadramento.service');
const {
  FASE_REVISAO_NORMATIVA,
  getMatrizRevisaoNormativaGrupo21,
  buildResumoMatriz,
} = require('./licenciamentoGrupo21RevisaoNormativa2D5C4.matrix');
const {
  FASE_SEED_CONTROLADO,
  SEED_CODE: SEED_CODE_GRUPO21_2D5C5,
  CODIGOS_APTOS_SEED_CONTROLADO,
  CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO,
  getMatrizSeedControladoGrupo21,
  getBloqueiosCodigosParciaisGrupo21,
  validateMatrizSeedControladoGrupo21,
} = require('./licenciamentoGrupo21SeedControlado2D5C5.matrix');

const FASE = '2D.5C.2';
const VERSAO_FASE = '2D.5C.2';
const FASE_IMPORTACAO = '2D.5C.2-B';
const FASE_PREPARACAO_REAL = '2D.5C.2-C';
const FASE_COMPLEMENTAR = '2D.5C.3-A';
const FASE_BLOQUEIO_NORMATIVO = '2D.5C.3-B';
const GRUPO = 21;
const NOME_GRUPO = 'Obras e Estruturas Diversas';
const FONTE_NORMATIVA = 'Decreto Municipal n. 021/2020';
const FONTE_NORMATIVA_MODELO = 'Decreto Municipal nº 21/2020';
const METODO = 'bancada_conferencia_manual_assistida';
const MODO_IMPORTACAO = 'conferencia_manual';
const MODO_MODELO_OFICIAL_REAL = 'modelo_oficial_conferencia_real';
const EXPECTED_CODES = ['21.01', '21.02', '21.03', '21.04', '21.05', '21.06', '21.07', '21.08', '21.09', '21.10'];

const STATUS_CONTROLADOS = [
  'rascunho',
  'pendente_conferencia',
  'conferido_com_lacunas',
  'conferido_integralmente',
  'bloqueado',
  'apto_para_seed_futuro',
];

const OPERADORES_PERMITIDOS = [
  'menor_que',
  'menor_ou_igual',
  'maior_que',
  'maior_ou_igual',
  'igual',
  'entre',
  'ate',
  'acima_de',
  'nao_aplicavel',
  'texto_livre_conferido',
];

const DEPENDENCIAS_SETORIAIS_SUGERIDAS = [
  'SEMOB / viabilidade urbanistica',
  'fiscalizacao',
  'recursos hidricos',
  'APP',
  'supressao vegetal',
  'Defesa Civil',
  'orgao estadual',
  'orgao federal',
  'concessionaria ou permissionaria',
  'outro',
];

const DEPENDENCIAS_SETORIAIS_PERMITIDAS_IMPORTACAO = [
  'semob_viabilidade_urbanistica',
  'fiscalizacao',
  'recursos_hidricos',
  'app',
  'supressao_vegetal',
  'defesa_civil',
  'orgao_estadual',
  'orgao_federal',
  'concessionaria_permissionaria',
  'outro',
];

const MENSAGEM_BLOQUEIO_CONFERENCIA_INTEGRAL =
  'Nao e possivel marcar o codigo como conferido integralmente enquanto houver campos normativos obrigatorios sem preenchimento ou justificativa.';

const STATUS_COMPLEMENTACAO_PERMITIDOS = [
  'conferido_com_lacunas',
  'conferido_integralmente',
  'bloqueado',
  'pendente_conferencia',
];

const STATUS_GERAL_BLOQUEIO_NORMATIVO = 'bloqueado_por_insuficiencia_de_fonte_municipal';

const MOTIVO_BLOQUEIO_NORMATIVO =
  'Grupo 21 permanece bloqueado porque ha lacunas normativas remanescentes sem fonte municipal segura para tipo de ato/licenca, classe, documentos minimos, limites e dependencias setoriais.';

const FONTES_NECESSARIAS_BLOQUEIO_NORMATIVO = [
  'Planilha oficial do Decreto Municipal n. 021/2020 ou de seus anexos aplicaveis.',
  'Tabela do Anexo II-A em alta resolucao e com colunas legiveis.',
  'Copia textual oficial e validada do anexo aplicavel ao Grupo 21.',
  'Conferencia humana externa formal assinada por area tecnica competente.',
  'Documento administrativo de validacao da matriz normativa do Grupo 21.',
];

const ENCAMINHAMENTOS_BLOQUEIO_NORMATIVO = [
  'Abrir encaminhamento administrativo para solicitacao de fonte complementar oficial.',
  'Manter os 10 codigos na bancada manual auditavel com bloqueio para seed.',
  'Impedir parametrizacao operacional do Grupo 21 enquanto houver lacuna ativa.',
  'Retomar a conferencia somente apos recebimento e validacao de fonte municipal segura.',
];

const MINUTA_SOLICITACAO_FONTE_GRUPO21 =
  'Considerando as fases de conferencia normativa realizadas no ambito da parametrizacao do Grupo 21 - Obras e Estruturas Diversas, vinculado ao Decreto Municipal n. 21/2020;\n\n'
  + 'Considerando que os codigos 21.01 a 21.10 foram identificados e estruturados em bancada manual auditavel, porem permaneceram com lacunas relativas a faixas, classes, tipo de ato/licenca, limites de impacto local, documentos minimos e/ou demais elementos necessarios a parametrizacao operacional;\n\n'
  + 'Considerando que a conferencia complementar nao localizou fonte municipal suficientemente segura para saneamento das lacunas remanescentes;\n\n'
  + 'Solicita-se a disponibilizacao de fonte normativa complementar, preferencialmente planilha oficial, tabela em alta resolucao, copia textual validada do Anexo aplicavel ou manifestacao tecnica formal que permita a conferencia integral das atividades do Grupo 21, a fim de viabilizar futura parametrizacao controlada no SIGMA, sem prejuizo da seguranca juridica e da rastreabilidade administrativa.';

const FONTES_COMPLEMENTARES_GRUPO21 = [
  {
    id: 'decreto_021_2020_anexo_ii_a_pdf',
    titulo: 'Decreto Municipal n. 021/2020 - Anexo II-A',
    tipo: 'pdf_oficial_municipal',
    natureza: 'normativa_principal',
    escopo: 'Matriz de enquadramento visual do Grupo 21 nas paginas 69 e 70 do PDF oficial.',
    grauConfianca: 'alto_para_campos_visualizados',
    resultado: 'Confirma nome oficial, parametro principal, unidade e faixas ja preenchidas na matriz 2D.5C.3.',
    limitacao: 'Nao apresenta coluna municipal clara para tipo de ato/licenca, documentos minimos por atividade ou dependencias setoriais completas.',
    exigeValidacaoHumana: false,
  },
  {
    id: 'matriz_real_2d5c3',
    titulo: 'docs/matrizes/grupo21_matriz_conferencia_real_2d5c3.json',
    tipo: 'artefato_tecnico_interno',
    natureza: 'auxiliar',
    escopo: 'Matriz real importada na bancada manual auditavel na Fase 2D.5C.3.',
    grauConfianca: 'alto_para_estado_da_bancada',
    resultado: 'Registra lacunas ativas e confirma que nenhum codigo ficou apto para seed.',
    limitacao: 'Nao substitui fonte normativa municipal para completar lacunas.',
    exigeValidacaoHumana: true,
  },
  {
    id: 'relatorio_visual_2d5c1',
    titulo: 'docs/22_licenciamento_fase_2d5c1_conferencia_visual_grupo21.md',
    tipo: 'relatorio_tecnico_interno',
    natureza: 'auxiliar',
    escopo: 'Conferencia visual anterior do Grupo 21 no PDF oficial.',
    grauConfianca: 'alto_para_historico_de_conferencia',
    resultado: 'Aponta que o anexo visual nao trouxe tipo de ato/licenca nem checklist documental por codigo.',
    limitacao: 'Serve para rastreabilidade, nao para preencher campo normativo novo.',
    exigeValidacaoHumana: true,
  },
  {
    id: 'nucleo_normativo_2c',
    titulo: 'docs/09_licenciamento_fase_2c_nucleo_normativo.md',
    tipo: 'documentacao_tecnica_interna',
    natureza: 'auxiliar',
    escopo: 'Mapeamento geral de anexos, documentos e procedimentos do modulo Licenciamento.',
    grauConfianca: 'medio_para_contexto',
    resultado: 'Nao identificou correlacao municipal suficiente para documentos minimos especificos do Grupo 21.',
    limitacao: 'Nao deve ser usado como substituicao automatica do Decreto Municipal.',
    exigeValidacaoHumana: true,
  },
  {
    id: 'migracoes_seeds_tipos_licenca',
    titulo: 'Seeds e migracoes homologadas do modulo Licenciamento',
    tipo: 'codigo_homologado',
    natureza: 'referencia_operacional_auxiliar',
    escopo: 'Tipos genericos de licenca e classes ja existentes no sistema.',
    grauConfianca: 'baixo_para_preenchimento_normativo_do_grupo21',
    resultado: 'Existem tipos operacionais genericos, mas sem vinculacao municipal especifica para as linhas 21.01 a 21.10.',
    limitacao: 'Nao podem preencher tipo de ato, classe ou faixa do Grupo 21 por inferencia.',
    exigeValidacaoHumana: true,
  },
];

const MARCADORES_HOMOLOGACAO = [
  'teste',
  'homologacao',
  'homologação',
  'validacao',
  'validação',
  'navegador',
  'exemplo',
  'fase2d5c2b',
  'importacao',
  'importação',
  'rascunho controlado',
];

function serviceError(message, statusCode = 400, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function userId(user) {
  return Number.isInteger(Number(user?.id)) ? Number(user.id) : null;
}

function getField(source, camel, snake) {
  if (!source || typeof source !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(source, camel)) return source[camel];
  if (snake && Object.prototype.hasOwnProperty.call(source, snake)) return source[snake];
  return undefined;
}

function getEvidencePage(evidencia = {}) {
  return evidencia.paginaPdf || evidencia.pagina_pdf || evidencia.pagina || evidencia.page || '';
}

function getRangeOperator(faixa = {}) {
  return faixa.operador || faixa.operator || '';
}

function getRangeType(faixa = {}) {
  return faixa.tipoAto || faixa.tipo_ato || faixa.tipoLicenca || faixa.tipo_licenca || '';
}

function getRangeClass(faixa = {}) {
  return faixa.classe || faixa.classeLicenciamento || faixa.classe_licenciamento || '';
}

function getRangeText(faixa = {}) {
  return faixa.textoNormativo || faixa.texto_normativo || faixa.textoNormativoFaixa || faixa.texto_normativo_faixa || '';
}

function getRangeInitialValue(faixa = {}) {
  return faixa.valorInicial ?? faixa.valor_inicial ?? faixa.inicio ?? faixa.valorInicio ?? null;
}

function getRangeFinalValue(faixa = {}) {
  return faixa.valorFinal ?? faixa.valor_final ?? faixa.fim ?? faixa.valorFim ?? null;
}

function getRangeUnit(faixa = {}) {
  return faixa.unidade || faixa.unit || '';
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function sameUnit(left, right) {
  if (isBlank(left) || isBlank(right)) return true;
  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return value === 1;
}

function hasOwn(source, field) {
  return Boolean(source && typeof source === 'object' && Object.prototype.hasOwnProperty.call(source, field));
}

function hasExplicitClear(source, field) {
  const clearFields = asArray(source?.limparCampos || source?.limpar_campos);
  return clearFields.includes(field);
}

function isMeaningfulFaixa(faixa = {}) {
  if (!faixa || typeof faixa !== 'object') return false;
  return !isBlank(getRangeOperator(faixa))
    || !isBlank(getRangeInitialValue(faixa))
    || !isBlank(getRangeFinalValue(faixa))
    || !isBlank(getRangeText(faixa))
    || !isBlank(getRangeUnit(faixa))
    || !isBlank(faixa.porte)
    || !isBlank(getRangeClass(faixa))
    || !isBlank(getRangeType(faixa))
    || !isBlank(faixa.limiteImpactoLocal)
    || !isBlank(faixa.limite_impacto_local)
    || !isBlank(faixa.observacao)
    || !isBlank(faixa.justificativa);
}

function hasRangeClassOrTypeJustification(faixa = {}, dados = {}) {
  return !isBlank(faixa.justificativaClasseTipoAto)
    || !isBlank(faixa.justificativa_classe_tipo_ato)
    || !isBlank(faixa.justificativaAusenciaClasseTipoAto)
    || !isBlank(faixa.justificativa_ausencia_classe_tipo_ato)
    || !isBlank(dados.justificativaClasseTipoAto)
    || !isBlank(dados.justificativa_classe_tipo_ato)
    || !isBlank(dados.justificativaAusenciaClasseTipoAto)
    || !isBlank(dados.justificativa_ausencia_classe_tipo_ato);
}

function hasClassJustification(faixa = {}, dados = {}) {
  return hasRangeClassOrTypeJustification(faixa, dados)
    || !isBlank(faixa.justificativaClasse)
    || !isBlank(faixa.justificativa_classe)
    || !isBlank(faixa.justificativaAusenciaClasse)
    || !isBlank(faixa.justificativa_ausencia_classe)
    || !isBlank(dados.justificativaClasse)
    || !isBlank(dados.justificativa_classe)
    || !isBlank(dados.justificativaAusenciaClasse)
    || !isBlank(dados.justificativa_ausencia_classe);
}

function hasTypeActJustification(faixa = {}, dados = {}) {
  return hasRangeClassOrTypeJustification(faixa, dados)
    || !isBlank(faixa.justificativaTipoAto)
    || !isBlank(faixa.justificativa_tipo_ato)
    || !isBlank(faixa.justificativaAusenciaTipoAto)
    || !isBlank(faixa.justificativa_ausencia_tipo_ato)
    || !isBlank(dados.justificativaTipoAto)
    || !isBlank(dados.justificativa_tipo_ato)
    || !isBlank(dados.justificativaAusenciaTipoAto)
    || !isBlank(dados.justificativa_ausencia_tipo_ato);
}

function hasDocumentJustification(dados = {}) {
  return !isBlank(dados.justificativaDocumentosMinimos)
    || !isBlank(dados.justificativa_documentos_minimos)
    || !isBlank(dados.justificativaDocumentosMinimosAusentes)
    || !isBlank(dados.justificativa_documentos_minimos_ausentes)
    || !isBlank(dados.justificativaAusenciaDocumentosMinimos)
    || !isBlank(dados.justificativa_ausencia_documentos_minimos)
    || !isBlank(dados.justificativaChecklistDocumental)
    || !isBlank(dados.justificativa_checklist_documental);
}

function hasRangeNotApplicableJustification(dados = {}) {
  return !isBlank(dados.justificativaFaixasNaoAplicaveis)
    || !isBlank(dados.justificativa_faixas_nao_aplicaveis)
    || !isBlank(dados.justificativaFaixaNaoAplicavel)
    || !isBlank(dados.justificativa_faixa_nao_aplicavel)
    || !isBlank(dados.justificativaNaoAplicabilidadeFaixas)
    || !isBlank(dados.justificativa_nao_aplicabilidade_faixas);
}

function hasConferenceObservation(record) {
  const dados = asObject(record.dadosConferidos);
  const evidencia = asObject(record.evidenciaVisual);
  return !isBlank(record.observacaoInterna)
    || !isBlank(dados.observacaoConferencia)
    || !isBlank(dados.observacao_conferencia)
    || !isBlank(evidencia.observacao)
    || !isBlank(evidencia.observacaoConferencia)
    || !isBlank(evidencia.observacao_conferencia);
}

function hasActiveGap(record) {
  const dados = asObject(record.dadosConferidos);
  const active = dados.lacunasAtivas ?? dados.lacunas_ativas ?? dados.lacunaAtiva ?? dados.lacuna_ativa;

  if (Array.isArray(active)) return active.length > 0;
  if (typeof active === 'boolean') return active;
  if (typeof active === 'string') return active.trim() !== '' && active.trim().toLowerCase() !== 'nao';

  return false;
}

function mapRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    fase: row.fase,
    grupo: row.grupo_numero,
    nomeGrupo: row.grupo_nome,
    codigo: row.codigo_atividade,
    nomeAtividade: row.nome_atividade,
    parametroPrincipal: row.parametro_principal,
    unidade: row.unidade,
    dadosConferidos: asObject(row.dados_conferidos),
    faixasConferidas: asArray(row.faixas_conferidas),
    documentosConferidos: asArray(row.documentos_conferidos),
    dependenciasSetoriais: asArray(row.dependencias_setoriais),
    observacoesNormativas: asArray(row.observacoes_normativas),
    evidenciaVisual: asObject(row.evidencia_visual),
    statusConferencia: row.status_conferencia,
    statusConferenciaManual: row.status_conferencia,
    aptoParaSeed: row.apto_para_seed === true,
    aptoParaSeedFuturo: row.apto_para_seed === true,
    conferidoPor: row.conferido_por,
    conferidoEm: row.conferido_em,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    atualizadoPor: row.atualizado_por,
    atualizadoEm: row.atualizado_em,
    fonteNormativa: row.fonte_normativa,
    versaoFase: row.versao_fase,
    observacaoInterna: row.observacao_interna,
    removidoEm: row.removido_em || null,
    removidoPor: row.removido_por || null,
    motivoRemocao: row.motivo_remocao || '',
  };
}

function buildBaseDiagnostica(base) {
  return {
    faseOrigem: '2D.5C.1',
    codigo: base.codigo,
    nomeAtividade: base.nomeAtividade,
    parametroPrincipal: base.parametroPrincipal,
    unidade: base.unidade,
    statusConferencia: base.statusConferencia,
    aptoParaSeedFuturo: base.aptoParaSeedFuturo === true,
    faixasConferidas: asArray(base.faixasConferidas),
    documentosMinimos: asArray(base.documentosMinimos),
    dependenciasSetoriais: asArray(base.dependenciasSetoriais),
    observacoesNormativas: asArray(base.observacoesNormativas),
    lacunas: asArray(base.lacunas),
    evidenciaVisual: asObject(base.evidenciaVisual),
    fonteNormativa: base.fonte || base.fonte_normativa || FONTE_NORMATIVA,
    metodoConferencia: base.metodoConferencia || 'conferencia_visual_pdf',
  };
}

function mergeBaseAndManual(base, manual) {
  const baseDiagnostica = buildBaseDiagnostica(base);
  const manualData = mapRow(manual);
  const statusConferenciaManual = manualData?.statusConferencia || 'pendente_conferencia';
  const aptoParaSeedFuturo = manualData?.aptoParaSeedFuturo === true;

  return {
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    codigo: base.codigo,
    nomeAtividade: manualData?.nomeAtividade || base.nomeAtividade || '',
    parametroPrincipal: manualData?.parametroPrincipal || base.parametroPrincipal || '',
    unidade: manualData?.unidade || base.unidade || '',
    dadosConferidos: manualData?.dadosConferidos || {},
    faixasConferidas: manualData?.faixasConferidas || [],
    documentosConferidos: manualData?.documentosConferidos || [],
    dependenciasSetoriais: manualData?.dependenciasSetoriais || [],
    observacoesNormativas: manualData?.observacoesNormativas || [],
    evidenciaVisual: manualData?.evidenciaVisual || baseDiagnostica.evidenciaVisual || {},
    statusConferencia: statusConferenciaManual,
    statusConferenciaManual,
    aptoParaSeed: aptoParaSeedFuturo,
    aptoParaSeedFuturo,
    fonteNormativa: manualData?.fonteNormativa || FONTE_NORMATIVA,
    versaoFase: manualData?.versaoFase || VERSAO_FASE,
    observacaoInterna: manualData?.observacaoInterna || '',
    manualSalvo: Boolean(manualData),
    atualizadoEm: manualData?.atualizadoEm || null,
    conferidoEm: manualData?.conferidoEm || null,
    conferidoPor: manualData?.conferidoPor || null,
    baseDiagnostica,
  };
}

async function getBaseVisualStatus() {
  const status = await enquadramentoService.getParametrizacaoFase2D5C1Grupo21ConferenciaVisualStatus();
  const byCode = new Map((status.codigos || []).map((item) => [item.codigo, item]));

  return {
    status,
    byCode,
    codigos: EXPECTED_CODES.map((codigo) => {
      const item = byCode.get(codigo);
      if (!item) {
        throw serviceError(`Codigo ${codigo} nao encontrado na base diagnostica 2D.5C.1.`, 500);
      }
      return item;
    }),
  };
}

async function getManualRows(options = {}) {
  const includeRemoved = options.includeRemoved === true;
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_parametrizacao_conferencias
      WHERE fase = $1
        AND grupo_numero = $2
        AND ($3::boolean = true OR removido_em IS NULL)
      ORDER BY codigo_atividade;
    `,
    [FASE, GRUPO, includeRemoved]
  );
  return result.rows;
}

async function findManualRow(codigo, options = {}) {
  const includeRemoved = options.includeRemoved === true;
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_parametrizacao_conferencias
      WHERE fase = $1
        AND grupo_numero = $2
        AND codigo_atividade = $3
        AND ($4::boolean = true OR removido_em IS NULL);
    `,
    [FASE, GRUPO, codigo, includeRemoved]
  );
  return result.rows[0] || null;
}

function validateCodigo(codigo) {
  const normalized = String(codigo || '').trim();
  if (!EXPECTED_CODES.includes(normalized)) {
    throw serviceError('Codigo do Grupo 21 nao reconhecido para a bancada 2D.5C.2.', 404, {
      codigo: normalized,
      codigosPermitidos: EXPECTED_CODES,
    });
  }
  return normalized;
}

function normalizeRecordPayload(codigo, base, previous, payload = {}) {
  const previousData = previous ? mapRow(previous) : null;
  const dadosPayload = getField(payload, 'dadosConferidos', 'dados_conferidos');
  const evidenciaPayload = getField(payload, 'evidenciaVisual', 'evidencia_visual');
  const statusPayload = getField(payload, 'statusConferencia', 'status_conferencia');
  const aptoPayload = getField(payload, 'aptoParaSeed', 'apto_para_seed');
  const aptoFuturoPayload = getField(payload, 'aptoParaSeedFuturo', 'apto_para_seed_futuro');

  const statusConferencia = statusPayload || previousData?.statusConferencia || 'rascunho';
  if (!STATUS_CONTROLADOS.includes(statusConferencia)) {
    throw serviceError('Status de conferencia invalido para a bancada 2D.5C.2.', 400, {
      statusConferencia,
      statusPermitidos: STATUS_CONTROLADOS,
    });
  }

  const aptoExplicit = aptoPayload !== undefined || aptoFuturoPayload !== undefined;
  const aptoParaSeed = aptoExplicit
    ? Boolean(aptoPayload ?? aptoFuturoPayload)
    : Boolean(previousData?.aptoParaSeedFuturo && statusConferencia === 'conferido_integralmente');

  return {
    fase: FASE,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    codigo,
    nomeAtividade: getField(payload, 'nomeAtividade', 'nome_atividade') ?? previousData?.nomeAtividade ?? base.nomeAtividade ?? '',
    parametroPrincipal: getField(payload, 'parametroPrincipal', 'parametro_principal') ?? previousData?.parametroPrincipal ?? base.parametroPrincipal ?? '',
    unidade: getField(payload, 'unidade') ?? previousData?.unidade ?? base.unidade ?? '',
    dadosConferidos: {
      ...(previousData?.dadosConferidos || {}),
      ...(asObject(dadosPayload)),
    },
    faixasConferidas: getField(payload, 'faixasConferidas', 'faixas_conferidas') !== undefined
      ? asArray(getField(payload, 'faixasConferidas', 'faixas_conferidas'))
      : previousData?.faixasConferidas || [],
    documentosConferidos: getField(payload, 'documentosConferidos', 'documentos_conferidos') !== undefined
      ? asArray(getField(payload, 'documentosConferidos', 'documentos_conferidos'))
      : previousData?.documentosConferidos || [],
    dependenciasSetoriais: getField(payload, 'dependenciasSetoriais', 'dependencias_setoriais') !== undefined
      ? asArray(getField(payload, 'dependenciasSetoriais', 'dependencias_setoriais'))
      : previousData?.dependenciasSetoriais || [],
    observacoesNormativas: getField(payload, 'observacoesNormativas', 'observacoes_normativas') !== undefined
      ? asArray(getField(payload, 'observacoesNormativas', 'observacoes_normativas'))
      : previousData?.observacoesNormativas || [],
    evidenciaVisual: {
      ...(previousData?.evidenciaVisual || asObject(base.evidenciaVisual)),
      ...(asObject(evidenciaPayload)),
    },
    statusConferencia,
    aptoParaSeed,
    fonteNormativa: getField(payload, 'fonteNormativa', 'fonte_normativa') ?? previousData?.fonteNormativa ?? FONTE_NORMATIVA,
    observacaoInterna: getField(payload, 'observacaoInterna', 'observacao_interna') ?? previousData?.observacaoInterna ?? '',
  };
}

function validateIntegralRecord(record, user, options = {}) {
  const errors = [];
  const dados = asObject(record.dadosConferidos);
  const faixas = asArray(record.faixasConferidas);

  if (isBlank(record.nomeAtividade)) errors.push('nome_oficial_atividade');
  if (isBlank(record.parametroPrincipal)) errors.push('parametro_principal');
  if (isBlank(record.unidade)) errors.push('unidade');

  if (faixas.length === 0 && !hasRangeNotApplicableJustification(dados)) {
    errors.push('faixas_ou_justificativa_nao_aplicabilidade');
  }

  for (const faixa of faixas) {
    const operador = getRangeOperator(faixa);
    if (!OPERADORES_PERMITIDOS.includes(operador)) {
      errors.push(`faixa_${faixa.ordem || '?'}_operador_valido`);
    }

    if (isBlank(getRangeClass(faixa)) && isBlank(getRangeType(faixa)) && !hasRangeClassOrTypeJustification(faixa, dados)) {
      errors.push(`faixa_${faixa.ordem || '?'}_classe_tipo_ato_ou_justificativa`);
    }
  }

  if (isBlank(getEvidencePage(record.evidenciaVisual))) {
    errors.push('evidencia_visual_pagina_pdf');
  }

  if (!hasConferenceObservation(record)) {
    errors.push('observacao_conferencia');
  }

  if (isBlank(record.fonteNormativa)) {
    errors.push('fonte_normativa');
  }

  if (record.aptoParaSeed === true) {
    if (record.statusConferencia !== 'conferido_integralmente') {
      errors.push('apto_seed_exige_status_conferido_integralmente');
    }

    if (!hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VALIDATE)) {
      errors.push('usuario_sem_permissao_para_apto_seed');
    }

    if (hasActiveGap(record)) {
      errors.push('lacuna_ativa');
    }
  }

  if (errors.length > 0 && options.throwOnError !== false) {
    throw serviceError(MENSAGEM_BLOQUEIO_CONFERENCIA_INTEGRAL, 400, {
      camposPendentes: [...new Set(errors)],
    });
  }

  return errors;
}

async function upsertRecord(client, record, previous, user, options = {}) {
  const actorId = userId(user);
  const keepPreviousConferencia = record.statusConferencia === 'conferido_integralmente';
  const conferidoPor = options.markConferido ? actorId : (keepPreviousConferencia ? previous?.conferido_por || null : null);
  const conferidoEm = options.markConferido ? new Date() : (keepPreviousConferencia ? previous?.conferido_em || null : null);

  const query = `
    INSERT INTO licenciamento_parametrizacao_conferencias (
      fase,
      grupo_numero,
      grupo_nome,
      codigo_atividade,
      nome_atividade,
      parametro_principal,
      unidade,
      dados_conferidos,
      faixas_conferidas,
      documentos_conferidos,
      dependencias_setoriais,
      observacoes_normativas,
      evidencia_visual,
      status_conferencia,
      apto_para_seed,
      conferido_por,
      conferido_em,
      criado_por,
      atualizado_por,
      fonte_normativa,
      versao_fase,
      observacao_interna
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
      $14, $15, $16, $21, $17, $18, $19, $20, $22
    )
    ON CONFLICT (fase, grupo_numero, codigo_atividade) DO UPDATE SET
      grupo_nome = EXCLUDED.grupo_nome,
      nome_atividade = EXCLUDED.nome_atividade,
      parametro_principal = EXCLUDED.parametro_principal,
      unidade = EXCLUDED.unidade,
      dados_conferidos = EXCLUDED.dados_conferidos,
      faixas_conferidas = EXCLUDED.faixas_conferidas,
      documentos_conferidos = EXCLUDED.documentos_conferidos,
      dependencias_setoriais = EXCLUDED.dependencias_setoriais,
      observacoes_normativas = EXCLUDED.observacoes_normativas,
      evidencia_visual = EXCLUDED.evidencia_visual,
      status_conferencia = EXCLUDED.status_conferencia,
      apto_para_seed = EXCLUDED.apto_para_seed,
      conferido_por = EXCLUDED.conferido_por,
      conferido_em = EXCLUDED.conferido_em,
      atualizado_por = EXCLUDED.atualizado_por,
      atualizado_em = CURRENT_TIMESTAMP,
      fonte_normativa = EXCLUDED.fonte_normativa,
      versao_fase = EXCLUDED.versao_fase,
      observacao_interna = EXCLUDED.observacao_interna,
      removido_em = NULL,
      removido_por = NULL,
      motivo_remocao = NULL
    RETURNING *;
  `;

  const values = [
    record.fase,
    record.grupo,
    record.nomeGrupo,
    record.codigo,
    record.nomeAtividade,
    record.parametroPrincipal,
    record.unidade,
    JSON.stringify(record.dadosConferidos || {}),
    JSON.stringify(record.faixasConferidas || []),
    JSON.stringify(record.documentosConferidos || []),
    JSON.stringify(record.dependenciasSetoriais || []),
    JSON.stringify(record.observacoesNormativas || []),
    JSON.stringify(record.evidenciaVisual || {}),
    record.statusConferencia,
    record.aptoParaSeed === true,
    conferidoPor,
    previous?.criado_por || actorId,
    actorId,
    record.fonteNormativa,
    VERSAO_FASE,
    conferidoEm,
    record.observacaoInterna || null,
  ];

  const result = await client.query(query, values);
  return result.rows[0];
}

async function insertHistory(client, row, previous, user, action, observacao, metadados = {}) {
  await client.query(
    `
      INSERT INTO licenciamento_parametrizacao_conferencias_historico (
        conferencia_id,
        acao,
        status_anterior,
        status_novo,
        usuario_id,
        observacao,
        metadados
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb);
    `,
    [
      row.id,
      action,
      previous?.status_conferencia || null,
      row.status_conferencia,
      userId(user),
      observacao || null,
      JSON.stringify(metadados || {}),
    ]
  );
}

async function getBancadaGrupo21(user) {
  const [base, manualRows] = await Promise.all([getBaseVisualStatus(), getManualRows()]);
  const manualByCode = new Map(manualRows.map((row) => [row.codigo_atividade, row]));
  const codigos = base.codigos.map((item) => mergeBaseAndManual(item, manualByCode.get(item.codigo)));

  const codigosConferidos = codigos.filter((item) => item.statusConferenciaManual === 'conferido_integralmente').length;
  const codigosRascunho = codigos.filter((item) => item.statusConferenciaManual === 'rascunho').length;
  const codigosComLacuna = codigos.filter((item) => item.statusConferenciaManual === 'conferido_com_lacunas').length;
  const codigosAptosSeedFuturo = codigos.filter((item) => item.aptoParaSeedFuturo === true).length;
  const codigosBloqueados = codigos.filter((item) => item.aptoParaSeedFuturo !== true).length;

  return {
    fase: FASE,
    titulo: 'Fase 2D.5C.2 - Bancada de Conferencia Manual Assistida do Grupo 21',
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    fonte: FONTE_NORMATIVA,
    metodo: METODO,
    totalCodigos: EXPECTED_CODES.length,
    codigosRascunho,
    codigosConferidos,
    codigosComLacuna,
    codigosBloqueados,
    codigosAptosSeedFuturo,
    statusGeral: codigosConferidos === EXPECTED_CODES.length
      ? 'pronto_para_seed_controlado'
      : 'bancada_em_conferencia_manual',
    aptoParaSeed: codigosAptosSeedFuturo === EXPECTED_CODES.length,
    seed_operacional_criado: false,
    atividades_incluidas: [],
    operadoresPermitidos: OPERADORES_PERMITIDOS,
    statusControlados: STATUS_CONTROLADOS,
    dependenciasSetoriaisSugeridas: DEPENDENCIAS_SETORIAIS_SUGERIDAS,
    permissoes: {
      visualizar: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
      editar: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_UPDATE),
      validar: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VALIDATE),
      auditar: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_AUDIT),
    },
    alertas: [
      'Esta bancada nao parametriza atividade no motor operacional.',
      'Os dados somente prepararao futura seed controlada.',
      'Nao constitui ato autorizativo.',
    ],
    codigos,
    lacunas: codigos.flatMap((item) => asArray(item.baseDiagnostica.lacunas).map((lacuna) => ({
      codigo: item.codigo,
      atividade: item.nomeAtividade,
      status: item.statusConferenciaManual,
      ...lacuna,
    }))),
    recomendacaoProximaFase: codigosConferidos > 0
      ? 'Fase 2D.5C.3 - Seed controlado apenas para codigos integralmente validados e aptos, mantendo os demais bloqueados.'
      : 'Manter saneamento na bancada 2D.5C.2 ate que ao menos um codigo esteja integralmente conferido por servidor autorizado.',
  };
}

async function getBancadaCodigo(codigo) {
  const normalized = validateCodigo(codigo);
  const [base, manual] = await Promise.all([getBaseVisualStatus(), findManualRow(normalized)]);
  return mergeBaseAndManual(base.byCode.get(normalized), manual);
}

async function salvarConferenciaCodigo(codigo, payload, user) {
  const normalized = validateCodigo(codigo);
  const base = await getBaseVisualStatus();
  const previous = await findManualRow(normalized);
  const record = normalizeRecordPayload(normalized, base.byCode.get(normalized), previous, payload);

  if (record.aptoParaSeed === true && record.statusConferencia !== 'conferido_integralmente') {
    throw serviceError('apto_para_seed_futuro so pode ser verdadeiro quando status_conferencia for conferido_integralmente.', 400);
  }

  if (record.statusConferencia === 'conferido_integralmente' || record.aptoParaSeed === true) {
    validateIntegralRecord(record, user);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const row = await upsertRecord(client, record, previous, user, {
      markConferido: record.statusConferencia === 'conferido_integralmente',
    });
    await insertHistory(
      client,
      row,
      previous,
      user,
      previous ? 'atualizar_conferencia' : 'salvar_rascunho',
      record.observacaoInterna || null,
      {
        fase: FASE,
        codigo: normalized,
        camposRecebidos: Object.keys(payload || {}),
        seedOperacionalCriado: false,
      }
    );
    await client.query('COMMIT');
    return mergeBaseAndManual(base.byCode.get(normalized), row);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function validarConferenciaCodigo(codigo, payload = {}, user) {
  const normalized = validateCodigo(codigo);
  const base = await getBaseVisualStatus();
  const previous = await findManualRow(normalized);
  const mergedPayload = {
    ...(payload || {}),
    statusConferencia: 'conferido_integralmente',
  };
  const record = normalizeRecordPayload(normalized, base.byCode.get(normalized), previous, mergedPayload);
  record.statusConferencia = 'conferido_integralmente';

  validateIntegralRecord(record, user);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const row = await upsertRecord(client, record, previous, user, { markConferido: true });
    await insertHistory(
      client,
      row,
      previous,
      user,
      'validar_conferencia',
      record.observacaoInterna || asObject(record.dadosConferidos).observacaoConferencia || null,
      {
        fase: FASE,
        codigo: normalized,
        aptoParaSeedFuturo: record.aptoParaSeed === true,
        seedOperacionalCriado: false,
      }
    );
    await client.query('COMMIT');
    return mergeBaseAndManual(base.byCode.get(normalized), row);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getHistoricoCodigo(codigo) {
  const normalized = validateCodigo(codigo);
  const row = await findManualRow(normalized, { includeRemoved: true });
  if (!row) {
    return {
      fase: FASE,
      grupo: GRUPO,
      nomeGrupo: NOME_GRUPO,
      codigo: normalized,
      historico: [],
    };
  }

  const result = await db.query(
    `
      SELECT
        h.id,
        h.acao,
        h.status_anterior,
        h.status_novo,
        h.usuario_id,
        u.nome AS usuario_nome,
        h.observacao,
        h.metadados,
        h.criado_em
      FROM licenciamento_parametrizacao_conferencias_historico h
      LEFT JOIN usuarios_internos u ON u.id = h.usuario_id
      WHERE h.conferencia_id = $1
      ORDER BY h.criado_em DESC, h.id DESC;
    `,
    [row.id]
  );

  return {
    fase: FASE,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    codigo: normalized,
    historico: result.rows.map((item) => ({
      id: item.id,
      acao: item.acao,
      statusAnterior: item.status_anterior,
      statusNovo: item.status_novo,
      usuarioId: item.usuario_id,
      usuarioNome: item.usuario_nome,
      observacao: item.observacao,
      metadados: asObject(item.metadados),
      criadoEm: item.criado_em,
    })),
  };
}

function buildModeloFaixa(unidade = '') {
  return {
    ordem: 1,
    operador: '',
    valorInicial: null,
    valorFinal: null,
    unidade: unidade || '',
    textoNormativo: '',
    porte: '',
    classe: '',
    tipoAto: '',
    limiteImpactoLocal: '',
    observacao: '',
  };
}

function buildModeloCodigo(base = {}) {
  const evidencia = asObject(base.evidenciaVisual);

  return {
    codigo: base.codigo,
    nomeAtividade: '',
    parametroPrincipal: base.parametroPrincipal || '',
    unidade: base.unidade || '',
    descricaoNormativa: '',
    faixasConferidas: [buildModeloFaixa(base.unidade || '')],
    documentosMinimos: [],
    dependenciasSetoriais: [],
    observacoesNormativas: [],
    evidenciaVisual: {
      paginaPdf: evidencia.paginaPdf || evidencia.pagina_pdf || '',
      trechoTabela: evidencia.trechoTabela || evidencia.trecho_tabela || '',
      observacao: evidencia.observacao || '',
    },
    observacaoInterna: '',
    statusPretendido: 'rascunho',
    aptoParaSeedPretendido: false,
  };
}

async function getModeloJsonImportacaoGrupo21() {
  const base = await getBaseVisualStatus();

  return {
    fase: FASE_IMPORTACAO,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    fonteNormativa: FONTE_NORMATIVA_MODELO,
    modo: MODO_IMPORTACAO,
    operadoresPermitidos: OPERADORES_PERMITIDOS,
    dependenciasSetoriaisPermitidas: DEPENDENCIAS_SETORIAIS_PERMITIDAS_IMPORTACAO,
    statusPermitidos: STATUS_CONTROLADOS,
    instrucoes: [
      'Preencha somente dados conferidos no PDF oficial.',
      'Campos duvidosos devem permanecer vazios ou justificados.',
      'A importacao nao executa seed nem altera tabelas operacionais.',
      'Use confirmarSobrescritaConferido: true apenas para substituir registro ja conferido integralmente.',
    ],
    codigos: base.codigos.map(buildModeloCodigo),
  };
}

async function getModeloOficialRealGrupo21() {
  const base = await getBaseVisualStatus();

  return {
    fase: FASE_PREPARACAO_REAL,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    fonteNormativa: FONTE_NORMATIVA_MODELO,
    modo: MODO_MODELO_OFICIAL_REAL,
    naoExecutaSeed: true,
    tabelaOperacionalAlterada: false,
    operadoresPermitidos: OPERADORES_PERMITIDOS,
    dependenciasSetoriaisPermitidas: DEPENDENCIAS_SETORIAIS_PERMITIDAS_IMPORTACAO,
    statusPermitidos: STATUS_CONTROLADOS,
    camposObrigatoriosConferencia: [
      'nomeAtividade',
      'parametroPrincipal',
      'unidade',
      'fonteNormativa',
      'evidenciaVisual.paginaPdf',
      'observacaoInterna ou observacaoConferencia',
      'faixasConferidas ou justificativaFaixasNaoAplicaveis',
      'classe/tipoAto ou justificativaClasseTipoAto',
    ],
    instrucoes: [
      'Este modelo oficial prepara a conferencia humana real do Grupo 21.',
      'Preencha somente dados confirmados no Decreto Municipal n. 021/2020.',
      'Campos duvidosos devem permanecer vazios ou conter justificativa expressa.',
      'O modelo nao executa seed, nao cria atividade operacional e nao altera taxa, VRTE, classe global, eDocs ou ato autorizativo.',
      'Apos preenchimento, use a importacao controlada 2D.5C.2-B para validar e aplicar somente na bancada manual.',
    ],
    codigos: base.codigos.map(buildModeloCodigo),
  };
}

function normalizeMarkerText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stringifyForMarker(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function getHistoricoRowsForConferencias(rows = []) {
  const ids = rows.map((row) => row.id).filter(Boolean);
  const grouped = new Map(ids.map((id) => [id, []]));
  if (ids.length === 0) return grouped;

  const result = await db.query(
    `
      SELECT
        id,
        conferencia_id,
        acao,
        status_anterior,
        status_novo,
        usuario_id,
        observacao,
        metadados,
        criado_em
      FROM licenciamento_parametrizacao_conferencias_historico
      WHERE conferencia_id = ANY($1::int[])
      ORDER BY criado_em DESC, id DESC;
    `,
    [ids]
  );

  for (const row of result.rows) {
    const items = grouped.get(row.conferencia_id) || [];
    items.push(row);
    grouped.set(row.conferencia_id, items);
  }

  return grouped;
}

function hasEvidenciaVisualCompleta(row) {
  const evidencia = asObject(row.evidencia_visual);
  const paginaPdf = getEvidencePage(evidencia);
  const trechoTabela = evidencia.trechoTabela || evidencia.trecho_tabela || '';
  return !isBlank(paginaPdf) && !isBlank(trechoTabela);
}

function mapPreparationRecord(row, historico = [], criterios = []) {
  const mapped = mapRow(row);

  return {
    id: mapped.id,
    codigo: mapped.codigo,
    nomeAtividade: mapped.nomeAtividade,
    statusConferencia: mapped.statusConferencia,
    aptoParaSeed: mapped.aptoParaSeed === true,
    criadoEm: mapped.criadoEm,
    atualizadoEm: mapped.atualizadoEm,
    fonteNormativa: mapped.fonteNormativa,
    observacaoInterna: mapped.observacaoInterna,
    evidenciaVisual: mapped.evidenciaVisual,
    criterios,
    historicoRecente: historico.slice(0, 3).map((item) => ({
      id: item.id,
      acao: item.acao,
      observacao: item.observacao,
      metadados: asObject(item.metadados),
      criadoEm: item.criado_em,
    })),
  };
}

function evaluatePossivelRegistroTeste(row, historico = [], totalRegistrosAtivos = 0) {
  const criterios = [];
  const status = row.status_conferencia;
  const aptoParaSeed = row.apto_para_seed === true;
  const text = normalizeMarkerText([
    row.observacao_interna,
    stringifyForMarker(row.dados_conferidos),
    stringifyForMarker(row.evidencia_visual),
    ...historico.map((item) => item.observacao),
    ...historico.map((item) => stringifyForMarker(item.metadados)),
    ...historico.map((item) => item.acao),
  ].join(' '));

  const markerDetectado = MARCADORES_HOMOLOGACAO.some((marker) => text.includes(normalizeMarkerText(marker)));
  const historicoImportacaoControlada = historico.some((item) => (
    item.acao === 'importacao_controlada_criar'
    || item.acao === 'importacao_controlada_atualizar'
    || asObject(item.metadados).faseImportacao === FASE_IMPORTACAO
  ));
  const criadoEm = row.criado_em ? new Date(row.criado_em).getTime() : 0;
  const atualizadoEm = row.atualizado_em ? new Date(row.atualizado_em).getTime() : 0;
  const recente = Math.max(criadoEm, atualizadoEm) > 0
    && Date.now() - Math.max(criadoEm, atualizadoEm) <= 1000 * 60 * 60 * 24 * 14;
  const statusRascunho = ['rascunho', 'pendente_conferencia'].includes(status);
  const evidenciaIncompleta = !hasEvidenciaVisualCompleta(row);
  const isolado = totalRegistrosAtivos === 1;

  if (recente) criterios.push('registro_criado_ou_atualizado_recentemente');
  if (statusRascunho) criterios.push('status_rascunho_ou_pendente');
  if (!aptoParaSeed) criterios.push('apto_para_seed_false');
  if (markerDetectado) criterios.push('observacao_ou_historico_indica_teste_homologacao_validacao');
  if (historicoImportacaoControlada) criterios.push('historico_de_importacao_controlada_2d5c2b');
  if (isolado) criterios.push('codigo_isolado_na_bancada');
  if (evidenciaIncompleta) criterios.push('evidencia_visual_incompleta');
  if (status !== 'conferido_integralmente') criterios.push('nao_conferido_integralmente');

  const possivelTeste = statusRascunho
    && !aptoParaSeed
    && status !== 'conferido_integralmente'
    && (
      markerDetectado
      || historicoImportacaoControlada
      || (isolado && evidenciaIncompleta)
    );

  return {
    possivelTeste,
    criterios,
    registro: mapPreparationRecord(row, historico, criterios),
  };
}

function buildPreparationStatus(registrosBancada, possiveisTestes, conferidosIntegralmente, atividadesOperacionaisGrupo21) {
  if (atividadesOperacionaisGrupo21 > 0) {
    return {
      statusGeral: 'alerta_tabela_operacional_com_grupo_21',
      recomendacao: 'Verificar a origem dos registros operacionais 21.% antes de qualquer nova etapa. A Fase 2D.5C.2-C nao cria seed.',
    };
  }

  if (possiveisTestes > 0) {
    return {
      statusGeral: 'homologacao_pendente_limpeza',
      recomendacao: 'Revisar os possiveis rascunhos artificiais e executar limpeza controlada apenas quando houver certeza institucional.',
    };
  }

  if (registrosBancada === 0) {
    return {
      statusGeral: 'bancada_pronta_para_matriz_real',
      recomendacao: 'Exportar o modelo oficial 2D.5C.2-C e iniciar o preenchimento humano definitivo do Grupo 21.',
    };
  }

  if (conferidosIntegralmente > 0) {
    return {
      statusGeral: 'bancada_com_registros_reais_preservados',
      recomendacao: 'Preservar os registros reais e prosseguir apenas com conferencia humana dos codigos pendentes.',
    };
  }

  return {
    statusGeral: 'bancada_com_rascunhos_reais_ou_pendentes',
    recomendacao: 'Revisar manualmente os registros existentes antes de limpar qualquer dado.',
  };
}

async function getPreparacaoMatrizRealGrupo21() {
  const [base, manualRows, atividadesOperacionaisGrupo21] = await Promise.all([
    getBaseVisualStatus(),
    getManualRows(),
    countOperationalGroup21Activities(),
  ]);
  const historicoPorId = await getHistoricoRowsForConferencias(manualRows);
  const avaliacoes = manualRows.map((row) => (
    evaluatePossivelRegistroTeste(row, historicoPorId.get(row.id) || [], manualRows.length)
  ));
  const possiveisRegistrosTeste = avaliacoes
    .filter((item) => item.possivelTeste)
    .map((item) => item.registro);
  const registrosReaisPreservados = avaliacoes
    .filter((item) => !item.possivelTeste)
    .map((item) => item.registro);
  const conferidosIntegralmente = manualRows.filter((row) => row.status_conferencia === 'conferido_integralmente').length;
  const status = buildPreparationStatus(
    manualRows.length,
    possiveisRegistrosTeste.length,
    conferidosIntegralmente,
    atividadesOperacionaisGrupo21
  );

  return {
    fase: FASE_PREPARACAO_REAL,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    codigosEsperados: EXPECTED_CODES,
    totalCodigos: EXPECTED_CODES.length,
    registrosBancada: manualRows.length,
    rascunhos: manualRows.filter((row) => row.status_conferencia === 'rascunho').length,
    conferidosComLacunas: manualRows.filter((row) => row.status_conferencia === 'conferido_com_lacunas').length,
    conferidosIntegralmente,
    aptosParaSeed: manualRows.filter((row) => row.apto_para_seed === true).length,
    possiveisRegistrosTeste,
    registrosReaisPreservados,
    tabelaOperacionalAfetada: false,
    atividadesOperacionaisGrupo21,
    statusGeral: status.statusGeral,
    recomendacao: status.recomendacao,
    modeloOficialDisponivel: true,
    baseDiagnostica: base.codigos.map((item) => ({
      codigo: item.codigo,
      parametroPrincipal: item.parametroPrincipal || '',
      unidade: item.unidade || '',
      evidenciaVisual: asObject(item.evidenciaVisual),
    })),
  };
}

function normalizeCodigosLimpeza(codigos) {
  return [...new Set(asArray(codigos).map((codigo) => normalizeText(codigo)).filter(Boolean))];
}

async function limparRascunhosHomologacaoGrupo21(payload = {}, user) {
  const codigos = normalizeCodigosLimpeza(payload.codigos);
  const justificativa = normalizeText(payload.justificativa);

  if (payload.confirmarLimpezaHomologacao !== true) {
    throw serviceError('Limpeza bloqueada: confirmarLimpezaHomologacao deve ser true.', 400, {
      tipo: 'confirmacao_obrigatoria',
    });
  }

  if (isBlank(justificativa)) {
    throw serviceError('Limpeza bloqueada: justificativa e obrigatoria.', 400, {
      tipo: 'justificativa_obrigatoria',
    });
  }

  if (codigos.length === 0) {
    throw serviceError('Limpeza bloqueada: informe ao menos um codigo do Grupo 21.', 400, {
      tipo: 'codigos_obrigatorios',
    });
  }

  const beforeOperationalCount = await countOperationalGroup21Activities();
  const manualRows = await getManualRows();
  const historicoPorId = await getHistoricoRowsForConferencias(manualRows);
  const activeByCode = new Map(manualRows.map((row) => [row.codigo_atividade, row]));
  const avaliacoesByCode = new Map(manualRows.map((row) => [
    row.codigo_atividade,
    evaluatePossivelRegistroTeste(row, historicoPorId.get(row.id) || [], manualRows.length),
  ]));
  const bloqueios = [];

  for (const codigo of codigos) {
    if (!EXPECTED_CODES.includes(codigo)) {
      bloqueios.push({ codigo, tipo: 'codigo_fora_do_grupo_21', mensagem: 'Codigo deve estar entre 21.01 e 21.10.' });
      continue;
    }

    const row = activeByCode.get(codigo);
    if (!row) {
      bloqueios.push({ codigo, tipo: 'registro_nao_encontrado_na_bancada', mensagem: 'Codigo nao possui registro ativo na bancada manual.' });
      continue;
    }

    if (!['rascunho', 'pendente_conferencia'].includes(row.status_conferencia)) {
      bloqueios.push({ codigo, tipo: 'status_nao_removivel', mensagem: 'Somente rascunho ou pendente_conferencia podem ser limpos.' });
    }

    if (row.status_conferencia === 'conferido_integralmente') {
      bloqueios.push({ codigo, tipo: 'conferido_integralmente_protegido', mensagem: 'Registro conferido integralmente nao pode ser removido por limpeza de homologacao.' });
    }

    if (row.apto_para_seed === true) {
      bloqueios.push({ codigo, tipo: 'apto_para_seed_protegido', mensagem: 'Registro apto_para_seed true nao pode ser removido por limpeza de homologacao.' });
    }

    if (avaliacoesByCode.get(codigo)?.possivelTeste !== true) {
      bloqueios.push({ codigo, tipo: 'registro_nao_identificado_como_homologacao', mensagem: 'Registro nao possui sinais suficientes de teste, homologacao, validacao ou exemplo.' });
    }
  }

  if (bloqueios.length > 0) {
    throw serviceError('Limpeza bloqueada por regra de preservacao da bancada.', 400, { bloqueios });
  }

  const client = await db.connect();
  const removidos = [];

  try {
    await client.query('BEGIN');

    for (const codigo of codigos) {
      const row = activeByCode.get(codigo);
      const avaliacao = avaliacoesByCode.get(codigo);

      await insertHistory(
        client,
        row,
        row,
        user,
        'limpeza_homologacao_remover_rascunho',
        justificativa,
        {
          faseLimpeza: FASE_PREPARACAO_REAL,
          codigo,
          criteriosHomologacao: avaliacao?.criterios || [],
          dadosAnteriores: mapRow(row),
          seedOperacionalCriado: false,
          tabelaOperacionalAlterada: false,
        }
      );

      await client.query(
        `
          UPDATE licenciamento_parametrizacao_conferencias
          SET removido_em = CURRENT_TIMESTAMP,
              removido_por = $2,
              motivo_remocao = $3,
              atualizado_por = $2,
              atualizado_em = CURRENT_TIMESTAMP
          WHERE id = $1
            AND removido_em IS NULL;
        `,
        [row.id, userId(user), justificativa]
      );

      removidos.push({
        codigo,
        conferenciaId: row.id,
        statusAnterior: row.status_conferencia,
        aptoParaSeedAnterior: row.apto_para_seed === true,
      });
    }

    const operationalCountInTransaction = await countOperationalGroup21Activities(client);
    if (operationalCountInTransaction !== beforeOperationalCount) {
      throw serviceError('Limpeza bloqueada: contagem operacional do Grupo 21 foi alterada durante a transacao.', 500);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const afterOperationalCount = await countOperationalGroup21Activities();

  return {
    success: true,
    fase: FASE_PREPARACAO_REAL,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    modo: 'limpeza_controlada_homologacao',
    totalSolicitado: codigos.length,
    removidos: removidos.length,
    registrosRemovidos: removidos,
    justificativa,
    tabelaOperacionalAlterada: beforeOperationalCount !== afterOperationalCount,
    atividadesOperacionaisGrupo21: afterOperationalCount,
    seedOperacionalCriado: false,
    mensagem: 'Rascunhos de homologacao limpos da bancada ativa. Historico preservado e nenhuma tabela operacional foi alterada.',
  };
}

function getImportMatrix(payload = {}) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return asObject(payload.matriz || payload.modelo || payload.data || payload);
  }
  return {};
}

function getImportCodigo(item = {}) {
  return normalizeText(item.codigo || item.codigoAtividade || item.codigo_atividade);
}

function getImportStatus(item = {}) {
  return normalizeText(item.statusPretendido || item.statusConferencia || item.status_conferencia || 'rascunho');
}

function getImportApto(item = {}) {
  if (hasOwn(item, 'aptoParaSeedPretendido')) return normalizeBoolean(item.aptoParaSeedPretendido);
  if (hasOwn(item, 'aptoParaSeedFuturo')) return normalizeBoolean(item.aptoParaSeedFuturo);
  if (hasOwn(item, 'aptoParaSeed')) return normalizeBoolean(item.aptoParaSeed);
  if (hasOwn(item, 'apto_para_seed')) return normalizeBoolean(item.apto_para_seed);
  return false;
}

function getImportFonte(item = {}, matrix = {}) {
  return normalizeText(item.fonteNormativa || item.fonte_normativa || matrix.fonteNormativa || matrix.fonte_normativa || '');
}

function getImportEvidence(item = {}) {
  const evidencia = asObject(item.evidenciaVisual || item.evidencia_visual);
  return {
    paginaPdf: evidencia.paginaPdf || evidencia.pagina_pdf || evidencia.pagina || '',
    trechoTabela: evidencia.trechoTabela || evidencia.trecho_tabela || '',
    observacao: evidencia.observacao || evidencia.observacaoConferencia || evidencia.observacao_conferencia || '',
  };
}

function getImportDadosConferidos(item = {}) {
  const dados = asObject(item.dadosConferidos || item.dados_conferidos);
  const lacunasAtivas = item.lacunasAtivas ?? item.lacunas_ativas ?? dados.lacunasAtivas ?? dados.lacunas_ativas ?? [];

  return {
    ...dados,
    descricaoNormativa: item.descricaoNormativa ?? item.descricao_normativa ?? dados.descricaoNormativa ?? dados.descricao_normativa ?? '',
    observacaoConferencia: item.observacaoConferencia ?? item.observacao_conferencia ?? dados.observacaoConferencia ?? dados.observacao_conferencia ?? '',
    justificativaFaixasNaoAplicaveis: item.justificativaFaixasNaoAplicaveis
      ?? item.justificativa_faixas_nao_aplicaveis
      ?? dados.justificativaFaixasNaoAplicaveis
      ?? dados.justificativa_faixas_nao_aplicaveis
      ?? '',
    justificativaClasseTipoAto: item.justificativaClasseTipoAto
      ?? item.justificativa_classe_tipo_ato
      ?? dados.justificativaClasseTipoAto
      ?? dados.justificativa_classe_tipo_ato
      ?? '',
    lacunasAtivas: Array.isArray(lacunasAtivas)
      ? lacunasAtivas
      : String(lacunasAtivas || '').split('\n').map((value) => value.trim()).filter(Boolean),
  };
}

function normalizeImportFaixa(faixa = {}, index = 0, unidadePadrao = '') {
  return {
    ordem: Number(faixa.ordem || index + 1),
    operador: normalizeText(getRangeOperator(faixa)),
    valorInicial: getRangeInitialValue(faixa),
    valorFinal: getRangeFinalValue(faixa),
    unidade: getRangeUnit(faixa) || unidadePadrao || '',
    textoNormativo: getRangeText(faixa),
    porte: faixa.porte || '',
    classe: getRangeClass(faixa),
    tipoAto: getRangeType(faixa),
    limiteImpactoLocal: faixa.limiteImpactoLocal || faixa.limite_impacto_local || '',
    observacao: faixa.observacao || '',
    justificativaClasseTipoAto: faixa.justificativaClasseTipoAto || faixa.justificativa_classe_tipo_ato || '',
    justificativaTipoAto: faixa.justificativaTipoAto || faixa.justificativa_tipo_ato || '',
    justificativaClasse: faixa.justificativaClasse || faixa.justificativa_classe || '',
  };
}

function getImportFaixas(item = {}, unidadePadrao = '') {
  if (!hasOwn(item, 'faixasConferidas') && !hasOwn(item, 'faixas_conferidas')) {
    return [];
  }

  return asArray(item.faixasConferidas || item.faixas_conferidas)
    .filter(isMeaningfulFaixa)
    .map((faixa, index) => normalizeImportFaixa(faixa, index, unidadePadrao));
}

function normalizeDocumentoMinimo(documento = {}) {
  if (typeof documento === 'string') {
    return { nome: documento, status: '' };
  }

  const source = asObject(documento);
  return {
    nome: source.nome || source.nomeDocumento || source.nome_documento || source.documento || '',
    status: source.status || source.situacao || '',
    observacao: source.observacao || '',
  };
}

function getImportDocumentos(item = {}) {
  const raw = hasOwn(item, 'documentosMinimos')
    ? item.documentosMinimos
    : item.documentosConferidos || item.documentos_conferidos || [];
  return asArray(raw).map(normalizeDocumentoMinimo);
}

function normalizeDependenciaSetorial(dependencia = {}) {
  if (typeof dependencia === 'string') {
    return { tipo: dependencia, descricao: '', status: '' };
  }

  const source = asObject(dependencia);
  return {
    tipo: source.tipo || source.codigo || source.dependencia || '',
    descricao: source.descricao || source.observacao || source.detalhe || '',
    status: source.status || '',
  };
}

function getImportDependencias(item = {}) {
  return asArray(item.dependenciasSetoriais || item.dependencias_setoriais).map(normalizeDependenciaSetorial);
}

function getImportObservacoes(item = {}) {
  return asArray(item.observacoesNormativas || item.observacoes_normativas);
}

function addImportIssue(collection, byCode, codigo, tipo, campo, mensagem, extra = {}) {
  const issue = {
    codigo: codigo || null,
    tipo,
    campo: campo || null,
    mensagem,
    severidade: extra.severidade || 'bloqueante',
    ...extra,
  };
  collection.push(issue);

  if (codigo) {
    const current = byCode.get(codigo) || [];
    current.push(issue);
    byCode.set(codigo, current);
  }

  return issue;
}

function publicImportValidationResult(result) {
  const {
    itensNormalizados,
    base,
    existingByCode,
    ...publicResult
  } = result;
  return publicResult;
}

async function buildImportValidation(payload = {}) {
  const matrix = getImportMatrix(payload);
  const rawCodigos = Array.isArray(matrix.codigos) ? matrix.codigos : [];
  const [base, manualRows] = await Promise.all([getBaseVisualStatus(), getManualRows()]);
  const existingByCode = new Map(manualRows.map((row) => [row.codigo_atividade, row]));
  const erros = [];
  const advertencias = [];
  const errosPorCodigo = new Map();
  const advertenciasPorCodigo = new Map();
  const itensNormalizados = [];
  const seen = new Set();

  const addError = (codigo, tipo, campo, mensagem, extra = {}) => (
    addImportIssue(erros, errosPorCodigo, codigo, tipo, campo, mensagem, extra)
  );
  const addWarning = (codigo, tipo, campo, mensagem, extra = {}) => (
    addImportIssue(advertencias, advertenciasPorCodigo, codigo, tipo, campo, mensagem, { severidade: 'advertencia', ...extra })
  );

  if (!matrix || Object.keys(matrix).length === 0) {
    addError(null, 'payload_vazio', 'body', 'JSON de importacao nao informado ou em formato invalido.');
  }

  if (matrix.fase && ![FASE_IMPORTACAO, FASE_PREPARACAO_REAL].includes(matrix.fase)) {
    addError(null, 'fase_invalida', 'fase', `A fase deve ser ${FASE_IMPORTACAO} ou ${FASE_PREPARACAO_REAL}.`);
  }

  if (Number(matrix.grupo) !== GRUPO) {
    addError(null, 'grupo_invalido', 'grupo', 'O grupo da matriz deve ser 21.');
  }

  if (normalizeText(matrix.nomeGrupo) !== NOME_GRUPO) {
    addError(null, 'nome_grupo_invalido', 'nomeGrupo', `O nome do grupo deve ser ${NOME_GRUPO}.`);
  }

  if (matrix.modo && ![MODO_IMPORTACAO, MODO_MODELO_OFICIAL_REAL].includes(matrix.modo)) {
    addError(null, 'modo_invalido', 'modo', `O modo da matriz deve ser ${MODO_IMPORTACAO} ou ${MODO_MODELO_OFICIAL_REAL}.`);
  }

  if (!Array.isArray(matrix.codigos)) {
    addError(null, 'codigos_ausentes', 'codigos', 'A matriz deve conter o array codigos.');
  }

  rawCodigos.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      addError(null, 'codigo_formato_invalido', `codigos[${index}]`, 'Cada item de codigos deve ser um objeto.');
      return;
    }

    const codigo = getImportCodigo(item);
    const itemGrupo = item.grupo ?? item.grupoNumero ?? item.grupo_numero ?? matrix.grupo;
    const statusPretendido = getImportStatus(item);
    const aptoParaSeedPretendido = getImportApto(item);
    const fonteNormativa = getImportFonte(item, matrix);
    const evidenciaVisual = getImportEvidence(item);
    const dadosConferidos = getImportDadosConferidos(item);
    const parametroPrincipal = normalizeText(item.parametroPrincipal || item.parametro_principal);
    const unidade = normalizeText(item.unidade);
    const faixasConferidas = getImportFaixas(item, unidade);
    const documentosMinimos = getImportDocumentos(item);
    const dependenciasSetoriais = getImportDependencias(item);
    const observacoesNormativas = getImportObservacoes(item);
    const nomeAtividade = normalizeText(item.nomeAtividade || item.nome_atividade);
    const observacaoInterna = normalizeText(item.observacaoInterna || item.observacao_interna);
    const confirmarSobrescritaConferido = normalizeBoolean(item.confirmarSobrescritaConferido || item.confirmar_sobrescrita_conferido);
    const previous = existingByCode.get(codigo);

    if (!codigo) {
      addError(null, 'codigo_ausente', `codigos[${index}].codigo`, 'Codigo da atividade nao informado.');
    } else if (seen.has(codigo)) {
      addError(codigo, 'codigo_duplicado', 'codigo', `Codigo ${codigo} aparece mais de uma vez na matriz.`);
    } else {
      seen.add(codigo);
    }

    if (Number(itemGrupo) !== GRUPO) {
      addError(codigo, 'grupo_codigo_invalido', 'grupo', 'Item de codigo pertence a grupo diferente de 21.');
    }

    if (codigo && !EXPECTED_CODES.includes(codigo)) {
      addError(codigo, 'codigo_fora_do_grupo_21', 'codigo', 'Codigo deve estar entre 21.01 e 21.10.');
    }

    if (!STATUS_CONTROLADOS.includes(statusPretendido)) {
      addError(codigo, 'status_pretendido_invalido', 'statusPretendido', 'Status pretendido fora da lista permitida.');
    }

    if (aptoParaSeedPretendido === true && statusPretendido !== 'conferido_integralmente') {
      addError(codigo, 'apto_seed_status_invalido', 'aptoParaSeedPretendido', 'aptoParaSeedPretendido so pode ser true com statusPretendido conferido_integralmente.');
    }

    if (aptoParaSeedPretendido === true && hasActiveGap({ dadosConferidos })) {
      addError(codigo, 'lacuna_ativa_bloqueia_apto_seed', 'dadosConferidos.lacunasAtivas', 'Qualquer lacuna ativa impede aptoParaSeedPretendido true.');
    }

    if (previous?.status_conferencia === 'conferido_integralmente' && !confirmarSobrescritaConferido) {
      addError(
        codigo,
        'sobrescrita_conferido_sem_confirmacao',
        'confirmarSobrescritaConferido',
        'Registro ja conferido integralmente exige confirmarSobrescritaConferido: true para ser alterado.'
      );
    }

    faixasConferidas.forEach((faixa) => {
      const operador = getRangeOperator(faixa);
      const valorInicial = toFiniteNumber(getRangeInitialValue(faixa));
      const valorFinal = toFiniteNumber(getRangeFinalValue(faixa));

      if (isBlank(operador)) {
        if (statusPretendido === 'conferido_integralmente') {
          addError(codigo, 'faixa_sem_operador', 'faixasConferidas.operador', 'Faixa conferida integralmente deve ter operador.', { faixaOrdem: faixa.ordem });
        }
      } else if (!OPERADORES_PERMITIDOS.includes(operador)) {
        addError(codigo, 'operador_invalido', 'faixasConferidas.operador', 'Operador fora da lista permitida.', { faixaOrdem: faixa.ordem });
      }

      if (operador === 'entre' && (valorInicial === null || valorFinal === null)) {
        addError(codigo, 'faixa_entre_sem_limites', 'faixasConferidas', 'Faixa com operador entre deve ter valorInicial e valorFinal.', { faixaOrdem: faixa.ordem });
      }

      if (valorInicial !== null && valorFinal !== null && valorInicial > valorFinal) {
        addError(codigo, 'valor_inicial_maior_que_final', 'faixasConferidas', 'valorInicial nao pode ser maior que valorFinal.', { faixaOrdem: faixa.ordem });
      }
    });

    documentosMinimos.forEach((documento, docIndex) => {
      if (isBlank(documento.nome) || isBlank(documento.status)) {
        addError(codigo, 'documento_minimo_incompleto', `documentosMinimos[${docIndex}]`, 'Documento minimo informado deve ter nome e status.');
      }
    });

    dependenciasSetoriais.forEach((dependencia, depIndex) => {
      if (!DEPENDENCIAS_SETORIAIS_PERMITIDAS_IMPORTACAO.includes(dependencia.tipo)) {
        addError(codigo, 'dependencia_setorial_invalida', `dependenciasSetoriais[${depIndex}]`, 'Dependencia setorial fora da lista permitida.');
      }

      if (dependencia.tipo === 'outro' && isBlank(dependencia.descricao)) {
        addError(codigo, 'dependencia_outro_sem_descricao', `dependenciasSetoriais[${depIndex}]`, 'Dependencia setorial outro exige descricao.');
      }
    });

    if (statusPretendido === 'conferido_integralmente') {
      const recordForIntegral = {
        codigo,
        nomeAtividade,
        parametroPrincipal,
        unidade,
        dadosConferidos,
        faixasConferidas,
        evidenciaVisual,
        fonteNormativa,
        observacaoInterna,
        aptoParaSeed: aptoParaSeedPretendido,
        statusConferencia: statusPretendido,
      };

      const pending = validateIntegralRecord(recordForIntegral, { permissoes: ['*'] }, { throwOnError: false });
      pending.forEach((campo) => {
        addError(codigo, 'campo_obrigatorio_conferido_integralmente', campo, `Campo obrigatorio pendente para conferencia integral: ${campo}.`);
      });
    } else if (aptoParaSeedPretendido === false) {
      if (isBlank(nomeAtividade) || isBlank(parametroPrincipal) || isBlank(unidade) || isBlank(getEvidencePage(evidenciaVisual))) {
        addWarning(codigo, 'rascunho_incompleto', 'codigos', 'Rascunho possui lacunas e permanecera nao apto para seed.');
      }
    }

    itensNormalizados.push({
      raw: item,
      codigo,
      grupo: GRUPO,
      nomeGrupo: NOME_GRUPO,
      nomeAtividade,
      parametroPrincipal,
      unidade,
      dadosConferidos,
      faixasConferidas,
      documentosMinimos,
      dependenciasSetoriais,
      observacoesNormativas,
      evidenciaVisual,
      statusPretendido,
      aptoParaSeedPretendido,
      fonteNormativa,
      observacaoInterna,
      confirmarSobrescritaConferido,
      previous,
    });
  });

  EXPECTED_CODES.forEach((codigo) => {
    if (!seen.has(codigo)) {
      addWarning(codigo, 'codigo_ausente', 'codigos', `Codigo ${codigo} nao foi enviado e nao sera alterado.`);
    }
  });

  const recebidosValidos = itensNormalizados.filter((item) => EXPECTED_CODES.includes(item.codigo));
  const codigosInvalidos = new Set([...errosPorCodigo.keys()].filter(Boolean));
  const codigosComAdvertencia = new Set([...advertenciasPorCodigo.keys()].filter((codigo) => !codigosInvalidos.has(codigo)));
  const invalidos = codigosInvalidos.size || (erros.length > 0 ? recebidosValidos.length : 0);
  const validos = recebidosValidos.filter((item) => !codigosInvalidos.has(item.codigo)).length;
  const previaAplicacao = itensNormalizados
    .filter((item) => EXPECTED_CODES.includes(item.codigo))
    .map((item) => ({
      codigo: item.codigo,
      acao: item.previous ? 'atualizar_conferencia_manual' : 'criar_rascunho_conferencia_manual',
      statusAtual: item.previous?.status_conferencia || 'sem_registro_manual',
      statusPretendido: item.statusPretendido,
      aptoParaSeedPretendido: item.aptoParaSeedPretendido,
      confirmarSobrescritaConferido: item.confirmarSobrescritaConferido,
      bloqueado: codigosInvalidos.has(item.codigo),
      erros: (errosPorCodigo.get(item.codigo) || []).map((erro) => erro.tipo),
      advertencias: (advertenciasPorCodigo.get(item.codigo) || []).map((advertencia) => advertencia.tipo),
      seedOperacionalCriado: false,
    }));

  return {
    success: erros.length === 0,
    fase: FASE_IMPORTACAO,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    modo: 'validacao_sem_gravacao',
    totalRecebido: rawCodigos.length,
    validos,
    comAdvertencia: codigosComAdvertencia.size,
    invalidos,
    erros,
    advertencias,
    previaAplicacao,
    seedOperacionalCriado: false,
    atividadesIncluidas: [],
    itensNormalizados,
    base,
    existingByCode,
  };
}

async function validarImportacaoGrupo21(payload = {}) {
  return publicImportValidationResult(await buildImportValidation(payload));
}

function shouldSendScalarImportValue(previous, item, field, value) {
  return !previous || !isBlank(value) || hasExplicitClear(item.raw, field);
}

function buildPayloadFromImportItem(item) {
  const previous = item.previous;
  const payload = {
    statusConferencia: item.statusPretendido,
    aptoParaSeed: item.aptoParaSeedPretendido,
  };

  if (shouldSendScalarImportValue(previous, item, 'nomeAtividade', item.nomeAtividade)) {
    payload.nomeAtividade = item.nomeAtividade;
  }

  if (shouldSendScalarImportValue(previous, item, 'parametroPrincipal', item.parametroPrincipal)) {
    payload.parametroPrincipal = item.parametroPrincipal;
  }

  if (shouldSendScalarImportValue(previous, item, 'unidade', item.unidade)) {
    payload.unidade = item.unidade;
  }

  if (shouldSendScalarImportValue(previous, item, 'fonteNormativa', item.fonteNormativa)) {
    payload.fonteNormativa = item.fonteNormativa || FONTE_NORMATIVA_MODELO;
  }

  if (shouldSendScalarImportValue(previous, item, 'observacaoInterna', item.observacaoInterna)) {
    payload.observacaoInterna = item.observacaoInterna;
  }

  const dadosConferidos = {};
  ['descricaoNormativa', 'observacaoConferencia', 'justificativaFaixasNaoAplicaveis', 'justificativaClasseTipoAto'].forEach((field) => {
    if (shouldSendScalarImportValue(previous, item, field, item.dadosConferidos[field])) {
      dadosConferidos[field] = item.dadosConferidos[field] || '';
    }
  });

  if (!previous || item.dadosConferidos.lacunasAtivas.length > 0 || hasExplicitClear(item.raw, 'lacunasAtivas')) {
    dadosConferidos.lacunasAtivas = item.dadosConferidos.lacunasAtivas;
  }

  if (Object.keys(dadosConferidos).length > 0 || !previous) {
    payload.dadosConferidos = dadosConferidos;
  }

  if (!previous || item.faixasConferidas.length > 0 || hasExplicitClear(item.raw, 'faixasConferidas')) {
    payload.faixasConferidas = item.faixasConferidas;
  }

  if (!previous || item.documentosMinimos.length > 0 || hasExplicitClear(item.raw, 'documentosMinimos')) {
    payload.documentosConferidos = item.documentosMinimos;
  }

  if (!previous || item.dependenciasSetoriais.length > 0 || hasExplicitClear(item.raw, 'dependenciasSetoriais')) {
    payload.dependenciasSetoriais = item.dependenciasSetoriais;
  }

  if (!previous || item.observacoesNormativas.length > 0 || hasExplicitClear(item.raw, 'observacoesNormativas')) {
    payload.observacoesNormativas = item.observacoesNormativas;
  }

  const evidenciaVisual = {};
  ['paginaPdf', 'trechoTabela', 'observacao'].forEach((field) => {
    if (!previous || !isBlank(item.evidenciaVisual[field]) || hasExplicitClear(item.raw, `evidenciaVisual.${field}`)) {
      evidenciaVisual[field] = item.evidenciaVisual[field] || '';
    }
  });

  if (Object.keys(evidenciaVisual).length > 0 || !previous) {
    payload.evidenciaVisual = evidenciaVisual;
  }

  return payload;
}

async function countOperationalGroup21Activities(client = db) {
  const result = await client.query(
    `
      SELECT COUNT(*)::int AS total
      FROM licenciamento_atividades
      WHERE deleted_at IS NULL
        AND ativo = true
        AND codigo LIKE '21.%';
    `
  );
  return Number(result.rows[0]?.total || 0);
}

async function aplicarImportacaoGrupo21(payload = {}, user) {
  const validation = await buildImportValidation(payload);
  if (!validation.success) {
    throw serviceError('Importacao bloqueada por inconsistencias estruturais.', 400, publicImportValidationResult(validation));
  }

  const aplicaveis = validation.itensNormalizados.filter((item) => EXPECTED_CODES.includes(item.codigo));
  const importacaoId = `fase2d5c2b_${Date.now()}_${userId(user) || 'sem_usuario'}`;
  const beforeOperationalCount = await countOperationalGroup21Activities();
  const client = await db.connect();
  const aplicados = [];

  try {
    await client.query('BEGIN');

    for (const item of aplicaveis) {
      const payloadItem = buildPayloadFromImportItem(item);
      const record = normalizeRecordPayload(item.codigo, validation.base.byCode.get(item.codigo), item.previous, payloadItem);

      if (record.aptoParaSeed === true && record.statusConferencia !== 'conferido_integralmente') {
        throw serviceError('apto_para_seed_futuro so pode ser verdadeiro quando status_conferencia for conferido_integralmente.', 400);
      }

      if (record.statusConferencia === 'conferido_integralmente' || record.aptoParaSeed === true) {
        validateIntegralRecord(record, user);
      }

      const row = await upsertRecord(client, record, item.previous, user, {
        markConferido: record.statusConferencia === 'conferido_integralmente',
      });

      await insertHistory(
        client,
        row,
        item.previous,
        user,
        item.previous ? 'importacao_controlada_atualizar' : 'importacao_controlada_criar',
        record.observacaoInterna || asObject(record.dadosConferidos).observacaoConferencia || null,
        {
          faseImportacao: FASE_IMPORTACAO,
          importacaoId,
          codigo: item.codigo,
          camposRecebidos: Object.keys(item.raw || {}),
          confirmarSobrescritaConferido: item.confirmarSobrescritaConferido,
          seedOperacionalCriado: false,
          tabelaOperacionalAlterada: false,
        }
      );

      aplicados.push({
        codigo: item.codigo,
        acao: item.previous ? 'atualizado' : 'criado',
        statusConferencia: row.status_conferencia,
        aptoParaSeed: row.apto_para_seed === true,
        conferenciaId: row.id,
      });
    }

    const operationalCountInTransaction = await countOperationalGroup21Activities(client);
    if (operationalCountInTransaction !== beforeOperationalCount) {
      throw serviceError('Importacao bloqueada: contagem operacional do Grupo 21 foi alterada durante a transacao.', 500);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const afterOperationalCount = await countOperationalGroup21Activities();
  return {
    success: true,
    fase: FASE_IMPORTACAO,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    modo: 'importacao_controlada_bancada_manual',
    importacaoId,
    totalRecebido: validation.totalRecebido,
    criados: aplicados.filter((item) => item.acao === 'criado').length,
    atualizados: aplicados.filter((item) => item.acao === 'atualizado').length,
    aplicados,
    advertencias: validation.advertencias,
    seedOperacionalCriado: false,
    atividadesIncluidas: [],
    tabelaOperacionalAlterada: beforeOperationalCount !== afterOperationalCount,
    mensagem: 'Importacao aplicada somente na bancada manual assistida. Nenhum seed operacional foi executado.',
  };
}

async function getHistoricoImportacoesGrupo21() {
  const result = await db.query(
    `
      SELECT
        h.id,
        h.acao,
        h.status_anterior,
        h.status_novo,
        h.usuario_id,
        u.nome AS usuario_nome,
        h.observacao,
        h.metadados,
        h.criado_em,
        c.codigo_atividade,
        c.nome_atividade
      FROM licenciamento_parametrizacao_conferencias_historico h
      JOIN licenciamento_parametrizacao_conferencias c ON c.id = h.conferencia_id
      LEFT JOIN usuarios_internos u ON u.id = h.usuario_id
      WHERE c.fase = $1
        AND c.grupo_numero = $2
        AND (
          h.acao IN ('importacao_controlada_criar', 'importacao_controlada_atualizar')
          OR h.metadados->>'faseImportacao' = $3
        )
      ORDER BY h.criado_em DESC, h.id DESC
      LIMIT 200;
    `,
    [FASE, GRUPO, FASE_IMPORTACAO]
  );

  return {
    fase: FASE_IMPORTACAO,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    total: result.rows.length,
    historico: result.rows.map((item) => ({
      id: item.id,
      codigo: item.codigo_atividade,
      nomeAtividade: item.nome_atividade,
      acao: item.acao,
      statusAnterior: item.status_anterior,
      statusNovo: item.status_novo,
      usuarioId: item.usuario_id,
      usuarioNome: item.usuario_nome,
      observacao: item.observacao,
      metadados: asObject(item.metadados),
      criadoEm: item.criado_em,
    })),
  };
}

function getActiveGapList(record = {}) {
  const dados = asObject(record.dadosConferidos || record.dados_conferidos);
  const active = dados.lacunasAtivas ?? dados.lacunas_ativas ?? dados.lacunaAtiva ?? dados.lacuna_ativa;

  if (Array.isArray(active)) {
    return active
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return normalizeText(item.tipo || item.campo || item.descricao || item.mensagem || JSON.stringify(item));
        }
        return normalizeText(item);
      })
      .filter(Boolean);
  }

  if (typeof active === 'boolean') return active ? ['lacuna_ativa_sem_detalhamento'] : [];
  if (typeof active === 'string') {
    const value = active.trim();
    return value && value.toLowerCase() !== 'nao' ? [value] : [];
  }

  return [];
}

function mapGapToField(gap) {
  const normalized = normalizeText(gap).toLowerCase();

  if (normalized.includes('document')) return 'documentos_minimos';
  if (normalized.includes('tipo') || normalized.includes('licen')) return 'tipo_de_ato';
  if (normalized.includes('classe')) return 'classe';
  if (normalized.includes('faixa')) return 'faixas_normativas';
  if (normalized.includes('impacto')) return 'limite_de_impacto_local';
  if (normalized.includes('depend')) return 'dependencias_setoriais';
  if (normalized.includes('observ')) return 'observacoes_normativas';
  return 'campo_normativo';
}

function getComplementaryPendingFields(record = {}) {
  const dados = asObject(record.dadosConferidos);
  const fields = new Set(getActiveGapList(record).map(mapGapToField));
  const faixas = asArray(record.faixasConferidas);

  faixas.forEach((faixa) => {
    if (isBlank(getRangeClass(faixa)) && !hasClassJustification(faixa, dados)) {
      fields.add('classe');
    }

    if (isBlank(getRangeType(faixa)) && !hasTypeActJustification(faixa, dados)) {
      fields.add('tipo_de_ato');
    }
  });

  if (asArray(record.documentosConferidos).length === 0 && !hasDocumentJustification(dados)) {
    fields.add('documentos_minimos');
  }

  return [...fields];
}

function buildComplementaryCodeResult(baseItem, row) {
  if (!row) {
    return {
      codigo: baseItem.codigo,
      nomeAtividade: baseItem.nomeAtividade || '',
      origemConferenciaId: null,
      statusAtual: 'sem_registro_manual',
      aptoParaSeedAtual: false,
      lacunasOriginais: 1,
      lacunasAtivas: ['codigo_sem_registro_na_bancada_manual'],
      lacunasPreenchidas: 0,
      lacunasRemanescentes: 1,
      camposComLacuna: ['registro_manual'],
      complementacoesPropostas: [],
      complementacaoSegura: false,
      statusPretendido: 'pendente_conferencia',
      aptoParaSeedPretendido: false,
      bloqueado: true,
      motivosBloqueio: ['codigo_sem_registro_na_bancada_manual'],
      fonteJustificadora: null,
      grauConfianca: 'baixo',
      necessidadeValidacaoHumana: true,
      observacaoTecnica: 'Sem registro ativo na bancada manual para aplicar conferencia complementar.',
    };
  }

  const record = mapRow(row);
  const lacunas = getActiveGapList(record);
  const camposComLacuna = getComplementaryPendingFields(record);
  const evaluation = evaluateRegistroParaPreviaSeed(row);
  const bloqueado = record.aptoParaSeedFuturo !== true || record.statusConferencia !== 'conferido_integralmente' || lacunas.length > 0;

  return {
    codigo: record.codigo,
    nomeAtividade: record.nomeAtividade || baseItem.nomeAtividade || '',
    origemConferenciaId: record.id || null,
    statusAtual: record.statusConferencia,
    aptoParaSeedAtual: record.aptoParaSeedFuturo === true,
    lacunasOriginais: lacunas.length,
    lacunasAtivas: lacunas,
    lacunasPreenchidas: 0,
    lacunasRemanescentes: lacunas.length,
    camposComLacuna,
    camposJaConfirmados: {
      nomeOficialAtividade: !isBlank(record.nomeAtividade),
      parametroPrincipal: !isBlank(record.parametroPrincipal),
      unidade: !isBlank(record.unidade),
      faixas: asArray(record.faixasConferidas).length,
      evidenciaVisual: !isBlank(getEvidencePage(record.evidenciaVisual)),
      fonteNormativa: !isBlank(record.fonteNormativa),
    },
    complementacoesPropostas: [],
    complementacaoSegura: false,
    statusPretendido: record.statusConferencia,
    aptoParaSeedPretendido: false,
    bloqueado,
    motivosBloqueio: [...new Set([
      ...evaluation.bloqueios,
      ...lacunas.map((lacuna) => `lacuna_${mapGapToField(lacuna)}`),
      'sem_fonte_municipal_complementar_suficiente',
    ])],
    fonteJustificadora: null,
    grauConfianca: lacunas.length > 0 ? 'alto_para_lacunas_identificadas' : 'medio_para_estado_atual',
    necessidadeValidacaoHumana: true,
    observacaoTecnica: 'Nao foi encontrada fonte municipal complementar segura para preencher as lacunas sem inferencia.',
  };
}

function getComplementaryRecommendation(codigosAptosParaSeed) {
  if (codigosAptosParaSeed === 0) {
    return 'Obter fonte normativa municipal melhor, como planilha oficial, tabela digital em alta resolucao ou conferencia humana externa do Decreto, antes de qualquer seed.';
  }

  if (codigosAptosParaSeed < EXPECTED_CODES.length) {
    return 'Executar futura fase de seed controlado parcial posterior a revisao 2D.5C.4, somente para codigos aptos.';
  }

  return 'Executar futura fase de seed controlado integral posterior a revisao 2D.5C.4.';
}

async function getConferenciaComplementarGrupo21() {
  const [base, manualRows, previa, operationalCount] = await Promise.all([
    getBaseVisualStatus(),
    getManualRows(),
    getPreviaSeedGrupo21(),
    countOperationalGroup21Activities(),
  ]);
  const manualByCode = new Map(manualRows.map((row) => [row.codigo_atividade, row]));
  const resultadoPorCodigo = base.codigos.map((item) => buildComplementaryCodeResult(item, manualByCode.get(item.codigo)));
  const lacunasOriginais = resultadoPorCodigo.reduce((total, item) => total + item.lacunasOriginais, 0);
  const lacunasPreenchidas = resultadoPorCodigo.reduce((total, item) => total + item.lacunasPreenchidas, 0);
  const lacunasRemanescentes = resultadoPorCodigo.reduce((total, item) => total + item.lacunasRemanescentes, 0);
  const codigosConferidosIntegralmente = resultadoPorCodigo.filter((item) => (
    item.statusPretendido === 'conferido_integralmente' && item.lacunasRemanescentes === 0
  )).length;
  const codigosAptosParaSeed = resultadoPorCodigo.filter((item) => item.aptoParaSeedPretendido === true).length;
  const codigosBloqueados = resultadoPorCodigo.filter((item) => item.bloqueado).length;
  const complementacoesSeguras = resultadoPorCodigo
    .flatMap((item) => item.complementacoesPropostas.map((complementacao) => ({ codigo: item.codigo, ...complementacao })));
  const statusGeral = complementacoesSeguras.length > 0
    ? 'complementacoes_seguras_identificadas_para_aplicacao_controlada'
    : 'sem_complementacao_normativa_segura';

  return {
    fase: FASE_COMPLEMENTAR,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    totalCodigos: EXPECTED_CODES.length,
    codigosAnalisados: resultadoPorCodigo.length,
    lacunasOriginais,
    lacunasPreenchidas,
    lacunasRemanescentes,
    codigosConferidosIntegralmente,
    codigosAptosParaSeed,
    codigosBloqueados,
    fontesConsultadas: FONTES_COMPLEMENTARES_GRUPO21,
    situacaoAntesComplementacao: {
      registrosAtivosBancada: manualRows.length,
      statusConferidoComLacunas: manualRows.filter((row) => row.status_conferencia === 'conferido_com_lacunas').length,
      statusConferidoIntegralmente: manualRows.filter((row) => row.status_conferencia === 'conferido_integralmente').length,
      aptosParaSeed: manualRows.filter((row) => row.apto_para_seed === true).length,
      atividadesOperacionaisGrupo21: operationalCount,
      previaDryRun: {
        fase: previa.fase,
        codigosAptosParaSeed: previa.codigosAptosParaSeed,
        codigosBloqueados: previa.codigosBloqueados,
        inconsistencias: asArray(previa.inconsistencias).length,
      },
    },
    complementacoesSeguras,
    resultadoPorCodigo,
    seedOperacionalCriado: false,
    atividadesIncluidas: [],
    tabelaOperacionalAlterada: false,
    statusGeral,
    recomendacaoProximaFase: getComplementaryRecommendation(codigosAptosParaSeed),
    alertas: [
      'Diagnostico complementar sem seed e sem escrita em licenciamento_atividades.',
      'Nenhuma lacuna foi preenchida por inferencia ou por norma complementar sem correlacao municipal.',
      'Tipo de ato, classe e documentos minimos permanecem bloqueados quando a fonte municipal nao e clara.',
    ],
  };
}

function getComplementationItems(payload = {}) {
  return asArray(payload.complementacoes || payload.itens || payload.codigos);
}

function normalizeComplementationSource(value) {
  if (typeof value === 'string') {
    return { titulo: value.trim() };
  }

  const source = asObject(value);
  if (Object.keys(source).length === 0) return {};

  return {
    id: normalizeText(source.id),
    titulo: normalizeText(source.titulo || source.fonte || source.nome || source.descricao),
    tipo: normalizeText(source.tipo),
    natureza: normalizeText(source.natureza || source.naturezaFonte || source.natureza_fonte),
    grauConfianca: normalizeText(source.grauConfianca || source.grau_confianca),
    evidencia: normalizeText(source.evidencia || source.evidenciaDocumental || source.evidencia_documental),
    paginaPdf: normalizeText(source.paginaPdf || source.pagina_pdf || source.pagina),
    necessidadeValidacaoHumana: source.necessidadeValidacaoHumana ?? source.necessidade_validacao_humana ?? null,
  };
}

function getComplementationSource(payload = {}, item = {}) {
  return normalizeComplementationSource(
    item.fonteNormativaComplementar
    || item.fonte_normativa_complementar
    || item.fonteComplementar
    || item.fonte_complementar
    || payload.fonteNormativaComplementar
    || payload.fonte_normativa_complementar
    || payload.fonteNormativa
    || payload.fonte_normativa
    || payload.fonte
  );
}

function hasValidComplementationSource(source = {}) {
  return !isBlank(source.titulo)
    && !isBlank(source.natureza)
    && !isBlank(source.grauConfianca)
    && (!isBlank(source.evidencia) || !isBlank(source.paginaPdf));
}

function getComplementationJustification(payload = {}, item = {}) {
  return normalizeText(
    item.justificativa
    || item.justificativaComplementacao
    || item.justificativa_complementacao
    || payload.justificativa
    || payload.justificativaComplementacao
    || payload.justificativa_complementacao
  );
}

function buildPayloadFromComplementationItem(item = {}, source = {}) {
  const payload = {};

  [
    ['nomeAtividade', 'nome_atividade'],
    ['parametroPrincipal', 'parametro_principal'],
    ['unidade', 'unidade'],
    ['observacaoInterna', 'observacao_interna'],
    ['fonteNormativa', 'fonte_normativa'],
  ].forEach(([camel, snake]) => {
    if (hasOwn(item, camel) || hasOwn(item, snake)) {
      payload[camel] = getField(item, camel, snake);
    }
  });

  const status = item.statusConferencia || item.status_conferencia || item.statusPretendido || item.status_pretendido;
  if (status !== undefined) payload.statusConferencia = status;

  const apto = item.aptoParaSeed ?? item.apto_para_seed ?? item.aptoParaSeedPretendido ?? item.apto_para_seed_pretendido;
  if (apto !== undefined) payload.aptoParaSeed = normalizeBoolean(apto);

  [
    ['dadosConferidos', 'dados_conferidos'],
    ['faixasConferidas', 'faixas_conferidas'],
    ['documentosConferidos', 'documentos_conferidos'],
    ['dependenciasSetoriais', 'dependencias_setoriais'],
    ['observacoesNormativas', 'observacoes_normativas'],
    ['evidenciaVisual', 'evidencia_visual'],
  ].forEach(([camel, snake]) => {
    if (hasOwn(item, camel) || hasOwn(item, snake)) {
      payload[camel] = getField(item, camel, snake);
    }
  });

  if (isBlank(payload.fonteNormativa) && !isBlank(source.titulo) && item.registrarFonteNormativa === true) {
    payload.fonteNormativa = source.titulo;
  }

  return payload;
}

function validateComplementationRecord(record, user) {
  const errors = [];
  const dados = asObject(record.dadosConferidos);
  const faixas = asArray(record.faixasConferidas);

  if (!STATUS_COMPLEMENTACAO_PERMITIDOS.includes(record.statusConferencia)) {
    errors.push('status_complementacao_invalido');
  }

  if (record.statusConferencia === 'conferido_integralmente' && hasActiveGap(record)) {
    errors.push('conferido_integralmente_com_lacuna_ativa');
  }

  if (record.aptoParaSeed === true) {
    if (record.statusConferencia !== 'conferido_integralmente') {
      errors.push('apto_para_seed_exige_conferido_integralmente');
    }

    if (hasActiveGap(record)) {
      errors.push('apto_para_seed_com_lacuna_ativa');
    }

    if (asArray(record.documentosConferidos).length === 0 && !hasDocumentJustification(dados)) {
      errors.push('documentos_minimos_ou_justificativa_normativa');
    }

    if (isBlank(record.fonteNormativa)) {
      errors.push('fonte_normativa');
    }

    if (isBlank(getEvidencePage(record.evidenciaVisual))) {
      errors.push('evidencia_visual_documental');
    }

    faixas.forEach((faixa) => {
      const ordem = faixa.ordem || '?';
      if (isBlank(getRangeClass(faixa)) && !hasClassJustification(faixa, dados)) {
        errors.push(`faixa_${ordem}_classe_ou_justificativa_normativa`);
      }

      if (isBlank(getRangeType(faixa)) && !hasTypeActJustification(faixa, dados)) {
        errors.push(`faixa_${ordem}_tipo_ato_ou_justificativa_normativa`);
      }
    });
  }

  if (record.statusConferencia === 'conferido_integralmente' || record.aptoParaSeed === true) {
    errors.push(...validateIntegralRecord(record, user, { throwOnError: false }));
  }

  const uniqueErrors = [...new Set(errors)];
  if (uniqueErrors.length > 0) {
    throw serviceError('Complementacao 2D.5C.3-A bloqueada por lacunas ou requisitos normativos pendentes.', 400, {
      camposPendentes: uniqueErrors,
    });
  }
}

async function aplicarComplementacaoGrupo21(payload = {}, user) {
  if (!normalizeBoolean(payload.confirmarAplicacaoComplementacao || payload.confirmar_aplicacao_complementacao)) {
    throw serviceError('Aplicacao de complementacao exige confirmarAplicacaoComplementacao: true.', 400, {
      tipo: 'confirmacao_obrigatoria',
    });
  }

  const complementacoes = getComplementationItems(payload);
  if (complementacoes.length === 0) {
    throw serviceError('Nenhuma complementacao foi informada para aplicacao controlada.', 400, {
      tipo: 'complementacoes_ausentes',
    });
  }

  const base = await getBaseVisualStatus();
  const beforeOperationalCount = await countOperationalGroup21Activities();
  const client = await db.connect();
  const aplicados = [];
  const aplicacaoId = `fase2d5c3a_${Date.now()}_${userId(user) || 'sem_usuario'}`;

  try {
    await client.query('BEGIN');

    for (const item of complementacoes) {
      const codigo = validateCodigo(item.codigo || item.codigoAtividade || item.codigo_atividade);
      const previous = await findManualRow(codigo);
      if (!previous) {
        throw serviceError(`Codigo ${codigo} nao possui registro ativo na bancada manual 2D.5C.2.`, 404, {
          codigo,
          tipo: 'registro_manual_ausente',
        });
      }

      const source = getComplementationSource(payload, item);
      if (!hasValidComplementationSource(source)) {
        throw serviceError('Complementacao exige fonte normativa/documental, natureza, grau de confianca e evidencia.', 400, {
          codigo,
          tipo: 'fonte_normativa_obrigatoria',
        });
      }

      const justificativa = getComplementationJustification(payload, item);
      const payloadItem = buildPayloadFromComplementationItem(item, source);
      const statusPretendido = payloadItem.statusConferencia || previous.status_conferencia;
      if (statusPretendido !== previous.status_conferencia && isBlank(justificativa)) {
        throw serviceError('Alteracao de status na complementacao exige justificativa expressa.', 400, {
          codigo,
          tipo: 'justificativa_status_obrigatoria',
        });
      }

      if (isBlank(justificativa)) {
        throw serviceError('Aplicacao de complementacao exige justificativa expressa.', 400, {
          codigo,
          tipo: 'justificativa_obrigatoria',
        });
      }

      const record = normalizeRecordPayload(codigo, base.byCode.get(codigo), previous, payloadItem);
      validateComplementationRecord(record, user);

      const row = await upsertRecord(client, record, previous, user, {
        markConferido: record.statusConferencia === 'conferido_integralmente',
      });

      await insertHistory(
        client,
        row,
        previous,
        user,
        'conferencia_complementar_2d5c3a_atualizar',
        justificativa,
        {
          faseComplementar: FASE_COMPLEMENTAR,
          aplicacaoId,
          codigo,
          fonteNormativa: source,
          camposRecebidos: Object.keys(item || {}),
          seedOperacionalCriado: false,
          tabelaOperacionalAlterada: false,
        }
      );

      aplicados.push({
        codigo,
        statusAnterior: previous.status_conferencia,
        statusConferencia: row.status_conferencia,
        aptoParaSeed: row.apto_para_seed === true,
        conferenciaId: row.id,
      });
    }

    const operationalCountInTransaction = await countOperationalGroup21Activities(client);
    if (operationalCountInTransaction !== beforeOperationalCount) {
      throw serviceError('Complementacao bloqueada: contagem operacional do Grupo 21 foi alterada durante a transacao.', 500);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const afterOperationalCount = await countOperationalGroup21Activities();
  return {
    success: true,
    fase: FASE_COMPLEMENTAR,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    modo: 'aplicacao_controlada_bancada_manual',
    aplicacaoId,
    totalRecebido: complementacoes.length,
    aplicados,
    seedOperacionalCriado: false,
    atividadesIncluidas: [],
    tabelaOperacionalAlterada: beforeOperationalCount !== afterOperationalCount,
    mensagem: 'Complementacao aplicada somente na bancada manual auditavel. Nenhum seed operacional foi executado.',
  };
}

async function getBloqueioNormativoGrupo21(user) {
  const [complementar, manualRows, operationalCount] = await Promise.all([
    getConferenciaComplementarGrupo21(),
    getManualRows(),
    countOperationalGroup21Activities(),
  ]);

  const resultadoPorCodigo = asArray(complementar.resultadoPorCodigo);
  const codigosComLacuna = resultadoPorCodigo.filter((item) => Number(item.lacunasRemanescentes || 0) > 0).length;
  const lacunasRemanescentes = Number(complementar.lacunasRemanescentes || 0);
  const codigosAptosParaSeed = Number(complementar.codigosAptosParaSeed || 0);

  return {
    fase: FASE_BLOQUEIO_NORMATIVO,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    statusGeral: STATUS_GERAL_BLOQUEIO_NORMATIVO,
    totalCodigos: EXPECTED_CODES.length,
    codigosComLacuna,
    codigosAptosParaSeed,
    lacunasRemanescentes,
    seedPermitido: false,
    atividadesOperacionaisGrupo21: operationalCount,
    motivoBloqueio: MOTIVO_BLOQUEIO_NORMATIVO,
    fontesNecessarias: FONTES_NECESSARIAS_BLOQUEIO_NORMATIVO,
    encaminhamentosRecomendados: ENCAMINHAMENTOS_BLOQUEIO_NORMATIVO,
    minutaSolicitacaoFonte: MINUTA_SOLICITACAO_FONTE_GRUPO21,
    proximaAcaoTecnica: 'Nao parametrizar operacionalmente o Grupo 21 ate recebimento e validacao de fonte municipal complementar segura.',
    registrosAtivosBancada: manualRows.length,
    seedOperacionalCriado: false,
    atividadesIncluidas: [],
    tabelaOperacionalAlterada: false,
    historicoPreservado: true,
    bloqueioAtivo: true,
    diagnosticoComplementar: {
      fase: complementar.fase,
      lacunasOriginais: complementar.lacunasOriginais,
      lacunasPreenchidas: complementar.lacunasPreenchidas,
      lacunasRemanescentes: complementar.lacunasRemanescentes,
      codigosBloqueados: complementar.codigosBloqueados,
      statusGeral: complementar.statusGeral,
    },
    resultadoPorCodigo: resultadoPorCodigo.map((item) => ({
      codigo: item.codigo,
      nomeAtividade: item.nomeAtividade,
      statusConferencia: item.statusAtual,
      lacunasRemanescentes: item.lacunasRemanescentes,
      camposComLacuna: item.camposComLacuna,
      aptoParaSeed: item.aptoParaSeedPretendido === true,
      bloqueado: true,
    })),
    permissoes: {
      visualizar: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
      auditar: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_AUDIT),
      registrarBloqueio: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_BLOCK),
    },
    alertas: [
      'Enquanto o bloqueio estiver ativo, o Grupo 21 nao deve ser parametrizado operacionalmente.',
      'O bloqueio normativo nao cria seed, nao altera licenciamento_atividades e nao modifica dados ja conferidos.',
      'A retomada depende de fonte municipal complementar segura.',
    ],
  };
}

async function registrarBloqueioNormativoGrupo21(payload = {}, user) {
  if (!hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_BLOCK)) {
    throw serviceError('Usuario sem permissao para registrar bloqueio normativo do Grupo 21.', 403, {
      tipo: 'permissao_bloqueio_normativo_obrigatoria',
    });
  }

  const justificativa = normalizeText(payload.justificativa || payload.justificativaBloqueio || payload.justificativa_bloqueio);
  if (isBlank(justificativa)) {
    throw serviceError('Registro de bloqueio normativo exige justificativa expressa.', 400, {
      tipo: 'justificativa_obrigatoria',
    });
  }

  const [diagnostico, manualRows] = await Promise.all([
    getBloqueioNormativoGrupo21(user),
    getManualRows(),
  ]);

  if (manualRows.length === 0) {
    throw serviceError('Nao ha registros ativos do Grupo 21 na bancada manual para registrar bloqueio normativo.', 400, {
      tipo: 'bancada_manual_sem_registros',
    });
  }

  const beforeOperationalCount = await countOperationalGroup21Activities();
  const registroId = `fase2d5c3b_${Date.now()}_${userId(user) || 'sem_usuario'}`;
  const client = await db.connect();
  const historicos = [];

  try {
    await client.query('BEGIN');

    for (const row of manualRows) {
      await insertHistory(
        client,
        row,
        row,
        user,
        'bloqueio_normativo_2d5c3b_registrar',
        justificativa,
        {
          faseBloqueio: FASE_BLOQUEIO_NORMATIVO,
          registroId,
          statusGeral: STATUS_GERAL_BLOQUEIO_NORMATIVO,
          codigo: row.codigo_atividade,
          lacunasRemanescentes: diagnostico.resultadoPorCodigo.find((item) => item.codigo === row.codigo_atividade)?.lacunasRemanescentes ?? null,
          seedPermitido: false,
          motivoBloqueio: MOTIVO_BLOQUEIO_NORMATIVO,
          fontesNecessarias: FONTES_NECESSARIAS_BLOQUEIO_NORMATIVO,
          seedOperacionalCriado: false,
          tabelaOperacionalAlterada: false,
        }
      );

      historicos.push({
        codigo: row.codigo_atividade,
        conferenciaId: row.id,
        statusConferencia: row.status_conferencia,
      });
    }

    const operationalCountInTransaction = await countOperationalGroup21Activities(client);
    if (operationalCountInTransaction !== beforeOperationalCount) {
      throw serviceError('Registro de bloqueio bloqueado: contagem operacional do Grupo 21 foi alterada durante a transacao.', 500);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const afterOperationalCount = await countOperationalGroup21Activities();
  return {
    success: true,
    fase: FASE_BLOQUEIO_NORMATIVO,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    statusGeral: STATUS_GERAL_BLOQUEIO_NORMATIVO,
    registroId,
    registrosHistoricoCriados: historicos.length,
    historicos,
    seedPermitido: false,
    seedOperacionalCriado: false,
    atividadesIncluidas: [],
    tabelaOperacionalAlterada: beforeOperationalCount !== afterOperationalCount,
    atividadesOperacionaisGrupo21: afterOperationalCount,
    mensagem: 'Bloqueio normativo registrado somente no historico da bancada manual. Nenhum seed operacional foi executado.',
  };
}

function summarizeManualRows(rows = []) {
  const byStatus = rows.reduce((acc, row) => {
    const status = row.status_conferencia || 'sem_status';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return {
    registrosAtivos: rows.length,
    porStatus: byStatus,
    conferidosComLacunas: byStatus.conferido_com_lacunas || 0,
    conferidosIntegralmente: byStatus.conferido_integralmente || 0,
    aptosParaSeedAnterior: rows.filter((row) => row.apto_para_seed === true).length,
  };
}

function buildRecomendacaoSeedRevisada(resumo) {
  return {
    modo: 'dry_run',
    aplicarSeedAutomatico: false,
    exigeConfirmacaoTecnicaPosterior: true,
    seedOperacionalCriado: false,
    codigosLiberaveisParaSeed: resumo.codigosAptos,
    codigosParciais: resumo.codigosParcialmenteAptos,
    codigosBloqueadosIntegralmente: resumo.codigosAindaBloqueados,
    subRegrasBloqueadas: resumo.bloqueiosMunicipais,
    lacunasReais: resumo.lacunasReais,
    recomendacao: 'Liberar em fase posterior somente os codigos integralmente aptos, manter regras parciais com bloqueios explicitos e nao aplicar seed operacional automatico nesta revisao.',
  };
}

function buildPreviaSeedRevisadaItem(item) {
  return {
    codigo: item.codigo,
    atividade: item.atividade,
    grupo: GRUPO,
    tipo: item.tipo,
    parametro: item.parametro,
    potencialPoluidorDegradador: item.potencialPoluidorDegradador,
    impactoLocal: item.impactoLocal,
    regras: item.regras,
    fonteNormativa: 'Planilha oficial de enquadramento apresentada para a Fase 2D.5C.4, com conferencia historica no Decreto Municipal n. 021/2020, Anexo II-A.',
    observacaoSeed: 'Previa revisada em modo dry-run. Nenhum registro foi inserido em licenciamento_atividades.',
  };
}

async function getRevisaoNormativaControladaGrupo21(user) {
  const [manualRows, operationalCount] = await Promise.all([
    getManualRows(),
    countOperationalGroup21Activities(),
  ]);
  const matriz = getMatrizRevisaoNormativaGrupo21();
  const resumo = buildResumoMatriz(matriz);
  const recomendacaoSeed = buildRecomendacaoSeedRevisada(resumo);

  return {
    fase: FASE_REVISAO_NORMATIVA,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    titulo: 'Grupo 21 - Revisao Normativa Controlada 2D.5C.4',
    statusGeral: resumo.codigosAindaBloqueados.length > 0
      ? 'revisao_controlada_com_bloqueios'
      : 'revisao_controlada_com_liberacao_parcial',
    fonteNormativaAnalisada: {
      principal: 'Planilha oficial de enquadramento do Grupo 21 apresentada para a Fase 2D.5C.4.',
      historicoConferido: 'Decreto Municipal n. 021/2020, Anexo II-A, PDF p. 69-70 / Diario Municipal p. 122-123.',
      observacao: 'A planilha saneia a leitura de campos de classe, porte, potencial e impacto local, mas nao autoriza transformar dispensa em licenca nem extrapolar limite municipal.',
    },
    totalCodigos: resumo.totalCodigos,
    codigosComFonteSuficiente: resumo.codigosComFonteSuficiente,
    totalCodigosComFonteSuficiente: resumo.codigosComFonteSuficiente.length,
    codigosAptos: resumo.codigosAptos,
    totalCodigosAptos: resumo.codigosAptos.length,
    codigosParcialmenteAptos: resumo.codigosParcialmenteAptos,
    totalCodigosParcialmenteAptos: resumo.codigosParcialmenteAptos.length,
    codigosAindaBloqueados: resumo.codigosAindaBloqueados,
    totalCodigosAindaBloqueados: resumo.codigosAindaBloqueados.length,
    codigosComRegraCondicional: resumo.codigosComRegraCondicional,
    totalCodigosComRegraCondicional: resumo.codigosComRegraCondicional.length,
    codigosComImpactoLocalLimitado: resumo.codigosComImpactoLocalLimitado,
    totalCodigosComImpactoLocalLimitado: resumo.codigosComImpactoLocalLimitado.length,
    lacunasReais: resumo.lacunasReais,
    totalLacunasReais: resumo.lacunasReais.length,
    camposNaoAplicaveis: resumo.camposNaoAplicaveis,
    totalCamposNaoAplicaveis: resumo.camposNaoAplicaveis.length,
    camposTodos: resumo.camposTodos,
    totalCamposTodos: resumo.camposTodos.length,
    camposDemaisCasos: resumo.camposDemaisCasos,
    totalCamposDemaisCasos: resumo.camposDemaisCasos.length,
    bloqueiosMunicipais: resumo.bloqueiosMunicipais,
    recomendacaoSeed,
    recomendacaoBloqueio: {
      bloqueioTotal: resumo.codigosAindaBloqueados,
      bloqueioParcial: [...new Set([
        ...resumo.codigosParcialmenteAptos,
        ...resumo.bloqueiosMunicipais.map((item) => item.codigo),
        ...resumo.lacunasReais.map((item) => item.codigo),
      ])],
      mensagem: 'Manter bloqueio parcial onde houver limite de impacto local, lacuna de igualdade ou regra condicional.',
    },
    interpretacaoObrigatoria: [
      '"-" foi tratado como nao aplicavel, nao como lacuna automatica.',
      '"Todos" foi tratado como valor normativo valido em classe ou impacto local.',
      '"Demais casos" foi tratado como regra residual valida.',
      'Dispensa condicionada nao foi convertida em licenca simplificada.',
      'Limites de impacto local foram preservados, com bloqueio para valores superiores.',
    ],
    resultadoPorCodigo: matriz,
    bancadaAtual: summarizeManualRows(manualRows),
    atividadesOperacionaisGrupo21: operationalCount,
    seedOperacionalCriado: false,
    tabelaOperacionalAlterada: false,
    atividadesIncluidas: [],
    permissoes: {
      visualizar: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
      auditar: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_AUDIT),
    },
  };
}

async function getPreviaSeedRevisaoNormativaGrupo21(user) {
  const beforeOperationalCount = await countOperationalGroup21Activities();
  const revisao = await getRevisaoNormativaControladaGrupo21(user);
  const afterOperationalCount = await countOperationalGroup21Activities();

  const previasSeed = revisao.resultadoPorCodigo
    .filter((item) => item.aptidaoSeed === 'sim')
    .map(buildPreviaSeedRevisadaItem);

  const previasParciais = revisao.resultadoPorCodigo
    .filter((item) => item.aptidaoSeed === 'parcial')
    .map((item) => ({
      codigo: item.codigo,
      atividade: item.atividade,
      statusRevisado: item.statusRevisado,
      aptidaoSeed: item.aptidaoSeed,
      regrasLiberaveis: item.regras.filter((regraItem) => regraItem.aptoParaSeedRevisado === true),
      regrasNaoLiberaveis: item.regras.filter((regraItem) => regraItem.aptoParaSeedRevisado === false),
      lacunasReais: item.lacunasReais,
      bloqueiosMunicipais: item.bloqueiosMunicipais,
      observacaoTecnica: item.observacaoTecnica,
    }));

  return {
    fase: FASE_REVISAO_NORMATIVA,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    modo: 'dry_run_seed_revisado',
    aplicaSeedAutomatico: false,
    geraSeed: false,
    seedOperacionalCriado: false,
    tabelaOperacionalAlterada: beforeOperationalCount !== afterOperationalCount,
    atividadesOperacionaisGrupo21Antes: beforeOperationalCount,
    atividadesOperacionaisGrupo21Depois: afterOperationalCount,
    atividadesIncluidas: [],
    totalCodigosGrupo: revisao.totalCodigos,
    totalCodigosLiberaveisParaSeed: previasSeed.length,
    codigosLiberaveisParaSeed: previasSeed.map((item) => item.codigo),
    totalCodigosParciais: previasParciais.length,
    codigosParciais: previasParciais.map((item) => item.codigo),
    previasSeed,
    previasParciais,
    bloqueios: [
      ...revisao.bloqueiosMunicipais,
      ...revisao.lacunasReais.map((item) => ({
        codigo: item.codigo,
        parametro: item.campo,
        condicao: item.campo,
        motivo: item.descricao,
        acao: 'bloquear_seed_integral',
      })),
    ],
    recomendacao: revisao.recomendacaoSeed.recomendacao,
    alertas: [
      'Esta previa apenas simula a liberacao revisada. Nenhum seed operacional foi aplicado.',
      'Codigos parciais exigem parametrizacao especifica e bloqueio das faixas nao municipais ou lacunosas.',
      'Dispensa condicionada nao deve ser tratada como licenca simplificada.',
    ],
  };
}

function toJson(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function normalizeCodeList(codes = []) {
  return [...new Set(asArray(codes).map((code) => String(code).trim()).filter(Boolean))].sort();
}

function sameCodeSet(left = [], right = []) {
  const normalizedLeft = normalizeCodeList(left);
  const normalizedRight = normalizeCodeList(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((code, index) => code === normalizedRight[index]);
}

async function getOperationalGroup21Rows(client = db) {
  const result = await client.query(
    `
      SELECT id, codigo, nome, ativo, seed_piloto_codigo, created_at, updated_at
      FROM licenciamento_atividades
      WHERE deleted_at IS NULL
        AND codigo LIKE '21.%'
      ORDER BY codigo;
    `
  );
  return result.rows;
}

function buildOperationalConflictReport(rows = []) {
  const allowedRows = rows.filter((row) => CODIGOS_APTOS_SEED_CONTROLADO.includes(row.codigo));
  const partialRows = rows.filter((row) => CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO.includes(row.codigo));
  const unexpectedRows = rows.filter((row) => !CODIGOS_APTOS_SEED_CONTROLADO.includes(row.codigo)
    && !CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO.includes(row.codigo));
  const foreignAllowedRows = allowedRows.filter((row) => row.seed_piloto_codigo !== SEED_CODE_GRUPO21_2D5C5);
  const appliedAllowedCodes = allowedRows
    .filter((row) => row.seed_piloto_codigo === SEED_CODE_GRUPO21_2D5C5 && row.ativo === true)
    .map((row) => row.codigo)
    .sort();
  const pendingAllowedCodes = CODIGOS_APTOS_SEED_CONTROLADO.filter((code) => !appliedAllowedCodes.includes(code));
  const duplicateCodes = rows.reduce((acc, row) => {
    acc[row.codigo] = (acc[row.codigo] || 0) + 1;
    return acc;
  }, {});

  return {
    totalRegistrosGrupo21: rows.length,
    totalAtivosGrupo21: rows.filter((row) => row.ativo === true).length,
    codigosAptosJaAplicados: appliedAllowedCodes,
    codigosAptosPendentes: pendingAllowedCodes,
    codigosParciaisOperacionais: partialRows.map((row) => row.codigo),
    codigosAptosComOrigemConflitante: foreignAllowedRows.map((row) => row.codigo),
    codigosInesperadosGrupo21: unexpectedRows.map((row) => row.codigo),
    codigosDuplicados: Object.entries(duplicateCodes)
      .filter(([, total]) => total > 1)
      .map(([codigo]) => codigo),
    tabelaSemParciaisOperacionais: partialRows.length === 0,
    tabelaSemConflitos: partialRows.length === 0
      && unexpectedRows.length === 0
      && foreignAllowedRows.length === 0
      && Object.values(duplicateCodes).every((total) => total === 1),
  };
}

function buildAtividadePrevistaSeedControlado(item, conflictReport) {
  const jaAplicado = conflictReport.codigosAptosJaAplicados.includes(item.codigo);
  return {
    codigo: item.codigo,
    descricao: item.descricao,
    grupo: item.grupo,
    parametro: item.parametroPrincipal,
    potencialPoluidorDegradador: item.potencialPoluidorDegradador,
    impactoLocal: item.impactoLocal,
    regraNormativaEnquadramento: item.regraNormativaEnquadramento,
    tipoAtoLicenciamento: item.tipoAtoLicenciamento,
    fundamentoLiberacao: item.fundamentoLiberacao,
    status: item.status,
    jaAplicado,
    acaoPrevista: jaAplicado ? 'atualizar_idempotente' : 'inserir',
    regrasPrevistas: item.regras.map((regraItem) => ({
      id: regraItem.id,
      expressao: regraItem.expressao,
      porte: regraItem.porte,
      tipoLicenca: regraItem.tipoLicenca,
      classe: regraItem.classe,
      potencial: regraItem.potencial,
    })),
    observacao: item.observacao,
  };
}

async function getPreviaSeedControladoGrupo21(user) {
  const matriz = getMatrizSeedControladoGrupo21();
  const matrizValidation = validateMatrizSeedControladoGrupo21(matriz);
  const revisaoResumo = buildResumoMatriz(getMatrizRevisaoNormativaGrupo21());
  const revisionCodesOk = sameCodeSet(revisaoResumo.codigosAptos, CODIGOS_APTOS_SEED_CONTROLADO)
    && sameCodeSet(revisaoResumo.codigosParcialmenteAptos, CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO);
  const rows = await getOperationalGroup21Rows();
  const conflictReport = buildOperationalConflictReport(rows);
  const bloqueiosParciais = getBloqueiosCodigosParciaisGrupo21();
  const blocked = !matrizValidation.success || !revisionCodesOk || !conflictReport.tabelaSemConflitos;
  const allApplied = conflictReport.codigosAptosPendentes.length === 0
    && sameCodeSet(conflictReport.codigosAptosJaAplicados, CODIGOS_APTOS_SEED_CONTROLADO);

  return {
    fase: FASE_SEED_CONTROLADO,
    faseOrigem: FASE_REVISAO_NORMATIVA,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    modo: 'previa_seed_controlado',
    aplicaSeedGeralGrupo21: false,
    totalCodigosAptos: CODIGOS_APTOS_SEED_CONTROLADO.length,
    codigosAptos: CODIGOS_APTOS_SEED_CONTROLADO,
    codigosParciaisBloqueados: CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO,
    bloqueiosParciais,
    matrizOperacional: matriz.map((item) => buildAtividadePrevistaSeedControlado(item, conflictReport)),
    atividadesQueSeriamInseridas: matriz
      .filter((item) => conflictReport.codigosAptosPendentes.includes(item.codigo))
      .map((item) => buildAtividadePrevistaSeedControlado(item, conflictReport)),
    validacoes: {
      matrizContemSomenteCodigosAptos: matrizValidation.success,
      detalhesMatriz: matrizValidation,
      revisao2d5c4MantemCodigosAprovados: revisionCodesOk,
      nenhumCodigoParcialNaMatriz: matrizValidation.partialCodesIncluded.length === 0,
      nenhumCodigoParcialNaTabelaOperacional: conflictReport.tabelaSemParciaisOperacionais,
      tabelaSemConflitos: conflictReport.tabelaSemConflitos,
      nenhumSeedGeral: true,
      naoConverteDispensaEmLicenca: true,
      codigosProibidosAusentesDaAplicacao: CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO.every((code) => !matrizValidation.actualCodes.includes(code)),
    },
    tabelaOperacional: conflictReport,
    statusGeral: blocked
      ? 'bloqueado'
      : allApplied
        ? 'aplicado_idempotente'
        : 'apto_para_aplicacao_controlada',
    aplicacaoPermitida: !blocked,
    riscos: [
      'Nao aplicar seed geral do Grupo 21.',
      'Nao parametrizar 21.01, 21.04, 21.06 ou 21.09 nesta rodada.',
      'Nao converter dispensa condicionada em licenca simplificada.',
      'Manter bloqueadas as situacoes NE > 5, EV = 30 e CE > 30 ate fonte complementar.',
    ],
    mensagensAuditoria: [
      'Previa baseada na matriz normativa aprovada na Fase 2D.5C.4.',
      'A aplicacao controlada exige confirmacao explicita e permissao de aplicacao/importacao de parametrizacao.',
      'Registros existentes dos seis codigos com origem fase2d5c5 sao tratados como idempotentes, nao como conflito.',
    ],
    permissoes: {
      visualizar: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
      aplicar: hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_APPLY),
    },
  };
}

async function getSeedControladoLookups(client) {
  const tipos = await client.query('SELECT id, codigo FROM licenciamento_tipos_licenca WHERE deleted_at IS NULL;');
  const classes = await client.query('SELECT id, codigo FROM licenciamento_classes WHERE deleted_at IS NULL;');
  const potenciais = await client.query('SELECT id, codigo FROM licenciamento_potenciais_poluidor WHERE deleted_at IS NULL;');
  const normas = await client.query("SELECT id, codigo FROM licenciamento_normas WHERE deleted_at IS NULL AND codigo IN ('DECRETO_MUNICIPAL_021_2020', 'ANEXO_II_A', 'CONSEMA_001_2022_REFERENCIA');");

  const toMap = (rows) => Object.fromEntries(rows.map((row) => [row.codigo, row]));
  return {
    tipos: toMap(tipos.rows),
    classes: toMap(classes.rows),
    potenciais: toMap(potenciais.rows),
    normas: toMap(normas.rows),
  };
}

function requireSeedLookup(lookup, key, label) {
  if (!key) return null;
  const item = lookup[key];
  if (!item) {
    throw serviceError(`Parametro base ausente para seed controlado 2D.5C.5: ${label} ${key}.`, 409, {
      tipo: 'lookup_operacional_ausente',
      label,
      key,
    });
  }
  return item.id;
}

function buildSeedControladoActivityPayload(item) {
  return {
    codigo: item.codigo,
    nome: item.nome,
    descricao: item.descricao,
    categoria: item.categoria,
    unidade_parametro_principal: item.parametroPrincipal.unidade,
    parametro_principal_label: item.parametroPrincipal.label,
    potencial_poluidor_padrao: item.potencialPoluidorPadrao,
    limite_impacto_local_tipo: item.limiteImpactoLocal.tipo,
    limite_impacto_local_valor: item.limiteImpactoLocal.valor,
    limite_impacto_local_unidade: item.limiteImpactoLocal.unidade,
    mensagem_extrapolacao_competencia: 'A informacao prestada excede o limite de impacto local reconhecido na matriz municipal ou pertence a codigo parcial ainda bloqueado. Recomenda-se consulta formal a SMAD.',
    expressao_original: item.regraNormativaEnquadramento,
    fundamento_normativo: item.fundamentoNormativo,
    tipo_atividade: item.tipoAtividade,
    formula_codigo: null,
    parametros_entrada: toJson(item.parametrosEntrada),
    perguntas_publicas: toJson(item.perguntasPublicas),
    bloqueios_publicos: toJson(item.bloqueiosPublicos),
    alertas_publicos: toJson(item.alertasPublicos),
    validacoes_requeridas: toJson(item.validacoesRequeridas),
    seed_piloto_codigo: SEED_CODE_GRUPO21_2D5C5,
    ativo: true,
    observacoes: [
      'status_normativo=apto_seed_controlado_2d5c5',
      item.fundamentoLiberacao,
      item.observacao,
    ].filter(Boolean).join(' | '),
  };
}

async function upsertSeedControladoActivity(client, item) {
  const existing = await client.query(
    'SELECT id, seed_piloto_codigo FROM licenciamento_atividades WHERE deleted_at IS NULL AND LOWER(codigo) = LOWER($1) LIMIT 1;',
    [item.codigo]
  );

  if (existing.rows[0] && existing.rows[0].seed_piloto_codigo !== SEED_CODE_GRUPO21_2D5C5) {
    throw serviceError(`Atividade ${item.codigo} ja existe com origem operacional diferente da Fase 2D.5C.5.`, 409, {
      tipo: 'atividade_grupo21_origem_conflitante',
      codigo: item.codigo,
      seed_piloto_codigo: existing.rows[0].seed_piloto_codigo,
    });
  }

  const payload = buildSeedControladoActivityPayload(item);
  const fields = Object.keys(payload);

  if (existing.rows[0]) {
    const values = fields.map((field) => payload[field]);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    values.push(existing.rows[0].id);
    const row = (await client.query(
      `UPDATE licenciamento_atividades SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *;`,
      values
    )).rows[0];
    return { row, acao: 'atualizado' };
  }

  const values = fields.map((field) => payload[field]);
  const placeholders = fields.map((_, index) => `$${index + 1}`);
  const row = (await client.query(
    `INSERT INTO licenciamento_atividades (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *;`,
    values
  )).rows[0];
  return { row, acao: 'inserido' };
}

async function upsertSeedControladoRuleParameter(client, ruleRow, item, regraItem) {
  const parametro = item.parametroPrincipal;
  await client.query(
    `
      INSERT INTO licenciamento_regra_parametros (
        regra_enquadramento_id,
        parametro_chave,
        parametro_label,
        parametro_unidade,
        operador,
        valor_minimo,
        valor_maximo,
        inclui_minimo,
        inclui_maximo,
        obrigatorio,
        ordem,
        expressao_original
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 1, $10)
      ON CONFLICT (regra_enquadramento_id, parametro_chave)
      WHERE deleted_at IS NULL
      DO UPDATE SET
        parametro_label = EXCLUDED.parametro_label,
        parametro_unidade = EXCLUDED.parametro_unidade,
        operador = EXCLUDED.operador,
        valor_minimo = EXCLUDED.valor_minimo,
        valor_maximo = EXCLUDED.valor_maximo,
        inclui_minimo = EXCLUDED.inclui_minimo,
        inclui_maximo = EXCLUDED.inclui_maximo,
        obrigatorio = EXCLUDED.obrigatorio,
        ordem = EXCLUDED.ordem,
        expressao_original = EXCLUDED.expressao_original,
        updated_at = CURRENT_TIMESTAMP;
    `,
    [
      ruleRow.id,
      parametro.chave,
      parametro.label,
      parametro.unidade,
      regraItem.operadorParametro,
      regraItem.valorMinimo,
      regraItem.valorMaximo,
      regraItem.incluiMinimo,
      regraItem.incluiMaximo,
      regraItem.expressao,
    ]
  );
}

async function upsertSeedControladoRule(client, activityRow, item, regraItem, lookups) {
  const seedCode = `${SEED_CODE_GRUPO21_2D5C5}:${activityRow.codigo}:${regraItem.id}`;
  const existing = await client.query(
    'SELECT id FROM licenciamento_regras_enquadramento WHERE deleted_at IS NULL AND seed_piloto_codigo = $1 LIMIT 1;',
    [seedCode]
  );

  const payload = {
    atividade_id: activityRow.id,
    tipo_licenca_id: requireSeedLookup(lookups.tipos, regraItem.tipoLicenca, 'tipo de licenca'),
    classe_id: requireSeedLookup(lookups.classes, regraItem.classe, 'classe'),
    potencial_poluidor_id: requireSeedLookup(lookups.potenciais, regraItem.potencial, 'potencial'),
    parametro_nome: item.parametroPrincipal.label,
    parametro_unidade: item.parametroPrincipal.unidade,
    valor_minimo: regraItem.valorMinimo,
    valor_maximo: regraItem.valorMaximo,
    operador: regraItem.operadorRegra,
    porte_resultante: regraItem.porte,
    dispensa_possivel: false,
    exige_vistoria: false,
    exige_estudo_ambiental: false,
    exige_anuencia: false,
    exige_georreferenciamento: false,
    observacao_publica: 'Resultado preliminar, orientativo e sujeito a validacao tecnica da SMAD.',
    observacao_interna: `${regraItem.observacao} Fundamento: ${item.fundamentoLiberacao}`,
    fundamento_normativo: item.fundamentoNormativo,
    expressao_original: regraItem.expressao,
    requer_validacao_tecnica: true,
    limite_impacto_local_tipo: null,
    limite_impacto_local_valor: null,
    limite_impacto_local_unidade: null,
    mensagem_extrapolacao_competencia: null,
    tipo_calculo: 'nenhum',
    formula_codigo: null,
    parametros_entrada: toJson(item.parametrosEntrada),
    status_resultado: regraItem.statusResultado,
    tipo_resultado: regraItem.tipoResultado,
    alertas_tecnicos: toJson([
      'Seed controlado 2D.5C.5.',
      'Nao aplicar aos codigos parciais 21.01, 21.04, 21.06 ou 21.09.',
    ]),
    bloqueios: toJson([]),
    seed_piloto_codigo: seedCode,
    ativo: true,
  };
  const fields = Object.keys(payload);
  let row;
  let acao;

  if (existing.rows[0]) {
    const values = fields.map((field) => payload[field]);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    values.push(existing.rows[0].id);
    row = (await client.query(
      `UPDATE licenciamento_regras_enquadramento SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *;`,
      values
    )).rows[0];
    acao = 'atualizada';
  } else {
    const values = fields.map((field) => payload[field]);
    const placeholders = fields.map((_, index) => `$${index + 1}`);
    row = (await client.query(
      `INSERT INTO licenciamento_regras_enquadramento (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *;`,
      values
    )).rows[0];
    acao = 'inserida';
  }

  await upsertSeedControladoRuleParameter(client, row, item, regraItem);
  return { row, acao, seedCode };
}

async function insertSeedControladoAudit(client, user, dados) {
  const result = await client.query(
    `
      INSERT INTO audit_logs (ator_tipo, ator_id, acao, entidade, entidade_id, dados)
      VALUES ('usuario_interno', $1, $2, 'licenciamento_atividades', NULL, $3::jsonb)
      RETURNING id;
    `,
    [
      userId(user),
      'licenciamento.parametrizacao.fase2d5c5.grupo21.aplicar_seed_controlado',
      JSON.stringify(dados),
    ]
  );
  return result.rows[0]?.id || null;
}

function assertSeedControladoConfirmado(payload = {}) {
  const confirmed = payload.confirmarAplicacao === true
    || payload.confirmarSeedControlado === true
    || payload.confirmar_aplicacao === true;

  if (!confirmed) {
    throw serviceError('Aplicacao do seed controlado 2D.5C.5 exige confirmacao explicita.', 400, {
      tipo: 'confirmacao_obrigatoria',
      campo: 'confirmarAplicacao',
    });
  }

  const requestedCodes = normalizeCodeList(payload.codigos || payload.codigosAplicacao || payload.codigos_aplicacao || []);
  if (requestedCodes.length > 0 && !sameCodeSet(requestedCodes, CODIGOS_APTOS_SEED_CONTROLADO)) {
    throw serviceError('Aplicacao bloqueada: lista de codigos difere dos seis codigos integralmente aptos.', 400, {
      tipo: 'codigos_aplicacao_invalidos',
      codigosRecebidos: requestedCodes,
      codigosPermitidos: CODIGOS_APTOS_SEED_CONTROLADO,
    });
  }
}

async function aplicarSeedControladoGrupo21(payload = {}, user) {
  if (!hasPermission(user, PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_APPLY)) {
    throw serviceError('Usuario sem permissao para aplicar seed controlado do Grupo 21.', 403, {
      tipo: 'permissao_aplicacao_seed_controlado_obrigatoria',
    });
  }

  assertSeedControladoConfirmado(payload);

  const previa = await getPreviaSeedControladoGrupo21(user);
  if (!previa.aplicacaoPermitida) {
    throw serviceError('Aplicacao do seed controlado 2D.5C.5 bloqueada pela previa.', 409, {
      tipo: 'previa_bloqueada',
      statusGeral: previa.statusGeral,
      validacoes: previa.validacoes,
      tabelaOperacional: previa.tabelaOperacional,
    });
  }

  const matriz = getMatrizSeedControladoGrupo21();
  const matrizValidation = validateMatrizSeedControladoGrupo21(matriz);
  if (!matrizValidation.success) {
    throw serviceError('Matriz operacional 2D.5C.5 invalida para aplicacao.', 409, matrizValidation);
  }

  const client = await db.connect();
  const atividades = [];
  const regras = [];
  let auditLogId = null;

  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('licenciamento_fase2d5c5_grupo21_seed_controlado'));");

    const rowsInTransaction = await getOperationalGroup21Rows(client);
    const transactionConflictReport = buildOperationalConflictReport(rowsInTransaction);
    if (!transactionConflictReport.tabelaSemConflitos) {
      throw serviceError('Aplicacao bloqueada: tabela operacional do Grupo 21 contem conflito ou codigo parcial.', 409, {
        tipo: 'conflito_operacional_grupo21',
        tabelaOperacional: transactionConflictReport,
      });
    }

    const lookups = await getSeedControladoLookups(client);

    for (const item of matriz) {
      if (!CODIGOS_APTOS_SEED_CONTROLADO.includes(item.codigo)) {
        throw serviceError(`Codigo ${item.codigo} nao autorizado para seed controlado 2D.5C.5.`, 409);
      }

      const activityResult = await upsertSeedControladoActivity(client, item);
      atividades.push({
        codigo: item.codigo,
        id: activityResult.row.id,
        acao: activityResult.acao,
      });

      for (const regraItem of item.regras) {
        const ruleResult = await upsertSeedControladoRule(client, activityResult.row, item, regraItem, lookups);
        regras.push({
          codigo: item.codigo,
          regra: regraItem.id,
          id: ruleResult.row.id,
          acao: ruleResult.acao,
          seedCode: ruleResult.seedCode,
        });
      }
    }

    const finalRows = await getOperationalGroup21Rows(client);
    const finalConflictReport = buildOperationalConflictReport(finalRows);
    if (!sameCodeSet(finalConflictReport.codigosAptosJaAplicados, CODIGOS_APTOS_SEED_CONTROLADO)
      || !finalConflictReport.tabelaSemConflitos) {
      throw serviceError('Aplicacao bloqueada apos validacao final: resultado operacional nao corresponde aos seis codigos aptos.', 500, {
        tipo: 'validacao_final_seed_controlado_falhou',
        tabelaOperacional: finalConflictReport,
      });
    }

    const auditPayload = {
      fase: FASE_SEED_CONTROLADO,
      faseOrigem: FASE_REVISAO_NORMATIVA,
      seedGeralGrupo21: false,
      codigosAplicados: CODIGOS_APTOS_SEED_CONTROLADO,
      codigosParciaisPreservados: CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO,
      subRegrasBloqueadas: getBloqueiosCodigosParciaisGrupo21(),
      atividades,
      regras: regras.map((item) => ({ codigo: item.codigo, regra: item.regra, acao: item.acao })),
      tabelaOperacionalAntes: previa.tabelaOperacional,
      tabelaOperacionalDepois: finalConflictReport,
    };
    auditLogId = await insertSeedControladoAudit(client, user, auditPayload);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const depois = await getPreviaSeedControladoGrupo21(user);

  return {
    success: true,
    fase: FASE_SEED_CONTROLADO,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    seedGeralGrupo21: false,
    seedControladoAplicado: true,
    idempotente: atividades.every((item) => item.acao === 'atualizado'),
    codigosInseridos: atividades.filter((item) => item.acao === 'inserido').map((item) => item.codigo),
    codigosAtualizados: atividades.filter((item) => item.acao === 'atualizado').map((item) => item.codigo),
    codigosAplicados: atividades.map((item) => item.codigo).sort(),
    codigosParciaisPreservados: CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO,
    subRegrasBloqueadas: getBloqueiosCodigosParciaisGrupo21(),
    totalAtividadesAfetadas: atividades.length,
    totalRegrasAfetadas: regras.length,
    atividades,
    regras,
    auditoria: {
      registrada: Boolean(auditLogId),
      auditLogId,
      acao: 'licenciamento.parametrizacao.fase2d5c5.grupo21.aplicar_seed_controlado',
    },
    tabelaOperacionalAntes: previa.tabelaOperacional,
    tabelaOperacionalDepois: depois.tabelaOperacional,
    mensagem: 'Seed controlado 2D.5C.5 aplicado somente aos seis codigos integralmente aptos do Grupo 21.',
  };
}

function normalizePreviewInput(input = {}) {
  if (Object.prototype.hasOwnProperty.call(input, 'codigo_atividade')) {
    return mapRow(input);
  }

  return {
    id: input.id || null,
    fase: input.fase || FASE,
    grupo: input.grupo ?? input.grupoNumero ?? input.grupo_numero ?? GRUPO,
    nomeGrupo: input.nomeGrupo || input.grupoNome || input.grupo_nome || NOME_GRUPO,
    codigo: input.codigo || input.codigoAtividade || input.codigo_atividade || '',
    nomeAtividade: input.nomeAtividade || input.nome_atividade || '',
    parametroPrincipal: input.parametroPrincipal || input.parametro_principal || '',
    unidade: input.unidade || '',
    dadosConferidos: asObject(input.dadosConferidos || input.dados_conferidos),
    faixasConferidas: asArray(input.faixasConferidas || input.faixas_conferidas),
    documentosConferidos: asArray(input.documentosConferidos || input.documentos_conferidos),
    dependenciasSetoriais: asArray(input.dependenciasSetoriais || input.dependencias_setoriais),
    observacoesNormativas: asArray(input.observacoesNormativas || input.observacoes_normativas),
    evidenciaVisual: asObject(input.evidenciaVisual || input.evidencia_visual),
    statusConferencia: input.statusConferencia || input.status_conferencia || 'pendente_conferencia',
    statusConferenciaManual: input.statusConferenciaManual || input.statusConferencia || input.status_conferencia || 'pendente_conferencia',
    aptoParaSeed: input.aptoParaSeed === true || input.apto_para_seed === true,
    aptoParaSeedFuturo: input.aptoParaSeedFuturo === true || input.aptoParaSeed === true || input.apto_para_seed === true,
    fonteNormativa: input.fonteNormativa || input.fonte_normativa || '',
    observacaoInterna: input.observacaoInterna || input.observacao_interna || '',
  };
}

function buildInconsistencia(record, tipo, mensagem, campo = null, faixaOrdem = null) {
  return {
    codigo: record.codigo || null,
    origemConferenciaId: record.id || null,
    tipo,
    campo,
    faixaOrdem,
    severidade: 'bloqueante',
    mensagem,
  };
}

function evaluateRegistroParaPreviaSeed(input) {
  const record = normalizePreviewInput(input);
  const dados = asObject(record.dadosConferidos);
  const faixas = asArray(record.faixasConferidas);
  const inconsistencias = [];
  const bloqueios = [];

  function block(tipo, mensagem, campo = null, faixaOrdem = null) {
    bloqueios.push(tipo);
    inconsistencias.push(buildInconsistencia(record, tipo, mensagem, campo, faixaOrdem));
  }

  if (Number(record.grupo) !== GRUPO) {
    block('codigo_fora_do_grupo_21', 'Registro de conferencia pertence a grupo diferente do Grupo 21.', 'grupo');
  }

  if (!EXPECTED_CODES.includes(record.codigo)) {
    block('codigo_nao_esperado_grupo_21', 'Codigo da conferencia nao pertence ao intervalo esperado 21.01 a 21.10.', 'codigo');
  }

  if (record.aptoParaSeedFuturo === true && record.statusConferencia !== 'conferido_integralmente') {
    block('apto_seed_status_invalido', 'Registro marcado como apto_para_seed possui status diferente de conferido_integralmente.', 'status_conferencia');
  }

  if (record.statusConferencia !== 'conferido_integralmente') {
    bloqueios.push(`status_${record.statusConferencia || 'ausente'}`);
  }

  if (record.aptoParaSeedFuturo !== true) {
    bloqueios.push('apto_para_seed_false');
  }

  if (isBlank(record.nomeAtividade)) {
    block('campo_obrigatorio_ausente', 'Nome oficial da atividade ausente.', 'nome_atividade');
  }

  if (isBlank(record.parametroPrincipal)) {
    block('campo_obrigatorio_ausente', 'Parametro principal ausente.', 'parametro_principal');
  }

  if (isBlank(record.unidade)) {
    block('campo_obrigatorio_ausente', 'Unidade ausente.', 'unidade');
  }

  if (faixas.length === 0 && !hasRangeNotApplicableJustification(dados)) {
    block('faixa_ausente_sem_justificativa', 'Nao ha faixa conferida nem justificativa valida de nao aplicabilidade.', 'faixas_conferidas');
  }

  faixas.forEach((faixa, index) => {
    const ordem = faixa.ordem || index + 1;
    const operador = getRangeOperator(faixa);
    const valorInicial = toFiniteNumber(getRangeInitialValue(faixa));
    const valorFinal = toFiniteNumber(getRangeFinalValue(faixa));
    const faixaText = getRangeText(faixa);
    const faixaObservation = faixa.observacao || faixa.justificativa || '';
    const classe = getRangeClass(faixa);
    const tipoAto = getRangeType(faixa);

    if (isBlank(operador)) {
      block('faixa_sem_operador', 'Faixa sem operador.', 'operador', ordem);
    } else if (!OPERADORES_PERMITIDOS.includes(operador)) {
      block('faixa_operador_invalido', 'Faixa possui operador fora da lista permitida.', 'operador', ordem);
    }

    if (valorInicial === null && valorFinal === null && isBlank(faixaText) && isBlank(faixaObservation)) {
      block('faixa_sem_valor_ou_justificativa', 'Faixa sem valor e sem justificativa textual.', 'faixas_conferidas', ordem);
    }

    if (valorInicial !== null && valorFinal !== null && valorInicial > valorFinal) {
      block('faixa_valor_inicial_maior_final', 'Faixa possui valor inicial maior que valor final.', 'faixas_conferidas', ordem);
    }

    if (!sameUnit(record.unidade, getRangeUnit(faixa))) {
      block('unidade_divergente_faixa', 'Unidade da faixa diverge da unidade do parametro principal.', 'unidade', ordem);
    }

    if (isBlank(classe) && !hasClassJustification(faixa, dados)) {
      block('classe_ausente_sem_justificativa', 'Classe ausente sem justificativa.', 'classe', ordem);
    }

    if (isBlank(tipoAto) && !hasTypeActJustification(faixa, dados)) {
      block('tipo_ato_ausente_sem_justificativa', 'Tipo de ato/licenca ausente sem justificativa.', 'tipo_ato', ordem);
    }
  });

  if (isBlank(getEvidencePage(record.evidenciaVisual))) {
    block('evidencia_visual_ausente', 'Evidencia visual com pagina do PDF ausente.', 'evidencia_visual');
  }

  if (isBlank(record.fonteNormativa)) {
    block('fonte_normativa_ausente', 'Fonte normativa ausente.', 'fonte_normativa');
  }

  if (record.statusConferencia === 'conferido_integralmente') {
    const requiredMissing = inconsistencias.some((item) => [
      'campo_obrigatorio_ausente',
      'faixa_ausente_sem_justificativa',
      'evidencia_visual_ausente',
      'fonte_normativa_ausente',
    ].includes(item.tipo));

    if (requiredMissing) {
      inconsistencias.push(buildInconsistencia(
        record,
        'conferido_integralmente_campos_obrigatorios_ausentes',
        'Codigo conferido integralmente possui campos obrigatorios ausentes.',
        'status_conferencia'
      ));
      bloqueios.push('conferido_integralmente_campos_obrigatorios_ausentes');
    }
  }

  if (record.aptoParaSeedFuturo === true && hasActiveGap(record)) {
    block('lacuna_ativa_codigo_apto', 'Codigo marcado como apto possui lacuna ativa.', 'dados_conferidos.lacunasAtivas');
  }

  const uniqueBloqueios = [...new Set(bloqueios)];
  const structuralInconsistencies = inconsistencias.length > 0;
  const pronto = record.statusConferencia === 'conferido_integralmente'
    && record.aptoParaSeedFuturo === true
    && !structuralInconsistencies
    && EXPECTED_CODES.includes(record.codigo)
    && Number(record.grupo) === GRUPO;

  return {
    record,
    pronto,
    bloqueios: uniqueBloqueios,
    inconsistencias,
  };
}

function buildPreviaSeedFromRecord(record) {
  const faixas = asArray(record.faixasConferidas);
  const firstClass = faixas.find((faixa) => !isBlank(getRangeClass(faixa)));
  const firstType = faixas.find((faixa) => !isBlank(getRangeType(faixa)));

  return {
    codigo: record.codigo,
    nomeAtividade: record.nomeAtividade,
    grupo: GRUPO,
    parametroPrincipal: record.parametroPrincipal,
    unidade: record.unidade,
    faixas: faixas.map((faixa, index) => ({
      ordem: faixa.ordem || index + 1,
      operador: getRangeOperator(faixa),
      valorInicial: getRangeInitialValue(faixa),
      valorFinal: getRangeFinalValue(faixa),
      unidade: getRangeUnit(faixa) || record.unidade,
      textoNormativo: getRangeText(faixa),
      porte: faixa.porte || '',
      classe: getRangeClass(faixa),
      tipoAto: getRangeType(faixa),
      limiteImpactoLocal: faixa.limiteImpactoLocal || faixa.limite_impacto_local || '',
      observacao: faixa.observacao || '',
    })),
    classe: firstClass ? getRangeClass(firstClass) : '',
    tipoAto: firstType ? getRangeType(firstType) : '',
    fonteNormativa: record.fonteNormativa,
    origemConferenciaId: record.id,
    observacaoSeed: 'Previa gerada em modo dry-run. Nao inserida no banco operacional.',
  };
}

function buildBlockFromEvaluation(evaluation, baseItem = null) {
  return {
    codigo: evaluation.record.codigo,
    nomeAtividade: evaluation.record.nomeAtividade || baseItem?.nomeAtividade || '',
    statusConferencia: evaluation.record.statusConferencia,
    aptoParaSeed: evaluation.record.aptoParaSeedFuturo === true,
    origemConferenciaId: evaluation.record.id || null,
    motivos: evaluation.bloqueios,
  };
}

function getPreviaRecommendation(codigosAptosParaSeed, inconsistencias) {
  if (codigosAptosParaSeed === 0) {
    return 'Concluir a conferencia manual dos codigos na bancada 2D.5C.2 antes de iniciar seed controlado.';
  }

  if (codigosAptosParaSeed > 0 && codigosAptosParaSeed < EXPECTED_CODES.length) {
    return 'Usar as fases posteriores de revisao/seed controlado para liberar apenas codigos aptos, mantendo bloqueio dos demais.';
  }

  if (codigosAptosParaSeed === EXPECTED_CODES.length && inconsistencias.length === 0) {
    return 'Executar seed controlado somente em fase operacional propria e auditavel, sem seed geral automatico do Grupo 21.';
  }

  return 'Corrigir inconsistencias bloqueantes na bancada 2D.5C.2 antes de qualquer seed controlado.';
}

async function getPreviaSeedGrupo21() {
  const base = await getBaseVisualStatus();
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_parametrizacao_conferencias
      WHERE fase = $1
        AND removido_em IS NULL
      ORDER BY grupo_numero, codigo_atividade, id;
    `,
    [FASE]
  );

  const allRows = result.rows;
  const expectedRows = allRows.filter((row) => Number(row.grupo_numero) === GRUPO && EXPECTED_CODES.includes(row.codigo_atividade));
  const expectedRowsByCode = new Map();
  const duplicateCounts = new Map();
  const inconsistencias = [];
  const bloqueios = [];
  const previasSeed = [];

  for (const row of allRows) {
    if (Number(row.grupo_numero) !== GRUPO) {
      const record = normalizePreviewInput(row);
      inconsistencias.push(buildInconsistencia(
        record,
        'codigo_fora_do_grupo_21',
        'Registro de conferencia da fase 2D.5C.2 possui grupo diferente de 21.',
        'grupo_numero'
      ));
      continue;
    }

    if (!EXPECTED_CODES.includes(row.codigo_atividade)) {
      const record = normalizePreviewInput(row);
      inconsistencias.push(buildInconsistencia(
        record,
        'codigo_nao_esperado_grupo_21',
        'Registro de conferencia possui codigo diferente de 21.01 a 21.10.',
        'codigo_atividade'
      ));
    }
  }

  for (const row of expectedRows) {
    const currentCount = duplicateCounts.get(row.codigo_atividade) || 0;
    duplicateCounts.set(row.codigo_atividade, currentCount + 1);

    if (!expectedRowsByCode.has(row.codigo_atividade)) {
      expectedRowsByCode.set(row.codigo_atividade, row);
    }
  }

  for (const [codigo, count] of duplicateCounts.entries()) {
    if (count > 1) {
      inconsistencias.push(buildInconsistencia(
        { codigo },
        'codigo_duplicado',
        'Codigo possui mais de um registro de conferencia manual para a mesma fase.',
        'codigo_atividade'
      ));
    }
  }

  for (const codigo of EXPECTED_CODES) {
    const baseItem = base.byCode.get(codigo);
    const row = expectedRowsByCode.get(codigo);

    if (!row) {
      bloqueios.push({
        codigo,
        nomeAtividade: baseItem?.nomeAtividade || '',
        statusConferencia: 'sem_registro_manual',
        aptoParaSeed: false,
        origemConferenciaId: null,
        motivos: ['codigo_sem_registro_na_bancada_2d5c2'],
      });
      continue;
    }

    const evaluation = evaluateRegistroParaPreviaSeed(row);
    inconsistencias.push(...evaluation.inconsistencias);

    if (evaluation.pronto) {
      previasSeed.push(buildPreviaSeedFromRecord(evaluation.record));
    } else {
      bloqueios.push(buildBlockFromEvaluation(evaluation, baseItem));
    }
  }

  const codigosConferidosIntegralmente = expectedRows.filter((row) => row.status_conferencia === 'conferido_integralmente').length;
  const codigosAptosParaSeed = previasSeed.length;
  const codigosBloqueados = EXPECTED_CODES.length - codigosAptosParaSeed;
  const percentualProntidao = Number(((codigosAptosParaSeed / EXPECTED_CODES.length) * 100).toFixed(2));
  const uniqueInconsistencias = inconsistencias.map((item, index) => ({ id: index + 1, ...item }));

  const statusGeral = uniqueInconsistencias.length > 0
    ? 'bloqueado_por_inconsistencias'
    : codigosAptosParaSeed === 0
      ? 'sem_codigo_apto'
      : codigosAptosParaSeed === EXPECTED_CODES.length
        ? 'todos_aptos_para_seed_controlado'
        : 'parcial_apto_com_bloqueios';

  return {
    fase: '2D.5C.2-A',
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    modo: 'dry_run',
    geraSeed: false,
    seed_operacional_criado: false,
    atividades_incluidas: [],
    totalCodigosGrupo: EXPECTED_CODES.length,
    codigosConferidosIntegralmente,
    codigosAptosParaSeed,
    codigosBloqueados,
    percentualProntidao,
    statusGeral,
    previasSeed,
    bloqueios,
    inconsistencias: uniqueInconsistencias,
    recomendacaoProximaFase: getPreviaRecommendation(codigosAptosParaSeed, uniqueInconsistencias),
    mensagemInstitucional: codigosAptosParaSeed === 0
      ? 'Nenhum codigo do Grupo 21 esta apto para seed controlado. E necessario concluir a conferencia manual assistida antes de prosseguir.'
      : '',
    alertas: [
      'Esta tela e apenas uma previa em modo dry-run. Nenhum dado e inserido na base operacional.',
      'A previa nao altera motor operacional, taxa, VRTE, classe, regra, Assistente, eDocs ou ato autorizativo.',
    ],
  };
}

module.exports = {
  FASE,
  FASE_IMPORTACAO,
  FASE_PREPARACAO_REAL,
  FASE_COMPLEMENTAR,
  FASE_BLOQUEIO_NORMATIVO,
  FASE_REVISAO_NORMATIVA,
  FASE_SEED_CONTROLADO,
  GRUPO,
  NOME_GRUPO,
  EXPECTED_CODES,
  STATUS_CONTROLADOS,
  OPERADORES_PERMITIDOS,
  DEPENDENCIAS_SETORIAIS_SUGERIDAS,
  DEPENDENCIAS_SETORIAIS_PERMITIDAS_IMPORTACAO,
  MENSAGEM_BLOQUEIO_CONFERENCIA_INTEGRAL,
  getBancadaGrupo21,
  getBancadaCodigo,
  salvarConferenciaCodigo,
  validarConferenciaCodigo,
  getHistoricoCodigo,
  getModeloJsonImportacaoGrupo21,
  validarImportacaoGrupo21,
  aplicarImportacaoGrupo21,
  getHistoricoImportacoesGrupo21,
  getPreparacaoMatrizRealGrupo21,
  getModeloOficialRealGrupo21,
  limparRascunhosHomologacaoGrupo21,
  getConferenciaComplementarGrupo21,
  aplicarComplementacaoGrupo21,
  getBloqueioNormativoGrupo21,
  registrarBloqueioNormativoGrupo21,
  getRevisaoNormativaControladaGrupo21,
  getPreviaSeedRevisaoNormativaGrupo21,
  getPreviaSeedControladoGrupo21,
  aplicarSeedControladoGrupo21,
  evaluateRegistroParaPreviaSeed,
  getPreviaSeedGrupo21,
};
