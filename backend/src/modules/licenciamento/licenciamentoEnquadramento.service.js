const auditService = require('../../services/auditService');
const repository = require('./licenciamentoEnquadramento.repository');
const {
  TAXA_STATUS,
  normalizeAdminFilters,
  sanitizeText,
  validateAtividadePayload,
  validateClassePayload,
  validateDocumentoPayload,
  validateNormaPayload,
  validateNormaVinculoPayload,
  validatePotencialPayload,
  validateRegraParametroPayload,
  validateRegraPayload,
  validateSimulacaoPayload,
  validateTaxaPayload,
  validateTipoLicencaPayload,
  validateVrtePayload,
} = require('./licenciamentoEnquadramento.validation');

const ENTITY_VALIDATORS = Object.freeze({
  atividades: validateAtividadePayload,
  tiposLicenca: validateTipoLicencaPayload,
  potenciaisPoluidor: validatePotencialPayload,
  classes: validateClassePayload,
  regrasEnquadramento: validateRegraPayload,
  documentosExigidos: validateDocumentoPayload,
  regrasTaxas: validateTaxaPayload,
  normas: validateNormaPayload,
  vrte: validateVrtePayload,
  regraParametros: validateRegraParametroPayload,
});

const ENTITY_AUDIT = Object.freeze({
  atividades: { acao: 'licenciamento.atividade', entidade: 'licenciamento_atividades' },
  tiposLicenca: { acao: 'licenciamento.tipo_licenca', entidade: 'licenciamento_tipos_licenca' },
  potenciaisPoluidor: { acao: 'licenciamento.potencial_poluidor', entidade: 'licenciamento_potenciais_poluidor' },
  classes: { acao: 'licenciamento.classe', entidade: 'licenciamento_classes' },
  regrasEnquadramento: { acao: 'licenciamento.regra_enquadramento', entidade: 'licenciamento_regras_enquadramento' },
  documentosExigidos: { acao: 'licenciamento.documento_exigido', entidade: 'licenciamento_documentos_exigidos' },
  regrasTaxas: { acao: 'licenciamento.regra_taxa', entidade: 'licenciamento_regras_taxas' },
  normas: { acao: 'licenciamento.norma', entidade: 'licenciamento_normas' },
  vrte: { acao: 'licenciamento.vrte', entidade: 'licenciamento_vrte_exercicios' },
  regraParametros: { acao: 'licenciamento.regra_parametro', entidade: 'licenciamento_regra_parametros' },
});

const ALERT_RULES = Object.freeze([
  {
    flag: 'possui_intervencao_app',
    message:
      'Foi indicada possivel intervencao em Area de Preservacao Permanente. O enquadramento podera exigir analise especifica, autorizacao propria e documentacao complementar.',
  },
  {
    flag: 'possui_supressao_vegetacao',
    message:
      'Foi indicada possivel supressao de vegetacao. Podera ser necessaria autorizacao especifica do orgao competente.',
  },
  {
    flag: 'possui_uso_recursos_hidricos',
    message:
      'Foi indicado possivel uso de recurso hidrico. Podera ser necessaria outorga ou manifestacao do orgao competente.',
  },
  {
    flag: 'gera_residuos',
    message:
      'A atividade podera exigir informacoes sobre geracao, armazenamento, transporte e destinacao de residuos.',
  },
]);

const MENSAGEM_INSTITUCIONAL =
  'Este resultado e preliminar e nao substitui a analise tecnica da SMAD. O enquadramento definitivo depende da conferencia dos dados, da documentacao apresentada e das condicoes ambientais e locacionais do empreendimento.';
const OBSERVACAO_TAXA_VRTE =
  'Taxa estimada conforme quantidade de VRTE cadastrada e valor da VRTE vigente no sistema. A cobranca definitiva dependera da validacao do enquadramento pela SMAD.';
const SIMULACAO_STATUS = Object.freeze({
  SIMULADA: 'simulada',
  ESTIMADA: 'estimada',
  REQUER_VALIDACAO_TECNICA: 'requer_validacao_tecnica',
  REQUER_VALIDACAO_JURIDICA: 'requer_validacao_juridica',
  REQUER_VALIDACAO_NORMATIVA: 'requer_validacao_normativa',
  REQUER_VALIDACAO_TECNICA_JURIDICA: 'requer_validacao_tecnica_juridica',
  REQUER_CONSULTA_PREVIA: 'requer_consulta_previa',
  POSSIVEL_DISPENSA_VERIFICAR: 'possivel_dispensa_verificar',
  LIMITE_IMPACTO_LOCAL_EXCEDIDO: 'limite_impacto_local_excedido',
  BLOQUEADA_POR_INCONSISTENCIA: 'bloqueada_por_inconsistencia',
  TAXA_NAO_PARAMETRIZADA: 'taxa_nao_parametrizada',
  VRTE_NAO_PARAMETRIZADA: 'vrte_nao_parametrizada',
  REGRA_NAO_PARAMETRIZADA: 'regra_nao_parametrizada',
  FORMULA_PENDENTE: 'formula_pendente',
  ATIVIDADE_ASSOCIADA_DETECTADA: 'atividade_associada_detectada',
});

function getActor(user) {
  return {
    ator_tipo: 'usuario_interno',
    ator_id: user?.id || null,
  };
}

function createNotFoundError(message = 'Registro nao encontrado.') {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function validateEntityPayload(entityKey, payload, options = {}) {
  const validator = ENTITY_VALIDATORS[entityKey];

  if (!validator) {
    const error = new Error('Entidade de parametrizacao invalida.');
    error.statusCode = 400;
    throw error;
  }

  return validator(payload, options);
}

function getAuditConfig(entityKey) {
  return ENTITY_AUDIT[entityKey] || { acao: `licenciamento.${entityKey}`, entidade: entityKey };
}

async function auditChange({ entityKey, action, id, before = null, after = null, user, req }) {
  const audit = getAuditConfig(entityKey);

  await auditService.logChange({
    ...getActor(user),
    acao: `${audit.acao}.${action}`,
    entidade: audit.entidade,
    entidade_id: id,
    before,
    after,
    req,
  });
}

async function listEntity(entityKey, query = {}) {
  if (entityKey === 'regrasEnquadramento') {
    return repository.listRegras(normalizeAdminFilters(query));
  }

  if (entityKey === 'simulacoes') {
    return repository.listSimulacoes(normalizeAdminFilters(query));
  }

  return repository.listEntity(entityKey, normalizeAdminFilters(query));
}

async function getEntity(entityKey, id) {
  const result = await repository.getEntityById(entityKey, id);

  if (!result) {
    throw createNotFoundError('Registro de parametrizacao nao encontrado.');
  }

  return result;
}

async function createEntity(entityKey, payload, user, req) {
  const normalized = validateEntityPayload(entityKey, payload);
  const created = await repository.createEntity(entityKey, normalized);

  await auditChange({
    entityKey,
    action: 'create',
    id: created.id,
    after: created,
    user,
    req,
  });

  return created;
}

async function updateEntity(entityKey, id, payload, user, req) {
  const normalized = validateEntityPayload(entityKey, payload, { partial: true });

  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getEntityById(entityKey, id, client, { forUpdate: true });
    if (!before) return null;

    const after = await repository.updateEntity(entityKey, id, normalized, client);
    return { before, after };
  });

  if (!result) {
    throw createNotFoundError('Registro de parametrizacao nao encontrado.');
  }

  await auditChange({
    entityKey,
    action: 'update',
    id,
    before: result.before,
    after: result.after,
    user,
    req,
  });

  return result.after;
}

async function deleteEntity(entityKey, id, user, req) {
  const result = await repository.withTransaction(async (client) => {
    const before = await repository.getEntityById(entityKey, id, client, { forUpdate: true });
    if (!before) return null;

    const after = await repository.softDeleteEntity(entityKey, id, client);
    return { before, after };
  });

  if (!result) {
    throw createNotFoundError('Registro de parametrizacao nao encontrado.');
  }

  await auditChange({
    entityKey,
    action: 'delete',
    id,
    before: result.before,
    after: result.after,
    user,
    req,
  });

  return result.after;
}

async function createNormaVinculo(normaId, payload, user, req) {
  const normalized = validateNormaVinculoPayload(payload);

  const created = await repository.withTransaction(async (client) => {
    const norma = await repository.getEntityById('normas', normaId, client, { forUpdate: true });
    if (!norma) return null;

    return repository.createNormaVinculo(client, normaId, normalized);
  });

  if (!created) {
    throw createNotFoundError('Norma nao encontrada.');
  }

  await auditService.log({
    ...getActor(user),
    acao: 'licenciamento.norma_vinculo.create',
    entidade: 'licenciamento_normas_vinculos',
    entidade_id: created.id,
    dados: created,
    req,
  });

  return created;
}

async function deleteNormaVinculo(vinculoId, user, req) {
  const deleted = await repository.withTransaction((client) => repository.softDeleteNormaVinculo(client, vinculoId));

  if (!deleted) {
    throw createNotFoundError('Vinculo de norma nao encontrado.');
  }

  await auditService.log({
    ...getActor(user),
    acao: 'licenciamento.norma_vinculo.delete',
    entidade: 'licenciamento_normas_vinculos',
    entidade_id: deleted.id,
    dados: deleted,
    req,
  });

  return deleted;
}

function ruleMatchesValue(rule, value) {
  if (value === null || value === undefined || value === '') return false;
  const min = rule.valor_minimo === null || rule.valor_minimo === undefined ? null : Number(rule.valor_minimo);
  const max = rule.valor_maximo === null || rule.valor_maximo === undefined ? null : Number(rule.valor_maximo);

  switch (rule.operador || 'faixa') {
    case 'qualquer':
      return true;
    case 'menor_igual':
      return max === null ? true : value <= max;
    case 'maior_igual':
      return min === null ? true : value >= min;
    case 'igual':
      return min !== null ? value === min : max !== null && value === max;
    case 'faixa':
    default:
      return (min === null || value >= min) && (max === null || value <= max);
  }
}

function parameterMatches(parametro, value) {
  if (value === undefined || value === null || value === '') return !parametro.obrigatorio;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return false;

  const min = parametro.valor_minimo === null || parametro.valor_minimo === undefined
    ? null
    : Number(parametro.valor_minimo);
  const max = parametro.valor_maximo === null || parametro.valor_maximo === undefined
    ? null
    : Number(parametro.valor_maximo);

  switch (parametro.operador || 'faixa') {
    case 'qualquer':
      return true;
    case 'menor_igual':
      return max === null ? true : numeric <= max;
    case 'maior_igual':
      return min === null ? true : numeric >= min;
    case 'igual':
      return min !== null ? numeric === min : max !== null && numeric === max;
    case 'faixa':
    default: {
      const minOk = min === null || (parametro.inclui_minimo === false ? numeric > min : numeric >= min);
      const maxOk = max === null || (parametro.inclui_maximo === false ? numeric < max : numeric <= max);
      return minOk && maxOk;
    }
  }
}

function ruleMatchesComposite(rule, parametros, payload) {
  if (!parametros?.length) {
    return ruleMatchesValue(rule, payload.valor_parametro);
  }

  const directParametro = parametros.find((parametro) => parametro.parametro_chave === 'valor_parametro');
  if (directParametro && payload.valor_parametro !== undefined && payload.valor_parametro !== null && payload.valor_parametro !== '') {
    return parameterMatches(directParametro, payload.valor_parametro);
  }

  return parametros.every((parametro) => {
    const value = parametro.parametro_chave === 'valor_parametro'
      ? payload.valor_parametro
      : payload.parametros_informados?.[parametro.parametro_chave];
    return parameterMatches(parametro, value);
  });
}

function getInputNumber(payload, key) {
  const value = payload.parametros_informados?.[key]
    ?? payload.respostas_condicionais?.[key]
    ?? payload[key];
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getNonNegativeInputNumber(payload, key) {
  const numeric = getInputNumber(payload, key);
  return numeric !== null && numeric >= 0 ? numeric : null;
}

function getConditionalValue(payload, key) {
  if (Object.prototype.hasOwnProperty.call(payload.respostas_condicionais || {}, key)) {
    return payload.respostas_condicionais[key];
  }

  if (Object.prototype.hasOwnProperty.call(payload.parametros_informados || {}, key)) {
    return payload.parametros_informados[key];
  }

  return payload[key];
}

function truthyAnswer(payload, key) {
  const value = getConditionalValue(payload, key);
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return false;
  return ['true', 'sim', '1', 'yes'].includes(String(value).toLowerCase());
}

function calculateFormulaValue(formulaCodigo, payload) {
  switch (formulaCodigo) {
    case 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM': {
      const areaConstruida = getNonNegativeInputNumber(payload, 'area_construida_m2');
      const areaEstocagem = getNonNegativeInputNumber(payload, 'area_estocagem_m2');
      return areaConstruida !== null && areaEstocagem !== null ? areaConstruida + areaEstocagem : null;
    }
    case 'AREA_CONSTRUIDA_ESTOCAGEM_DIRETA': {
      const areaConstruida = getNonNegativeInputNumber(payload, 'area_construida_m2');
      const areaEstocagem = getNonNegativeInputNumber(payload, 'area_estocagem_m2');
      return areaConstruida !== null && areaEstocagem !== null ? areaConstruida + areaEstocagem : null;
    }
    case 'TENSAO_KV_DIRETA':
      return getNonNegativeInputNumber(payload, 'tensao_kv') ?? getNonNegativeInputNumber(payload, 'valor_parametro');
    case 'AREA_INTERVENCAO_DIRETA':
      return getNonNegativeInputNumber(payload, 'area_intervencao_m2') ?? getNonNegativeInputNumber(payload, 'valor_parametro');
    case 'LOTES_X_LOTES_X_AREA_HA_DIV_1000': {
      const numeroLotes = getNonNegativeInputNumber(payload, 'numero_lotes');
      const areaTotalHa = getNonNegativeInputNumber(payload, 'area_total_ha');
      return numeroLotes !== null && areaTotalHa !== null ? (numeroLotes * numeroLotes * areaTotalHa) / 1000 : null;
    }
    case 'UNIDADES_X_UNIDADES_X_AREA_HA_DIV_1000': {
      const numeroUnidades = getNonNegativeInputNumber(payload, 'numero_unidades');
      const areaTotalHa = getNonNegativeInputNumber(payload, 'area_total_ha');
      return numeroUnidades !== null && areaTotalHa !== null
        ? (numeroUnidades * numeroUnidades * areaTotalHa) / 1000
        : null;
    }
    case 'LEITOS_X_AREA_UTIL_HA': {
      const numeroLeitos = getNonNegativeInputNumber(payload, 'numero_leitos');
      const areaUtilHa = getNonNegativeInputNumber(payload, 'area_util_ha');
      return numeroLeitos !== null && areaUtilHa !== null ? numeroLeitos * areaUtilHa : null;
    }
    case 'M2_PARA_HA': {
      const areaM2 = getNonNegativeInputNumber(payload, 'area_m2');
      return areaM2 !== null ? areaM2 / 10000 : null;
    }
    case 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM_M2_PARA_HA': {
      const areaConstruida = getNonNegativeInputNumber(payload, 'area_construida_m2');
      const areaEstocagem = getNonNegativeInputNumber(payload, 'area_estocagem_m2');
      return areaConstruida !== null && areaEstocagem !== null ? (areaConstruida + areaEstocagem) / 10000 : null;
    }
    case 'PARAMETRO_QUALITATIVO_TODOS':
      return 1;
    case 'CAPACIDADE_ARMAZENAMENTO_DIRETA':
      return getNonNegativeInputNumber(payload, 'capacidade_armazenamento_m3')
        ?? getNonNegativeInputNumber(payload, 'capacidade_armazenamento_litros')
        ?? payload.valor_parametro;
    case 'QUANTIDADE_RECEBIDA_DIA_DIRETA':
      return getNonNegativeInputNumber(payload, 'quantidade_recebida_t_dia') ?? payload.valor_parametro;
    case 'PRODUCAO_DIA_DIRETA':
      return getNonNegativeInputNumber(payload, 'producao_dia')
        ?? getNonNegativeInputNumber(payload, 'producao_dia_litros')
        ?? payload.valor_parametro;
    case 'PRODUCAO_MES_DIRETA':
      return getNonNegativeInputNumber(payload, 'producao_mes')
        ?? getNonNegativeInputNumber(payload, 'producao_mes_toneladas')
        ?? payload.valor_parametro;
    case 'CAPACIDADE_INSTALADA_DIRETA':
      return getNonNegativeInputNumber(payload, 'capacidade_instalada') ?? payload.valor_parametro;
    case 'AREA_UTIL_DIRETA':
      return getNonNegativeInputNumber(payload, 'area_util_m2') ?? payload.valor_parametro;
    case 'NUMERO_LEITOS_DIRETA':
      return getNonNegativeInputNumber(payload, 'numero_leitos')
        ?? getNonNegativeInputNumber(payload, 'nle')
        ?? payload.valor_parametro;
    case 'NUMERO_PESSOAS_DIRETA':
      return getNonNegativeInputNumber(payload, 'numero_pessoas') ?? payload.valor_parametro;
    case 'INDICE_AREA_CONSTRUIDA_ESTOCAGEM': {
      const areaConstruida = getNonNegativeInputNumber(payload, 'area_construida_m2');
      const areaEstocagem = getNonNegativeInputNumber(payload, 'area_estocagem_m2');
      return areaConstruida !== null && areaEstocagem !== null ? areaConstruida + areaEstocagem : null;
    }
    case 'PARAMETRO_SANITARIO_QUALITATIVO':
      return 1;
    case 'PARAMETRO_DIRETO':
      return payload.valor_parametro;
    case 'REGRA_COMPOSTA_AREA_TALUDE':
      return getNonNegativeInputNumber(payload, 'area_terraplanada_m2');
    default:
      return null;
  }
}

function getEvaluationValue(rule, atividade, payload) {
  const formulaCodigo = rule?.formula_codigo || atividade?.formula_codigo || null;
  const calculated = formulaCodigo ? calculateFormulaValue(formulaCodigo, payload) : null;
  const direct = calculated !== null && calculated !== undefined ? calculated : payload.valor_parametro;

  return {
    value: direct,
    indice_calculado: calculated,
    formula_codigo_usado: formulaCodigo,
  };
}

function getRuleComparableValue(rule, payload, fallbackValue = null) {
  if (fallbackValue !== null && fallbackValue !== undefined) return fallbackValue;
  if (payload.valor_parametro !== null && payload.valor_parametro !== undefined) return payload.valor_parametro;

  if (rule?.parametros?.length) {
    const first = rule.parametros.find((parametro) => payload.parametros_informados?.[parametro.parametro_chave] !== undefined);
    if (first) return Number(payload.parametros_informados[first.parametro_chave]);
  }

  return null;
}

function buildImpactLimitAlert(source, payload, comparableValue = null) {
  if (!source || source.limite_impacto_local_tipo !== 'valor_maximo') return null;

  const limit = Number(source.limite_impacto_local_valor);
  if (!Number.isFinite(limit)) return null;

  const value = getRuleComparableValue(source, payload, comparableValue);
  if (value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) <= limit) return null;

  return source.mensagem_extrapolacao_competencia
    || 'A informacao prestada excede o limite de impacto local previsto na matriz municipal para esta atividade. Recomenda-se consulta formal a SMAD para verificacao de competencia e enquadramento aplicavel.';
}

function buildAlertas(payload) {
  return ALERT_RULES
    .filter((rule) => payload[rule.flag])
    .map((rule) => rule.message);
}

function pushBlock(blockers, status, message, sugestaoCodigoAtividade = null) {
  blockers.push({
    status,
    message: sugestaoCodigoAtividade ? `${message} Sugestao de atividade: ${sugestaoCodigoAtividade}.` : message,
    sugestao_codigo_atividade: sugestaoCodigoAtividade,
  });
}

function buildPilotEvaluation(atividade, payload) {
  const codigo = atividade?.codigo;
  const blockers = [];
  const alertasTecnicos = [];

  if (['18.01', '18.02'].includes(codigo)) {
    if (codigo === '18.01' && truthyAnswer(payload, 'condominio_horizontal')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'O enquadramento informado parece corresponder a condominio horizontal.',
        '18.02'
      );
    }
    if (codigo === '18.02' && (truthyAnswer(payload, 'loteamento_abertura_vias') || truthyAnswer(payload, 'lotes_autonomos'))) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'O empreendimento possui caracteristicas de loteamento com vias ou lotes autonomos.',
        '18.01'
      );
    }
  }

  if (codigo === '18.03' && (truthyAnswer(payload, 'abertura_vias') || truthyAnswer(payload, 'infraestrutura_nova'))) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      'Desmembramento com abertura de vias ou infraestrutura nova nao deve ser concluido na atividade 18.03.',
      '18.01'
    );
  }

  if (codigo === '18.04') {
    const consolidado = truthyAnswer(payload, 'loteamento_consolidado') || truthyAnswer(payload, 'loteamento_licenciado');
    if (!consolidado) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'A atividade 18.04 exige loteamento consolidado ou ja licenciado para conclusao orientativa.'
      );
    }
  }

  if (codigo === '18.06') {
    if (truthyAnswer(payload, 'atividade_principal_sujeita_licenciamento')) {
      blockers.push({
        status: SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        message: 'A terraplenagem pode ser atividade associada da licenca principal quando a atividade principal for sujeita a licenciamento ambiental.',
      });
    }
    if (truthyAnswer(payload, 'rural_agropecuario')) {
      blockers.push({
        status: SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        message: 'A terraplenagem informada pode se relacionar a atividade rural agropecuaria e deve ser conferida em enquadramento especifico.',
      });
    }
    if (
      truthyAnswer(payload, 'recebe_material_externo')
      || truthyAnswer(payload, 'bota_fora_residuos')
      || truthyAnswer(payload, 'aterro_rcc')
    ) {
      blockers.push({
        status: SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        message: 'Houve indicacao de recebimento de material externo, bota-fora ou aterro com RCC. O caso exige analise do Grupo 20 antes de concluir o enquadramento.',
      });
    }
  }

  if (codigo === '18.07') {
    if (!truthyAnswer(payload, 'propriedade_rural') || !truthyAnswer(payload, 'objetivo_agropecuario')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'A atividade 18.07 exige propriedade rural e objetivo agropecuario.',
        '18.06'
      );
    }
    if (truthyAnswer(payload, 'recebe_material_externo') || truthyAnswer(payload, 'aterro_residuos')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'Houve indicacao de recebimento externo de material ou aterro com residuos. Avaliar enquadramento do Grupo 20.'
      );
    }
  }

  if (codigo === '19.01') {
    if (truthyAnswer(payload, 'gas_inflamavel') || truthyAnswer(payload, 'risco_explosao') || truthyAnswer(payload, 'sem_avcb')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.REQUER_VALIDACAO_TECNICA,
        'Envasamento ou industrializacao de gas exige validacao tecnica de seguranca operacional, incendio/explosao, AVCB/CBMES ou documento equivalente antes de qualquer conclusao administrativa.'
      );
    }
  }

  if (codigo === '19.02') {
    if (
      truthyAnswer(payload, 'intervencao_app')
      || truthyAnswer(payload, 'supressao_vegetal')
      || truthyAnswer(payload, 'travessia_curso_hidrico')
      || truthyAnswer(payload, 'unidade_conservacao')
      || truthyAnswer(payload, 'sem_anuencia_passagem')
    ) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.REQUER_VALIDACAO_TECNICA,
        'Linha de transmissao com APP, supressao, travessia hidrica, unidade de conservacao ou pendencia de anuencia/faixa de passagem exige validacao tecnica e documental da SMAD.'
      );
    }
  }

  if (codigo === '19.04') {
    if (
      truthyAnswer(payload, 'intervencao_app')
      || truthyAnswer(payload, 'supressao_vegetal')
      || truthyAnswer(payload, 'oleo_isolante')
      || truthyAnswer(payload, 'equipamento_contaminante')
    ) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.REQUER_VALIDACAO_TECNICA,
        'Subestacao com APP, supressao vegetal, oleo isolante ou equipamento com potencial contaminante exige validacao tecnica antes de qualquer conclusao administrativa.'
      );
    }
  }

  if (codigo === '20.01') {
    if (truthyAnswer(payload, 'residuo_perigoso') || truthyAnswer(payload, 'contaminado') || truthyAnswer(payload, 'classe_i')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'Nao foi possivel concluir o enquadramento automatico porque a atividade informada envolve residuos perigosos, Classe I ou contaminados, incompativeis com a atividade 20.01.',
        '20.02'
      );
    }
  }

  if (codigo === '20.03' && (
    truthyAnswer(payload, 'oleo_mineral')
    || truthyAnswer(payload, 'oleo_lubrificante')
    || truthyAnswer(payload, 'combustivel')
    || truthyAnswer(payload, 'oleo_contaminado')
    || truthyAnswer(payload, 'beneficiamento_industrial')
  )) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      'A atividade 20.03 e restrita a oleo vegetal usado sem beneficiamento industrial.'
    );
  }

  if (codigo === '20.05') {
    if (truthyAnswer(payload, 'exclusivamente_agropecuario')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'A compostagem exclusivamente agropecuaria deve ser conferida em atividade especifica.',
        '20.11'
      );
    }
    if (truthyAnswer(payload, 'lodo') || truthyAnswer(payload, 'residuo_saude') || truthyAnswer(payload, 'residuo_perigoso') || truthyAnswer(payload, 'carcaca_animal')) {
      alertasTecnicos.push('A presenca de lodo, residuo de saude, perigoso ou carcaca animal exige validacao tecnica especifica antes de qualquer conclusao.');
    }
  }

  if (codigo === '20.06' && truthyAnswer(payload, 'lbro')) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      'A atividade 20.06 exclui lama do beneficiamento de rochas ornamentais.'
    );
  }

  if (codigo === '20.08') {
    if (truthyAnswer(payload, 'disposicao_final_rcc_classe_a')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'Disposicao final ou aterro de RCC Classe A deve ser conferida em atividade especifica.',
        '20.09'
      );
    }
    if (truthyAnswer(payload, 'residuo_perigoso') || truthyAnswer(payload, 'contaminado')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'A atividade 20.08 nao comporta residuos perigosos ou contaminados.'
      );
    }
    if (truthyAnswer(payload, 'rsu_comum')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'RSU comum deve ser conferido na atividade de transbordo propria.',
        '20.07'
      );
    }
  }

  if (codigo === '20.09') {
    const exclusive = getConditionalValue(payload, 'rcc_classe_a_exclusivo');
    if (
      (exclusive !== undefined && exclusive !== null && !truthyAnswer(payload, 'rcc_classe_a_exclusivo'))
      || truthyAnswer(payload, 'rcc_misto')
      || truthyAnswer(payload, 'classe_b_c_d')
      || truthyAnswer(payload, 'residuo_perigoso')
      || truthyAnswer(payload, 'residuo_organico')
    ) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'Nao foi possivel concluir o enquadramento automatico porque o aterro 20.09 exige recebimento exclusivamente de RCC Classe A.'
      );
    }
    alertasTecnicos.push(
      'Ha divergencia interna indicada para esta atividade entre a matriz extraida do decreto e entendimentos operacionais anteriores. Validar tecnicamente antes de uso decisorio.'
    );
  }

  if (codigo === '20.10' && (
    truthyAnswer(payload, 'produto_vencido')
    || truthyAnswer(payload, 'remanescente')
    || truthyAnswer(payload, 'produto_vazando')
    || truthyAnswer(payload, 'residuo_perigoso')
  )) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      'Produto vencido, remanescente, vazando ou residuo perigoso exige analise tecnica especifica.'
    );
  }

  if (codigo === '20.11') {
    if (truthyAnswer(payload, 'residuos_urbanos') || truthyAnswer(payload, 'residuos_comerciais') || truthyAnswer(payload, 'residuos_industriais')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'A atividade 20.11 e restrita a residuos organicos exclusivamente agropecuarios.',
        '20.05'
      );
    }
    if (truthyAnswer(payload, 'lodo') || truthyAnswer(payload, 'residuo_saude') || truthyAnswer(payload, 'residuo_perigoso') || truthyAnswer(payload, 'carcaca_animal')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'Lodo, residuo de saude, perigoso ou carcaca animal impede conclusao orientativa pela atividade 20.11.'
      );
    }
  }

  if (codigo === '22.02' && (
    truthyAnswer(payload, 'envasamento')
    || truthyAnswer(payload, 'processamento')
    || truthyAnswer(payload, 'atividade_portuaria')
  )) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      'A atividade 22.02 nao se aplica quando houver envasamento, processamento ou associacao portuaria.'
    );
  }

  if (codigo === '22.03') {
    if (truthyAnswer(payload, 'agrotoxico')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'A atividade 22.03 exclui armazenamento de agrotoxicos.'
      );
    }
    const recipiente = getInputNumber(payload, 'volume_recipiente_l_kg');
    if (recipiente !== null && recipiente > 200) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'A atividade 22.03 e limitada a recipientes fracionados ate 200 L/kg.'
      );
    }
  }

  if (codigo === '22.04' && (
    truthyAnswer(payload, 'beneficiamento')
    || truthyAnswer(payload, 'britagem')
    || truthyAnswer(payload, 'peneiramento')
    || truthyAnswer(payload, 'lavagem')
  )) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      'Deposito exclusivo de produto mineral em bruto nao permite beneficiamento, britagem, peneiramento ou lavagem.'
    );
  }

  if (codigo === '22.05' && (
    truthyAnswer(payload, 'corte')
    || truthyAnswer(payload, 'serragem')
    || truthyAnswer(payload, 'polimento')
    || truthyAnswer(payload, 'beneficiamento')
  )) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      'Deposito exclusivo de blocos de rochas ornamentais nao permite corte, serragem, polimento ou beneficiamento.'
    );
  }

  if (codigo === '22.09' && (truthyAnswer(payload, 'manutencao') || truthyAnswer(payload, 'lavagem') || truthyAnswer(payload, 'abastecimento'))) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
      'Cargas gerais com manutencao, lavagem ou abastecimento devem ser avaliadas em atividade propria.',
      '22.07'
    );
  }

  if (codigo === '22.11' && (
    truthyAnswer(payload, 'tintas')
    || truthyAnswer(payload, 'solventes')
    || truthyAnswer(payload, 'quimicos')
    || truthyAnswer(payload, 'inflamaveis')
  )) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      'Materiais quimicos, solventes, tintas ou inflamaveis em volume relevante exigem enquadramento especifico.',
      '22.03'
    );
  }

  if (codigo === '24.02' && (truthyAnswer(payload, 'tanque_enterrado') || truthyAnswer(payload, 'revenda'))) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      'Posto com tanque enterrado ou revenda deve ser avaliado na atividade propria.',
      '24.01'
    );
  }

  if (codigo === '24.03') {
    if (truthyAnswer(payload, 'manutencao') || truthyAnswer(payload, 'troca_oleo') || truthyAnswer(payload, 'abastecimento')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'Lavador com manutencao, troca de oleo ou abastecimento exige avaliacao de atividade associada do Grupo 24.'
      );
    }
    if (truthyAnswer(payload, 'vinculado_posto')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'Lavador vinculado a posto deve ser tratado como atividade associada.'
      );
    }
  }

  if (codigo === '24.04') {
    if (truthyAnswer(payload, 'apenas_estacionamento')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'Garagem apenas para estacionamento, sem manutencao, lavagem ou abastecimento, nao deve ser concluida na atividade 24.04.'
      );
    }
    if (truthyAnswer(payload, 'tanque_enterrado')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'Tanque enterrado deve ser avaliado na atividade de posto correspondente.',
        '24.01'
      );
    }
  }

  if (codigo === '24.05') {
    if (!truthyAnswer(payload, 'atividade_principal_licenciada') && !truthyAnswer(payload, 'atividade_principal_dispensada')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'Canteiro de obras exige atividade principal licenciada ou dispensada para conclusao orientativa.'
      );
    }
    if (truthyAnswer(payload, 'alojamento') || truthyAnswer(payload, 'atividade_licenciavel_propria')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'Alojamento ou atividade licenciavel propria em canteiro exige analise tecnica especifica.'
      );
    }
    if (truthyAnswer(payload, 'tanque_enterrado')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'Tanque enterrado deve ser avaliado na atividade de posto correspondente.',
        '24.01'
      );
    }
    const tanqueAereo = getInputNumber(payload, 'tanque_aereo_m3');
    if (tanqueAereo !== null && tanqueAereo > 15) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
        'Tanque aereo acima de 15 m3 deve ser avaliado na atividade propria.',
        '24.02'
      );
    }
  }

  if (codigo === '24.06' && truthyAnswer(payload, 'atividade_especifica_existente')) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      'Atividade residual 24.06 nao deve ser usada quando houver enquadramento especifico no Decreto.'
    );
  }

  if (codigo === '19.03') {
    if (truthyAnswer(payload, 'subestacao_propria')) {
      alertasTecnicos.push('Foi indicada subestacao propria. Pode haver atividade associada a ser avaliada pela SMAD.');
    }
    if (truthyAnswer(payload, 'linha_transmissao_associada')) {
      alertasTecnicos.push('Foi indicada linha de transmissao associada. Pode haver atividade associada a ser avaliada pela SMAD.');
    }
  }

  if (codigo === '15.20' && truthyAnswer(payload, 'possui_abate')) {
    blockers.push({
      status: SIMULACAO_STATUS.ATIVIDADE_ASSOCIADA_DETECTADA,
      message: 'Nao foi possivel concluir em 15.20 porque houve indicacao de abate. Verifique atividades de abatedouro, como 15.15, 15.16, 15.17 ou 15.18.',
    });
  }

  if (codigo === '15.20') {
    if (truthyAnswer(payload, 'graxaria') || truthyAnswer(payload, 'subproduto_animal')) {
      alertasTecnicos.push('Foi indicada graxaria ou subproduto animal. O caso exige validacao tecnica e sanitaria antes de qualquer conclusao.');
    }
    if (truthyAnswer(payload, 'efluente_sem_tratamento')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.REQUER_VALIDACAO_TECNICA,
        'Efluente industrial sem tratamento impede conclusao automatica e exige validacao tecnica da SMAD.'
      );
    }
    if (truthyAnswer(payload, 'lancamento_corpo_hidrico')) {
      alertasTecnicos.push('Foi indicado lancamento em corpo hidrico. Pode ser necessaria outorga ou dispensa de outorga antes da conclusao administrativa.');
    }
  }

  if (codigo === '16.06' && truthyAnswer(payload, 'artesanal')) {
    blockers.push({
      status: SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
      message: 'Nao foi possivel concluir em 16.06 porque houve indicacao de producao artesanal. Verifique a atividade 16.02.',
    });
  }

  if (codigo === '16.06') {
    if (truthyAnswer(payload, 'efluente_sem_tratamento')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.REQUER_VALIDACAO_TECNICA,
        'Bebidas com geracao de efluente sem tratamento exigem validacao tecnica antes de qualquer conclusao.'
      );
    }
    if (truthyAnswer(payload, 'lancamento_corpo_hidrico')) {
      alertasTecnicos.push('Lancamento em corpo hidrico exige outorga ou manifestacao especifica do orgao competente.');
    }
  }

  if (codigo === '17.05') {
    if (
      truthyAnswer(payload, 'uso_resina_solvente')
      || truthyAnswer(payload, 'resina')
      || truthyAnswer(payload, 'solvente')
      || truthyAnswer(payload, 'catalisador')
      || truthyAnswer(payload, 'tinta_verniz')
      || truthyAnswer(payload, 'inflamavel')
      || truthyAnswer(payload, 'residuo_perigoso')
    ) {
      alertasTecnicos.push('Produtos quimicos, resinas, solventes, catalisadores, tintas, inflamaveis ou residuos perigosos exigem controle operacional e validacao tecnica.');
    }
    if (truthyAnswer(payload, 'residuo_classe_i_sem_destinacao') || truthyAnswer(payload, 'quimico_perigoso_sem_controle')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA,
        'Residuo Classe I sem destinacao ou produto quimico perigoso sem controle impede conclusao orientativa.'
      );
    }
  }

  if (codigo === '23.04') {
    const nle = getInputNumber(payload, 'numero_leitos') ?? getInputNumber(payload, 'nle');
    if (nle !== null && nle > 25 && nle <= 50) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.REQUER_VALIDACAO_NORMATIVA,
        'A faixa intermediaria de 25 < NLE <= 50 para hospital veterinario depende de validacao normativa pela SMAD.'
      );
    }
  }

  if (codigo === '23.05' && !truthyAnswer(payload, 'procedimento_cirurgico')) {
    pushBlock(
      blockers,
      SIMULACAO_STATUS.POSSIVEL_DISPENSA_VERIFICAR,
      'Clinica ou unidade sem procedimento cirurgico deve ser tratada como possivel dispensa ou consulta previa, sem conclusao automatica na atividade 23.05.'
    );
  }

  if (codigo === '23.06') {
    const hasTanatopraxiaAnswer = ['embalsamento', 'tanatopraxia', 'somatoconservacao']
      .some((key) => getConditionalValue(payload, key) !== undefined);
    const possuiTanatopraxia = truthyAnswer(payload, 'embalsamento')
      || truthyAnswer(payload, 'tanatopraxia')
      || truthyAnswer(payload, 'somatoconservacao');
    if (truthyAnswer(payload, 'funeraria_sem_tanatopraxia') || (hasTanatopraxiaAnswer && !possuiTanatopraxia)) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.POSSIVEL_DISPENSA_VERIFICAR,
        'Funeraria sem embalsamento, tanatopraxia ou somatoconservacao deve ser tratada como possivel dispensa ou consulta previa.'
      );
    }
    if (truthyAnswer(payload, 'cremacao')) {
      pushBlock(
        blockers,
        SIMULACAO_STATUS.REQUER_VALIDACAO_NORMATIVA,
        'Servico com cremacao nao deve ser enquadrado automaticamente em 23.06 e exige analise tecnica e normativa.'
      );
    }
  }

  return { blockers, alertasTecnicos };
}

function chooseSimulationStatus({ regra, taxa, blockers, impactExceeded }) {
  if (blockers.length > 0) return blockers[0].status || SIMULACAO_STATUS.BLOQUEADA_POR_INCONSISTENCIA;
  if (impactExceeded) return SIMULACAO_STATUS.LIMITE_IMPACTO_LOCAL_EXCEDIDO;
  if (!regra) return SIMULACAO_STATUS.REGRA_NAO_PARAMETRIZADA;
  if (regra.status_resultado && regra.status_resultado !== SIMULACAO_STATUS.ESTIMADA) {
    return regra.status_resultado;
  }
  if (taxa?.status === TAXA_STATUS.VRTE_NAO_PARAMETRIZADA) return SIMULACAO_STATUS.VRTE_NAO_PARAMETRIZADA;
  if (taxa?.status === TAXA_STATUS.TAXA_NAO_PARAMETRIZADA) return SIMULACAO_STATUS.TAXA_NAO_PARAMETRIZADA;
  if (taxa?.status === TAXA_STATUS.FORMULA_PENDENTE) return SIMULACAO_STATUS.FORMULA_PENDENTE;
  if (regra.requer_validacao_tecnica) return SIMULACAO_STATUS.REQUER_VALIDACAO_TECNICA;
  return SIMULACAO_STATUS.ESTIMADA;
}

function buildRespostas(payload) {
  const respostas = [
    {
      pergunta_chave: 'tipo_pessoa',
      pergunta_texto: 'Tipo de pessoa informado',
      resposta_valor: payload.tipo_pessoa,
      resposta_texto: payload.tipo_pessoa === 'fisica' ? 'Pessoa fisica' : 'Pessoa juridica',
    },
    {
      pergunta_chave: 'tipo_imovel',
      pergunta_texto: 'Tipo de imovel informado',
      resposta_valor: payload.tipo_imovel,
      resposta_texto: payload.tipo_imovel === 'rural' ? 'Rural' : 'Urbano',
    },
    {
      pergunta_chave: 'possui_intervencao_app',
      pergunta_texto: 'Foi indicada intervencao em APP?',
      resposta_valor: String(Boolean(payload.possui_intervencao_app)),
      resposta_texto: payload.possui_intervencao_app ? 'Sim' : 'Nao',
    },
    {
      pergunta_chave: 'possui_supressao_vegetacao',
      pergunta_texto: 'Foi indicada supressao de vegetacao?',
      resposta_valor: String(Boolean(payload.possui_supressao_vegetacao)),
      resposta_texto: payload.possui_supressao_vegetacao ? 'Sim' : 'Nao',
    },
    {
      pergunta_chave: 'possui_uso_recursos_hidricos',
      pergunta_texto: 'Foi indicado uso de recursos hidricos?',
      resposta_valor: String(Boolean(payload.possui_uso_recursos_hidricos)),
      resposta_texto: payload.possui_uso_recursos_hidricos ? 'Sim' : 'Nao',
    },
    {
      pergunta_chave: 'gera_residuos',
      pergunta_texto: 'Foi indicada geracao de residuos?',
      resposta_valor: String(Boolean(payload.gera_residuos)),
      resposta_texto: payload.gera_residuos ? 'Sim' : 'Nao',
    },
  ];

  Object.entries(payload.parametros_informados || {}).forEach(([key, value]) => {
    respostas.push({
      pergunta_chave: `parametro_${key}`,
      pergunta_texto: `Parametro informado: ${key}`,
      resposta_valor: String(value),
      resposta_texto: String(value),
    });
  });

  Object.entries(payload.respostas_condicionais || {}).forEach(([key, value]) => {
    respostas.push({
      pergunta_chave: `condicional_${key}`,
      pergunta_texto: `Resposta condicional: ${key}`,
      resposta_valor: String(value),
      resposta_texto: String(value),
    });
  });

  return respostas;
}

function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDecimal(value, digits = 6) {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function buildTaxaResponse(taxaRule, vrte = null) {
  const governanca = taxaRule
    ? {
        tabela_taxa_codigo: taxaRule.tabela_taxa_codigo || null,
        tabela_taxa_nome: taxaRule.tabela_taxa_nome || null,
        tabela_taxa_status: taxaRule.tabela_taxa_status || taxaRule.status_validacao || null,
        tabela_taxa_operacional: Boolean(taxaRule.tabela_taxa_operacional),
        tabela_taxa_piloto: Boolean(taxaRule.tabela_taxa_piloto),
        tabela_taxa_validada_para_cobranca: Boolean(taxaRule.tabela_taxa_validada_para_cobranca),
        tabela_taxa_requer_conferencia_juridica: Boolean(taxaRule.tabela_taxa_requer_conferencia_juridica),
        aviso_normativo:
          taxaRule.tabela_taxa_status === 'operacional_piloto' || taxaRule.validada_para_cobranca === false
            ? 'Taxa estimada com base em tabela operacional em conferencia. Nao constitui cobranca oficial.'
            : null,
      }
    : {};

  if (!taxaRule) {
    return {
      status: TAXA_STATUS.TAXA_NAO_PARAMETRIZADA,
      valor: null,
      observacao: 'Taxa nao parametrizada para o enquadramento informado.',
    };
  }

  if ((taxaRule.usa_formula || taxaRule.formula_codigo || taxaRule.formula) && (
    taxaRule.quantidade_vrte === null || taxaRule.quantidade_vrte === undefined
  )) {
    return {
      status: TAXA_STATUS.FORMULA_PENDENTE,
      valor: null,
      regra_taxa_id: taxaRule.id || null,
      formula_codigo: taxaRule.formula_codigo || null,
      observacao: 'Taxa depende de formula parametrizada e devera ser confirmada pela SMAD.',
      ...governanca,
    };
  }

  if (taxaRule.quantidade_vrte !== null && taxaRule.quantidade_vrte !== undefined) {
    if (!vrte) {
      return {
        status: TAXA_STATUS.VRTE_NAO_PARAMETRIZADA,
        valor: null,
        regra_taxa_id: taxaRule.id || null,
        quantidade_vrte: Number(taxaRule.quantidade_vrte),
        fator: Number(taxaRule.fator_padrao || 1),
        observacao: 'Valor de VRTE vigente nao parametrizado para o exercicio informado.',
        ...governanca,
      };
    }

    const quantidadeVrte = Number(taxaRule.quantidade_vrte);
    const valorUnitarioVrte = Number(vrte.valor_vrte);
    const fator = Number(taxaRule.fator_padrao || 1);

    if (![quantidadeVrte, valorUnitarioVrte, fator].every(Number.isFinite)) {
      return {
        status: TAXA_STATUS.REGRA_INCONSISTENTE,
        valor: null,
        regra_taxa_id: taxaRule.id || null,
        observacao: 'Regra de taxa inconsistente para calculo por VRTE.',
        ...governanca,
      };
    }

    const valorTotal = quantidadeVrte * valorUnitarioVrte * fator;
    const valorFormatado = formatCurrency(valorTotal);

    return {
      status: TAXA_STATUS.ESTIMADA,
      valor: valorTotal,
      valor_total: valorTotal,
      valor_total_formatado: valorFormatado,
      regra_taxa_id: taxaRule.id || null,
      quantidade_vrte: quantidadeVrte,
      valor_unitario_vrte: valorUnitarioVrte,
      fator,
      ano_exercicio_vrte: vrte.ano,
      memoria_calculo: `${quantidadeVrte} VRTE x R$ ${formatDecimal(valorUnitarioVrte)} x ${fator} = ${valorFormatado}`,
      observacao: taxaRule.observacao || OBSERVACAO_TAXA_VRTE,
      ...governanca,
    };
  }

  if (taxaRule.valor_fixo !== null && taxaRule.valor_fixo !== undefined) {
    return {
      status: TAXA_STATUS.ESTIMADA,
      valor: Number(taxaRule.valor_fixo),
      valor_total: Number(taxaRule.valor_fixo),
      valor_total_formatado: formatCurrency(taxaRule.valor_fixo),
      regra_taxa_id: taxaRule.id || null,
      observacao: taxaRule.observacao || 'Taxa estimativa preliminar, sujeita a confirmacao pela SMAD.',
      ...governanca,
    };
  }

  return {
    status: TAXA_STATUS.TAXA_NAO_PARAMETRIZADA,
    valor: null,
    observacao: 'Taxa nao parametrizada para o enquadramento informado.',
  };
}

function buildResultadoResumo(rule) {
  if (!rule) {
    return 'Nao foi possivel identificar enquadramento preliminar com os parametros informados. Procure a SMAD ou revise as informacoes.';
  }

  if (rule.dispensa_possivel) {
    return 'Resultado preliminar: ha indicacao parametrizada de possivel dispensa, sujeita a validacao tecnica da SMAD.';
  }

  if (rule.requer_validacao_tecnica) {
    return 'Resultado preliminar de enquadramento com validacao tecnica obrigatoria pela SMAD.';
  }

  return 'Resultado preliminar de enquadramento ambiental, sujeito a validacao tecnica da SMAD.';
}

function toPublicSimulationResult({
  simulation,
  atividade,
  regra,
  documentos,
  normas,
  taxa,
}) {
  return {
    protocolo_simulacao: simulation.protocolo_simulacao,
    resultado: 'Resultado preliminar de enquadramento',
    atividade: atividade
      ? {
          id: atividade.id,
          codigo: atividade.codigo,
          nome: atividade.nome,
          categoria: atividade.categoria,
          tipo_atividade: atividade.tipo_atividade,
          parametro_principal_label: atividade.parametro_principal_label,
          unidade_parametro_principal: atividade.unidade_parametro_principal,
        }
      : null,
    tipo_licenca_sugerida: regra?.tipo_licenca_id
      ? {
          id: regra.tipo_licenca_id,
          codigo: regra.tipo_licenca_codigo,
          nome: regra.tipo_licenca_nome,
          descricao: regra.tipo_licenca_descricao,
        }
      : null,
    classe_sugerida: regra?.classe_id
      ? {
          id: regra.classe_id,
          codigo: regra.classe_codigo,
          nome: regra.classe_nome,
          descricao: regra.classe_descricao,
        }
      : null,
    potencial_poluidor: regra?.potencial_poluidor_id
      ? {
          id: regra.potencial_poluidor_id,
          codigo: regra.potencial_codigo,
          nome: regra.potencial_nome,
          descricao: regra.potencial_descricao,
        }
      : null,
    porte_estimado: simulation.porte_estimado,
    status_resultado: simulation.status_resultado,
    indice_calculado: simulation.indice_calculado,
    formula_codigo_usado: simulation.formula_codigo_usado,
    parametros_informados: simulation.parametros_informados || {},
    dispensa_possivel: simulation.dispensa_possivel,
    taxa,
    documentos_exigidos: documentos,
    normas_relacionadas: normas,
    alertas: simulation.alertas || [],
    alertas_tecnicos: simulation.alertas_tecnicos || [],
    bloqueios: simulation.bloqueios || [],
    resultado_resumo: simulation.resultado_resumo,
    mensagem_institucional: MENSAGEM_INSTITUCIONAL,
  };
}

async function selectEnquadramentoRule(atividade, payload) {
  const atividadeId = atividade.id;
  const rules = await repository.listActiveRulesForActivity(atividadeId);
  const parametrosByRule = await repository.listParametrosForRules(rules.map((rule) => rule.id));

  const enrichedRules = rules.map((rule) => ({
    ...rule,
    parametros: parametrosByRule[rule.id] || [],
  }));

  for (const item of enrichedRules) {
    const evaluation = getEvaluationValue(item, atividade, payload);
    const payloadForRule = {
      ...payload,
      valor_parametro: evaluation.value !== null && evaluation.value !== undefined ? evaluation.value : payload.valor_parametro,
    };
    const matched = item.formula_codigo || atividade.formula_codigo
      ? ruleMatchesValue(item, payloadForRule.valor_parametro)
      : ruleMatchesComposite(item, item.parametros, payloadForRule);

    if (matched) {
      return {
        regra: item,
        indice_calculado: evaluation.indice_calculado,
        formula_codigo_usado: evaluation.formula_codigo_usado,
        valor_avaliado: payloadForRule.valor_parametro,
      };
    }
  }

  const activityEvaluation = getEvaluationValue(null, atividade, payload);
  return {
    regra: null,
    indice_calculado: activityEvaluation.indice_calculado,
    formula_codigo_usado: activityEvaluation.formula_codigo_usado,
    valor_avaliado: activityEvaluation.value,
  };
}

async function simulateEnquadramento(payload, req, options = {}) {
  const normalized = validateSimulacaoPayload(payload);
  const atividade = await repository.getAtividadePublica(normalized.atividade_id);

  if (!atividade) {
    throw createNotFoundError('Atividade licenciavel nao encontrada ou inativa.');
  }

  const selection = await selectEnquadramentoRule(atividade, normalized);
  const regra = selection.regra;
  const valorAvaliado = selection.valor_avaliado;
  const pilotEvaluation = buildPilotEvaluation(atividade, normalized);
  const activityImpactAlert = buildImpactLimitAlert(atividade, normalized, valorAvaliado);
  const ruleImpactAlert = buildImpactLimitAlert(regra, normalized, valorAvaliado);
  const impactAlerts = [activityImpactAlert, ruleImpactAlert].filter(Boolean);
  const impactExceeded = impactAlerts.length > 0;
  const normativeBlocked = regra?.status_resultado === SIMULACAO_STATUS.REQUER_VALIDACAO_NORMATIVA;
  const shouldCalculate = pilotEvaluation.blockers.length === 0 && !impactExceeded && Boolean(regra) && !normativeBlocked;

  const documentos = shouldCalculate
    ? await repository.listDocumentosForSimulation({
        atividadeId: atividade.id,
        regraId: regra.id,
        tipoLicencaId: regra.tipo_licenca_id,
        tipoPessoa: normalized.tipo_pessoa,
        tipoImovel: normalized.tipo_imovel,
      })
    : [];
  const normas = shouldCalculate || regra
    ? await repository.listNormasForSimulation({
        atividadeId: atividade.id,
        regraId: regra?.id || null,
        tipoLicencaId: regra?.tipo_licenca_id || null,
      })
    : [];
  const taxaRule = shouldCalculate
    ? await repository.findTaxaRule({
        tipoLicencaId: regra.tipo_licenca_id,
        classeId: regra.classe_id,
        porte: regra.porte_resultante,
        potencialPoluidorId: regra.potencial_poluidor_id,
        tipoAtividade: atividade.tipo_atividade,
      })
    : null;
  const vrte = taxaRule ? await repository.getActiveVrte() : null;
  const taxa = buildTaxaResponse(taxaRule, vrte);
  const alertas = buildAlertas(normalized);
  [...impactAlerts, ...pilotEvaluation.alertasTecnicos].filter(Boolean).forEach((alerta) => {
    if (!alertas.includes(alerta)) alertas.push(alerta);
  });
  if (taxa.aviso_normativo && !alertas.includes(taxa.aviso_normativo)) {
    alertas.push(taxa.aviso_normativo);
  }
  if (regra?.porte_resultante === 'grande' && regra?.potencial_codigo === 'baixo') {
    const avisoNormativo = 'Enquadramento sujeito a validacao normativa da SMAD.';
    if (!alertas.includes(avisoNormativo)) alertas.push(avisoNormativo);
  }
  pilotEvaluation.blockers.forEach((blocker) => {
    if (!alertas.includes(blocker.message)) alertas.push(blocker.message);
  });
  const statusResultado = chooseSimulationStatus({
    regra,
    taxa,
    blockers: pilotEvaluation.blockers,
    impactExceeded,
  });
  const resultadoResumo = pilotEvaluation.blockers[0]?.message
    || (impactExceeded
      ? 'Resultado preliminar bloqueado por extrapolacao de limite de impacto local. Recomenda-se consulta formal a SMAD para verificacao de competencia e enquadramento aplicavel.'
      : buildResultadoResumo(regra));
  const identificada = Boolean(normalized.nome_interessado || normalized.email_interessado || normalized.telefone_interessado);

  const simulationPayload = {
    atividade_id: atividade.id,
    regra_enquadramento_id: regra?.id || null,
    tipo_licenca_sugerida_id: shouldCalculate ? regra?.tipo_licenca_id || null : null,
    classe_sugerida_id: shouldCalculate ? regra?.classe_id || null : null,
    potencial_poluidor_sugerido_id: shouldCalculate ? regra?.potencial_poluidor_id || null : null,
    parametro_informado: regra?.parametro_nome || atividade.parametro_principal_label || 'Parametro principal',
    parametro_unidade: normalized.parametro_unidade || regra?.parametro_unidade || atividade.unidade_parametro_principal,
    valor_parametro: valorAvaliado,
    porte_estimado: shouldCalculate ? regra?.porte_resultante || null : null,
    dispensa_possivel: shouldCalculate ? Boolean(regra?.dispensa_possivel) : false,
    taxa_estimativa: taxa.valor,
    taxa_status: taxa.status,
    taxa_regra_id: taxa.regra_taxa_id || null,
    taxa_quantidade_vrte: taxa.quantidade_vrte || null,
    taxa_valor_unitario_vrte: taxa.valor_unitario_vrte || null,
    taxa_fator: taxa.fator || null,
    taxa_valor_total_calculado: taxa.valor_total || null,
    taxa_ano_exercicio_vrte: taxa.ano_exercicio_vrte || null,
    taxa_memoria_calculo: taxa.memoria_calculo || null,
    taxa_data_calculo: taxa.regra_taxa_id ? new Date() : null,
    taxa_observacao: taxa.observacao || null,
    parametros_informados: normalized.parametros_informados,
    status_resultado: statusResultado,
    indice_calculado: selection.indice_calculado || null,
    formula_codigo_usado: selection.formula_codigo_usado || null,
    alertas_tecnicos: pilotEvaluation.alertasTecnicos,
    bloqueios: pilotEvaluation.blockers,
    resultado_resumo: resultadoResumo,
    alertas,
    nome_interessado: identificada ? normalized.nome_interessado : null,
    email_interessado: identificada ? normalized.email_interessado : null,
    telefone_interessado: identificada ? normalized.telefone_interessado : null,
    identificacao_tipo: identificada ? 'identificada' : 'anonima',
    origem: 'painel_publico_sigma',
  };

  const simulation = options.persist === false
    ? {
        id: null,
        protocolo_simulacao: 'DIAGNOSTICO-HOMOLOGACAO',
        ...simulationPayload,
      }
    : await repository.withTransaction((client) => repository.createSimulation(
        client,
        simulationPayload,
        buildRespostas(normalized)
      ));

  if (options.persist !== false) {
    await auditService.log({
      ator_tipo: 'publico',
      acao: 'licenciamento.simulacao.create',
      entidade: 'licenciamento_simulacoes',
      entidade_id: simulation.id,
      request_id: req?.requestId || null,
      dados: {
        protocolo_simulacao: simulation.protocolo_simulacao,
        atividade_id: atividade.id,
        regra_enquadramento_id: regra?.id || null,
        taxa_status: taxa.status,
        status_resultado: statusResultado,
      },
    });
  }

  return toPublicSimulationResult({
    simulation,
    atividade,
    regra,
    documentos,
    normas,
    taxa,
  });
}

async function listPublicActivities(query = {}) {
  return repository.listPublicActivities(normalizeAdminFilters(query));
}

async function listPublicNormas(query = {}) {
  return repository.listNormasPublicas(normalizeAdminFilters(query));
}

async function getPublicSimulation(protocolo) {
  const normalized = sanitizeText(protocolo, 60, 'protocolo', { required: true });
  const result = await repository.getPublicSimulationByProtocol(normalized);

  if (!result) {
    throw createNotFoundError('Simulacao nao encontrada.');
  }

  return {
    protocolo_simulacao: result.protocolo_simulacao,
    resultado_resumo: result.resultado_resumo,
    atividade: {
      codigo: result.atividade_codigo,
      nome: result.atividade_nome,
    },
    tipo_licenca_sugerida: result.tipo_licenca_codigo
      ? {
          codigo: result.tipo_licenca_codigo,
          nome: result.tipo_licenca_nome,
        }
      : null,
    classe_sugerida: result.classe_codigo
      ? {
          codigo: result.classe_codigo,
          nome: result.classe_nome,
        }
      : null,
    potencial_poluidor: result.potencial_codigo
      ? {
          codigo: result.potencial_codigo,
          nome: result.potencial_nome,
        }
      : null,
    parametro_informado: result.parametro_informado,
    parametro_unidade: result.parametro_unidade,
    valor_parametro: result.valor_parametro,
    porte_estimado: result.porte_estimado,
    status_resultado: result.status_resultado,
    indice_calculado: result.indice_calculado,
    formula_codigo_usado: result.formula_codigo_usado,
    dispensa_possivel: result.dispensa_possivel,
    taxa: {
      status: result.taxa_status,
      valor: result.taxa_estimativa,
      valor_total: result.taxa_valor_total_calculado,
      valor_total_formatado: result.taxa_valor_total_calculado ? formatCurrency(result.taxa_valor_total_calculado) : null,
      quantidade_vrte: result.taxa_quantidade_vrte,
      valor_unitario_vrte: result.taxa_valor_unitario_vrte,
      fator: result.taxa_fator,
      ano_exercicio_vrte: result.taxa_ano_exercicio_vrte,
      memoria_calculo: result.taxa_memoria_calculo,
    },
    parametros_informados: result.parametros_informados || {},
    alertas: result.alertas || [],
    alertas_tecnicos: result.alertas_tecnicos || [],
    bloqueios: result.bloqueios || [],
    created_at: result.created_at,
    mensagem_institucional: MENSAGEM_INSTITUCIONAL,
  };
}

async function getParametrizacaoStatus() {
  return repository.getParametrizacaoStatus();
}

async function getParametrizacaoFase2D1Status() {
  const targetCodes = [
    '18.01', '18.02', '18.03', '18.04', '18.05', '18.06', '18.07', '18.08', '18.09', '18.10', '18.11', '18.12', '18.13', '18.14', '18.15', '18.16', '18.17',
    '20.01', '20.02', '20.03', '20.04', '20.05', '20.06', '20.07', '20.08', '20.09', '20.10', '20.11',
    '22.01', '22.02', '22.03', '22.04', '22.05', '22.06', '22.07', '22.08', '22.09', '22.10', '22.11',
    '24.01', '24.02', '24.03', '24.04', '24.05', '24.06', '24.07',
  ];

  const [summary, groups, validation, release] = await Promise.all([
    repository.db.query(
      `
        WITH atividades_base AS (
          SELECT *
          FROM licenciamento_atividades
          WHERE deleted_at IS NULL AND ativo = true AND codigo = ANY($1)
        )
        SELECT
          COUNT(*)::int AS atividades,
          (
            SELECT COUNT(*)::int
            FROM licenciamento_regras_enquadramento r
            JOIN atividades_base a ON a.id = r.atividade_id
            WHERE r.deleted_at IS NULL AND r.ativo = true
          ) AS regras,
          COALESCE(SUM(jsonb_array_length(COALESCE(perguntas_publicas, '[]'::jsonb))), 0)::int AS perguntas,
          COALESCE(SUM(jsonb_array_length(COALESCE(alertas_publicos, '[]'::jsonb))), 0)::int AS alertas,
          COALESCE(SUM(jsonb_array_length(COALESCE(bloqueios_publicos, '[]'::jsonb))), 0)::int AS bloqueios,
          (
            SELECT COUNT(*)::int
            FROM licenciamento_documentos_exigidos d
            JOIN atividades_base a ON a.id = d.atividade_id
            WHERE d.deleted_at IS NULL AND d.ativo = true
          ) AS documentos,
          COUNT(*) FILTER (WHERE validacoes_requeridas::text LIKE '%validacao%')::int AS atividades_com_validacao_tecnica,
          COUNT(*) FILTER (WHERE formula_codigo = 'PARAMETRO_QUALITATIVO_TODOS')::int AS atividades_qualitativas_todos,
          COUNT(*) FILTER (WHERE limite_impacto_local_tipo = 'valor_maximo')::int AS atividades_com_limite_impacto_local,
          COUNT(*) FILTER (WHERE COALESCE(observacoes, '') <> '')::int AS atividades_com_observacao_interna
        FROM atividades_base;
      `,
      [targetCodes]
    ),
    repository.db.query(
      `
        SELECT
          split_part(a.codigo, '.', 1) AS grupo,
          MAX(a.categoria) AS nome,
          COUNT(DISTINCT a.id)::int AS atividades,
          COUNT(DISTINCT r.id)::int AS regras,
          COUNT(DISTINCT d.id)::int AS documentos
        FROM licenciamento_atividades a
        LEFT JOIN licenciamento_regras_enquadramento r ON r.atividade_id = a.id AND r.deleted_at IS NULL AND r.ativo = true
        LEFT JOIN licenciamento_documentos_exigidos d ON d.atividade_id = a.id AND d.deleted_at IS NULL AND d.ativo = true
        WHERE a.deleted_at IS NULL AND a.ativo = true AND a.codigo = ANY($1)
        GROUP BY split_part(a.codigo, '.', 1)
        ORDER BY grupo;
      `,
      [targetCodes]
    ),
    repository.db.query(
      `
        SELECT
          a.codigo,
          a.nome,
          a.categoria,
          a.tipo_atividade,
          a.potencial_poluidor_padrao,
          a.formula_codigo,
          a.limite_impacto_local_tipo,
          a.validacoes_requeridas,
          jsonb_array_length(COALESCE(a.bloqueios_publicos, '[]'::jsonb))::int AS bloqueios,
          COUNT(DISTINCT r.id)::int AS regras,
          COUNT(DISTINCT d.id)::int AS documentos
        FROM licenciamento_atividades a
        LEFT JOIN licenciamento_regras_enquadramento r ON r.atividade_id = a.id AND r.deleted_at IS NULL AND r.ativo = true
        LEFT JOIN licenciamento_documentos_exigidos d ON d.atividade_id = a.id AND d.deleted_at IS NULL AND d.ativo = true
        WHERE a.deleted_at IS NULL AND a.ativo = true AND a.codigo = ANY($1)
        GROUP BY a.id
        ORDER BY a.codigo;
      `,
      [targetCodes]
    ),
    repository.db.query(
      `
        SELECT id, codigo, status, ready, confirmado_em, bloqueios_producao_json
        FROM licenciamento_homologacao_liberacoes
        WHERE status = 'liberada_tecnicamente'
          AND ready = true
        ORDER BY confirmado_em DESC NULLS LAST, id DESC
        LIMIT 1;
      `
    ),
  ]);

  const row = summary.rows[0] || {};
  const releaseRow = release.rows[0] || null;
  const blockers = releaseRow?.bloqueios_producao_json || {};
  const bloqueiosProducao = {
    dam_real: blockers.dam_real === true,
    cobranca_oficial: blockers.cobranca_oficial === true,
    protocolo_definitivo: blockers.protocolo_definitivo === true,
    decisao_automatica: blockers.decisao_automatica === true,
  };

  return {
    fase: '2D.1',
    bloco: 'Grupos 18, 20, 22 e 24',
    status_seed: row.atividades === targetCodes.length ? 'executado' : 'pendente',
    esperado: {
      grupos: 4,
      atividades: targetCodes.length,
    },
    totais: {
      grupos: groups.rows.length,
      atividades: row.atividades || 0,
      regras: row.regras || 0,
      perguntas: row.perguntas || 0,
      alertas: row.alertas || 0,
      bloqueios: row.bloqueios || 0,
      documentos: row.documentos || 0,
      atividades_com_validacao_tecnica: row.atividades_com_validacao_tecnica || 0,
      atividades_qualitativas_todos: row.atividades_qualitativas_todos || 0,
      atividades_com_limite_impacto_local: row.atividades_com_limite_impacto_local || 0,
      atividades_com_observacao_interna: row.atividades_com_observacao_interna || 0,
    },
    grupos: groups.rows,
    atividades: validation.rows,
    liberacao_tecnica: releaseRow,
    bloqueios_producao: bloqueiosProducao,
    mensagem: 'Parametrizacao orientativa. Nao libera DAM real, cobranca oficial, protocolo definitivo ou decisao administrativa automatica.',
  };
}

async function getParametrizacaoFase2D2Status() {
  const targetCodes = [
    '15.20',
    '16.06',
    '17.05',
    '23.01',
    '23.02',
    '23.03',
    '23.04',
    '23.05',
    '23.06',
  ];
  const targetGroups = ['15', '16', '17', '23'];

  const [summary, groups, validation, release] = await Promise.all([
    repository.db.query(
      `
        WITH atividades_base AS (
          SELECT *
          FROM licenciamento_atividades
          WHERE deleted_at IS NULL AND ativo = true AND codigo = ANY($1)
        )
        SELECT
          COUNT(*)::int AS atividades,
          MAX(updated_at) AS atualizado_em,
          (
            SELECT COUNT(*)::int
            FROM licenciamento_regras_enquadramento r
            JOIN atividades_base a ON a.id = r.atividade_id
            WHERE r.deleted_at IS NULL AND r.ativo = true
          ) AS regras,
          COALESCE(SUM(jsonb_array_length(COALESCE(perguntas_publicas, '[]'::jsonb))), 0)::int AS perguntas,
          COALESCE(SUM(jsonb_array_length(COALESCE(alertas_publicos, '[]'::jsonb))), 0)::int AS alertas,
          COALESCE(SUM(jsonb_array_length(COALESCE(bloqueios_publicos, '[]'::jsonb))), 0)::int AS bloqueios,
          (
            SELECT COUNT(*)::int
            FROM licenciamento_documentos_exigidos d
            JOIN atividades_base a ON a.id = d.atividade_id
            WHERE d.deleted_at IS NULL AND d.ativo = true
          ) AS documentos,
          COUNT(*) FILTER (WHERE validacoes_requeridas::text LIKE '%validacao%')::int AS atividades_com_validacao_tecnica,
          COUNT(*) FILTER (WHERE validacoes_requeridas::text LIKE '%normativa%' OR COALESCE(observacoes, '') ILIKE '%normativa%')::int AS atividades_com_validacao_normativa,
          COUNT(*) FILTER (WHERE formula_codigo = 'PARAMETRO_QUALITATIVO_TODOS' OR formula_codigo = 'PARAMETRO_SANITARIO_QUALITATIVO')::int AS atividades_qualitativas_todos,
          COUNT(*) FILTER (WHERE limite_impacto_local_tipo = 'valor_maximo')::int AS atividades_com_limite_impacto_local,
          COUNT(*) FILTER (WHERE COALESCE(observacoes, '') <> '')::int AS atividades_com_observacao_interna
        FROM atividades_base;
      `,
      [targetCodes]
    ),
    repository.db.query(
      `
        SELECT
          split_part(a.codigo, '.', 1) AS grupo,
          MAX(a.categoria) AS nome,
          COUNT(DISTINCT a.id)::int AS atividades,
          COUNT(DISTINCT r.id)::int AS regras,
          COUNT(DISTINCT d.id)::int AS documentos
        FROM licenciamento_atividades a
        LEFT JOIN licenciamento_regras_enquadramento r ON r.atividade_id = a.id AND r.deleted_at IS NULL AND r.ativo = true
        LEFT JOIN licenciamento_documentos_exigidos d ON d.atividade_id = a.id AND d.deleted_at IS NULL AND d.ativo = true
        WHERE a.deleted_at IS NULL AND a.ativo = true AND a.codigo = ANY($1)
        GROUP BY split_part(a.codigo, '.', 1)
        ORDER BY grupo;
      `,
      [targetCodes]
    ),
    repository.db.query(
      `
        SELECT
          a.codigo,
          a.nome,
          a.categoria,
          a.tipo_atividade,
          a.potencial_poluidor_padrao,
          a.formula_codigo,
          a.limite_impacto_local_tipo,
          a.validacoes_requeridas,
          a.observacoes,
          jsonb_array_length(COALESCE(a.bloqueios_publicos, '[]'::jsonb))::int AS bloqueios,
          COUNT(DISTINCT r.id)::int AS regras,
          COUNT(DISTINCT d.id)::int AS documentos,
          COUNT(DISTINCT r.id) FILTER (WHERE r.status_resultado = 'requer_validacao_normativa')::int AS regras_com_validacao_normativa
        FROM licenciamento_atividades a
        LEFT JOIN licenciamento_regras_enquadramento r ON r.atividade_id = a.id AND r.deleted_at IS NULL AND r.ativo = true
        LEFT JOIN licenciamento_documentos_exigidos d ON d.atividade_id = a.id AND d.deleted_at IS NULL AND d.ativo = true
        WHERE a.deleted_at IS NULL AND a.ativo = true AND a.codigo = ANY($1)
        GROUP BY a.id
        ORDER BY a.codigo;
      `,
      [targetCodes]
    ),
    repository.db.query(
      `
        SELECT id, codigo, status, ready, confirmado_em, bloqueios_producao_json
        FROM licenciamento_homologacao_liberacoes
        WHERE status = 'liberada_tecnicamente'
          AND ready = true
        ORDER BY confirmado_em DESC NULLS LAST, id DESC
        LIMIT 1;
      `
    ),
  ]);

  const row = summary.rows[0] || {};
  const releaseRow = release.rows[0] || null;
  const blockers = releaseRow?.bloqueios_producao_json || {};
  const bloqueiosProducao = {
    dam_real: blockers.dam_real === true,
    cobranca_oficial: blockers.cobranca_oficial === true,
    protocolo_definitivo: blockers.protocolo_definitivo === true,
    decisao_automatica: blockers.decisao_automatica === true,
  };
  const atividadesComNormativa = validation.rows.filter((item) => Number(item.regras_com_validacao_normativa) > 0
    || JSON.stringify(item.validacoes_requeridas || []).includes('normativa')
    || String(item.observacoes || '').toLowerCase().includes('normativa'));

  return {
    fase: '2D.2',
    bloco: 'Grupos 15, 16, 17 e 23',
    grupos: targetGroups,
    grupos_cadastrados: groups.rows.length,
    atividades_cadastradas: row.atividades || 0,
    regras_cadastradas: row.regras || 0,
    perguntas_publicas: row.perguntas || 0,
    alertas_publicos: row.alertas || 0,
    bloqueios_logicos: row.bloqueios || 0,
    documentos_vinculados: row.documentos || 0,
    atividades_com_validacao_tecnica: row.atividades_com_validacao_tecnica || 0,
    atividades_com_validacao_normativa: atividadesComNormativa.length,
    seed_executado: row.atividades === targetCodes.length,
    atualizado_em: row.atualizado_em || null,
    status_seed: row.atividades === targetCodes.length ? 'executado' : 'pendente',
    esperado: {
      grupos: targetGroups.length,
      atividades: targetCodes.length,
    },
    totais: {
      grupos: groups.rows.length,
      atividades: row.atividades || 0,
      regras: row.regras || 0,
      perguntas: row.perguntas || 0,
      alertas: row.alertas || 0,
      bloqueios: row.bloqueios || 0,
      documentos: row.documentos || 0,
      atividades_com_validacao_tecnica: row.atividades_com_validacao_tecnica || 0,
      atividades_com_validacao_normativa: atividadesComNormativa.length,
      atividades_qualitativas_todos: row.atividades_qualitativas_todos || 0,
      atividades_com_limite_impacto_local: row.atividades_com_limite_impacto_local || 0,
      atividades_com_observacao_interna: row.atividades_com_observacao_interna || 0,
    },
    grupos_detalhados: groups.rows,
    atividades: validation.rows,
    pendencias_normativas: atividadesComNormativa.map((item) => ({
      codigo: item.codigo,
      nome: item.nome,
      observacao: item.observacoes || 'Atividade ou faixa depende de validacao normativa.',
    })),
    liberacao_tecnica: releaseRow,
    bloqueios_producao: bloqueiosProducao,
    mensagem: 'Parametrizacao orientativa. Nao libera DAM real, cobranca oficial, protocolo definitivo ou decisao administrativa automatica.',
  };
}

async function getParametrizacaoFase2D21Status() {
  const targetCodesByGroup = {
    15: Array.from({ length: 27 }, (_, index) => `15.${String(index + 1).padStart(2, '0')}`),
    16: Array.from({ length: 8 }, (_, index) => `16.${String(index + 1).padStart(2, '0')}`),
    17: Array.from({ length: 17 }, (_, index) => `17.${String(index + 1).padStart(2, '0')}`),
  };
  const targetCodes = Object.values(targetCodesByGroup).flat();
  const targetGroups = Object.keys(targetCodesByGroup);
  const statusTags = {
    confirmado: 'status_normativo_confirmado_decreto_021_2020',
    pendente: 'status_normativo_requer_validacao_normativa',
    lacuna: 'status_normativo_incompleto_por_lacuna_textual',
  };
  const fase2d1Codes = [
    '18.01', '18.02', '18.03', '18.04', '18.05', '18.06', '18.07', '18.08', '18.09', '18.10', '18.11', '18.12', '18.13', '18.14', '18.15', '18.16', '18.17',
    '20.01', '20.02', '20.03', '20.04', '20.05', '20.06', '20.07', '20.08', '20.09', '20.10', '20.11',
    '22.01', '22.02', '22.03', '22.04', '22.05', '22.06', '22.07', '22.08', '22.09', '22.10', '22.11',
    '24.01', '24.02', '24.03', '24.04', '24.05', '24.06', '24.07',
  ];
  const fase2d2Codes = ['15.20', '16.06', '17.05', '23.01', '23.02', '23.03', '23.04', '23.05', '23.06'];

  const [
    summary,
    groups,
    validation,
    release,
    fase2d1,
    fase2d2,
  ] = await Promise.all([
    repository.db.query(
      `
        WITH atividades_base AS (
          SELECT *
          FROM licenciamento_atividades
          WHERE deleted_at IS NULL AND ativo = true AND codigo = ANY($1)
        )
        SELECT
          COUNT(*)::int AS atividades,
          MAX(updated_at) AS atualizado_em,
          COUNT(*) FILTER (WHERE validacoes_requeridas ? $2 OR NOT (validacoes_requeridas ? $3 OR validacoes_requeridas ? $4))::int AS confirmadas,
          COUNT(*) FILTER (WHERE validacoes_requeridas ? $3)::int AS pendentes_normativas,
          COUNT(*) FILTER (WHERE validacoes_requeridas ? $4)::int AS lacunas_textuais,
          (
            SELECT COUNT(*)::int
            FROM licenciamento_regras_enquadramento r
            JOIN atividades_base a ON a.id = r.atividade_id
            WHERE r.deleted_at IS NULL AND r.ativo = true
          ) AS regras,
          COALESCE(SUM(jsonb_array_length(COALESCE(perguntas_publicas, '[]'::jsonb))), 0)::int AS perguntas,
          COALESCE(SUM(jsonb_array_length(COALESCE(alertas_publicos, '[]'::jsonb))), 0)::int AS alertas,
          COALESCE(SUM(jsonb_array_length(COALESCE(bloqueios_publicos, '[]'::jsonb))), 0)::int AS bloqueios,
          (
            SELECT COUNT(*)::int
            FROM licenciamento_documentos_exigidos d
            JOIN atividades_base a ON a.id = d.atividade_id
            WHERE d.deleted_at IS NULL AND d.ativo = true
          ) AS documentos,
          COUNT(*) FILTER (WHERE validacoes_requeridas::text LIKE '%validacao%')::int AS atividades_com_validacao_tecnica,
          COUNT(*) FILTER (WHERE limite_impacto_local_tipo = 'valor_maximo')::int AS atividades_com_limite_impacto_local,
          COUNT(*) FILTER (WHERE COALESCE(observacoes, '') <> '')::int AS atividades_com_observacao_interna
        FROM atividades_base;
      `,
      [targetCodes, statusTags.confirmado, statusTags.pendente, statusTags.lacuna]
    ),
    repository.db.query(
      `
        SELECT
          split_part(a.codigo, '.', 1) AS grupo,
          MAX(a.categoria) AS nome,
          COUNT(DISTINCT a.id)::int AS atividades,
          COUNT(DISTINCT r.id)::int AS regras,
          COUNT(DISTINCT d.id)::int AS documentos
        FROM licenciamento_atividades a
        LEFT JOIN licenciamento_regras_enquadramento r ON r.atividade_id = a.id AND r.deleted_at IS NULL AND r.ativo = true
        LEFT JOIN licenciamento_documentos_exigidos d ON d.atividade_id = a.id AND d.deleted_at IS NULL AND d.ativo = true
        WHERE a.deleted_at IS NULL AND a.ativo = true AND a.codigo = ANY($1)
        GROUP BY split_part(a.codigo, '.', 1)
        ORDER BY grupo;
      `,
      [targetCodes]
    ),
    repository.db.query(
      `
        SELECT
          a.codigo,
          a.nome,
          a.categoria,
          a.tipo_atividade,
          a.potencial_poluidor_padrao,
          a.parametro_principal_label,
          a.unidade_parametro_principal,
          a.formula_codigo,
          a.limite_impacto_local_tipo,
          a.limite_impacto_local_valor,
          a.validacoes_requeridas,
          a.observacoes,
          jsonb_array_length(COALESCE(a.bloqueios_publicos, '[]'::jsonb))::int AS bloqueios,
          COUNT(DISTINCT r.id)::int AS regras,
          COUNT(DISTINCT d.id)::int AS documentos,
          COUNT(DISTINCT r.id) FILTER (WHERE r.status_resultado = 'requer_validacao_normativa')::int AS regras_com_validacao_normativa
        FROM licenciamento_atividades a
        LEFT JOIN licenciamento_regras_enquadramento r ON r.atividade_id = a.id AND r.deleted_at IS NULL AND r.ativo = true
        LEFT JOIN licenciamento_documentos_exigidos d ON d.atividade_id = a.id AND d.deleted_at IS NULL AND d.ativo = true
        WHERE a.deleted_at IS NULL AND a.ativo = true AND a.codigo = ANY($1)
        GROUP BY a.id
        ORDER BY a.codigo;
      `,
      [targetCodes]
    ),
    repository.db.query(
      `
        SELECT id, codigo, status, ready, confirmado_em, bloqueios_producao_json
        FROM licenciamento_homologacao_liberacoes
        WHERE status = 'liberada_tecnicamente'
          AND ready = true
        ORDER BY confirmado_em DESC NULLS LAST, id DESC
        LIMIT 1;
      `
    ),
    repository.db.query(
      `
        SELECT COUNT(*)::int AS cadastradas
        FROM licenciamento_atividades
        WHERE deleted_at IS NULL AND ativo = true AND codigo = ANY($1);
      `,
      [fase2d1Codes]
    ),
    repository.db.query(
      `
        SELECT COUNT(*)::int AS cadastradas
        FROM licenciamento_atividades
        WHERE deleted_at IS NULL AND ativo = true AND codigo = ANY($1);
      `,
      [fase2d2Codes]
    ),
  ]);

  const row = summary.rows[0] || {};
  const releaseRow = release.rows[0] || null;
  const blockers = releaseRow?.bloqueios_producao_json || {};
  const bloqueiosProducao = {
    dam_real: blockers.dam_real === true,
    cobranca_oficial: blockers.cobranca_oficial === true,
    protocolo_definitivo: blockers.protocolo_definitivo === true,
    decisao_automatica: blockers.decisao_automatica === true,
  };

  const cadastradosPorGrupo = Object.fromEntries(targetGroups.map((grupo) => [grupo, 0]));
  groups.rows.forEach((item) => {
    cadastradosPorGrupo[item.grupo] = Number(item.atividades || 0);
  });

  const expectedByGroup = Object.fromEntries(
    Object.entries(targetCodesByGroup).map(([grupo, codes]) => [grupo, codes.length])
  );
  const cadastradoCodes = new Set(validation.rows.map((item) => item.codigo));
  const codigosFaltantesPorGrupo = Object.fromEntries(
    Object.entries(targetCodesByGroup).map(([grupo, codes]) => [
      grupo,
      codes.filter((code) => !cadastradoCodes.has(code)),
    ])
  );

  const atividades = validation.rows.map((item) => {
    const validacoes = item.validacoes_requeridas || [];
    let statusNormativo = 'confirmado_decreto_021_2020';
    if (validacoes.includes(statusTags.lacuna)) statusNormativo = 'incompleto_por_lacuna_textual';
    else if (validacoes.includes(statusTags.pendente)) statusNormativo = 'requer_validacao_normativa';
    return { ...item, status_normativo: statusNormativo };
  });

  const atividadesComLacuna = atividades.filter((item) => item.status_normativo === 'incompleto_por_lacuna_textual');
  const atividadesPendentes = atividades.filter((item) => item.status_normativo !== 'confirmado_decreto_021_2020');
  const divergencias = [
    ...Object.entries(codigosFaltantesPorGrupo)
      .filter(([, codes]) => codes.length > 0)
      .map(([grupo, codes]) => ({
        tipo: 'codigo_faltante',
        grupo,
        codigos: codes,
        mensagem: `Grupo ${grupo} possui codigos esperados ainda nao cadastrados.`,
      })),
    ...atividadesComLacuna.map((item) => ({
      tipo: 'lacuna_textual',
      grupo: String(item.codigo).split('.')[0],
      codigo: item.codigo,
      mensagem: item.observacoes || 'Atividade possui lacuna textual normativa registrada.',
    })),
  ];

  return {
    fase: '2D.2.1',
    bloco: 'Complementacao normativa auditavel dos Grupos 15, 16 e 17',
    grupos: targetGroups,
    codigos_esperados_por_grupo: expectedByGroup,
    codigos_cadastrados_por_grupo: cadastradosPorGrupo,
    grupos_cadastrados: groups.rows.length,
    atividades_cadastradas: row.atividades || 0,
    regras_cadastradas: row.regras || 0,
    perguntas_publicas: row.perguntas || 0,
    alertas_publicos: row.alertas || 0,
    bloqueios_logicos: row.bloqueios || 0,
    documentos_vinculados: row.documentos || 0,
    atividades_confirmadas: row.confirmadas || 0,
    atividades_com_pendencia_normativa: row.pendentes_normativas || 0,
    atividades_incompletas_por_lacuna_textual: row.lacunas_textuais || 0,
    atividades_com_validacao_tecnica: row.atividades_com_validacao_tecnica || 0,
    seed_executado: row.atividades === targetCodes.length && divergencias.filter((item) => item.tipo === 'codigo_faltante').length === 0,
    atualizado_em: row.atualizado_em || null,
    status_seed: row.atividades === targetCodes.length ? 'executado' : 'pendente',
    preservacao_fases_anteriores: {
      fase2d1: {
        esperadas: fase2d1Codes.length,
        cadastradas: fase2d1.rows[0]?.cadastradas || 0,
        preservada: Number(fase2d1.rows[0]?.cadastradas || 0) === fase2d1Codes.length,
      },
      fase2d2: {
        esperadas: fase2d2Codes.length,
        cadastradas: fase2d2.rows[0]?.cadastradas || 0,
        preservada: Number(fase2d2.rows[0]?.cadastradas || 0) === fase2d2Codes.length,
      },
    },
    totais: {
      grupos: groups.rows.length,
      atividades: row.atividades || 0,
      regras: row.regras || 0,
      perguntas: row.perguntas || 0,
      alertas: row.alertas || 0,
      bloqueios: row.bloqueios || 0,
      documentos: row.documentos || 0,
      atividades_confirmadas: row.confirmadas || 0,
      atividades_com_pendencia_normativa: row.pendentes_normativas || 0,
      atividades_incompletas_por_lacuna_textual: row.lacunas_textuais || 0,
      atividades_com_validacao_tecnica: row.atividades_com_validacao_tecnica || 0,
      atividades_com_limite_impacto_local: row.atividades_com_limite_impacto_local || 0,
      atividades_com_observacao_interna: row.atividades_com_observacao_interna || 0,
    },
    grupos_detalhados: groups.rows,
    atividades,
    pendencias_normativas: atividadesPendentes.map((item) => ({
      codigo: item.codigo,
      nome: item.nome,
      status_normativo: item.status_normativo,
      observacao: item.observacoes || 'Atividade depende de conferencia normativa antes de taxa ou classe definitiva.',
    })),
    divergencias_detectadas: divergencias,
    liberacao_tecnica: releaseRow,
    bloqueios_producao: bloqueiosProducao,
    mensagem: 'Complementacao normativa auditavel. Nao libera DAM real, cobranca oficial, protocolo definitivo ou decisao administrativa automatica.',
  };
}

function rangeDecretoCodes(group, total) {
  return Array.from({ length: total }, (_, index) => `${group}.${String(index + 1).padStart(2, '0')}`);
}

const DECRETO_021_MASTER_GROUPS = [
  ...Array.from({ length: 14 }, (_, index) => {
    const group = String(index + 1);
    return {
      grupo: group,
      nome: `Grupo ${group} - nome e codigos pendentes de conferencia PDF`,
      codigos_esperados: [],
      status_base: 'requer_conferencia_pdf',
      prioridade_recomendada: 'baixa',
      recomendacao_prioridade: 'Conferir tabela original do Decreto antes de qualquer parametrizacao.',
    };
  }),
  {
    grupo: '15',
    nome: 'Industria de Produtos Alimentares',
    codigos_esperados: rangeDecretoCodes('15', 27),
    lacunas: ['15.06', '15.11'],
    prioridade_recomendada: 'concluido_com_ressalvas',
    recomendacao_prioridade: 'Manter lacunas visiveis e validar 15.06 e 15.11 antes de taxa ou classe definitiva.',
  },
  {
    grupo: '16',
    nome: 'Industria de Bebidas',
    codigos_esperados: rangeDecretoCodes('16', 8),
    prioridade_recomendada: 'concluido',
    recomendacao_prioridade: 'Grupo parametrizado para simulacao orientativa, com bloqueios de producao preservados.',
  },
  {
    grupo: '17',
    nome: 'Industrias Diversas',
    codigos_esperados: rangeDecretoCodes('17', 17),
    lacunas: ['17.06'],
    prioridade_recomendada: 'concluido_com_ressalvas',
    recomendacao_prioridade: 'Manter lacuna textual de 17.06 visivel antes de taxa ou classe definitiva.',
  },
  {
    grupo: '18',
    nome: 'Uso e Ocupacao do Solo',
    codigos_esperados: rangeDecretoCodes('18', 17),
    prioridade_recomendada: 'concluido',
    recomendacao_prioridade: 'Grupo parametrizado na Fase 2D.1 e preservado para simulacao orientativa.',
  },
  {
    grupo: '19',
    nome: 'Energia',
    codigos_esperados: ['19.03'],
    status_base: 'parametrizado_parcialmente',
    prioridade_recomendada: 'alta',
    recomendacao_prioridade: 'Recomendado para o Bloco 3 por ja possuir piloto 19.03, uso recorrente de energia solar e teste de limite de impacto local previamente validado.',
    observacao_contagem: 'Somente 19.03 esta confirmado no acervo parametrizado; demais codigos do Grupo 19 dependem de conferencia PDF antes de cadastro.',
  },
  {
    grupo: '20',
    nome: 'Gerenciamento de Residuos',
    codigos_esperados: rangeDecretoCodes('20', 11),
    prioridade_recomendada: 'concluido',
    recomendacao_prioridade: 'Grupo parametrizado na Fase 2D.1 e preservado para simulacao orientativa.',
  },
  {
    grupo: '21',
    nome: 'Grupo 21 - nome e codigos pendentes de conferencia PDF',
    codigos_esperados: [],
    status_base: 'requer_conferencia_pdf',
    prioridade_recomendada: 'media',
    recomendacao_prioridade: 'Conferir texto do Decreto antes de decidir inclusao em bloco futuro.',
  },
  {
    grupo: '22',
    nome: 'Armazenamento e Estocagem',
    codigos_esperados: rangeDecretoCodes('22', 11),
    prioridade_recomendada: 'concluido',
    recomendacao_prioridade: 'Grupo parametrizado na Fase 2D.1 e preservado para simulacao orientativa.',
  },
  {
    grupo: '23',
    nome: 'Servicos de Saude e Areas Afins',
    codigos_esperados: rangeDecretoCodes('23', 6),
    lacunas: ['23.04'],
    prioridade_recomendada: 'concluido_com_ressalvas',
    recomendacao_prioridade: 'Manter a faixa intermediaria de 23.04 como requer_validacao_normativa.',
  },
  {
    grupo: '24',
    nome: 'Atividades Diversas',
    codigos_esperados: rangeDecretoCodes('24', 7),
    prioridade_recomendada: 'concluido',
    recomendacao_prioridade: 'Grupo parametrizado na Fase 2D.1 e preservado para simulacao orientativa.',
  },
  {
    grupo: '25',
    nome: 'Grupo 25 - nome e codigos pendentes de conferencia PDF',
    codigos_esperados: [],
    status_base: 'requer_conferencia_pdf',
    prioridade_recomendada: 'media',
    recomendacao_prioridade: 'Conferir texto do Decreto antes de decidir inclusao em bloco futuro.',
  },
];

const DECRETO_021_LACUNAS_NORMATIVAS = {
  '15.06': {
    descricao: 'Unidade textual ambigua: Decreto extraido informa ha, mas faixas numericas aparentam escala de m2.',
    risco: 'Nao gerar taxa, classe definitiva, DAM, licenca, dispensa, AMA ou decisao automatica sem conferencia normativa.',
  },
  '15.11': {
    descricao: 'Contradicao textual entre "artesanal" e "exceto artesanal".',
    risco: 'Nao concluir enquadramento automatico enquanto a SMAD nao validar o texto normativo.',
  },
  '17.06': {
    descricao: 'Expressao de area util ambigua em atividade de graficas e editoras.',
    risco: 'Nao gerar taxa ou classe definitiva ate saneamento da lacuna textual.',
  },
  '23.04': {
    descricao: 'Faixa intermediaria 25 < NLE <= 50 permanece sem confirmacao normativa.',
    risco: 'Retornar requer_validacao_normativa na faixa lacunosa, sem inventar porte, classe ou taxa.',
  },
};

const DECRETO_021_FASE_2D5B_FONTE_OFICIAL = {
  arquivo: 'C:/Users/Samira/Documents/links/Municipal/Decreto 21.2020.pdf',
  referencia: 'Decreto Municipal n. 021/2020, Anexo II-A - Planilha de Enquadramento das Atividades Passiveis de Licenciamento Ordinario e Simplificado.',
  metodo: 'Conferencia documental local por OCR rotacionado do PDF oficial informado pela SMAD. A Fase 2D.5B nao transforma a leitura em seed de regras, faixas, taxas ou classes.',
};

const DECRETO_021_GRUPOS_CONFIRMADOS_FASE_2D5B = [
  {
    grupo: '1',
    nome: 'Extracao Mineral',
    codigos_esperados: rangeDecretoCodes('1', 6),
    prioridade_recomendada: 'alta',
    recomendacao_prioridade: 'Fonte oficial confirma grupo e codigos. Parametrizacao segura exige conferencia linha a linha de parametros, faixas e limites antes de seed.',
  },
  {
    grupo: '2',
    nome: 'Atividades Agropecuarias',
    codigos_esperados: [
      ...rangeDecretoCodes('2', 13),
      ...rangeDecretoCodes('2', 25).filter((code) => Number(code.split('.')[1]) >= 15),
    ],
    prioridade_recomendada: 'alta',
    recomendacao_prioridade: 'Grupo frequente na rotina municipal. A leitura oficial confirmou 2.01 a 2.13 e 2.15 a 2.25; 2.14 nao foi inferido sem conferencia visual.',
    pendencias_conferencia_visual: [
      {
        codigo: '2.14',
        motivo: 'Sequencia do Anexo II-A extraida por OCR salta de 2.13 para 2.15. O codigo nao foi contado nem cadastrado sem conferencia visual do PDF.',
      },
    ],
  },
  {
    grupo: '3',
    nome: 'Industria de Produtos Minerais Nao Metalicos',
    codigos_esperados: rangeDecretoCodes('3', 12),
    prioridade_recomendada: 'alta',
    recomendacao_prioridade: 'Atividades industriais com potencial fiscalizatorio relevante. Exige conferencia normativa antes de seed.',
  },
  {
    grupo: '4',
    nome: 'Industria de Transformacao',
    codigos_esperados: rangeDecretoCodes('4', 3),
    prioridade_recomendada: 'media',
    recomendacao_prioridade: 'Fonte oficial confirma codigos. Parametrizacao deve ser precedida por conferencia das faixas de enquadramento.',
  },
  {
    grupo: '5',
    nome: 'Industria Metalmecanica',
    codigos_esperados: rangeDecretoCodes('5', 10),
    prioridade_recomendada: 'alta',
    recomendacao_prioridade: 'Grupo com atividades industriais potencialmente recorrentes. Requer conferencia normativa antes de seed.',
  },
  {
    grupo: '6',
    nome: 'Industria de Material Eletrico e de Comunicacao',
    codigos_esperados: rangeDecretoCodes('6', 2),
    prioridade_recomendada: 'media',
    recomendacao_prioridade: 'Fonte oficial confirma grupo pequeno. Pode ser parametrizado apos conferencia das faixas e documentos.',
  },
  {
    grupo: '7',
    nome: 'Industria de Material de Transporte',
    codigos_esperados: rangeDecretoCodes('7', 3),
    prioridade_recomendada: 'media',
    recomendacao_prioridade: 'Fonte oficial confirma codigos. Requer conferencia previa de parametros e limites.',
  },
  {
    grupo: '8',
    nome: 'Industria de Madeira e Mobiliario',
    codigos_esperados: rangeDecretoCodes('8', 6),
    prioridade_recomendada: 'alta',
    recomendacao_prioridade: 'Grupo com relevancia fiscalizatoria por uso de madeira, pintura e tratamento. Seed somente apos conferencia normativa.',
  },
  {
    grupo: '9',
    nome: 'Industria de Celulose e Papel',
    codigos_esperados: rangeDecretoCodes('9', 1),
    prioridade_recomendada: 'media',
    recomendacao_prioridade: 'Fonte oficial confirma grupo e codigo unico. Conferir faixas antes de qualquer parametrizacao.',
  },
  {
    grupo: '10',
    nome: 'Industria de Borracha',
    codigos_esperados: rangeDecretoCodes('10', 4),
    prioridade_recomendada: 'media',
    recomendacao_prioridade: 'Fonte oficial confirma codigos. Exige conferencia de parametro, porte e risco antes de seed.',
  },
  {
    grupo: '11',
    nome: 'Industria Quimica',
    codigos_esperados: rangeDecretoCodes('11', 9),
    prioridade_recomendada: 'alta',
    recomendacao_prioridade: 'Grupo sensivel por risco ambiental e produtos quimicos. Deve passar por conferencia normativa detalhada antes de seed.',
  },
  {
    grupo: '12',
    nome: 'Industria de Produtos de Materiais Plasticos',
    codigos_esperados: rangeDecretoCodes('12', 1),
    prioridade_recomendada: 'media',
    recomendacao_prioridade: 'Fonte oficial confirma grupo e codigo unico. Conferir faixas antes de parametrizar.',
  },
  {
    grupo: '13',
    nome: 'Industria Textil',
    codigos_esperados: rangeDecretoCodes('13', 7),
    prioridade_recomendada: 'alta',
    recomendacao_prioridade: 'Grupo com efluentes e processos potencialmente relevantes. Requer conferencia normativa antes de seed.',
  },
  {
    grupo: '14',
    nome: 'Industria de Vestuario e Artefatos de Tecidos, Couros e Peles',
    codigos_esperados: rangeDecretoCodes('14', 8),
    prioridade_recomendada: 'media',
    recomendacao_prioridade: 'Fonte oficial confirma codigos 14.01 a 14.08. Parametrizacao depende de conferencia de parametros e lacunas eventuais.',
  },
  {
    grupo: '21',
    nome: 'Obras e Estruturas Diversas',
    codigos_esperados: rangeDecretoCodes('21', 10),
    prioridade_recomendada: 'alta',
    recomendacao_prioridade: 'Recomendado para Bloco 4 por impacto administrativo, fiscalizacao e sinergia com grupos 20, 22 e 24. Proximo passo deve ser conferencia normativa detalhada.',
  },
  {
    grupo: '25',
    nome: 'Saneamento',
    codigos_esperados: rangeDecretoCodes('25', 2),
    prioridade_recomendada: 'alta',
    recomendacao_prioridade: 'Grupo pequeno e relevante para infraestrutura publica. Seed direto permanece bloqueado ate conferencia de faixas, documentos e competencia.',
  },
];

const DECRETO_021_GRUPO21_CONFERENCIA_FASE_2D5C = [
  {
    codigo: '21.01',
    nomeAtividade: 'Microdrenagem (Redes de drenagem de aguas pluviais com diametro de tubulacao requerido menor que 1.000 mm e seus dispositivos de drenagem), sem necessidade de intervencao em corpos hidricos (dragagens, canalizacao e/ou retificacoes, dentre outros). Nao inclui canais de drenagem.',
    descricaoNormativa: 'Atividade de microdrenagem sem intervencao em corpos hidricos e sem incluir canais de drenagem.',
    parametroPrincipal: 'Comprimento da Linha',
    unidade: 'km',
    abreviaturaParametro: 'CL',
    faixas: [
      {
        expressao: 'Todos, desde que vinculada a obras de pavimentacao e recapeamento asfaltico, dispensada de licenciamento em area urbana',
        origem: 'fragmento_ocr_anexo_ii_a',
        confianca: 'baixa',
        observacao: 'Fragmento precisa de conferencia visual para confirmar se se aplica a 21.01 e a qual coluna da matriz pertence.',
      },
      {
        expressao: 'Demais casos',
        origem: 'fragmento_ocr_anexo_ii_a',
        confianca: 'baixa',
        observacao: 'Fragmento precisa de conferencia visual antes de ser usado como regra.',
      },
    ],
    observacoesNormativas: [
      'A descricao exclui intervencao em corpos hidricos.',
      'A descricao informa que canais de drenagem nao estao incluidos.',
    ],
    dependencias: [
      { tipo: 'recursos_hidricos', status: 'bloqueio_condicional', motivo: 'Se houver dragagem, canalizacao, retificacao ou outra intervencao em corpo hidrico, a atividade descrita em 21.01 pode nao ser aplicavel.' },
      { tipo: 'semob_obras', status: 'potencial_a_confirmar', motivo: 'Vinculo com pavimentacao ou recapeamento aparece no fragmento OCR e requer conferencia visual.' },
    ],
    confianca: 'media',
  },
  {
    codigo: '21.02',
    nomeAtividade: 'Urbanizacao em margens de corpos hidricos interiores (lagunares, lacustres, fluviais e em reservatorios).',
    descricaoNormativa: 'Urbanizacao em margens de corpos hidricos interiores.',
    parametroPrincipal: 'Area de intervencao',
    unidade: 'ha',
    abreviaturaParametro: 'AIN',
    faixas: [
      { expressao: 'AIN 1', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Operador e coluna da matriz dependem de conferencia visual.' },
      { expressao: '1 < AIN < 10', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Fragmento identificado no OCR; confirmar coluna de porte/classe.' },
      { expressao: 'AIN > 10', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Fragmento identificado no OCR; confirmar coluna de porte/classe e limite.' },
    ],
    observacoesNormativas: [
      'Atividade relacionada a margens de corpos hidricos interiores.',
    ],
    dependencias: [
      { tipo: 'recursos_hidricos', status: 'potencial_a_confirmar', motivo: 'A propria descricao envolve margens de corpos hidricos.' },
      { tipo: 'app', status: 'potencial_a_confirmar', motivo: 'APP nao foi confirmada na linha OCR; verificar visualmente antes de parametrizar.' },
    ],
    confianca: 'media',
  },
  {
    codigo: '21.03',
    nomeAtividade: 'Urbanizacao de orlas (maritimas e estuarinas).',
    descricaoNormativa: 'Urbanizacao de orlas maritimas e estuarinas.',
    parametroPrincipal: 'Area de intervencao',
    unidade: 'ha',
    abreviaturaParametro: 'AIN',
    faixas: [
      { expressao: 'AIN 1', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Operador e coluna da matriz dependem de conferencia visual.' },
      { expressao: '1 < AIN < 10', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Fragmento identificado no OCR; confirmar coluna de porte/classe.' },
      { expressao: 'AIN > 10', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Fragmento identificado no OCR; confirmar coluna de porte/classe e limite.' },
    ],
    observacoesNormativas: [
      'Atividade relacionada a orlas maritimas e estuarinas.',
    ],
    dependencias: [
      { tipo: 'recursos_hidricos_orla', status: 'potencial_a_confirmar', motivo: 'A descricao envolve orla maritima ou estuarina.' },
      { tipo: 'app', status: 'potencial_a_confirmar', motivo: 'APP nao foi confirmada na linha OCR; verificar visualmente antes de parametrizar.' },
    ],
    confianca: 'media',
  },
  {
    codigo: '21.04',
    nomeAtividade: 'Atracadouro, ancoradouro, pieres e trapiches, sem realizacao de obras de dragagem, aterros, enrocamento e/ou quebra-mar.',
    descricaoNormativa: 'Estruturas de atracacao sem dragagem, aterro, enrocamento e/ou quebra-mar.',
    parametroPrincipal: 'Capacidade de atracacao/ancoragem',
    unidade: 'numero de embarcacoes',
    abreviaturaParametro: 'NE',
    faixas: [
      { expressao: 'NE < 5', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Confirmar operador, coluna da matriz e limite de impacto local visualmente.' },
      { expressao: 'Todos', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'baixa', observacao: 'Fragmento aparece proximo a 21.04-21.10; confirmar aplicacao.' },
    ],
    observacoesNormativas: [
      'A descricao exclui dragagem, aterros, enrocamento e/ou quebra-mar.',
    ],
    dependencias: [
      { tipo: 'recursos_hidricos', status: 'bloqueio_condicional', motivo: 'Dragagem, aterro, enrocamento ou quebra-mar nao fazem parte da linha conferida.' },
      { tipo: 'setor_obras', status: 'potencial_a_confirmar', motivo: 'Estrutura fisica em corpo hidrico deve ser conferida com a matriz e setores competentes.' },
    ],
    confianca: 'media',
  },
  {
    codigo: '21.05',
    nomeAtividade: 'Rampa para lancamento de barcos.',
    descricaoNormativa: 'Rampa para lancamento de barcos.',
    parametroPrincipal: 'Area Util',
    unidade: 'm2',
    abreviaturaParametro: 'AU',
    faixas: [
      { expressao: 'Todos', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'baixa', observacao: 'Confirmar se a faixa se aplica integralmente a 21.05 e em qual coluna.' },
    ],
    observacoesNormativas: [],
    dependencias: [
      { tipo: 'recursos_hidricos', status: 'potencial_a_confirmar', motivo: 'Rampa para barcos pode envolver margem ou corpo hidrico; a linha deve ser conferida visualmente.' },
    ],
    confianca: 'media',
  },
  {
    codigo: '21.06',
    nomeAtividade: 'Restauracao, reabilitacao e/ou melhoramento de estradas ou rodovias municipais e vicinais.',
    descricaoNormativa: 'Restauracao, reabilitacao e/ou melhoramento de estradas ou rodovias municipais e vicinais.',
    parametroPrincipal: 'Extensao da via',
    unidade: 'km',
    abreviaturaParametro: 'EV',
    faixas: [
      { expressao: 'EV 30', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Confirmar operador: o OCR nao diferencia <=, >= ou coluna de porte.' },
      { expressao: 'EV > 30', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Fragmento identificado no OCR; confirmar coluna e consequencia normativa.' },
    ],
    observacoesNormativas: [
      'Escopo limitado a estradas ou rodovias municipais e vicinais.',
    ],
    dependencias: [
      { tipo: 'semob_obras', status: 'potencial_a_confirmar', motivo: 'Atividade viaria municipal; dependencia setorial deve ser confirmada no fluxo administrativo.' },
    ],
    confianca: 'media',
  },
  {
    codigo: '21.07',
    nomeAtividade: 'Pavimentacao de estradas e rodovias municipais e vicinais.',
    descricaoNormativa: 'Pavimentacao de estradas e rodovias municipais e vicinais.',
    parametroPrincipal: 'Extensao da via',
    unidade: 'km',
    abreviaturaParametro: 'EV',
    faixas: [
      { expressao: 'Todos', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'baixa', observacao: 'Confirmar se a faixa Todos se aplica a 21.07 e em qual coluna da matriz.' },
    ],
    observacoesNormativas: [
      'Escopo limitado a estradas e rodovias municipais e vicinais.',
    ],
    dependencias: [
      { tipo: 'semob_obras', status: 'potencial_a_confirmar', motivo: 'Atividade viaria municipal; dependencia setorial deve ser confirmada no fluxo administrativo.' },
    ],
    confianca: 'media',
  },
  {
    codigo: '21.08',
    nomeAtividade: 'Implantacao de obras de arte corrente em estradas e rodovias municipais e vicinais.',
    descricaoNormativa: 'Implantacao de obras de arte corrente em estradas e rodovias municipais e vicinais.',
    parametroPrincipal: 'Largura do corpo hidrico',
    unidade: 'm',
    abreviaturaParametro: 'LCH',
    faixas: [
      { expressao: 'Todos', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'baixa', observacao: 'Confirmar se a faixa Todos se aplica a 21.08 e em qual coluna.' },
    ],
    observacoesNormativas: [
      'Linha envolve corpo hidrico como parametro.',
    ],
    dependencias: [
      { tipo: 'recursos_hidricos', status: 'potencial_a_confirmar', motivo: 'Parametro principal e largura de corpo hidrico.' },
      { tipo: 'semob_obras', status: 'potencial_a_confirmar', motivo: 'Obra em estrada ou rodovia municipal/vicinal.' },
    ],
    confianca: 'media',
  },
  {
    codigo: '21.09',
    nomeAtividade: 'Implantacao de obras de arte especiais.',
    descricaoNormativa: 'Implantacao de obras de arte especiais.',
    parametroPrincipal: 'Comprimento da estrutura',
    unidade: 'm',
    abreviaturaParametro: 'CE',
    faixas: [
      { expressao: '15 < CE < 30', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Fragmento identificado; confirmar demais limites e colunas.' },
      { expressao: 'CE 30', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'baixa', observacao: 'OCR nao permite confirmar operador.' },
    ],
    observacoesNormativas: [],
    dependencias: [
      { tipo: 'semob_obras', status: 'potencial_a_confirmar', motivo: 'Obra de arte especial pode depender de setor de obras e conferencia locacional.' },
      { tipo: 'recursos_hidricos', status: 'potencial_a_confirmar', motivo: 'A natureza da obra pode envolver corpo hidrico, mas isso deve ser conferido caso a caso.' },
    ],
    confianca: 'media',
  },
  {
    codigo: '21.10',
    nomeAtividade: 'Estabelecimentos prisionais e semelhantes.',
    descricaoNormativa: 'Estabelecimentos prisionais e semelhantes.',
    parametroPrincipal: 'Capacidade Projetada',
    unidade: 'numero de pessoas',
    abreviaturaParametro: 'CP',
    faixas: [
      { expressao: 'CP 150', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'baixa', observacao: 'OCR nao permite confirmar operador.' },
      { expressao: '150 < CP 450', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Fragmento identificado; confirmar operador e coluna.' },
      { expressao: '450 < CP 800', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Fragmento identificado; confirmar operador e coluna.' },
      { expressao: 'CP > 800', origem: 'fragmento_ocr_anexo_ii_a', confianca: 'media', observacao: 'Fragmento identificado; confirmar coluna da matriz.' },
    ],
    observacoesNormativas: [],
    dependencias: [
      { tipo: 'setor_responsavel_empreendimento_publico', status: 'potencial_a_confirmar', motivo: 'Estabelecimento prisional exige conferencia administrativa especifica antes de seed.' },
    ],
    confianca: 'media',
  },
].map((item) => ({
  grupo: 21,
  nomeGrupo: 'Obras e Estruturas Diversas',
  nome_grupo: 'Obras e Estruturas Diversas',
  ...item,
  nome_atividade: item.nomeAtividade,
  descricao_normativa: item.descricaoNormativa,
  parametro_principal: item.parametroPrincipal,
  abreviatura_parametro: item.abreviaturaParametro,
  classe: null,
  tipoAtoAplicavel: null,
  tipo_ato_aplicavel: null,
  documentos: [],
  documentosObservacao: 'Documentos minimos nao constam de forma segura no trecho conferido do Anexo II-A; devem ser definidos em fase propria com matriz documental oficial.',
  documentos_observacao: 'Documentos minimos nao constam de forma segura no trecho conferido do Anexo II-A; devem ser definidos em fase propria com matriz documental oficial.',
  observacoes_normativas: item.observacoesNormativas,
  fonte: 'Decreto Municipal n. 021/2020, Anexo II-A',
  fonte_normativa: 'Decreto Municipal n. 021/2020, Anexo II-A',
  fonte_arquivo: DECRETO_021_FASE_2D5B_FONTE_OFICIAL.arquivo,
  fonte_paginas: 'PDF pages 69-70 / OCR page indexes 68-69',
  grau_confianca: item.confianca,
  statusConferencia: 'pendente_conferencia_visual',
  status_conferencia: 'pendente_conferencia_visual',
  aptoParaSeed: false,
  apto_para_seed: false,
  bloqueioSeed: 'Bloqueado para seed porque faixas, classes, tipo de ato e documentos ainda dependem de conferencia visual humana.',
  bloqueio_seed: 'Bloqueado para seed porque faixas, classes, tipo de ato e documentos ainda dependem de conferencia visual humana.',
  lacunas: [
    {
      tipo: 'faixas_classes_tipo_ato',
      motivo: 'OCR intercalou colunas de porte, classe, limite e potencial poluidor; nao ha seguranca para parametrizacao operacional.',
      acao_necessaria: 'Conferencia visual linha a linha no PDF oficial antes de seed.',
    },
    {
      tipo: 'documentos_minimos',
      motivo: 'Anexo II-A nao consolidou documentos minimos exigiveis para a atividade.',
      acao_necessaria: 'Conferir matriz documental oficial antes de parametrizar checklist.',
    },
  ],
}));

const DECRETO_021_FASE_2D5C1_CABECALHO_VISUAL = {
  pagina_pdf: 'PDF p. 48 / Diario Municipal p. 101',
  trecho_tabela: 'Anexo II-A - Planilha de Enquadramento das Atividades Passiveis de Licenciamento Ordinario e Simplificado de Impacto Local',
  colunas_conferidas: [
    'Codigo das atividades',
    'Descricao da Atividade',
    'Tipo',
    'Parametro',
    'Classe Simplificada',
    'Porte Limite - Pequeno',
    'Porte Limite - Medio',
    'Porte Limite - Grande',
    'Potencial Poluidor/Degradador',
    'Porte Limite fixado para atividades de impacto local',
  ],
  observacao: 'Cabecalho conferido visualmente na imagem renderizada do PDF oficial. A tabela nao possui coluna especifica de documentos minimos nem coluna de tipo de ato/licenca.',
};

function buildGrupo21VisualFaixa({
  ordem,
  colunaTabela,
  operador,
  valorInicial = null,
  valorFinal = null,
  textoNormativoFaixa,
  porte,
  classe = '',
  limiteImpactoLocal,
  potencialPoluidor,
}) {
  return {
    ordem,
    colunaTabela,
    operador,
    valorInicial,
    valorFinal,
    textoNormativoFaixa,
    porte,
    classe,
    tipoAto: '',
    limiteImpactoLocal,
    potencialPoluidor,
    statusConferencia: 'conferido',
    observacao: 'Faixa conferida visualmente no Anexo II-A. Tipo de ato/licenca nao consta em coluna especifica desta tabela.',
  };
}

function buildGrupo21VisualItem({
  codigo,
  nomeAtividade,
  parametroPrincipal,
  unidade,
  abreviaturaParametro,
  potencialPoluidor,
  limiteImpactoLocal,
  paginaPdf,
  trechoTabela,
  faixasConferidas,
  observacoesNormativas = [],
  bloqueiosNormativos = [],
  dependenciasSetoriais = [],
}) {
  const lacunas = [
    {
      tipo: 'tipo_ato_licenca',
      descricao: 'O Anexo II-A conferido visualmente informa Tipo = N, classes/portes e potencial, mas nao identifica LMS, LMU, dispensa, AMA ou outro ato especifico por faixa.',
      acaoNecessaria: 'Confirmar o ato/licenca aplicavel em norma complementar, matriz operacional homologada ou validacao humana antes de seed.',
    },
    {
      tipo: 'documentos_minimos',
      descricao: 'Documentos minimos nao constam nas colunas do Anexo II-A visualmente conferido.',
      acaoNecessaria: 'Usar matriz documental oficial ou validacao SMAD antes de parametrizar checklist documental.',
    },
  ];

  return {
    grupo: 21,
    nomeGrupo: 'Obras e Estruturas Diversas',
    nome_grupo: 'Obras e Estruturas Diversas',
    codigo,
    nomeAtividade,
    nome_atividade: nomeAtividade,
    parametroPrincipal,
    parametro_principal: parametroPrincipal,
    unidade,
    abreviaturaParametro,
    abreviatura_parametro: abreviaturaParametro,
    tipoNormativo: 'N',
    tipo_normativo: 'N',
    tipoAtividade: 'nao_industrial',
    tipo_atividade: 'nao_industrial',
    potencialPoluidor,
    potencial_poluidor: potencialPoluidor.toLowerCase(),
    limiteImpactoLocal,
    limite_impacto_local: limiteImpactoLocal,
    tipoAtoLicenca: '',
    tipo_ato_licenca: '',
    tipoAtoLicencaObservacao: 'Nao consta tipo de ato/licenca especifico no trecho visual do Anexo II-A.',
    documentosMinimos: [],
    documentos_minimos: [],
    documentosObservacao: 'Nao constam documentos minimos no trecho visual do Anexo II-A.',
    documentos_observacao: 'Nao constam documentos minimos no trecho visual do Anexo II-A.',
    faixasConferidas,
    faixas_conferidas: faixasConferidas,
    faixas: faixasConferidas,
    observacoesNormativas,
    observacoes_normativas: observacoesNormativas,
    bloqueiosNormativos,
    bloqueios_normativos: bloqueiosNormativos,
    dependenciasSetoriais,
    dependencias_setoriais: dependenciasSetoriais,
    evidenciaVisual: {
      paginaPdf,
      trechoTabela,
      observacao: `${DECRETO_021_FASE_2D5C1_CABECALHO_VISUAL.observacao} Linhas e colunas do codigo conferidas na pagina indicada.`,
    },
    evidencia_visual: {
      pagina_pdf: paginaPdf,
      trecho_tabela: trechoTabela,
      observacao: `${DECRETO_021_FASE_2D5C1_CABECALHO_VISUAL.observacao} Linhas e colunas do codigo conferidas na pagina indicada.`,
    },
    fonte: 'Decreto Municipal n. 021/2020',
    fonte_normativa: 'Decreto Municipal n. 021/2020, Anexo II-A',
    fonte_arquivo: DECRETO_021_FASE_2D5B_FONTE_OFICIAL.arquivo,
    metodoConferencia: 'conferencia_visual_pdf',
    metodo_conferencia: 'conferencia_visual_pdf',
    confianca: 'alta',
    grau_confianca: 'alta',
    statusConferencia: 'conferido_com_lacunas',
    status_conferencia: 'conferido_com_lacunas',
    lacunas,
    aptoParaSeedFuturo: false,
    apto_para_seed_futuro: false,
    aptoParaSeed: false,
    apto_para_seed: false,
    bloqueioSeed: 'Bloqueado para seed futuro ate confirmacao de tipo de ato/licenca e matriz documental oficial, sem inferencia a partir do OCR.',
    bloqueio_seed: 'Bloqueado para seed futuro ate confirmacao de tipo de ato/licenca e matriz documental oficial, sem inferencia a partir do OCR.',
  };
}

const GRUPO21_PAGINA_122 = {
  paginaPdf: 'PDF p. 69 / Diario Municipal p. 122',
  trechoTabela: 'Anexo II-A, Grupo 21 - Obras e Estruturas Diversas, linhas 21.01 a 21.03',
};

const GRUPO21_PAGINA_123 = {
  paginaPdf: 'PDF p. 70 / Diario Municipal p. 123',
  trechoTabela: 'Anexo II-A, Grupo 21 - Obras e Estruturas Diversas, linhas 21.04 a 21.10',
};

const DECRETO_021_GRUPO21_CONFERENCIA_VISUAL_FASE_2D5C1 = [
  buildGrupo21VisualItem({
    codigo: '21.01',
    nomeAtividade: 'Microdrenagem (Redes de drenagem de aguas pluviais com diametro de tubulacao requerido menor que 1.000 mm e seus dispositivos de drenagem), sem necessidade de intervencao em corpos hidricos (dragagens, canalizacao e/ou retificacoes, dentre outros). Nao inclui canais de drenagem.',
    parametroPrincipal: 'Comprimento da Linha',
    unidade: 'km',
    abreviaturaParametro: 'CL',
    potencialPoluidor: 'BAIXO',
    limiteImpactoLocal: 'Todos',
    ...GRUPO21_PAGINA_122,
    faixasConferidas: [
      buildGrupo21VisualFaixa({
        ordem: 1,
        colunaTabela: 'Classe Simplificada',
        operador: 'todos_condicionado',
        textoNormativoFaixa: 'Todos, desde que vinculada a obras de pavimentacao e recapeamento asfaltico, dispensada de licenciamento em area urbana',
        porte: 'Classe Simplificada',
        classe: 'Classe Simplificada',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'BAIXO',
      }),
      buildGrupo21VisualFaixa({
        ordem: 2,
        colunaTabela: 'Porte Limite - Pequeno',
        operador: 'demais_casos',
        textoNormativoFaixa: 'Demais casos',
        porte: 'Pequeno',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'BAIXO',
      }),
    ],
    observacoesNormativas: [
      'A propria descricao restringe a linha a microdrenagem sem intervencao em corpos hidricos.',
      'A descricao exclui canais de drenagem.',
    ],
    bloqueiosNormativos: [
      'Nao aplicar 21.01 quando houver dragagem, canalizacao, retificacao ou outra intervencao em corpo hidrico.',
      'Nao aplicar 21.01 para canais de drenagem.',
    ],
    dependenciasSetoriais: [
      {
        tipo: 'obras_pavimentacao_recapeamento',
        status: 'condicao_normativa_na_classe_simplificada',
        observacao: 'A classe simplificada depende de vinculo com obras de pavimentacao e recapeamento asfaltico em area urbana.',
      },
    ],
  }),
  buildGrupo21VisualItem({
    codigo: '21.02',
    nomeAtividade: 'Urbanizacao em margens de corpos hidricos interiores (lagunares, lacustres, fluviais e em reservatorios).',
    parametroPrincipal: 'Area de intervencao',
    unidade: 'ha',
    abreviaturaParametro: 'AIN',
    potencialPoluidor: 'MEDIO',
    limiteImpactoLocal: 'Todos',
    ...GRUPO21_PAGINA_122,
    faixasConferidas: [
      buildGrupo21VisualFaixa({
        ordem: 1,
        colunaTabela: 'Porte Limite - Pequeno',
        operador: 'menor_igual',
        valorFinal: 1,
        textoNormativoFaixa: 'AIN <= 1',
        porte: 'Pequeno',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
      buildGrupo21VisualFaixa({
        ordem: 2,
        colunaTabela: 'Porte Limite - Medio',
        operador: 'maior_que_e_menor_igual',
        valorInicial: 1,
        valorFinal: 10,
        textoNormativoFaixa: '1 < AIN <= 10',
        porte: 'Medio',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
      buildGrupo21VisualFaixa({
        ordem: 3,
        colunaTabela: 'Porte Limite - Grande',
        operador: 'maior_que',
        valorInicial: 10,
        textoNormativoFaixa: 'AIN > 10',
        porte: 'Grande',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
    ],
    observacoesNormativas: [
      'Atividade vinculada a margens de corpos hidricos interiores.',
    ],
    dependenciasSetoriais: [
      {
        tipo: 'recursos_hidricos_app',
        status: 'avaliacao_tecnica_recomendada',
        observacao: 'A descricao envolve margens de corpos hidricos interiores; o trecho visual nao traz anuencia setorial expressa.',
      },
    ],
  }),
  buildGrupo21VisualItem({
    codigo: '21.03',
    nomeAtividade: 'Urbanizacao de orlas (maritimas e estuarinas).',
    parametroPrincipal: 'Area de intervencao',
    unidade: 'ha',
    abreviaturaParametro: 'AIN',
    potencialPoluidor: 'ALTO',
    limiteImpactoLocal: 'Todos',
    ...GRUPO21_PAGINA_122,
    faixasConferidas: [
      buildGrupo21VisualFaixa({
        ordem: 1,
        colunaTabela: 'Porte Limite - Pequeno',
        operador: 'menor_igual',
        valorFinal: 1,
        textoNormativoFaixa: 'AIN <= 1',
        porte: 'Pequeno',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'ALTO',
      }),
      buildGrupo21VisualFaixa({
        ordem: 2,
        colunaTabela: 'Porte Limite - Medio',
        operador: 'maior_que_e_menor_igual',
        valorInicial: 1,
        valorFinal: 10,
        textoNormativoFaixa: '1 < AIN <= 10',
        porte: 'Medio',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'ALTO',
      }),
      buildGrupo21VisualFaixa({
        ordem: 3,
        colunaTabela: 'Porte Limite - Grande',
        operador: 'maior_que',
        valorInicial: 10,
        textoNormativoFaixa: 'AIN > 10',
        porte: 'Grande',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'ALTO',
      }),
    ],
    observacoesNormativas: [
      'Atividade vinculada a orlas maritimas e estuarinas.',
    ],
    dependenciasSetoriais: [
      {
        tipo: 'orla_recursos_hidricos_app',
        status: 'avaliacao_tecnica_recomendada',
        observacao: 'A descricao envolve orla maritima ou estuarina; o trecho visual nao traz anuencia setorial expressa.',
      },
    ],
  }),
  buildGrupo21VisualItem({
    codigo: '21.04',
    nomeAtividade: 'Atracadouro, ancoradouro, pieres e trapiches, sem realizacao de obras de dragagem, aterros, enrocamento e/ou quebra-mar.',
    parametroPrincipal: 'Capacidade de atracacao/ancoragem',
    unidade: 'numero de embarcacoes',
    abreviaturaParametro: 'NE',
    potencialPoluidor: 'MEDIO',
    limiteImpactoLocal: 'NE <= 5',
    ...GRUPO21_PAGINA_123,
    faixasConferidas: [
      buildGrupo21VisualFaixa({
        ordem: 1,
        colunaTabela: 'Classe Simplificada',
        operador: 'menor_igual',
        valorFinal: 5,
        textoNormativoFaixa: 'NE <= 5',
        porte: 'Classe Simplificada',
        classe: 'Classe Simplificada',
        limiteImpactoLocal: 'NE <= 5',
        potencialPoluidor: 'MEDIO',
      }),
    ],
    observacoesNormativas: [
      'A descricao exclui realizacao de dragagem, aterros, enrocamento e/ou quebra-mar.',
    ],
    bloqueiosNormativos: [
      'Nao aplicar 21.04 quando houver dragagem, aterros, enrocamento e/ou quebra-mar.',
      'Porte limite de impacto local visualmente conferido: NE <= 5.',
    ],
    dependenciasSetoriais: [
      {
        tipo: 'recursos_hidricos_estrutura_margem',
        status: 'avaliacao_tecnica_recomendada',
        observacao: 'Estrutura de atracacao/ancoragem pode envolver corpo hidrico; o trecho visual nao traz anuencia setorial expressa.',
      },
    ],
  }),
  buildGrupo21VisualItem({
    codigo: '21.05',
    nomeAtividade: 'Rampa para lancamento de barcos.',
    parametroPrincipal: 'Area Util',
    unidade: 'm2',
    abreviaturaParametro: 'AU',
    potencialPoluidor: 'MEDIO',
    limiteImpactoLocal: 'Todos',
    ...GRUPO21_PAGINA_123,
    faixasConferidas: [
      buildGrupo21VisualFaixa({
        ordem: 1,
        colunaTabela: 'Classe Simplificada',
        operador: 'todos',
        textoNormativoFaixa: 'Todos',
        porte: 'Classe Simplificada',
        classe: 'Classe Simplificada',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
    ],
    dependenciasSetoriais: [
      {
        tipo: 'recursos_hidricos_margem',
        status: 'avaliacao_tecnica_recomendada',
        observacao: 'Rampa para barcos pode envolver margem ou corpo hidrico; o trecho visual nao traz anuencia setorial expressa.',
      },
    ],
  }),
  buildGrupo21VisualItem({
    codigo: '21.06',
    nomeAtividade: 'Restauracao, reabilitacao e/ou melhoramento de estradas ou rodovias municipais e vicinais.',
    parametroPrincipal: 'Extensao da via',
    unidade: 'km',
    abreviaturaParametro: 'EV',
    potencialPoluidor: 'MEDIO',
    limiteImpactoLocal: 'Todos',
    ...GRUPO21_PAGINA_123,
    faixasConferidas: [
      buildGrupo21VisualFaixa({
        ordem: 1,
        colunaTabela: 'Classe Simplificada',
        operador: 'menor_igual',
        valorFinal: 30,
        textoNormativoFaixa: 'EV <= 30',
        porte: 'Classe Simplificada',
        classe: 'Classe Simplificada',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
      buildGrupo21VisualFaixa({
        ordem: 2,
        colunaTabela: 'Porte Limite - Pequeno',
        operador: 'maior_que',
        valorInicial: 30,
        textoNormativoFaixa: 'EV > 30',
        porte: 'Pequeno',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
    ],
    observacoesNormativas: [
      'Escopo restrito a estradas ou rodovias municipais e vicinais.',
    ],
    dependenciasSetoriais: [
      {
        tipo: 'obras_viarias_municipais',
        status: 'avaliacao_tecnica_recomendada',
        observacao: 'Atividade viaria municipal; o trecho visual nao traz anuencia setorial expressa.',
      },
    ],
  }),
  buildGrupo21VisualItem({
    codigo: '21.07',
    nomeAtividade: 'Pavimentacao de estradas e rodovias municipais e vicinais.',
    parametroPrincipal: 'Extensao da via',
    unidade: 'km',
    abreviaturaParametro: 'EV',
    potencialPoluidor: 'MEDIO',
    limiteImpactoLocal: 'Todos',
    ...GRUPO21_PAGINA_123,
    faixasConferidas: [
      buildGrupo21VisualFaixa({
        ordem: 1,
        colunaTabela: 'Classe Simplificada',
        operador: 'todos',
        textoNormativoFaixa: 'Todos',
        porte: 'Classe Simplificada',
        classe: 'Classe Simplificada',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
    ],
    observacoesNormativas: [
      'Escopo restrito a estradas e rodovias municipais e vicinais.',
    ],
    dependenciasSetoriais: [
      {
        tipo: 'obras_viarias_municipais',
        status: 'avaliacao_tecnica_recomendada',
        observacao: 'Atividade viaria municipal; o trecho visual nao traz anuencia setorial expressa.',
      },
    ],
  }),
  buildGrupo21VisualItem({
    codigo: '21.08',
    nomeAtividade: 'Implantacao de obras de arte corrente em estradas e rodovias municipais e vicinais.',
    parametroPrincipal: 'Largura do corpo hidrico',
    unidade: 'm',
    abreviaturaParametro: 'LCH',
    potencialPoluidor: 'MEDIO',
    limiteImpactoLocal: 'Todos',
    ...GRUPO21_PAGINA_123,
    faixasConferidas: [
      buildGrupo21VisualFaixa({
        ordem: 1,
        colunaTabela: 'Porte Limite - Pequeno',
        operador: 'todos',
        textoNormativoFaixa: 'Todos',
        porte: 'Pequeno',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
    ],
    observacoesNormativas: [
      'Parametro visualmente conferido envolve largura do corpo hidrico.',
      'Escopo restrito a estradas e rodovias municipais e vicinais.',
    ],
    dependenciasSetoriais: [
      {
        tipo: 'recursos_hidricos_obras_viarias',
        status: 'avaliacao_tecnica_recomendada',
        observacao: 'Parametro e corpo hidrico; o trecho visual nao traz anuencia setorial expressa.',
      },
    ],
  }),
  buildGrupo21VisualItem({
    codigo: '21.09',
    nomeAtividade: 'Implantacao de obras de arte especiais.',
    parametroPrincipal: 'Comprimento da estrutura',
    unidade: 'm',
    abreviaturaParametro: 'CE',
    potencialPoluidor: 'MEDIO',
    limiteImpactoLocal: 'CE <= 30',
    ...GRUPO21_PAGINA_123,
    faixasConferidas: [
      buildGrupo21VisualFaixa({
        ordem: 1,
        colunaTabela: 'Classe Simplificada',
        operador: 'menor_igual',
        valorFinal: 15,
        textoNormativoFaixa: 'CE <= 15',
        porte: 'Classe Simplificada',
        classe: 'Classe Simplificada',
        limiteImpactoLocal: 'CE <= 30',
        potencialPoluidor: 'MEDIO',
      }),
      buildGrupo21VisualFaixa({
        ordem: 2,
        colunaTabela: 'Porte Limite - Pequeno',
        operador: 'maior_que_e_menor_igual',
        valorInicial: 15,
        valorFinal: 30,
        textoNormativoFaixa: '15 < CE <= 30',
        porte: 'Pequeno',
        limiteImpactoLocal: 'CE <= 30',
        potencialPoluidor: 'MEDIO',
      }),
    ],
    bloqueiosNormativos: [
      'Porte limite de impacto local visualmente conferido: CE <= 30.',
    ],
    dependenciasSetoriais: [
      {
        tipo: 'obras_especiais',
        status: 'avaliacao_tecnica_recomendada',
        observacao: 'Obra de arte especial pode exigir avaliacao setorial; o trecho visual nao traz anuencia expressa.',
      },
    ],
  }),
  buildGrupo21VisualItem({
    codigo: '21.10',
    nomeAtividade: 'Estabelecimentos prisionais e semelhantes.',
    parametroPrincipal: 'Capacidade Projetada',
    unidade: 'numero de pessoas',
    abreviaturaParametro: 'CP',
    potencialPoluidor: 'MEDIO',
    limiteImpactoLocal: 'Todos',
    ...GRUPO21_PAGINA_123,
    faixasConferidas: [
      buildGrupo21VisualFaixa({
        ordem: 1,
        colunaTabela: 'Classe Simplificada',
        operador: 'menor_igual',
        valorFinal: 150,
        textoNormativoFaixa: 'CP <= 150',
        porte: 'Classe Simplificada',
        classe: 'Classe Simplificada',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
      buildGrupo21VisualFaixa({
        ordem: 2,
        colunaTabela: 'Porte Limite - Pequeno',
        operador: 'maior_que_e_menor_igual',
        valorInicial: 150,
        valorFinal: 450,
        textoNormativoFaixa: '150 < CP <= 450',
        porte: 'Pequeno',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
      buildGrupo21VisualFaixa({
        ordem: 3,
        colunaTabela: 'Porte Limite - Medio',
        operador: 'maior_que_e_menor_igual',
        valorInicial: 450,
        valorFinal: 800,
        textoNormativoFaixa: '450 < CP <= 800',
        porte: 'Medio',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
      buildGrupo21VisualFaixa({
        ordem: 4,
        colunaTabela: 'Porte Limite - Grande',
        operador: 'maior_que',
        valorInicial: 800,
        textoNormativoFaixa: 'CP > 800',
        porte: 'Grande',
        limiteImpactoLocal: 'Todos',
        potencialPoluidor: 'MEDIO',
      }),
    ],
    dependenciasSetoriais: [
      {
        tipo: 'empreendimento_publico_seguranca',
        status: 'avaliacao_tecnica_recomendada',
        observacao: 'A natureza do empreendimento recomenda validacao administrativa; o trecho visual nao traz anuencia setorial expressa.',
      },
    ],
  }),
];

function normalizeGroupNumber(value) {
  return String(value || '').replace(/^0+/, '') || String(value || '');
}

function calculateCoveragePercent(registered, expected) {
  if (!expected) return 0;
  return Number(((registered / expected) * 100).toFixed(2));
}

function classifyMasterGroup(group, registeredExpectedCodes, registeredAnyCodes, activeLacunas) {
  if (activeLacunas.length > 0) return 'possui_lacuna_normativa';
  if (group.status_base) return group.status_base;
  if (group.codigos_esperados.length > 0 && registeredExpectedCodes.length === group.codigos_esperados.length) {
    return 'parametrizado_integralmente';
  }
  if (registeredExpectedCodes.length > 0 || registeredAnyCodes.length > 0) return 'parametrizado_parcialmente';
  if (group.codigos_esperados.length === 0) return 'requer_conferencia_pdf';
  return 'nao_parametrizado';
}

async function getParametrizacaoFase2D3MapaDecretoStatus() {
  const expectedCodes = DECRETO_021_MASTER_GROUPS.flatMap((group) => group.codigos_esperados);
  const [
    activitiesResult,
    metricsResult,
    rulesResult,
    docsResult,
    release,
  ] = await Promise.all([
    repository.db.query(
      `
        SELECT
          codigo,
          nome,
          categoria,
          validacoes_requeridas,
          observacoes,
          split_part(codigo, '.', 1) AS grupo
        FROM licenciamento_atividades
        WHERE deleted_at IS NULL
          AND ativo = true
          AND codigo ~ '^\\d{1,2}\\.\\d{2}$'
        ORDER BY split_part(codigo, '.', 1)::int, codigo;
      `
    ),
    repository.db.query(
      `
        SELECT
          split_part(codigo, '.', 1) AS grupo,
          COUNT(*)::int AS atividades,
          MAX(updated_at) AS atualizado_em,
          COALESCE(SUM(jsonb_array_length(COALESCE(perguntas_publicas, '[]'::jsonb))), 0)::int AS perguntas,
          COALESCE(SUM(jsonb_array_length(COALESCE(alertas_publicos, '[]'::jsonb))), 0)::int AS alertas,
          COALESCE(SUM(jsonb_array_length(COALESCE(bloqueios_publicos, '[]'::jsonb))), 0)::int AS bloqueios
        FROM licenciamento_atividades
        WHERE deleted_at IS NULL
          AND ativo = true
          AND codigo ~ '^\\d{1,2}\\.\\d{2}$'
        GROUP BY split_part(codigo, '.', 1)
        ORDER BY split_part(codigo, '.', 1)::int;
      `
    ),
    repository.db.query(
      `
        SELECT split_part(a.codigo, '.', 1) AS grupo, COUNT(DISTINCT r.id)::int AS regras
        FROM licenciamento_atividades a
        JOIN licenciamento_regras_enquadramento r ON r.atividade_id = a.id
        WHERE a.deleted_at IS NULL
          AND a.ativo = true
          AND r.deleted_at IS NULL
          AND r.ativo = true
          AND a.codigo ~ '^\\d{1,2}\\.\\d{2}$'
        GROUP BY split_part(a.codigo, '.', 1);
      `
    ),
    repository.db.query(
      `
        SELECT split_part(a.codigo, '.', 1) AS grupo, COUNT(DISTINCT d.id)::int AS documentos
        FROM licenciamento_atividades a
        JOIN licenciamento_documentos_exigidos d ON d.atividade_id = a.id
        WHERE a.deleted_at IS NULL
          AND a.ativo = true
          AND d.deleted_at IS NULL
          AND d.ativo = true
          AND a.codigo ~ '^\\d{1,2}\\.\\d{2}$'
        GROUP BY split_part(a.codigo, '.', 1);
      `
    ),
    repository.db.query(
      `
        SELECT id, codigo, status, ready, confirmado_em, bloqueios_producao_json
        FROM licenciamento_homologacao_liberacoes
        WHERE status = 'liberada_tecnicamente'
          AND ready = true
        ORDER BY confirmado_em DESC NULLS LAST, id DESC
        LIMIT 1;
      `
    ),
  ]);

  const activitiesByCode = new Map(activitiesResult.rows.map((item) => [item.codigo, item]));
  const activitiesByGroup = new Map();
  activitiesResult.rows.forEach((item) => {
    const group = normalizeGroupNumber(item.grupo);
    if (!activitiesByGroup.has(group)) activitiesByGroup.set(group, []);
    activitiesByGroup.get(group).push(item.codigo);
  });

  const metricsByGroup = new Map(metricsResult.rows.map((item) => [normalizeGroupNumber(item.grupo), item]));
  const rulesByGroup = new Map(rulesResult.rows.map((item) => [normalizeGroupNumber(item.grupo), Number(item.regras || 0)]));
  const docsByGroup = new Map(docsResult.rows.map((item) => [normalizeGroupNumber(item.grupo), Number(item.documentos || 0)]));

  const lacunasNormativas = Object.entries(DECRETO_021_LACUNAS_NORMATIVAS)
    .filter(([code]) => {
      const activity = activitiesByCode.get(code);
      if (!activity) return false;
      if (code === '23.04') {
        return JSON.stringify(activity.validacoes_requeridas || []).includes('normativa')
          || String(activity.observacoes || '').toLowerCase().includes('lacuna');
      }
      return true;
    })
    .map(([code, data]) => {
      const activity = activitiesByCode.get(code);
      return {
        codigo: code,
        grupo: code.split('.')[0],
        atividade: activity?.nome || null,
        descricao: data.descricao,
        risco: data.risco,
        status: 'preservada_sem_efeito_produtivo',
      };
    });

  const lacunasAtivas = new Set(lacunasNormativas.map((item) => item.codigo));
  const grupos = DECRETO_021_MASTER_GROUPS.map((group) => {
    const registeredAnyCodes = activitiesByGroup.get(group.grupo) || [];
    const registeredExpectedCodes = group.codigos_esperados.filter((code) => activitiesByCode.has(code));
    const pendingCodes = group.codigos_esperados.filter((code) => !activitiesByCode.has(code));
    const activeLacunas = (group.lacunas || []).filter((code) => lacunasAtivas.has(code));
    const groupMetrics = metricsByGroup.get(group.grupo) || {};
    const expectedCount = group.codigos_esperados.length;
    const registeredCount = registeredExpectedCodes.length;
    const status = classifyMasterGroup(group, registeredExpectedCodes, registeredAnyCodes, activeLacunas);

    return {
      grupo: Number(group.grupo),
      nome: group.nome,
      codigos_esperados: group.codigos_esperados,
      codigos_cadastrados: registeredExpectedCodes,
      codigos_cadastrados_fora_lista_confirmada: registeredAnyCodes.filter((code) => !group.codigos_esperados.includes(code)),
      codigos_pendentes: pendingCodes,
      codigos_pendentes_descricao: group.codigos_esperados.length === 0
        ? 'Lista de codigos requer conferencia PDF antes de parametrizacao.'
        : null,
      total_codigos_esperados: expectedCount,
      total_codigos_cadastrados: registeredCount,
      total_codigos_pendentes: pendingCodes.length,
      percentual_cobertura: calculateCoveragePercent(registeredCount, expectedCount),
      status,
      possui_lacuna_normativa: activeLacunas.length > 0,
      lacunas_normativas: activeLacunas,
      requer_conferencia_pdf: status === 'requer_conferencia_pdf' || Boolean(group.observacao_contagem),
      regras_cadastradas: rulesByGroup.get(group.grupo) || 0,
      perguntas_publicas: Number(groupMetrics.perguntas || 0),
      alertas_publicos: Number(groupMetrics.alertas || 0),
      bloqueios_logicos: Number(groupMetrics.bloqueios || 0),
      documentos_vinculados: docsByGroup.get(group.grupo) || 0,
      atualizado_em: groupMetrics.atualizado_em || null,
      prioridade_recomendada: group.prioridade_recomendada || 'media',
      recomendacao_prioridade: group.recomendacao_prioridade,
      observacao_contagem: group.observacao_contagem || null,
    };
  });

  const totalExpectedCodes = grupos.reduce((sum, item) => sum + item.total_codigos_esperados, 0);
  const totalRegisteredCodes = grupos.reduce((sum, item) => sum + item.total_codigos_cadastrados, 0);
  const totalPendingCodes = grupos.reduce((sum, item) => sum + item.total_codigos_pendentes, 0);
  const workedGroups = grupos.filter((item) => [
    'parametrizado_integralmente',
    'parametrizado_parcialmente',
    'possui_lacuna_normativa',
  ].includes(item.status));
  const notRegisteredGroups = grupos.filter((item) => item.total_codigos_cadastrados === 0);
  const releaseRow = release.rows[0] || null;
  const blockers = releaseRow?.bloqueios_producao_json || {};
  const bloqueiosProducao = {
    dam_real: blockers.dam_real === true,
    cobranca_oficial: blockers.cobranca_oficial === true,
    protocolo_definitivo: blockers.protocolo_definitivo === true,
    decisao_automatica: blockers.decisao_automatica === true,
  };

  const riscos = [
    'Grupos sem lista de codigos confirmada exigem conferencia do PDF antes de qualquer seed normativo.',
    'Lacunas 15.06, 15.11, 17.06 e 23.04 nao podem gerar taxa, classe definitiva ou decisao automatica.',
    'Grupo 19 possui apenas piloto 19.03 e deve ser complementado em bloco proprio com conferencia normativa previa.',
    'Simulacoes permanecem orientativas e nao substituem analise tecnica, administrativa ou juridica da SMAD.',
  ];

  return {
    fase: '2D.3',
    titulo: 'Mapa Mestre do Decreto Municipal n. 021/2020',
    total_grupos_identificados: DECRETO_021_MASTER_GROUPS.length,
    grupos_parametrizados_integralmente: grupos.filter((item) => item.status === 'parametrizado_integralmente').length,
    grupos_parametrizados_parcialmente: grupos.filter((item) => item.status === 'parametrizado_parcialmente').length,
    grupos_com_lacuna_normativa: grupos.filter((item) => item.status === 'possui_lacuna_normativa').length,
    grupos_nao_parametrizados: notRegisteredGroups.length,
    grupos_requerem_conferencia_pdf: grupos.filter((item) => item.status === 'requer_conferencia_pdf').length,
    total_codigos_esperados: totalExpectedCodes,
    total_codigos_cadastrados: totalRegisteredCodes,
    total_codigos_pendentes: totalPendingCodes,
    percentual_geral_cobertura: Number(((workedGroups.length / DECRETO_021_MASTER_GROUPS.length) * 100).toFixed(2)),
    percentual_cobertura_codigos_confirmados: calculateCoveragePercent(totalRegisteredCodes, totalExpectedCodes),
    observacao_contagem: 'Totais de codigos consideram somente listas confirmadas no acervo interno. Grupos sem lista confirmada permanecem como requer_conferencia_pdf para evitar invencao normativa.',
    grupos,
    lacunas_normativas: lacunasNormativas,
    riscos,
    recomendacao_proximo_bloco: {
      bloco: 'Bloco 3',
      grupos_recomendados: ['19'],
      titulo: 'Grupo 19 - Energia',
      justificativa: 'O Grupo 19 e a recomendacao mais segura para o proximo bloco porque ja possui piloto 19.03, teste de limite de impacto local e demanda provavel por energia solar, mas ainda exige conferencia PDF para completar os demais codigos.',
      criterios: [
        'frequencia provavel de requerimentos',
        'relevancia para a rotina da SMAD',
        'risco ambiental controlavel por limite de impacto local',
        'existencia de piloto ja validado',
        'possibilidade de simulacao segura apos conferencia normativa',
        'necessidade de conferencia juridica antes de complementar codigos',
      ],
      restricao: 'Nao iniciar seed do Bloco 3 antes de confirmar codigos, faixas, parametros e limites diretamente no Decreto.',
    },
    preservacao_fases_anteriores: {
      fase2d1: grupos.filter((item) => ['18', '20', '22', '24'].includes(String(item.grupo))).every((item) => item.total_codigos_pendentes === 0),
      fase2d2: grupos.filter((item) => ['15', '16', '17', '23'].includes(String(item.grupo))).every((item) => item.total_codigos_cadastrados > 0),
      fase2d21: grupos.filter((item) => ['15', '16', '17'].includes(String(item.grupo))).every((item) => item.total_codigos_pendentes === 0),
    },
    liberacao_tecnica: releaseRow,
    bloqueios_producao: bloqueiosProducao,
    mensagem: 'Mapa mestre diagnostico. Nao cadastra novos grupos, nao altera taxa, VRTE, matriz ou normas e nao libera efeitos produtivos.',
  };
}

const DECRETO_021_GRUPO19_CONFERENCIA = [
  {
    codigo: '19.01',
    nome: 'Envasamento e industrializacao de gas',
    tipo_normativo: 'I',
    tipo_atividade: 'industrial',
    parametro_enquadramento: 'I = Area construida (m2) + area de estocagem (m2), quando houver',
    unidade: 'm2',
    faixas_porte: [
      { porte: 'pequeno', expressao: 'I <= 2.000' },
      { porte: 'medio', expressao: '2.000 < I <= 5.000' },
      { porte: 'grande', expressao: '5.000 < I <= 10.000' },
    ],
    potencial_poluidor: 'medio',
    classes: 'Nao expressas diretamente no grupo; dependem da matriz operacional vigente no sistema.',
    limite_impacto_local: 'I <= 10.000',
    observacoes_textuais: 'Linha extraida da pagina 121 do Decreto Municipal n. 021/2020.',
    status_normativo: 'confirmado_decreto_021_2020',
    status_parametrizacao: 'apto_para_parametrizacao_controlada',
  },
  {
    codigo: '19.02',
    nome: 'Implantacao de Linhas de Transmissao de energia eletrica',
    tipo_normativo: 'N',
    tipo_atividade: 'nao_industrial',
    parametro_enquadramento: 'Tensao (kV)',
    unidade: 'kV',
    faixas_porte: [
      { porte: 'simplificado', expressao: 'T <= 138' },
      { porte: 'pequeno', expressao: '138 < T <= 230' },
      { porte: 'medio', expressao: 'T > 230' },
    ],
    potencial_poluidor: 'medio',
    classes: 'Nao expressas diretamente no grupo; dependem da matriz operacional vigente no sistema.',
    limite_impacto_local: 'Todos',
    observacoes_textuais: 'Linha extraida da pagina 121 do Decreto Municipal n. 021/2020.',
    status_normativo: 'confirmado_decreto_021_2020',
    status_parametrizacao: 'apto_para_parametrizacao_controlada',
  },
  {
    codigo: '19.03',
    nome: 'Usina de geracao de energia solar fotovoltaica',
    tipo_normativo: 'N',
    tipo_atividade: 'nao_industrial',
    parametro_enquadramento: 'Area de intervencao (m2)',
    unidade: 'm2',
    faixas_porte: [
      { porte: 'simplificado', expressao: 'AIN <= 50.000' },
      { porte: 'pequeno', expressao: '50.000 < AIN <= 100.000' },
      { porte: 'medio', expressao: '100.000 < AIN <= 300.000' },
      { porte: 'grande', expressao: '300.000 < AIN <= 500.000' },
    ],
    potencial_poluidor: 'baixo',
    classes: 'Piloto usa classes da matriz operacional: simplificada, simplificada, classe_i e classe_i.',
    limite_impacto_local: 'AIN <= 500.000',
    observacoes_textuais: 'Linha extraida da pagina 121 do Decreto Municipal n. 021/2020.',
    status_normativo: 'confirmado_decreto_021_2020',
    status_parametrizacao: 'apto_para_parametrizacao_controlada',
  },
  {
    codigo: '19.04',
    nome: 'Implantacao de Subestacao de energia eletrica',
    tipo_normativo: 'N',
    tipo_atividade: 'nao_industrial',
    parametro_enquadramento: 'Area de intervencao (m2)',
    unidade: 'm2',
    faixas_porte: [
      { porte: 'simplificado', expressao: 'AIN <= 13.000' },
      { porte: 'pequeno', expressao: '13.000 < AIN <= 20.000' },
    ],
    potencial_poluidor: 'baixo',
    classes: 'Nao expressas diretamente no grupo; dependem da matriz operacional vigente no sistema.',
    limite_impacto_local: 'Todos',
    observacoes_textuais: 'Linha extraida da pagina 121 do Decreto Municipal n. 021/2020.',
    status_normativo: 'confirmado_decreto_021_2020',
    status_parametrizacao: 'apto_para_parametrizacao_controlada',
  },
];

function normalizeComparableText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildGrupo19PilotComparison(activity, rules, documents) {
  const decreto1903 = DECRETO_021_GRUPO19_CONFERENCIA.find((item) => item.codigo === '19.03');
  const divergencias = [];

  if (!activity) {
    divergencias.push({
      codigo: '19.03',
      tipo: 'piloto_ausente',
      mensagem: 'Piloto 19.03 nao localizado no sistema.',
    });
    return { divergencias, status: 'piloto_ausente' };
  }

  const nameMatches = normalizeComparableText(activity.nome).includes('usina de geracao de energia solar fotovoltaica');
  if (!nameMatches) {
    divergencias.push({
      codigo: '19.03',
      tipo: 'descricao_divergente',
      decreto: decreto1903.nome,
      sistema: activity.nome,
      mensagem: 'Nome do piloto diverge materialmente do texto normativo conferido.',
    });
  }

  const checks = [
    ['tipo_atividade', activity.tipo_atividade, decreto1903.tipo_atividade],
    ['potencial_poluidor_padrao', activity.potencial_poluidor_padrao, decreto1903.potencial_poluidor],
    ['unidade_parametro_principal', activity.unidade_parametro_principal, 'm2'],
  ];

  checks.forEach(([field, current, expected]) => {
    if (normalizeComparableText(current) !== normalizeComparableText(expected)) {
      divergencias.push({
        codigo: '19.03',
        tipo: 'campo_divergente',
        campo: field,
        decreto: expected,
        sistema: current,
        mensagem: `Campo ${field} do piloto diverge do Decreto conferido.`,
      });
    }
  });

  const limit = Number(activity.limite_impacto_local_valor || 0);
  if (activity.limite_impacto_local_tipo !== 'valor_maximo' || limit !== 500000) {
    divergencias.push({
      codigo: '19.03',
      tipo: 'limite_divergente',
      decreto: 'AIN <= 500.000',
      sistema: `${activity.limite_impacto_local_tipo || '-'} ${activity.limite_impacto_local_valor || '-'}`,
      mensagem: 'Limite de impacto local do piloto nao coincide com o Decreto.',
    });
  }

  const expectedExpressions = ['AIN <= 50.000 m2', '50.000 < AIN <= 100.000 m2', '100.000 < AIN <= 300.000 m2', '300.000 < AIN <= 500.000 m2']
    .map(normalizeComparableText);
  const ruleExpressions = rules.map((rule) => normalizeComparableText(rule.expressao_original));
  const missingExpressions = expectedExpressions.filter((expression) => !ruleExpressions.includes(expression));
  if (missingExpressions.length > 0 || rules.length !== 4) {
    divergencias.push({
      codigo: '19.03',
      tipo: 'faixas_divergentes',
      decreto: decreto1903.faixas_porte.map((item) => item.expressao),
      sistema: rules.map((rule) => rule.expressao_original),
      mensagem: 'Faixas do piloto nao coincidem integralmente com o Decreto conferido.',
    });
  }

  return {
    divergencias,
    status: divergencias.length > 0 ? 'divergente_do_piloto_existente' : 'piloto_preservado_sem_divergencia_material',
    detalhes: {
      perguntas_publicas: activity.perguntas || 0,
      alertas_publicos: activity.alertas || 0,
      bloqueios_logicos: activity.bloqueios || 0,
      documentos_vinculados: documents?.documentos || 0,
      regras: rules.length,
      status_resultado_regras: [...new Set(rules.map((rule) => rule.status_resultado))],
      classes_sistema: [...new Set(rules.map((rule) => rule.classe_codigo).filter(Boolean))],
    },
  };
}

async function getParametrizacaoFase2D4AGrupo19ConferenciaStatus() {
  const expectedCodes = DECRETO_021_GRUPO19_CONFERENCIA.map((item) => item.codigo);
  const [
    activities,
    rules,
    docs,
    release,
    mapa2d3,
  ] = await Promise.all([
    repository.db.query(
      `
        SELECT
          id,
          codigo,
          nome,
          categoria,
          descricao,
          tipo_atividade,
          potencial_poluidor_padrao,
          parametro_principal_label,
          unidade_parametro_principal,
          formula_codigo,
          limite_impacto_local_tipo,
          limite_impacto_local_valor,
          validacoes_requeridas,
          jsonb_array_length(COALESCE(perguntas_publicas, '[]'::jsonb))::int AS perguntas,
          jsonb_array_length(COALESCE(alertas_publicos, '[]'::jsonb))::int AS alertas,
          jsonb_array_length(COALESCE(bloqueios_publicos, '[]'::jsonb))::int AS bloqueios,
          observacoes
        FROM licenciamento_atividades
        WHERE deleted_at IS NULL
          AND ativo = true
          AND codigo LIKE '19.%'
        ORDER BY codigo;
      `
    ),
    repository.db.query(
      `
        SELECT
          a.codigo,
          r.id AS regra_id,
          r.porte_resultante,
          c.codigo AS classe_codigo,
          p.codigo AS potencial_codigo,
          tl.codigo AS tipo_licenca_codigo,
          r.valor_minimo,
          r.valor_maximo,
          r.status_resultado,
          r.formula_codigo,
          r.limite_impacto_local_tipo,
          r.limite_impacto_local_valor,
          r.observacao_publica,
          r.observacao_interna,
          r.expressao_original,
          COUNT(rp.id)::int AS parametros
        FROM licenciamento_atividades a
        JOIN licenciamento_regras_enquadramento r ON r.atividade_id = a.id AND r.deleted_at IS NULL AND r.ativo = true
        LEFT JOIN licenciamento_classes c ON c.id = r.classe_id
        LEFT JOIN licenciamento_potenciais_poluidor p ON p.id = r.potencial_poluidor_id
        LEFT JOIN licenciamento_tipos_licenca tl ON tl.id = r.tipo_licenca_id
        LEFT JOIN licenciamento_regra_parametros rp ON rp.regra_enquadramento_id = r.id AND rp.deleted_at IS NULL
        WHERE a.deleted_at IS NULL
          AND a.codigo LIKE '19.%'
        GROUP BY a.codigo, r.id, c.codigo, p.codigo, tl.codigo
        ORDER BY a.codigo, r.valor_minimo NULLS FIRST, r.valor_maximo NULLS LAST;
      `
    ),
    repository.db.query(
      `
        SELECT
          a.codigo,
          COUNT(d.id)::int AS documentos,
          array_agg(d.nome_documento ORDER BY d.ordem, d.nome_documento) FILTER (WHERE d.nome_documento IS NOT NULL) AS nomes
        FROM licenciamento_atividades a
        LEFT JOIN licenciamento_documentos_exigidos d ON d.atividade_id = a.id AND d.deleted_at IS NULL AND d.ativo = true
        WHERE a.deleted_at IS NULL
          AND a.codigo LIKE '19.%'
        GROUP BY a.codigo
        ORDER BY a.codigo;
      `
    ),
    repository.db.query(
      `
        SELECT id, codigo, status, ready, confirmado_em, bloqueios_producao_json
        FROM licenciamento_homologacao_liberacoes
        WHERE status = 'liberada_tecnicamente'
          AND ready = true
        ORDER BY confirmado_em DESC NULLS LAST, id DESC
        LIMIT 1;
      `
    ),
    getParametrizacaoFase2D3MapaDecretoStatus(),
  ]);

  const activitiesByCode = new Map(activities.rows.map((item) => [item.codigo, item]));
  const rulesByCode = new Map();
  rules.rows.forEach((rule) => {
    if (!rulesByCode.has(rule.codigo)) rulesByCode.set(rule.codigo, []);
    rulesByCode.get(rule.codigo).push(rule);
  });
  const docsByCode = new Map(docs.rows.map((item) => [item.codigo, item]));

  const existingCodes = activities.rows.map((item) => item.codigo);
  const pendingCodes = expectedCodes.filter((code) => !activitiesByCode.has(code));
  const pilotComparison = buildGrupo19PilotComparison(
    activitiesByCode.get('19.03'),
    rulesByCode.get('19.03') || [],
    docsByCode.get('19.03')
  );
  const codigoDetalhado = DECRETO_021_GRUPO19_CONFERENCIA.map((item) => {
    const existing = activitiesByCode.get(item.codigo);
    let status = item.status_parametrizacao;
    if (item.codigo === '19.03') status = pilotComparison.status;
    return {
      ...item,
      existe_no_sistema: Boolean(existing),
      status_conferencia: status,
      dados_sistema: existing ? {
        nome: existing.nome,
        categoria: existing.categoria,
        tipo_atividade: existing.tipo_atividade,
        potencial_poluidor_padrao: existing.potencial_poluidor_padrao,
        parametro_principal_label: existing.parametro_principal_label,
        unidade_parametro_principal: existing.unidade_parametro_principal,
        limite_impacto_local_tipo: existing.limite_impacto_local_tipo,
        limite_impacto_local_valor: existing.limite_impacto_local_valor,
        perguntas_publicas: existing.perguntas,
        alertas_publicos: existing.alertas,
        bloqueios_logicos: existing.bloqueios,
        documentos_vinculados: docsByCode.get(item.codigo)?.documentos || 0,
        regras_cadastradas: (rulesByCode.get(item.codigo) || []).length,
      } : null,
    };
  });

  const releaseRow = release.rows[0] || null;
  const blockers = releaseRow?.bloqueios_producao_json || {};
  const bloqueiosProducao = {
    dam_real: blockers.dam_real === true,
    cobranca_oficial: blockers.cobranca_oficial === true,
    protocolo_definitivo: blockers.protocolo_definitivo === true,
    decisao_automatica: blockers.decisao_automatica === true,
  };
  const lacunasGrupo19 = codigoDetalhado.filter((item) => item.status_conferencia === 'incompleto_por_lacuna_textual');
  const divergenciasPiloto = pilotComparison.divergencias || [];
  const aptos = codigoDetalhado
    .filter((item) => item.status_conferencia === 'apto_para_parametrizacao_controlada')
    .map((item) => item.codigo);

  return {
    fase: '2D.4-A',
    grupo_analisado: {
      numero: 19,
      nome_oficial: 'Energia',
      fonte_normativa: 'Decreto Municipal n. 021/2020, pagina 121 do Diario Municipal, edicao n. 1439, 23/01/2020.',
      natureza: 'Conferencia normativa diagnostica, sem seed definitivo.',
    },
    codigos_identificados_decreto: codigoDetalhado,
    codigos_identificados: expectedCodes,
    codigos_existentes_sistema: existingCodes,
    codigos_pendentes: pendingCodes,
    codigos_aptos_para_parametrizacao: aptos,
    codigos_com_lacuna: lacunasGrupo19.map((item) => item.codigo),
    codigos_divergentes_do_piloto: divergenciasPiloto.map((item) => item.codigo),
    piloto_1903: {
      status: pilotComparison.status,
      atividade: activitiesByCode.get('19.03') || null,
      regras: rulesByCode.get('19.03') || [],
      documentos: docsByCode.get('19.03') || null,
      comparacao: pilotComparison,
      preservado: pilotComparison.status !== 'piloto_ausente',
      divergencia_material: divergenciasPiloto.length > 0,
    },
    lacunas_normativas_grupo19: lacunasGrupo19,
    divergencias_encontradas: divergenciasPiloto,
    lacunas_preservadas_fases_anteriores: mapa2d3.lacunas_normativas || [],
    preservacao_fases_anteriores: mapa2d3.preservacao_fases_anteriores,
    riscos_normativos: [
      'Classes nao estao expressas diretamente na linha do Grupo 19 e devem continuar derivadas da matriz operacional vigente, sem alteracao da matriz.',
      '19.01 envolve gas e deve receber documentos, alertas e bloqueios especificos em seed futuro, sem confundir com armazenamento de combustiveis ou GLP de outros grupos.',
      '19.02 e 19.04 dependem de validacao locacional, faixa de servidao, supressao, APP e anuencia de uso do solo antes de conclusao administrativa.',
      '19.03 deve permanecer preservado ate subfase propria de ajuste, caso a SMAD decida revisar o piloto.',
    ],
    recomendacao_2d4b: {
      pode_avancar: divergenciasPiloto.length === 0 && pendingCodes.length === 3,
      status: divergenciasPiloto.length === 0 ? 'apta_para_parametrizacao_controlada' : 'requer_saneamento_previo',
      texto: divergenciasPiloto.length === 0
        ? 'Avancar para Fase 2D.4-B - Parametrizacao Controlada do Grupo 19 - Energia, preservando o piloto 19.03 e cadastrando 19.01, 19.02 e 19.04 em seed idempotente proprio.'
        : 'Nao avancar para Fase 2D.4-B antes de avaliar divergencias materiais do piloto 19.03.',
      restricoes: [
        'Nao liberar DAM real.',
        'Nao liberar cobranca oficial.',
        'Nao liberar protocolo definitivo.',
        'Nao emitir licenca, dispensa ou AMA automaticamente.',
        'Nao transformar simulacao em decisao administrativa.',
      ],
    },
    bloqueios_producao: bloqueiosProducao,
    liberacao_tecnica: releaseRow,
    mensagem: 'Conferencia normativa diagnostica do Grupo 19. Nao cadastra novos codigos, nao altera taxa, VRTE, matriz, normas ou bloqueios produtivos.',
  };
}

async function getParametrizacaoFase2D4BGrupo19Status() {
  const expectedCodes = DECRETO_021_GRUPO19_CONFERENCIA.map((item) => item.codigo);
  const newCodes = ['19.01', '19.02', '19.04'];
  const preservedCode = '19.03';
  const [
    activities,
    rules,
    docs,
    release,
    conferencia2d4a,
  ] = await Promise.all([
    repository.db.query(
      `
        SELECT
          id,
          codigo,
          nome,
          categoria,
          descricao,
          tipo_atividade,
          potencial_poluidor_padrao,
          parametro_principal_label,
          unidade_parametro_principal,
          formula_codigo,
          limite_impacto_local_tipo,
          limite_impacto_local_valor,
          limite_impacto_local_unidade,
          validacoes_requeridas,
          jsonb_array_length(COALESCE(perguntas_publicas, '[]'::jsonb))::int AS perguntas,
          jsonb_array_length(COALESCE(alertas_publicos, '[]'::jsonb))::int AS alertas,
          jsonb_array_length(COALESCE(bloqueios_publicos, '[]'::jsonb))::int AS bloqueios,
          observacoes,
          seed_piloto_codigo,
          updated_at
        FROM licenciamento_atividades
        WHERE deleted_at IS NULL
          AND ativo = true
          AND codigo = ANY($1)
        ORDER BY codigo;
      `,
      [expectedCodes]
    ),
    repository.db.query(
      `
        SELECT
          a.codigo,
          r.id AS regra_id,
          r.porte_resultante,
          c.codigo AS classe_codigo,
          p.codigo AS potencial_codigo,
          tl.codigo AS tipo_licenca_codigo,
          r.valor_minimo,
          r.valor_maximo,
          r.status_resultado,
          r.formula_codigo,
          r.expressao_original,
          r.requer_validacao_tecnica,
          COUNT(rp.id)::int AS parametros
        FROM licenciamento_atividades a
        JOIN licenciamento_regras_enquadramento r ON r.atividade_id = a.id AND r.deleted_at IS NULL AND r.ativo = true
        LEFT JOIN licenciamento_classes c ON c.id = r.classe_id
        LEFT JOIN licenciamento_potenciais_poluidor p ON p.id = r.potencial_poluidor_id
        LEFT JOIN licenciamento_tipos_licenca tl ON tl.id = r.tipo_licenca_id
        LEFT JOIN licenciamento_regra_parametros rp ON rp.regra_enquadramento_id = r.id AND rp.deleted_at IS NULL
        WHERE a.deleted_at IS NULL
          AND a.codigo = ANY($1)
        GROUP BY a.codigo, r.id, c.codigo, p.codigo, tl.codigo
        ORDER BY a.codigo, r.valor_minimo NULLS FIRST, r.valor_maximo NULLS LAST;
      `,
      [expectedCodes]
    ),
    repository.db.query(
      `
        SELECT
          a.codigo,
          COUNT(d.id)::int AS documentos,
          array_agg(d.nome_documento ORDER BY d.ordem, d.nome_documento) FILTER (WHERE d.nome_documento IS NOT NULL) AS nomes
        FROM licenciamento_atividades a
        LEFT JOIN licenciamento_documentos_exigidos d ON d.atividade_id = a.id AND d.deleted_at IS NULL AND d.ativo = true
        WHERE a.deleted_at IS NULL
          AND a.codigo = ANY($1)
        GROUP BY a.codigo
        ORDER BY a.codigo;
      `,
      [expectedCodes]
    ),
    repository.db.query(
      `
        SELECT id, codigo, status, ready, confirmado_em, bloqueios_producao_json
        FROM licenciamento_homologacao_liberacoes
        WHERE status = 'liberada_tecnicamente'
          AND ready = true
        ORDER BY confirmado_em DESC NULLS LAST, id DESC
        LIMIT 1;
      `
    ),
    getParametrizacaoFase2D4AGrupo19ConferenciaStatus(),
  ]);

  const activitiesByCode = new Map(activities.rows.map((item) => [item.codigo, item]));
  const rulesByCode = new Map();
  rules.rows.forEach((rule) => {
    if (!rulesByCode.has(rule.codigo)) rulesByCode.set(rule.codigo, []);
    rulesByCode.get(rule.codigo).push(rule);
  });
  const docsByCode = new Map(docs.rows.map((item) => [item.codigo, item]));
  const existingCodes = expectedCodes.filter((code) => activitiesByCode.has(code));
  const registeredNewCodes = newCodes.filter((code) => activitiesByCode.has(code));
  const pilotComparison = buildGrupo19PilotComparison(
    activitiesByCode.get(preservedCode),
    rulesByCode.get(preservedCode) || [],
    docsByCode.get(preservedCode)
  );
  const codigoDetalhado = DECRETO_021_GRUPO19_CONFERENCIA.map((item) => {
    const existing = activitiesByCode.get(item.codigo);
    const itemRules = rulesByCode.get(item.codigo) || [];
    const itemDocs = docsByCode.get(item.codigo);
    return {
      ...item,
      existe_no_sistema: Boolean(existing),
      novo_cadastrado_2d4b: newCodes.includes(item.codigo) && Boolean(existing),
      preservado_2d4b: item.codigo === preservedCode && Boolean(existing),
      dados_sistema: existing ? {
        nome: existing.nome,
        categoria: existing.categoria,
        tipo_atividade: existing.tipo_atividade,
        potencial_poluidor_padrao: existing.potencial_poluidor_padrao,
        parametro_principal_label: existing.parametro_principal_label,
        unidade_parametro_principal: existing.unidade_parametro_principal,
        formula_codigo: existing.formula_codigo,
        limite_impacto_local_tipo: existing.limite_impacto_local_tipo,
        limite_impacto_local_valor: existing.limite_impacto_local_valor,
        perguntas_publicas: existing.perguntas,
        alertas_publicos: existing.alertas,
        bloqueios_logicos: existing.bloqueios,
        documentos_vinculados: itemDocs?.documentos || 0,
        regras_cadastradas: itemRules.length,
        seed_piloto_codigo: existing.seed_piloto_codigo,
        atualizado_em: existing.updated_at,
      } : null,
      regras: itemRules,
      documentos: itemDocs?.nomes || [],
    };
  });

  const releaseRow = release.rows[0] || null;
  const blockers = releaseRow?.bloqueios_producao_json || {};
  const bloqueiosProducao = {
    dam_real: blockers.dam_real === true,
    cobranca_oficial: blockers.cobranca_oficial === true,
    protocolo_definitivo: blockers.protocolo_definitivo === true,
    decisao_automatica: blockers.decisao_automatica === true,
  };
  const totalPerguntas = activities.rows.reduce((sum, item) => sum + Number(item.perguntas || 0), 0);
  const totalAlertas = activities.rows.reduce((sum, item) => sum + Number(item.alertas || 0), 0);
  const totalBloqueios = activities.rows.reduce((sum, item) => sum + Number(item.bloqueios || 0), 0);
  const totalDocumentos = docs.rows.reduce((sum, item) => sum + Number(item.documentos || 0), 0);
  const atualizadoEm = activities.rows
    .map((item) => item.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    fase: '2D.4-B',
    titulo: 'Parametrizacao Controlada do Grupo 19 - Energia',
    grupo_parametrizado: {
      numero: 19,
      nome: 'Energia',
      fonte_normativa: 'Decreto Municipal n. 021/2020, pagina 121 do Diario Municipal, edicao n. 1439, 23/01/2020.',
    },
    codigos_esperados: expectedCodes,
    codigos_cadastrados: existingCodes,
    codigos_novos: registeredNewCodes,
    codigo_preservado: preservedCode,
    codigos_preservados: activitiesByCode.has(preservedCode) ? [preservedCode] : [],
    codigos_pendentes: expectedCodes.filter((code) => !activitiesByCode.has(code)),
    status_piloto_1903: {
      status: pilotComparison.status,
      preservado: pilotComparison.status !== 'piloto_ausente',
      divergencia_material: (pilotComparison.divergencias || []).length > 0,
      detalhes: pilotComparison.detalhes || {},
      divergencias: pilotComparison.divergencias || [],
    },
    total_regras: rules.rows.length,
    total_perguntas_publicas: totalPerguntas,
    total_documentos_vinculados: totalDocumentos,
    total_alertas_publicos: totalAlertas,
    total_bloqueios_logicos: totalBloqueios,
    atividades: codigoDetalhado,
    lacunas_normativas_preservadas: conferencia2d4a.lacunas_preservadas_fases_anteriores || [],
    preservacao_fases_anteriores: {
      ...(conferencia2d4a.preservacao_fases_anteriores || {}),
      fase2d3: true,
      fase2d4a: conferencia2d4a.fase === '2D.4-A' && (conferencia2d4a.codigos_divergentes_do_piloto || []).length === 0,
    },
    bloqueios_producao: bloqueiosProducao,
    efeitos_produtivos_bloqueados: {
      dam_real: bloqueiosProducao.dam_real,
      cobranca_oficial: bloqueiosProducao.cobranca_oficial,
      protocolo_definitivo: bloqueiosProducao.protocolo_definitivo,
      decisao_administrativa_automatica: bloqueiosProducao.decisao_automatica,
      emissao_automatica_licenca: true,
      emissao_automatica_dispensa: true,
      emissao_automatica_ama: true,
    },
    liberacao_tecnica: releaseRow,
    seed_executado: registeredNewCodes.length === newCodes.length && activitiesByCode.has(preservedCode),
    atualizado_em: atualizadoEm,
    mensagem: 'Parametrizacao orientativa do Grupo 19. O piloto 19.03 permanece preservado. Esta etapa nao altera taxa, VRTE, matriz, normas e nao libera efeitos produtivos.',
  };
}

async function getParametrizacaoFase2D5AMapaPosGrupo19Status() {
  const [mapa2d3, grupo19] = await Promise.all([
    getParametrizacaoFase2D3MapaDecretoStatus(),
    getParametrizacaoFase2D4BGrupo19Status(),
  ]);

  const expectedGrupo19 = ['19.01', '19.02', '19.03', '19.04'];
  const cadastradosGrupo19 = expectedGrupo19.filter((code) => (grupo19.codigos_cadastrados || []).includes(code));
  const grupo19Integral = cadastradosGrupo19.length === expectedGrupo19.length
    && (grupo19.codigos_preservados || []).includes('19.03')
    && (grupo19.codigos_novos || []).includes('19.01')
    && (grupo19.codigos_novos || []).includes('19.02')
    && (grupo19.codigos_novos || []).includes('19.04');

  const grupos = (mapa2d3.grupos || []).map((item) => {
    if (Number(item.grupo) !== 19) return item;

    return {
      ...item,
      nome: 'Energia',
      codigos_esperados: expectedGrupo19,
      codigos_cadastrados: cadastradosGrupo19,
      codigos_cadastrados_fora_lista_confirmada: [],
      codigos_pendentes: expectedGrupo19.filter((code) => !cadastradosGrupo19.includes(code)),
      codigos_pendentes_descricao: null,
      total_codigos_esperados: expectedGrupo19.length,
      total_codigos_cadastrados: cadastradosGrupo19.length,
      total_codigos_pendentes: expectedGrupo19.length - cadastradosGrupo19.length,
      percentual_cobertura: calculateCoveragePercent(cadastradosGrupo19.length, expectedGrupo19.length),
      status: grupo19Integral ? 'parametrizado_integralmente' : 'parametrizado_parcialmente',
      possui_lacuna_normativa: false,
      lacunas_normativas: [],
      requer_conferencia_pdf: false,
      regras_cadastradas: grupo19.total_regras || item.regras_cadastradas || 0,
      perguntas_publicas: grupo19.total_perguntas_publicas || item.perguntas_publicas || 0,
      alertas_publicos: grupo19.total_alertas_publicos || item.alertas_publicos || 0,
      bloqueios_logicos: grupo19.total_bloqueios_logicos || item.bloqueios_logicos || 0,
      documentos_vinculados: grupo19.total_documentos_vinculados || item.documentos_vinculados || 0,
      atualizado_em: grupo19.atualizado_em || item.atualizado_em,
      prioridade_recomendada: 'concluido',
      recomendacao_prioridade: 'Grupo 19 integralmente parametrizado na Fase 2D.4-B, com 19.03 preservado e 19.01, 19.02 e 19.04 cadastrados.',
      observacao_contagem: 'Grupo 19 recalculado na Fase 2D.5-A como fotografia pos-2D.4-B.',
    };
  });

  const totalExpectedCodes = grupos.reduce((sum, item) => sum + item.total_codigos_esperados, 0);
  const totalRegisteredCodes = grupos.reduce((sum, item) => sum + item.total_codigos_cadastrados, 0);
  const totalPendingCodes = grupos.reduce((sum, item) => sum + item.total_codigos_pendentes, 0);
  const workedGroups = grupos.filter((item) => [
    'parametrizado_integralmente',
    'parametrizado_parcialmente',
    'possui_lacuna_normativa',
  ].includes(item.status));
  const gruposPendentes = grupos.filter((item) => [
    'requer_conferencia_pdf',
    'nao_parametrizado',
    'parametrizado_parcialmente',
  ].includes(item.status));

  const criteriosBloco4 = [
    { criterio: 'frequencia_provavel_requerimentos', avaliacao: 'media_alta', peso: 4 },
    { criterio: 'relevancia_fiscalizacao_ambiental', avaliacao: 'alta', peso: 5 },
    { criterio: 'licenciamento_simplificado', avaliacao: 'media', peso: 3 },
    { criterio: 'risco_ambiental', avaliacao: 'medio', peso: 4 },
    { criterio: 'clareza_normativa_decreto', avaliacao: 'nao_conferida_pdf', peso: 2 },
    { criterio: 'lacunas_textuais_conhecidas', avaliacao: 'sem_lacuna_registrada_no_mapa_atual', peso: 3 },
    { criterio: 'parametrizacao_segura', avaliacao: 'depende_de_conferencia_normativa', peso: 2 },
    { criterio: 'impacto_administrativo_sigma', avaliacao: 'alto', peso: 5 },
    { criterio: 'sinergia_grupos_parametrizados', avaliacao: 'alta_com_grupos_20_22_24', peso: 4 },
  ];

  const recomendacaoBloco4 = {
    bloco: 'Bloco 4',
    grupo_recomendado: '21',
    grupos_recomendados: ['21'],
    titulo: 'Grupo 21 - conferencia normativa previa',
    proximo_passo: 'conferencia_normativa',
    seed_direto_recomendado: false,
    justificativa: 'Recomenda-se iniciar pelo Grupo 21 em fase de conferencia normativa, porque ele permanece pendente no mapa mestre, tende a ter sinergia operacional com residuos, armazenamento e atividades diversas ja parametrizadas, e pode gerar impacto relevante para triagem, fiscalizacao e licenciamento simplificado. Como o grupo ainda nao foi conferido em PDF, a etapa segura e auditar texto, codigos, parametros, faixas, limites e eventuais lacunas antes de qualquer seed.',
    riscos: [
      'A lista de codigos do Grupo 21 ainda nao esta confirmada no acervo interno.',
      'Pode haver lacunas textuais ou faixas incompletas ainda nao mapeadas.',
      'Seed direto criaria risco de inventar parametro, porte, classe ou efeito administrativo sem base conferida.',
    ],
    cautelas: [
      'Conferir o PDF do Decreto Municipal n. 021/2020 antes de parametrizar.',
      'Registrar expressamente codigos, unidades, faixas, limites de impacto local e pontos ambiguidade.',
      'Manter DAM real, cobranca oficial, protocolo definitivo e decisoes automaticas bloqueados.',
    ],
    criterios: criteriosBloco4,
  };

  return {
    fase: '2D.5-A',
    titulo: 'Mapa Mestre Pos-Grupo 19 - Fase 2D.5-A',
    total_grupos_identificados: grupos.length,
    grupos_parametrizados_integralmente: grupos.filter((item) => item.status === 'parametrizado_integralmente').length,
    grupos_parametrizados_parcialmente: grupos.filter((item) => item.status === 'parametrizado_parcialmente').length,
    grupos_com_lacuna_normativa: grupos.filter((item) => item.status === 'possui_lacuna_normativa').length,
    grupos_nao_parametrizados: grupos.filter((item) => item.total_codigos_cadastrados === 0).length,
    grupos_sem_parametrizacao: grupos.filter((item) => item.total_codigos_cadastrados === 0).length,
    grupos_requerem_conferencia_pdf: grupos.filter((item) => item.status === 'requer_conferencia_pdf').length,
    total_codigos_esperados: totalExpectedCodes,
    total_codigos_cadastrados: totalRegisteredCodes,
    total_codigos_pendentes: totalPendingCodes,
    percentual_geral_cobertura: Number(((workedGroups.length / grupos.length) * 100).toFixed(2)),
    percentual_cobertura_codigos_confirmados: calculateCoveragePercent(totalRegisteredCodes, totalExpectedCodes),
    grupo19: {
      status: grupo19Integral ? 'parametrizado_integralmente' : 'parametrizado_parcialmente',
      codigos_esperados: expectedGrupo19,
      codigos_cadastrados: cadastradosGrupo19,
      codigos_preservados: grupo19.codigos_preservados || [],
      codigos_novos: grupo19.codigos_novos || [],
      piloto_1903_preservado: grupo19.status_piloto_1903?.preservado === true,
      totais: {
        regras: grupo19.total_regras,
        perguntas_publicas: grupo19.total_perguntas_publicas,
        documentos_vinculados: grupo19.total_documentos_vinculados,
        alertas_publicos: grupo19.total_alertas_publicos,
        bloqueios_logicos: grupo19.total_bloqueios_logicos,
      },
    },
    grupos_parametrizados: grupos.filter((item) => item.status === 'parametrizado_integralmente').map((item) => item.grupo),
    grupos_pendentes: gruposPendentes,
    grupos_pendentes_resumo: gruposPendentes.map((item) => ({
      grupo: item.grupo,
      nome: item.nome,
      status: item.status,
      requer_conferencia_pdf: item.requer_conferencia_pdf,
      codigos_pendentes: item.codigos_pendentes,
    })),
    grupos,
    lacunas_normativas: mapa2d3.lacunas_normativas || [],
    bloqueios_producao: grupo19.bloqueios_producao || mapa2d3.bloqueios_producao,
    efeitos_produtivos_bloqueados: grupo19.efeitos_produtivos_bloqueados,
    preservacao_fases_anteriores: {
      fase2b: true,
      fase2c: true,
      fase2c1: true,
      fase2c2: true,
      fase2c3: true,
      fase2c4: true,
      fase2d1: mapa2d3.preservacao_fases_anteriores?.fase2d1 === true,
      fase2d2: mapa2d3.preservacao_fases_anteriores?.fase2d2 === true,
      fase2d21: mapa2d3.preservacao_fases_anteriores?.fase2d21 === true,
      fase2d3: mapa2d3.fase === '2D.3',
      fase2d4a: grupo19.preservacao_fases_anteriores?.fase2d4a === true,
      fase2d4b: grupo19.seed_executado === true,
    },
    recomendacao_bloco4: recomendacaoBloco4,
    recomendacao_proximo_bloco: recomendacaoBloco4,
    riscos_remanescentes: [
      'Grupos 1 a 14, 21 e 25 seguem sem conferencia normativa suficiente no mapa mestre.',
      'Lacunas 15.06, 15.11, 17.06 e 23.04 permanecem explicitas e sem efeito produtivo.',
      'A recomendacao do Bloco 4 e diagnostica e nao autoriza seed, taxa, VRTE, matriz, norma, DAM, cobranca, protocolo, licenca, dispensa, AMA ou decisao automatica.',
    ],
    mensagem: 'Fase diagnostica. Atualiza o mapa mestre apos o Grupo 19 e recomenda conferencia normativa do Bloco 4, sem criar seed de novos grupos e sem liberar efeitos produtivos.',
  };
}

async function getParametrizacaoFase2D5BComplementacaoGruposStatus() {
  const mapa2d5a = await getParametrizacaoFase2D5AMapaPosGrupo19Status();
  const activitiesResult = await repository.db.query(
    `
      SELECT
        codigo,
        nome,
        validacoes_requeridas,
        observacoes,
        split_part(codigo, '.', 1) AS grupo
      FROM licenciamento_atividades
      WHERE deleted_at IS NULL
        AND ativo = true
        AND codigo ~ '^\\d{1,2}\\.\\d{2}$'
      ORDER BY split_part(codigo, '.', 1)::int, codigo;
    `
  );

  const officialByGroup = new Map(
    DECRETO_021_GRUPOS_CONFIRMADOS_FASE_2D5B.map((item) => [item.grupo, item])
  );
  const activitiesByCode = new Map(activitiesResult.rows.map((item) => [item.codigo, item]));
  const activitiesByGroup = new Map();
  activitiesResult.rows.forEach((item) => {
    const grupo = normalizeGroupNumber(item.grupo);
    if (!activitiesByGroup.has(grupo)) activitiesByGroup.set(grupo, []);
    activitiesByGroup.get(grupo).push(item.codigo);
  });

  const grupos = (mapa2d5a.grupos || []).map((item) => {
    const grupo = normalizeGroupNumber(item.grupo);
    const official = officialByGroup.get(grupo);
    if (!official) {
      return {
        ...item,
        fonte_oficial_confirmada: true,
        fonte_normativa: 'Acervo parametrizado nas fases anteriores do modulo Licenciamento.',
        bloqueio_tecnico: item.possui_lacuna_normativa
          ? 'Lacuna normativa preservada; nao gerar taxa, classe definitiva ou decisao automatica.'
          : null,
      };
    }

    const expectedCodes = official.codigos_esperados;
    const registeredAnyCodes = activitiesByGroup.get(grupo) || [];
    const registeredExpectedCodes = expectedCodes.filter((code) => activitiesByCode.has(code));
    const pendingCodes = expectedCodes.filter((code) => !activitiesByCode.has(code));
    const status = registeredExpectedCodes.length === expectedCodes.length
      ? 'parametrizado_integralmente'
      : registeredExpectedCodes.length > 0
        ? 'parametrizado_parcialmente'
        : 'fonte_oficial_confirmada_sem_parametrizacao';

    return {
      ...item,
      nome: official.nome,
      codigos_esperados: expectedCodes,
      codigos_cadastrados: registeredExpectedCodes,
      codigos_cadastrados_fora_lista_confirmada: registeredAnyCodes.filter((code) => !expectedCodes.includes(code)),
      codigos_pendentes: pendingCodes,
      codigos_pendentes_descricao: pendingCodes.length
        ? 'Fonte oficial confirma grupo e codigos; seed de atividades permanece bloqueado ate conferencia normativa linha a linha.'
        : null,
      total_codigos_esperados: expectedCodes.length,
      total_codigos_cadastrados: registeredExpectedCodes.length,
      total_codigos_pendentes: pendingCodes.length,
      percentual_cobertura: calculateCoveragePercent(registeredExpectedCodes.length, expectedCodes.length),
      status,
      requer_conferencia_pdf: false,
      requer_parametrizacao_controlada: pendingCodes.length > 0,
      fonte_oficial_confirmada: true,
      fonte_normativa: DECRETO_021_FASE_2D5B_FONTE_OFICIAL.referencia,
      fonte_arquivo: DECRETO_021_FASE_2D5B_FONTE_OFICIAL.arquivo,
      metodo_conferencia: DECRETO_021_FASE_2D5B_FONTE_OFICIAL.metodo,
      prioridade_recomendada: official.prioridade_recomendada,
      recomendacao_prioridade: official.recomendacao_prioridade,
      pendencias_conferencia_visual: official.pendencias_conferencia_visual || [],
      bloqueio_tecnico: pendingCodes.length
        ? 'Nao parametrizado nesta fase para evitar cadastro incompleto de parametros, faixas, classes, taxas ou documentos sem conferencia normativa controlada.'
        : null,
      observacao_contagem: 'Nome e lista de codigos atualizados pela Fase 2D.5B com base no PDF oficial informado. Nao houve seed de atividades.',
    };
  });

  const totalExpectedCodes = grupos.reduce((sum, item) => sum + Number(item.total_codigos_esperados || 0), 0);
  const totalRegisteredCodes = grupos.reduce((sum, item) => sum + Number(item.total_codigos_cadastrados || 0), 0);
  const totalPendingCodes = grupos.reduce((sum, item) => sum + Number(item.total_codigos_pendentes || 0), 0);
  const workedGroups = grupos.filter((item) => [
    'parametrizado_integralmente',
    'parametrizado_parcialmente',
    'possui_lacuna_normativa',
  ].includes(item.status));
  const gruposPendentes = grupos.filter((item) => [
    'fonte_oficial_confirmada_sem_parametrizacao',
    'requer_conferencia_pdf',
    'nao_parametrizado',
    'parametrizado_parcialmente',
  ].includes(item.status));
  const gruposFonteSemSeed = grupos.filter((item) => item.status === 'fonte_oficial_confirmada_sem_parametrizacao');
  const gruposSemNomeOficial = grupos.filter((item) => /pendentes de conferencia PDF/i.test(String(item.nome || '')));
  const gruposComZeroAtividadesEsperadas = grupos.filter((item) => Number(item.total_codigos_esperados || 0) === 0);
  const lacunasNormativas = mapa2d5a.lacunas_normativas || [];
  const lacunasPorGrupo = lacunasNormativas.reduce((acc, item) => {
    const grupo = normalizeGroupNumber(item.grupo || String(item.codigo || '').split('.')[0]);
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(item);
    return acc;
  }, {});

  const atividadesAusentes = gruposFonteSemSeed.flatMap((grupo) => (grupo.codigos_pendentes || []).map((codigo) => ({
    grupo: grupo.grupo,
    nome_grupo: grupo.nome,
    codigo,
    nome_oficial: null,
    status: 'ausente_sem_seed',
    fonte_normativa: grupo.fonte_normativa,
    observacao: 'Codigo confirmado no Anexo II-A para diagnostico. Nome, parametro, unidade, faixa, classe, taxa e documentos exigem conferencia normativa antes de cadastro.',
  })));

  const pendenciasConferenciaVisual = DECRETO_021_GRUPOS_CONFIRMADOS_FASE_2D5B.flatMap((grupo) => (
    grupo.pendencias_conferencia_visual || []
  ).map((pendencia) => ({
    grupo: Number(grupo.grupo),
    nome_grupo: grupo.nome,
    ...pendencia,
    status: 'nao_inferido',
  })));

  const grupo19 = mapa2d5a.grupo19 || {};
  const grupo20 = grupos.find((item) => Number(item.grupo) === 20) || null;
  const recomendacaoBloco4 = {
    bloco: 'Bloco 4',
    grupo_recomendado: '21',
    grupos_recomendados: ['21'],
    titulo: 'Grupo 21 - Obras e Estruturas Diversas',
    proximo_passo: 'conferencia_normativa_detalhada',
    seed_direto_recomendado: false,
    justificativa: 'O Grupo 21 deve abrir o Bloco 4 porque o Decreto ja confirma nome e 10 codigos, ha alta relevancia para fiscalizacao ambiental, drenagem, obras viarias, urbanizacao e estruturas em corpos hidricos, alem de forte sinergia com os grupos 20, 22 e 24 ja parametrizados. A proxima etapa deve conferir parametros, unidades, faixas, limites e documentos no PDF antes de qualquer seed.',
    riscos: [
      'Obras e estruturas podem envolver APP, corpos hidricos, drenagem, pavimentacao e competencia ambiental sensivel.',
      'A Fase 2D.5B confirmou nome e codigos, mas nao validou todos os parametros, faixas, classes e documentos do Grupo 21.',
      'Seed direto criaria risco de enquadramento sem lastro documental completo.',
    ],
    cautelas: [
      'Executar conferencia normativa visual do Anexo II-A para os codigos 21.01 a 21.10.',
      'Registrar ambiguidades antes de parametrizar regras, documentos, perguntas publicas e bloqueios.',
      'Manter DAM real, cobranca oficial, protocolo definitivo, licenca, dispensa, AMA e decisao automatica bloqueados.',
    ],
    criterios: [
      { criterio: 'frequencia_provavel_requerimentos', avaliacao: 'media_alta', peso: 4 },
      { criterio: 'relevancia_fiscalizacao_ambiental', avaliacao: 'alta', peso: 5 },
      { criterio: 'licenciamento_simplificado', avaliacao: 'media', peso: 3 },
      { criterio: 'risco_ambiental', avaliacao: 'medio_alto', peso: 4 },
      { criterio: 'clareza_normativa_decreto', avaliacao: 'grupo_e_codigos_confirmados_parametros_pendentes', peso: 3 },
      { criterio: 'existencia_lacunas_textuais', avaliacao: 'sem_lacuna_confirmada_nesta_fase', peso: 3 },
      { criterio: 'parametrizacao_segura', avaliacao: 'depende_de_conferencia_normativa_detalhada', peso: 2 },
      { criterio: 'impacto_administrativo_sigma', avaliacao: 'alto', peso: 5 },
      { criterio: 'sinergia_grupos_parametrizados', avaliacao: 'alta_com_grupos_20_22_24', peso: 4 },
    ],
  };

  return {
    fase: '2D.5B',
    titulo: 'Complementacao Controlada de Grupos e Atividades Pendentes - Fase 2D.5B',
    natureza: 'diagnostica_sem_seed_parametrizacao',
    total_grupos_identificados: grupos.length,
    grupos_parametrizados_integralmente: grupos.filter((item) => item.status === 'parametrizado_integralmente').length,
    grupos_parametrizados_parcialmente: grupos.filter((item) => item.status === 'parametrizado_parcialmente').length,
    grupos_com_lacuna_normativa: grupos.filter((item) => item.status === 'possui_lacuna_normativa').length,
    grupos_sem_parametrizacao: grupos.filter((item) => [
      'fonte_oficial_confirmada_sem_parametrizacao',
      'requer_conferencia_pdf',
      'nao_parametrizado',
    ].includes(item.status)).length,
    grupos_sem_nome_oficial: gruposSemNomeOficial.length,
    grupos_com_zero_atividades_esperadas: gruposComZeroAtividadesEsperadas.length,
    grupos_com_fonte_oficial_confirmada_sem_seed: gruposFonteSemSeed.length,
    grupos_aguardando_parametrizacao_controlada: gruposFonteSemSeed.map((item) => item.grupo),
    total_codigos_esperados: totalExpectedCodes,
    codigos_esperados_confirmados: totalExpectedCodes,
    total_codigos_cadastrados: totalRegisteredCodes,
    codigos_cadastrados: totalRegisteredCodes,
    total_codigos_pendentes: totalPendingCodes,
    codigos_pendentes: totalPendingCodes,
    total_atividades_cadastradas: activitiesResult.rows.length,
    percentual_geral_cobertura: Number(((workedGroups.length / grupos.length) * 100).toFixed(2)),
    percentual_geral_cobertura_por_grupo: Number(((workedGroups.length / grupos.length) * 100).toFixed(2)),
    percentual_grupos_parametrizados_integralmente: Number(((grupos.filter((item) => item.status === 'parametrizado_integralmente').length / grupos.length) * 100).toFixed(2)),
    percentual_cobertura_codigos_confirmados: calculateCoveragePercent(totalRegisteredCodes, totalExpectedCodes),
    grupos_parametrizados: grupos.filter((item) => item.status === 'parametrizado_integralmente').map((item) => item.grupo),
    grupos_trabalhados: grupos.filter((item) => [
      'parametrizado_integralmente',
      'possui_lacuna_normativa',
      'parametrizado_parcialmente',
    ].includes(item.status)).map((item) => item.grupo),
    grupos_preenchidos_por_fonte_oficial: gruposFonteSemSeed.map((item) => ({
      grupo: item.grupo,
      nome: item.nome,
      codigos_esperados: item.codigos_esperados,
      total_codigos_esperados: item.total_codigos_esperados,
      fonte_normativa: item.fonte_normativa,
    })),
    grupos_pendentes: gruposPendentes,
    grupos_pendentes_resumo: gruposPendentes.map((item) => ({
      grupo: item.grupo,
      nome: item.nome,
      status: item.status,
      prioridade: item.prioridade_recomendada,
      codigos_pendentes: item.codigos_pendentes,
      bloqueio_tecnico: item.bloqueio_tecnico,
    })),
    grupos,
    atividades_cadastradas: activitiesResult.rows.map((item) => ({
      grupo: Number(normalizeGroupNumber(item.grupo)),
      codigo: item.codigo,
      nome: item.nome,
    })),
    atividades_ausentes: atividadesAusentes,
    lacunas_normativas: lacunasNormativas,
    lacunas_por_grupo: lacunasPorGrupo,
    pendencias_conferencia_visual: pendenciasConferenciaVisual,
    grupo19: {
      ...grupo19,
      status: grupo19.status,
      piloto_1903_preservado: grupo19.piloto_1903_preservado === true,
    },
    grupo20: grupo20 ? {
      grupo: grupo20.grupo,
      nome: grupo20.nome,
      status: grupo20.status,
      codigos_esperados: grupo20.codigos_esperados,
      codigos_cadastrados: grupo20.codigos_cadastrados,
      percentual_cobertura: grupo20.percentual_cobertura,
      observacao: 'Grupo 20 preservado como integral na base parametrizada, sem alteracao nesta fase.',
    } : null,
    fontes_normativas_consultadas: [
      DECRETO_021_FASE_2D5B_FONTE_OFICIAL,
      { referencia: 'Fases 2B a 2D.5-A ja registradas no acervo tecnico do modulo Licenciamento.' },
    ],
    preservacao_fases_anteriores: {
      ...(mapa2d5a.preservacao_fases_anteriores || {}),
      fase2d5a: mapa2d5a.fase === '2D.5-A',
    },
    bloqueios_producao: mapa2d5a.bloqueios_producao,
    efeitos_produtivos_bloqueados: {
      ...(mapa2d5a.efeitos_produtivos_bloqueados || {}),
      dam_real: true,
      cobranca_oficial: true,
      protocolo_definitivo: true,
      decisao_administrativa_automatica: true,
      emissao_automatica_licenca: true,
      emissao_automatica_dispensa: true,
      emissao_automatica_ama: true,
    },
    alteracoes_protegidas: {
      taxa_alterada: false,
      vrte_alterado: false,
      matriz_operacional_alterada: false,
      norma_alterada: false,
      dam_real_liberado: false,
      cobranca_oficial_liberada: false,
      protocolo_definitivo_liberado: false,
      decisao_automatica_liberada: false,
    },
    seed_parametrizacao_novos_grupos_criado: false,
    atividades_incluidas: [],
    lacunas_encerradas: [],
    recomendacao_bloco4: recomendacaoBloco4,
    recomendacao_proximo_bloco: recomendacaoBloco4,
    riscos_remanescentes: [
      'Grupos 1 a 14, 21 e 25 tiveram nome e codigos diagnosticados por fonte oficial, mas continuam sem seed de parametrizacao.',
      'A atividade 2.14 nao foi inferida porque a leitura OCR do PDF salta de 2.13 para 2.15.',
      'Lacunas 15.06, 15.11, 17.06 e 23.04 permanecem abertas e sem efeito produtivo.',
      'Nao houve alteracao de taxa, VRTE, matriz operacional, normas, DAM, cobranca, protocolo, licenca, dispensa, AMA ou decisao automatica.',
    ],
    mensagem: 'Fase diagnostica de saneamento. Atualiza nomes e codigos esperados quando confirmados por fonte oficial, mas nao cria seed de novos grupos e nao libera efeitos produtivos.',
  };
}

const FASE_2D5D_PRIORIZACAO = '2D.5D';
const GRUPOS_RELEVANCIA_ALTA_2D5D = new Set(['1', '2', '3', '5', '8', '11', '13', '21', '25']);
const GRUPOS_SINERGIA_ASSISTENTE_2D5D = new Set(['1', '2', '8', '11', '20', '21', '22', '23', '24', '25']);
const GRUPOS_CORRELATOS_PARAMETRIZADOS_2D5D = new Set(['21', '25']);
const GRUPOS_BLOQUEADOS_LACUNA_CRITICA_2D5D = new Set(['15', '17', '23']);
const LACUNAS_CRITICAS_2D5D = [
  {
    codigo: '15.06',
    grupo: 15,
    tipo: 'lacuna_textual',
    severidade: 'critica',
    descricao: DECRETO_021_LACUNAS_NORMATIVAS['15.06'].descricao,
  },
  {
    codigo: '15.11',
    grupo: 15,
    tipo: 'lacuna_textual',
    severidade: 'critica',
    descricao: DECRETO_021_LACUNAS_NORMATIVAS['15.11'].descricao,
  },
  {
    codigo: '17.06',
    grupo: 17,
    tipo: 'lacuna_textual',
    severidade: 'critica',
    descricao: DECRETO_021_LACUNAS_NORMATIVAS['17.06'].descricao,
  },
  {
    codigo: '23.04',
    grupo: 23,
    tipo: 'lacuna_textual',
    severidade: 'critica',
    descricao: DECRETO_021_LACUNAS_NORMATIVAS['23.04'].descricao,
  },
  {
    codigo: '2.14',
    grupo: 2,
    tipo: 'pendencia_conferencia_visual',
    severidade: 'alta',
    descricao: 'Sequencia extraida por OCR salta de 2.13 para 2.15. O codigo 2.14 permanece sem inferencia ate conferencia visual.',
  },
];

function classifyComplexity2D5D(groupNumber, expectedCodes) {
  if (['11', '13', '21'].includes(groupNumber)) return 'alta';
  if (expectedCodes.length <= 3) return 'baixa';
  if (expectedCodes.length <= 8) return 'media';
  return 'alta';
}

function classifyRelevancia2D5D(groupNumber) {
  if (GRUPOS_RELEVANCIA_ALTA_2D5D.has(groupNumber)) return 'alta';
  if (['4', '6', '7', '9', '10', '12', '14', '15', '17', '23'].includes(groupNumber)) return 'media';
  return 'baixa';
}

function classifyRisco2D5D(groupNumber, statusAtual, lacunasConhecidas, complexidade) {
  if (groupNumber === '21') return 'alto';
  if (String(statusAtual || '').includes('bloqueado')) return 'alto';
  if (lacunasConhecidas.some((item) => item.severidade === 'critica')) return 'alto';
  if (complexidade === 'alta') return 'alto';
  if (lacunasConhecidas.length > 0 || complexidade === 'media') return 'medio';
  return 'baixo';
}

function addScore2D5D(scoreItems, criterio, avaliacao, pontos) {
  scoreItems.push({ criterio, avaliacao, pontos });
}

function buildPontuacao2D5D({ groupNumber, fonteClara, lacunasConhecidas, relevanciaOperacional, complexidade, riscoNormativo }) {
  const scoreItems = [];

  if (groupNumber === '21') {
    addScore2D5D(scoreItems, 'fonte_insuficiente', 'bloqueio_normativo_2d5c3b_ativo', -40);
  } else if (fonteClara) {
    addScore2D5D(scoreItems, 'fonte_clara', 'fonte_municipal_confirmada_na_2d5b', 30);
  } else {
    addScore2D5D(scoreItems, 'fonte_insuficiente', 'sem_confirmacao_municipal_segura', -40);
  }

  const hasCriticalGap = lacunasConhecidas.some((item) => ['critica', 'alta'].includes(item.severidade));
  if (lacunasConhecidas.length === 0) {
    addScore2D5D(scoreItems, 'baixa_quantidade_lacunas', 'sem_lacuna_conhecida_no_mapa_atual', 20);
  } else if (hasCriticalGap) {
    addScore2D5D(scoreItems, 'lacunas_criticas', 'ha_lacuna_critica_ou_pendencia_visual', -30);
  } else {
    addScore2D5D(scoreItems, 'lacunas_residuais', 'ha_lacunas_nao_criticas', -10);
  }

  if (relevanciaOperacional === 'alta') addScore2D5D(scoreItems, 'alta_relevancia_operacional', 'rotina_sigma_ou_infraestrutura_recorrente', 20);
  else if (relevanciaOperacional === 'media') addScore2D5D(scoreItems, 'relevancia_operacional_media', 'uso_provavel_moderado', 10);

  if (complexidade === 'baixa') addScore2D5D(scoreItems, 'baixa_complexidade_normativa', 'grupo_pequeno_ou_parametrizacao_pontual', 15);
  else if (complexidade === 'media') addScore2D5D(scoreItems, 'complexidade_normativa_media', 'grupo_com_varias_atividades_mas_sem_complexidade_extrema', 8);
  else addScore2D5D(scoreItems, 'alta_complexidade_normativa', 'muitas_atividades_ou_parametros_sensiveis', -10);

  if (GRUPOS_SINERGIA_ASSISTENTE_2D5D.has(groupNumber)) {
    addScore2D5D(scoreItems, 'sinergia_assistente_pre_requerimentos', 'atividade_recorrente_em_triagem_orientativa', 10);
  }

  if (GRUPOS_CORRELATOS_PARAMETRIZADOS_2D5D.has(groupNumber)) {
    addScore2D5D(scoreItems, 'grupo_correlato_parametrizado', 'dialoga_com_grupos_20_22_24_ja_mapeados', 5);
  }

  addScore2D5D(scoreItems, 'ausencia_parametros_faixas_conferidos', 'grupo_ainda_precisa_conferencia_linha_a_linha_antes_de_seed', -20);

  if (riscoNormativo === 'alto') {
    addScore2D5D(scoreItems, 'alto_risco_juridico', 'erro_normativo_pode_afetar_classe_ato_ou_documentos', -30);
  }

  return {
    itens: scoreItems,
    total: scoreItems.reduce((sum, item) => sum + Number(item.pontos || 0), 0),
  };
}

function normalizeLacunas2D5D(groupNumber, mapa2d5b) {
  const lacunas = [
    ...((mapa2d5b.lacunas_por_grupo || {})[groupNumber] || []).map((item) => ({
      codigo: item.codigo,
      tipo: 'lacuna_normativa',
      severidade: 'critica',
      descricao: item.descricao || item.mensagem || item.risco || 'Lacuna normativa preservada em fase anterior.',
    })),
    ...(mapa2d5b.pendencias_conferencia_visual || [])
      .filter((item) => normalizeGroupNumber(item.grupo) === groupNumber)
      .map((item) => ({
        codigo: item.codigo,
        tipo: 'pendencia_conferencia_visual',
        severidade: 'alta',
        descricao: item.motivo,
      })),
  ];

  if (groupNumber === '21') {
    lacunas.push({
      codigo: '21.01-21.10',
      tipo: 'bloqueio_normativo_grupo',
      severidade: 'critica',
      descricao: 'Grupo 21 possui 24 lacunas remanescentes e bloqueio formal por insuficiencia de fonte municipal segura.',
    });
  }

  return lacunas;
}

async function getGrupo21BloqueioResumo2D5D() {
  const [manualRows, atividades] = await Promise.all([
    repository.db.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status_conferencia = 'conferido_com_lacunas')::int AS com_lacunas,
          COUNT(*) FILTER (WHERE apto_para_seed = true)::int AS aptos
        FROM licenciamento_parametrizacao_conferencias
        WHERE fase = '2D.5C.2'
          AND grupo_numero = 21
          AND removido_em IS NULL;
      `
    ),
    repository.db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM licenciamento_atividades
        WHERE deleted_at IS NULL
          AND ativo = true
          AND codigo LIKE '21.%';
      `
    ),
  ]);

  return {
    registrosAtivosBancada: manualRows.rows[0]?.total || 0,
    registrosComLacuna: manualRows.rows[0]?.com_lacunas || 0,
    aptosParaSeed: manualRows.rows[0]?.aptos || 0,
    lacunasRemanescentes: 24,
    atividadesOperacionais: atividades.rows[0]?.total || 0,
    bloqueioFormalRegistrado: true,
  };
}

function buildGrupoPendente2D5D(group, mapa2d5b, grupo21Resumo) {
  const groupNumber = normalizeGroupNumber(group.grupo);
  const expectedCodes = group.codigos_esperados || [];
  const registeredCodes = group.codigos_cadastrados || [];
  const pendingCodes = group.codigos_pendentes || expectedCodes.filter((code) => !registeredCodes.includes(code));
  const lacunasConhecidas = normalizeLacunas2D5D(groupNumber, mapa2d5b);
  const fonteClara = group.fonte_oficial_confirmada === true && groupNumber !== '21';
  const complexidade = classifyComplexity2D5D(groupNumber, expectedCodes);
  const relevanciaOperacional = classifyRelevancia2D5D(groupNumber);
  let statusAtual = group.status || 'pendente_diagnostico';

  if (groupNumber === '21') {
    statusAtual = 'bloqueado_por_insuficiencia_de_fonte_municipal';
  } else if (GRUPOS_BLOQUEADOS_LACUNA_CRITICA_2D5D.has(groupNumber)) {
    statusAtual = 'bloqueado_por_lacuna_critica';
  } else if (lacunasConhecidas.some((item) => item.tipo === 'pendencia_conferencia_visual')) {
    statusAtual = 'pendente_conferencia_visual';
  }

  const riscoNormativo = classifyRisco2D5D(groupNumber, statusAtual, lacunasConhecidas, complexidade);
  const pontuacao = buildPontuacao2D5D({
    groupNumber,
    fonteClara,
    lacunasConhecidas,
    relevanciaOperacional,
    complexidade,
    riscoNormativo,
  });
  const seedBloqueado = true;
  const recomendavelParaProximaConferencia = groupNumber !== '21'
    && !String(statusAtual).includes('bloqueado')
    && fonteClara
    && lacunasConhecidas.length === 0;

  return {
    grupo: Number(groupNumber),
    nomeGrupo: group.nome,
    statusAtual,
    codigosEsperados: Number(group.total_codigos_esperados || expectedCodes.length || 0),
    codigosCadastrados: Number(group.total_codigos_cadastrados || registeredCodes.length || 0),
    codigosPendentes: Number(group.total_codigos_pendentes || pendingCodes.length || 0),
    codigosEsperadosLista: expectedCodes,
    codigosPendentesLista: pendingCodes,
    lacunasConhecidas,
    fonteDisponivel: groupNumber === '21'
      ? 'Fonte municipal insuficiente para saneamento das 24 lacunas remanescentes; bloqueio 2D.5C.3-B ativo.'
      : group.fonte_normativa || 'Fonte nao consolidada no mapa tecnico atual.',
    riscoNormativo,
    relevanciaOperacional,
    complexidade,
    pontuacaoPrioridade: pontuacao.total,
    criteriosPontuacao: pontuacao.itens,
    seedPermitido: false,
    seedBloqueado,
    recomendavelParaProximaConferencia,
    recomendacao: recomendavelParaProximaConferencia
      ? 'Priorizar conferencia normativa detalhada antes de qualquer seed.'
      : 'Manter bloqueado ou tratar apenas em diagnostico complementar ate saneamento das lacunas.',
    justificativa: groupNumber === '21'
      ? `Grupo 21 nao pode ser recomendado: ${grupo21Resumo.registrosAtivosBancada} registros ativos na bancada, ${grupo21Resumo.registrosComLacuna} com lacunas, ${grupo21Resumo.lacunasRemanescentes} lacunas remanescentes e ${grupo21Resumo.atividadesOperacionais} atividades operacionais.`
      : 'Pontuacao calculada por fonte disponivel, lacunas conhecidas, relevancia operacional, complexidade e risco normativo. A recomendacao nao autoriza seed.',
  };
}

async function getParametrizacaoFase2D5DPriorizacaoGruposPendentes() {
  const [mapa2d5b, grupo21Resumo, beforeOperational21] = await Promise.all([
    getParametrizacaoFase2D5BComplementacaoGruposStatus(),
    getGrupo21BloqueioResumo2D5D(),
    repository.db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM licenciamento_atividades
        WHERE deleted_at IS NULL
          AND ativo = true
          AND codigo LIKE '21.%';
      `
    ),
  ]);

  const pendingNumbers = new Set([
    ...(mapa2d5b.grupos_pendentes || []).map((item) => normalizeGroupNumber(item.grupo)),
    '15',
    '17',
    '23',
    '21',
    '25',
  ]);
  const gruposPendentes = (mapa2d5b.grupos || [])
    .filter((item) => pendingNumbers.has(normalizeGroupNumber(item.grupo)))
    .map((item) => buildGrupoPendente2D5D(item, mapa2d5b, grupo21Resumo))
    .sort((left, right) => left.grupo - right.grupo);

  const rankingPriorizacao = [...gruposPendentes]
    .sort((left, right) => right.pontuacaoPrioridade - left.pontuacaoPrioridade || left.grupo - right.grupo)
    .map((item, index) => ({
      posicao: index + 1,
      grupo: item.grupo,
      nomeGrupo: item.nomeGrupo,
      statusAtual: item.statusAtual,
      pontuacaoPrioridade: item.pontuacaoPrioridade,
      riscoNormativo: item.riscoNormativo,
      relevanciaOperacional: item.relevanciaOperacional,
      complexidade: item.complexidade,
      recomendavelParaProximaConferencia: item.recomendavelParaProximaConferencia,
      criteriosPontuacao: item.criteriosPontuacao,
    }));

  const grupoRecomendado = gruposPendentes
    .filter((item) => item.recomendavelParaProximaConferencia)
    .sort((left, right) => right.pontuacaoPrioridade - left.pontuacaoPrioridade || left.grupo - right.grupo)[0] || null;

  const afterOperational21 = await repository.db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM licenciamento_atividades
      WHERE deleted_at IS NULL
        AND ativo = true
        AND codigo LIKE '21.%';
    `
  );

  const recomendacaoAdministrativa = 'Se a SMAD discordar da priorizacao tecnica, a alternativa segura e abrir fase administrativa de obtencao de fontes oficiais antes de qualquer seed.';
  const proximaFaseRecomendada = grupoRecomendado
    ? `Fase 2D.5E - Conferencia normativa detalhada do Grupo ${grupoRecomendado.grupo}`
    : 'Fase administrativa de obtencao de fontes oficiais complementares';

  return {
    fase: FASE_2D5D_PRIORIZACAO,
    objetivo: 'Priorização técnica dos grupos pendentes',
    totalGrupos: 25,
    gruposIntegralmenteParametrizados: mapa2d5b.grupos_parametrizados_integralmente || 0,
    gruposParciais: (mapa2d5b.grupos_parametrizados_parcialmente || 0) + (mapa2d5b.grupos_com_lacuna_normativa || 0),
    gruposBloqueados: gruposPendentes.filter((item) => String(item.statusAtual).includes('bloqueado')).length,
    gruposPendentes,
    lacunasCriticas: LACUNAS_CRITICAS_2D5D,
    rankingPriorizacao,
    grupoRecomendado: grupoRecomendado ? {
      grupo: grupoRecomendado.grupo,
      nomeGrupo: grupoRecomendado.nomeGrupo,
      pontuacaoPrioridade: grupoRecomendado.pontuacaoPrioridade,
      statusAtual: grupoRecomendado.statusAtual,
      riscoNormativo: grupoRecomendado.riscoNormativo,
      justificativa: `Grupo ${grupoRecomendado.grupo} combina fonte municipal confirmada, baixa complexidade relativa, ausencia de lacunas criticas conhecidas e boa relevancia operacional. A recomendacao e somente para conferencia detalhada, sem seed direto.`,
      proximaFase: proximaFaseRecomendada,
    } : {},
    justificativa: grupoRecomendado
      ? `O Grupo ${grupoRecomendado.grupo} foi priorizado porque apresenta melhor relacao entre fonte disponivel, baixa quantidade de lacunas conhecidas, complexidade controlavel e utilidade para a rotina da SMAD. O Grupo 21 permanece bloqueado e nao foi elegivel.`
      : 'Nenhum grupo possui combinacao minima de fonte clara, baixa lacuna e risco controlavel; recomenda-se obter fontes oficiais complementares.',
    proximaFaseRecomendada,
    recomendacaoAdministrativa,
    grupo21: {
      ...grupo21Resumo,
      statusAtual: 'bloqueado_por_insuficiencia_de_fonte_municipal',
      recomendado: false,
      seedPermitido: false,
    },
    criterios: {
      pesosPositivos: [
        { criterio: 'fonte_clara', pontos: 30 },
        { criterio: 'baixa_quantidade_lacunas', pontos: 20 },
        { criterio: 'alta_relevancia_operacional', pontos: 20 },
        { criterio: 'baixa_complexidade_normativa', pontos: 15 },
        { criterio: 'sinergia_assistente_pre_requerimentos', pontos: 10 },
        { criterio: 'grupo_correlato_parametrizado', pontos: 5 },
      ],
      penalidades: [
        { criterio: 'fonte_insuficiente', pontos: -40 },
        { criterio: 'lacunas_criticas', pontos: -30 },
        { criterio: 'ocr_inconsistente_ou_pendencia_visual', pontos: -20 },
        { criterio: 'ausencia_parametros_faixas_conferidos', pontos: -20 },
        { criterio: 'alto_risco_juridico', pontos: -30 },
      ],
    },
    seedPermitido: false,
    seedOperacionalCriado: false,
    atividadesIncluidas: [],
    tabelaOperacionalAlterada: Number(beforeOperational21.rows[0]?.total || 0) !== Number(afterOperational21.rows[0]?.total || 0),
    preservacaoFasesAnteriores: {
      fase2d5b: mapa2d5b.fase === '2D.5B',
      fase2d5c3b: grupo21Resumo.bloqueioFormalRegistrado === true,
    },
    alertas: [
      'Diagnostico nao decisorio: nao cria seed e nao cadastra atividade definitiva.',
      'Grupo 21 permanece bloqueado ate obtencao de fonte municipal complementar segura.',
      'Ranking serve para orientar a proxima conferencia normativa, nao para parametrizacao operacional imediata.',
    ],
  };
}

async function getParametrizacaoFase2D5CGrupo21ConferenciaStatus() {
  const mapa2d5b = await getParametrizacaoFase2D5BComplementacaoGruposStatus();
  const group21Map = (mapa2d5b.grupos || []).find((item) => Number(item.grupo) === 21) || null;
  const expectedCodes = ['21.01', '21.02', '21.03', '21.04', '21.05', '21.06', '21.07', '21.08', '21.09', '21.10'];
  const detailsByCode = new Map(DECRETO_021_GRUPO21_CONFERENCIA_FASE_2D5C.map((item) => [item.codigo, item]));
  const detalhes = expectedCodes.map((codigo) => detailsByCode.get(codigo)).filter(Boolean);

  const registeredResult = await repository.db.query(
    `
      SELECT codigo, nome
      FROM licenciamento_atividades
      WHERE deleted_at IS NULL
        AND ativo = true
        AND codigo = ANY($1)
      ORDER BY codigo;
    `,
    [expectedCodes]
  );
  const registeredCodes = registeredResult.rows.map((item) => item.codigo);
  const lacunas = detalhes.flatMap((item) => item.lacunas.map((lacuna) => ({
    grupo: 21,
    codigo: item.codigo,
    atividade: item.nomeAtividade,
    ...lacuna,
    status: 'aberta',
    fonte: item.fonte,
  })));
  const codigosConferidos = detalhes.filter((item) => item.statusConferencia === 'conferido');
  const codigosPendentes = detalhes.filter((item) => item.statusConferencia !== 'conferido');
  const codigosBloqueados = detalhes.filter((item) => item.aptoParaSeed !== true);
  const documentosPendentes = detalhes.filter((item) => item.documentos.length === 0).map((item) => item.codigo);
  const parametrosIdentificados = detalhes.filter((item) => item.parametroPrincipal && item.unidade).map((item) => item.codigo);
  const faixasIdentificadas = detalhes.filter((item) => item.faixas.length > 0).map((item) => item.codigo);
  const statusGeral = codigosConferidos.length === expectedCodes.length
    ? 'conferido_apto_para_seed'
    : 'pendente_conferencia_visual';

  return {
    fase: '2D.5C',
    titulo: 'Conferencia Normativa Detalhada do Grupo 21 - Obras e Estruturas Diversas',
    natureza: 'diagnostica_sem_seed_operacional',
    grupo: 21,
    nome_grupo: 'Obras e Estruturas Diversas',
    nomeGrupo: 'Obras e Estruturas Diversas',
    fonte: DECRETO_021_FASE_2D5B_FONTE_OFICIAL.referencia,
    fonte_arquivo: DECRETO_021_FASE_2D5B_FONTE_OFICIAL.arquivo,
    metodo_conferencia: 'Leitura do PDF oficial com apoio de OCR rotacionado. Fragmentos OCR nao sao usados como regra operacional sem conferencia visual humana.',
    total_codigos_esperados: expectedCodes.length,
    codigos_esperados: expectedCodes,
    codigos_identificados: detalhes.map((item) => item.codigo),
    total_codigos_identificados: detalhes.length,
    codigos_conferidos: codigosConferidos.map((item) => item.codigo),
    total_codigos_conferidos: codigosConferidos.length,
    codigos_pendentes: codigosPendentes.map((item) => item.codigo),
    total_codigos_pendentes: codigosPendentes.length,
    codigos_bloqueados: codigosBloqueados.map((item) => item.codigo),
    total_codigos_bloqueados: codigosBloqueados.length,
    codigos_cadastrados_no_banco: registeredCodes,
    percentual_identificacao: calculateCoveragePercent(detalhes.length, expectedCodes.length),
    percentual_conferencia: calculateCoveragePercent(codigosConferidos.length, expectedCodes.length),
    percentual_apto_para_seed: calculateCoveragePercent(detalhes.filter((item) => item.aptoParaSeed === true).length, expectedCodes.length),
    status_geral: statusGeral,
    apto_para_seed: false,
    seed_operacional_criado: false,
    atividades_incluidas: [],
    detalhes,
    lista_detalhada_codigos: detalhes,
    parametros_identificados: parametrosIdentificados,
    unidades_identificadas: detalhes.filter((item) => item.unidade).map((item) => ({ codigo: item.codigo, unidade: item.unidade })),
    faixas_identificadas: faixasIdentificadas,
    documentos_pendentes: documentosPendentes,
    lacunas,
    lacunas_resumo: [
      {
        tipo: 'conferencia_visual_faixas_classes',
        descricao: 'As colunas de faixas, classe, tipo de ato e limite de impacto local do Grupo 21 exigem conferencia visual no PDF oficial antes de seed.',
        codigos: expectedCodes,
        prioridade: 'alta',
      },
      {
        tipo: 'matriz_documental',
        descricao: 'Documentos minimos nao foram extraidos com seguranca do Anexo II-A e devem ser conferidos em matriz documental oficial.',
        codigos: expectedCodes,
        prioridade: 'alta',
      },
    ],
    dependencia_conferencia_humana: true,
    grupo21_no_mapa_2d5b: group21Map ? {
      status: group21Map.status,
      total_codigos_esperados: group21Map.total_codigos_esperados,
      total_codigos_cadastrados: group21Map.total_codigos_cadastrados,
      fonte_oficial_confirmada: group21Map.fonte_oficial_confirmada === true,
    } : null,
    preservacao_fases_anteriores: {
      ...(mapa2d5b.preservacao_fases_anteriores || {}),
      fase2d5b: mapa2d5b.fase === '2D.5B',
    },
    efeitos_produtivos_bloqueados: {
      dam_real: true,
      cobranca_oficial: true,
      protocolo_definitivo: true,
      decisao_administrativa_automatica: true,
      emissao_automatica_licenca: true,
      emissao_automatica_dispensa: true,
      emissao_automatica_ama: true,
    },
    alteracoes_protegidas: {
      taxa_alterada: false,
      vrte_alterado: false,
      matriz_operacional_alterada: false,
      norma_alterada: false,
      assistente_alterado: false,
      pre_requerimento_alterado: false,
    },
    recomendacao_proxima_fase: {
      fase: '2D.5C.1',
      titulo: 'Conferencia visual final do Grupo 21 para matriz de seed controlado',
      proximo_passo: 'conferencia_visual_pdf_e_matriz_documental',
      seed_direto_recomendado: false,
      justificativa: 'Os 10 codigos e nomes oficiais foram identificados, mas faixas, classes, tipo de ato e documentos ainda nao estao seguros para parametrizacao operacional.',
      criterios_saida: [
        'Confirmar visualmente operadores e colunas de todas as faixas do Grupo 21.',
        'Validar classe, tipo de ato e limite de impacto local de cada codigo.',
        'Conferir matriz documental oficial antes de criar perguntas, documentos e bloqueios.',
        'Registrar lacunas restantes antes de qualquer seed idempotente.',
      ],
    },
    mensagem: 'Fase 2D.5C diagnostica. Identifica os 10 codigos do Grupo 21, mas mantem todos bloqueados para seed ate conferencia visual e documental completa.',
  };
}

async function getParametrizacaoFase2D5C1Grupo21ConferenciaVisualStatus() {
  const fase2d5c = await getParametrizacaoFase2D5CGrupo21ConferenciaStatus();
  const expectedCodes = ['21.01', '21.02', '21.03', '21.04', '21.05', '21.06', '21.07', '21.08', '21.09', '21.10'];
  const codigos = DECRETO_021_GRUPO21_CONFERENCIA_VISUAL_FASE_2D5C1;
  const codigosIntegralmenteConferidos = codigos.filter((item) => item.statusConferencia === 'conferido_integralmente');
  const codigosComLacuna = codigos.filter((item) => item.statusConferencia === 'conferido_com_lacunas');
  const codigosBloqueados = codigos.filter((item) => item.aptoParaSeedFuturo !== true);
  const codigosAptosParaSeed = codigos.filter((item) => item.aptoParaSeedFuturo === true);
  const codigosVisualmenteConferidos = codigos.filter((item) => ['conferido_integralmente', 'conferido_com_lacunas'].includes(item.statusConferencia));
  const lacunas = codigos.flatMap((item) => item.lacunas.map((lacuna) => ({
    grupo: 21,
    codigo: item.codigo,
    atividade: item.nomeAtividade,
    fonte: item.fonte_normativa,
    paginaPdf: item.evidenciaVisual.paginaPdf,
    status: 'aberta',
    ...lacuna,
  })));
  const statusGeral = codigosIntegralmenteConferidos.length === expectedCodes.length
    ? 'pronto_para_seed_controlado'
    : codigosAptosParaSeed.length > 0
      ? 'pronto_parcialmente_com_bloqueios'
      : 'pendente_conferencia_humana';

  return {
    fase: '2D.5C.1',
    titulo: 'Fase 2D.5C.1 - Conferencia Visual do Grupo 21',
    natureza: 'diagnostica_conferencia_visual_sem_seed_operacional',
    grupo: 21,
    nomeGrupo: 'Obras e Estruturas Diversas',
    nome_grupo: 'Obras e Estruturas Diversas',
    fonte: 'Decreto Municipal n. 021/2020',
    fonte_normativa: DECRETO_021_FASE_2D5B_FONTE_OFICIAL.referencia,
    fonte_arquivo: DECRETO_021_FASE_2D5B_FONTE_OFICIAL.arquivo,
    metodo: 'conferencia_visual_pdf',
    metodo_conferencia: 'conferencia_visual_pdf',
    cabecalhoVisual: DECRETO_021_FASE_2D5C1_CABECALHO_VISUAL,
    cabecalho_visual: DECRETO_021_FASE_2D5C1_CABECALHO_VISUAL,
    totalCodigos: expectedCodes.length,
    total_codigos: expectedCodes.length,
    codigosEsperados: expectedCodes,
    codigos_esperados: expectedCodes,
    codigosVisualmenteConferidos: codigosVisualmenteConferidos.length,
    codigos_visual_conferidos: codigosVisualmenteConferidos.length,
    codigosConferidos: codigosIntegralmenteConferidos.length,
    codigos_conferidos_integralmente: codigosIntegralmenteConferidos.length,
    codigosComLacuna: codigosComLacuna.length,
    codigos_com_lacuna: codigosComLacuna.length,
    codigosBloqueados: codigosBloqueados.length,
    codigos_bloqueados: codigosBloqueados.length,
    statusGeral,
    status_geral: statusGeral,
    aptoParaSeed: false,
    apto_para_seed: false,
    seed_operacional_criado: false,
    atividades_incluidas: [],
    codigos,
    detalhes: codigos,
    lacunas,
    lacunasResumo: [
      {
        tipo: 'tipo_ato_licenca',
        descricao: 'O Anexo II-A nao apresenta ato/licenca especifico por faixa. A coluna Tipo = N foi conferida, mas nao equivale a LMS, LMU, dispensa ou AMA.',
        codigos: expectedCodes,
        prioridade: 'alta',
      },
      {
        tipo: 'documentos_minimos',
        descricao: 'Documentos minimos nao constam da tabela visualmente conferida; checklist documental permanece bloqueado.',
        codigos: expectedCodes,
        prioridade: 'alta',
      },
    ],
    lacunas_resumo: [
      {
        tipo: 'tipo_ato_licenca',
        descricao: 'O Anexo II-A nao apresenta ato/licenca especifico por faixa. A coluna Tipo = N foi conferida, mas nao equivale a LMS, LMU, dispensa ou AMA.',
        codigos: expectedCodes,
        prioridade: 'alta',
      },
      {
        tipo: 'documentos_minimos',
        descricao: 'Documentos minimos nao constam da tabela visualmente conferida; checklist documental permanece bloqueado.',
        codigos: expectedCodes,
        prioridade: 'alta',
      },
    ],
    preservacao_fases_anteriores: {
      ...(fase2d5c.preservacao_fases_anteriores || {}),
      fase2d5b: fase2d5c.preservacao_fases_anteriores?.fase2d5b === true,
      fase2d5c: fase2d5c.fase === '2D.5C',
    },
    efeitos_produtivos_bloqueados: {
      dam_real: true,
      cobranca_oficial: true,
      protocolo_definitivo: true,
      decisao_administrativa_automatica: true,
      emissao_automatica_licenca: true,
      emissao_automatica_dispensa: true,
      emissao_automatica_ama: true,
      seed_operacional: true,
    },
    alteracoes_protegidas: {
      seed_operacional_criado: false,
      taxa_alterada: false,
      vrte_alterado: false,
      matriz_operacional_alterada: false,
      norma_alterada: false,
      assistente_alterado: false,
      pre_requerimento_alterado: false,
      edocs_integrado: false,
      ia_integrada: false,
    },
    recomendacaoProximaFase: 'Fase 2D.5C.2 - Bancada de conferencia manual assistida do Grupo 21; no estado atual, nenhum codigo deve seguir para seed antes de validacao humana auditavel.',
    recomendacao_proxima_fase: {
      fase: '2D.5C.2',
      titulo: 'Bancada de conferencia manual assistida do Grupo 21',
      seed_direto_recomendado: false,
      seed_controlado_recomendado: false,
      justificativa: 'As faixas e limites do Anexo II-A foram conferidos visualmente para os 10 codigos, mas todos mantem lacunas de ato/licenca e documentos minimos; e necessario fluxo manual auditavel antes de qualquer seed.',
      pre_condicoes: [
        'Preencher e validar manualmente a matriz normativa na bancada interna.',
        'Validar se a SMAD adotara matriz operacional para converter classe simplificada/porte/potencial em tipo de licenca.',
        'Inserir fonte oficial ou validacao humana para documentos minimos.',
        'Manter todos os codigos bloqueados para seed ate saneamento dessas lacunas.',
      ],
    },
    mensagem: 'Fase diagnostica complementar. A conferencia visual confirmou linhas, colunas, operadores, portes, potencial poluidor e limite de impacto local do Grupo 21 no Anexo II-A, mas manteve todos os codigos bloqueados para seed por lacunas de ato/licenca e documentos minimos.',
  };
}

module.exports = {
  MENSAGEM_INSTITUCIONAL,
  SIMULACAO_STATUS,
  ruleMatchesValue,
  parameterMatches,
  ruleMatchesComposite,
  calculateFormulaValue,
  buildTaxaResponse,
  listEntity,
  getEntity,
  createEntity,
  updateEntity,
  deleteEntity,
  createNormaVinculo,
  deleteNormaVinculo,
  listPublicActivities,
  listPublicNormas,
  simulateEnquadramento,
  getPublicSimulation,
  getParametrizacaoStatus,
  getParametrizacaoFase2D1Status,
  getParametrizacaoFase2D2Status,
  getParametrizacaoFase2D21Status,
  getParametrizacaoFase2D3MapaDecretoStatus,
  getParametrizacaoFase2D4AGrupo19ConferenciaStatus,
  getParametrizacaoFase2D4BGrupo19Status,
  getParametrizacaoFase2D5AMapaPosGrupo19Status,
  getParametrizacaoFase2D5BComplementacaoGruposStatus,
  getParametrizacaoFase2D5DPriorizacaoGruposPendentes,
  getParametrizacaoFase2D5CGrupo21ConferenciaStatus,
  getParametrizacaoFase2D5C1Grupo21ConferenciaVisualStatus,
};
