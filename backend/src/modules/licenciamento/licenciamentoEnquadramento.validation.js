const {
  createValidationError,
  normalizeOptionalString,
  normalizePositiveInteger,
  normalizeString,
} = require('./licenciamento.validation');

const TEXT_LIMITS = Object.freeze({
  short: 40,
  medium: 120,
  long: 220,
  text: 3000,
});

const TIPO_PESSOA_OPTIONS = Object.freeze(['fisica', 'juridica']);
const TIPO_IMOVEL_OPTIONS = Object.freeze(['urbano', 'rural']);
const TAXA_STATUS = Object.freeze({
  ESTIMADA: 'estimada',
  VRTE_NAO_PARAMETRIZADA: 'vrte_nao_parametrizada',
  TAXA_NAO_PARAMETRIZADA: 'taxa_nao_parametrizada',
  FORMULA_PENDENTE: 'formula_pendente',
  NAO_PARAMETRIZADA: 'nao_parametrizada',
  REGRA_INCONSISTENTE: 'regra_inconsistente',
});
const TIPO_TAXA_OPTIONS = Object.freeze([
  'atividade_industrial_poluidora',
  'atividade_nao_industrial_degradadora',
  'licenciamento_simplificado',
  'autorizacao_ambiental',
  'servico_administrativo',
]);
const TIPO_ATIVIDADE_TAXA_OPTIONS = Object.freeze(['industrial', 'nao_industrial', 'servico_administrativo', 'outro']);
const FORMULA_SEGURA_OPTIONS = Object.freeze([
  'LMA_SOMA_LMP_LMI_LMO',
  'LMR_SOMA_LMP_LMI_LMO',
  'EIA_MULTIPLICA_5',
  'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
  'AREA_CONSTRUIDA_ESTOCAGEM_DIRETA',
  'TENSAO_KV_DIRETA',
  'AREA_INTERVENCAO_DIRETA',
  'LOTES_X_LOTES_X_AREA_HA_DIV_1000',
  'PARAMETRO_DIRETO',
  'REGRA_COMPOSTA_AREA_TALUDE',
  'UNIDADES_X_UNIDADES_X_AREA_HA_DIV_1000',
  'LEITOS_X_AREA_UTIL_HA',
  'M2_PARA_HA',
  'AREA_CONSTRUIDA_MAIS_ESTOCAGEM_M2_PARA_HA',
  'PARAMETRO_QUALITATIVO_TODOS',
  'CAPACIDADE_ARMAZENAMENTO_DIRETA',
  'QUANTIDADE_RECEBIDA_DIA_DIRETA',
  'PRODUCAO_DIA_DIRETA',
  'PRODUCAO_MES_DIRETA',
  'CAPACIDADE_INSTALADA_DIRETA',
  'AREA_UTIL_DIRETA',
  'NUMERO_LEITOS_DIRETA',
  'NUMERO_PESSOAS_DIRETA',
  'INDICE_AREA_CONSTRUIDA_ESTOCAGEM',
  'PARAMETRO_SANITARIO_QUALITATIVO',
]);
const TIPO_CALCULO_OPTIONS = Object.freeze([
  'nenhum',
  'soma',
  'multiplicacao',
  'formula_predefinida',
]);
const LIMITE_IMPACTO_LOCAL_OPTIONS = Object.freeze(['todos', 'valor_maximo', 'nao_aplicavel']);

function sanitizeText(value, maxLength = TEXT_LIMITS.text, fieldName = 'campo', { required = false } = {}) {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (required && !text) {
    throw createValidationError(`Campo obrigatorio: ${fieldName}.`, { field: fieldName });
  }

  if (text.length > maxLength) {
    throw createValidationError(`Campo muito longo: ${fieldName}.`, { field: fieldName, maxLength });
  }

  return text || null;
}

function requireText(value, fieldName, maxLength = TEXT_LIMITS.long) {
  return sanitizeText(value, maxLength, fieldName, { required: true });
}

function normalizeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  return Boolean(value);
}

function normalizeNumber(value, fieldName, { required = false, min = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createValidationError(`Campo obrigatorio: ${fieldName}.`, { field: fieldName });
    }

    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw createValidationError(`Campo numerico invalido: ${fieldName}.`, { field: fieldName });
  }

  if (min !== null && parsed < min) {
    throw createValidationError(`Campo abaixo do valor minimo: ${fieldName}.`, { field: fieldName, min });
  }

  return parsed;
}

function normalizeInteger(value, fieldName, { required = false, min = null } = {}) {
  const parsed = normalizeNumber(value, fieldName, { required, min });
  if (parsed === null) return null;

  if (!Number.isInteger(parsed)) {
    throw createValidationError(`Campo inteiro invalido: ${fieldName}.`, { field: fieldName });
  }

  return parsed;
}

function normalizeJsonObject(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // falls through to validation error
    }
  }

  throw createValidationError(`JSON invalido: ${fieldName}.`, { field: fieldName });
}

function normalizeJsonValue(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'object') return value;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      // falls through to validation error
    }
  }

  throw createValidationError(`JSON invalido: ${fieldName}.`, { field: fieldName });
}

function normalizeOption(value, fieldName, allowed, { required = false, defaultValue = null } = {}) {
  const normalized = sanitizeText(value, TEXT_LIMITS.medium, fieldName);

  if (!normalized) {
    if (required) {
      throw createValidationError(`Campo obrigatorio: ${fieldName}.`, { field: fieldName, allowed });
    }

    return defaultValue;
  }

  if (!allowed.includes(normalized)) {
    throw createValidationError(`Opcao invalida: ${fieldName}.`, { field: fieldName, allowed });
  }

  return normalized;
}

function normalizeDateOnly(value, fieldName) {
  const normalized = sanitizeText(value, 10, fieldName);
  if (!normalized) return null;

  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw createValidationError(`Data invalida: ${fieldName}.`, { field: fieldName });
  }

  return normalized.slice(0, 10);
}

function normalizeEmail(value, fieldName = 'email') {
  const email = sanitizeText(value, 160, fieldName);
  if (!email) return null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createValidationError('E-mail invalido.', { field: fieldName });
  }

  return email;
}

function normalizePhone(value, fieldName = 'telefone') {
  const phone = sanitizeText(value, 40, fieldName);
  if (!phone) return null;

  if (phone.replace(/\D/g, '').length < 8) {
    throw createValidationError('Telefone invalido.', { field: fieldName });
  }

  return phone;
}

function validateRange(payload) {
  if (
    payload.valor_minimo !== null
    && payload.valor_maximo !== null
    && payload.valor_minimo > payload.valor_maximo
  ) {
    throw createValidationError('Valor minimo nao pode ser maior que valor maximo.', {
      field: 'valor_minimo',
    });
  }
}

function validateVigencia(payload) {
  if (payload.vigencia_inicio && payload.vigencia_fim && payload.vigencia_fim < payload.vigencia_inicio) {
    throw createValidationError('Vigencia final nao pode ser anterior a inicial.', {
      field: 'vigencia_fim',
    });
  }
}

function validateAtividadePayload(payload = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'codigo')) {
    data.codigo = requireText(payload.codigo, 'codigo', TEXT_LIMITS.short);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'nome')) {
    data.nome = requireText(payload.nome, 'nome', TEXT_LIMITS.long);
  }

  [
    ['descricao', TEXT_LIMITS.text],
    ['categoria', TEXT_LIMITS.medium],
    ['cnae', TEXT_LIMITS.short],
    ['unidade_parametro_principal', TEXT_LIMITS.short],
    ['parametro_principal_label', TEXT_LIMITS.medium],
    ['potencial_poluidor_padrao', TEXT_LIMITS.short],
    ['observacoes', TEXT_LIMITS.text],
    ['limite_impacto_local_unidade', TEXT_LIMITS.short],
    ['mensagem_extrapolacao_competencia', TEXT_LIMITS.text],
    ['expressao_original', TEXT_LIMITS.text],
    ['fundamento_normativo', TEXT_LIMITS.text],
    ['tipo_atividade', TEXT_LIMITS.short],
    ['formula_codigo', TEXT_LIMITS.medium],
    ['seed_piloto_codigo', TEXT_LIMITS.medium],
  ].forEach(([field, max]) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = sanitizeText(payload[field], max, field);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'limite_impacto_local_tipo')) {
    data.limite_impacto_local_tipo = normalizeOption(
      payload.limite_impacto_local_tipo,
      'limite_impacto_local_tipo',
      LIMITE_IMPACTO_LOCAL_OPTIONS,
      { defaultValue: null }
    );
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'limite_impacto_local_valor')) {
    data.limite_impacto_local_valor = normalizeNumber(payload.limite_impacto_local_valor, 'limite_impacto_local_valor', {
      min: 0,
    });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ativo')) {
    data.ativo = normalizeBoolean(payload.ativo, true);
  }

  ['parametros_entrada', 'perguntas_publicas', 'bloqueios_publicos', 'alertas_publicos', 'validacoes_requeridas'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeJsonValue(payload[field], field);
    }
  });

  return data;
}

function validateTipoLicencaPayload(payload = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'codigo')) {
    data.codigo = requireText(payload.codigo, 'codigo', TEXT_LIMITS.short).toUpperCase();
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'nome')) {
    data.nome = requireText(payload.nome, 'nome', 160);
  }

  ['descricao', 'natureza'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = sanitizeText(payload[field], field === 'natureza' ? 80 : TEXT_LIMITS.text, field);
    }
  });

  ['exige_analise_tecnica', 'permite_emissao_publica', 'ativo'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeBoolean(payload[field], field === 'ativo');
    }
  });

  return data;
}

function validatePotencialPayload(payload = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'codigo')) {
    data.codigo = requireText(payload.codigo, 'codigo', TEXT_LIMITS.short).toLowerCase();
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'nome')) {
    data.nome = requireText(payload.nome, 'nome', TEXT_LIMITS.medium);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'peso')) {
    data.peso = normalizeInteger(payload.peso, 'peso', { min: 0 }) || 0;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'descricao')) {
    data.descricao = sanitizeText(payload.descricao, TEXT_LIMITS.text, 'descricao');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ativo')) {
    data.ativo = normalizeBoolean(payload.ativo, true);
  }

  return data;
}

function validateClassePayload(payload = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'codigo')) {
    data.codigo = requireText(payload.codigo, 'codigo', TEXT_LIMITS.short).toLowerCase();
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'nome')) {
    data.nome = requireText(payload.nome, 'nome', TEXT_LIMITS.medium);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'descricao')) {
    data.descricao = sanitizeText(payload.descricao, TEXT_LIMITS.text, 'descricao');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ordem')) {
    data.ordem = normalizeInteger(payload.ordem, 'ordem', { min: 0 }) || 0;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ativo')) {
    data.ativo = normalizeBoolean(payload.ativo, true);
  }

  return data;
}

function validateRegraPayload(payload = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'atividade_id')) {
    data.atividade_id = normalizePositiveInteger(payload.atividade_id, 'atividade_id', { required: true });
  }

  ['tipo_licenca_id', 'classe_id', 'potencial_poluidor_id'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizePositiveInteger(payload[field], field);
    }
  });

  [
    'parametro_nome',
    'parametro_unidade',
    'operador',
    'porte_resultante',
    'observacao_publica',
    'observacao_interna',
    'fundamento_normativo',
    'expressao_original',
    'limite_impacto_local_unidade',
    'mensagem_extrapolacao_competencia',
    'formula_codigo',
    'status_resultado',
    'tipo_resultado',
    'seed_piloto_codigo',
  ].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = sanitizeText(payload[field], field.includes('observacao') || field === 'fundamento_normativo'
        ? TEXT_LIMITS.text
        : TEXT_LIMITS.medium, field);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'operador')) {
    data.operador = data.operador || 'faixa';
  }

  ['valor_minimo', 'valor_maximo'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeNumber(payload[field], field);
    }
  });

  [
    'dispensa_possivel',
    'exige_vistoria',
    'exige_estudo_ambiental',
    'exige_anuencia',
    'exige_georreferenciamento',
    'requer_validacao_tecnica',
    'ativo',
  ].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeBoolean(payload[field], field === 'ativo');
    }
  });

  ['vigencia_inicio', 'vigencia_fim'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeDateOnly(payload[field], field);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'limite_impacto_local_tipo')) {
    data.limite_impacto_local_tipo = normalizeOption(
      payload.limite_impacto_local_tipo,
      'limite_impacto_local_tipo',
      LIMITE_IMPACTO_LOCAL_OPTIONS,
      { defaultValue: null }
    );
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'limite_impacto_local_valor')) {
    data.limite_impacto_local_valor = normalizeNumber(payload.limite_impacto_local_valor, 'limite_impacto_local_valor', {
      min: 0,
    });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'tipo_calculo')) {
    data.tipo_calculo = normalizeOption(payload.tipo_calculo, 'tipo_calculo', TIPO_CALCULO_OPTIONS, {
      defaultValue: 'nenhum',
    });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'parametros_entrada')) {
    data.parametros_entrada = normalizeJsonObject(payload.parametros_entrada, 'parametros_entrada');
  }

  ['alertas_tecnicos', 'bloqueios'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeJsonValue(payload[field], field);
    }
  });

  validateRange(data);
  validateVigencia(data);

  if (!partial && !data.tipo_licenca_id && !data.dispensa_possivel) {
    throw createValidationError('Informe tipo de licenca ou marque dispensa possivel.', {
      field: 'tipo_licenca_id',
    });
  }

  return data;
}

function validateRegraParametroPayload(payload = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'regra_enquadramento_id')) {
    data.regra_enquadramento_id = normalizePositiveInteger(payload.regra_enquadramento_id, 'regra_enquadramento_id', {
      required: true,
    });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'parametro_chave')) {
    data.parametro_chave = requireText(payload.parametro_chave, 'parametro_chave', 80)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'parametro_label')) {
    data.parametro_label = requireText(payload.parametro_label, 'parametro_label', 160);
  }

  ['parametro_unidade', 'operador', 'expressao_original'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = sanitizeText(payload[field], field === 'expressao_original' ? TEXT_LIMITS.text : TEXT_LIMITS.medium, field);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'operador')) {
    data.operador = data.operador || 'faixa';
  }

  ['valor_minimo', 'valor_maximo'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeNumber(payload[field], field);
    }
  });

  ['inclui_minimo', 'inclui_maximo', 'obrigatorio'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeBoolean(payload[field], true);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ordem')) {
    data.ordem = normalizeInteger(payload.ordem, 'ordem', { min: 0 }) || 0;
  }

  validateRange(data);

  return data;
}

function validateDocumentoPayload(payload = {}, { partial = false } = {}) {
  const data = {};

  ['atividade_id', 'regra_enquadramento_id', 'tipo_licenca_id'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizePositiveInteger(payload[field], field);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'nome_documento')) {
    data.nome_documento = requireText(payload.nome_documento, 'nome_documento', 180);
  }

  ['descricao', 'fundamento'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = sanitizeText(payload[field], TEXT_LIMITS.text, field);
    }
  });

  [
    'obrigatorio',
    'aplicavel_pessoa_fisica',
    'aplicavel_pessoa_juridica',
    'aplicavel_imovel_rural',
    'aplicavel_imovel_urbano',
    'ativo',
  ].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeBoolean(payload[field], true);
    }
  });

  ['exige_responsavel_tecnico', 'exige_art_rrt'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeBoolean(payload[field], false);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ordem')) {
    data.ordem = normalizeInteger(payload.ordem, 'ordem', { min: 0 }) || 0;
  }

  if (!partial && !data.atividade_id && !data.regra_enquadramento_id && !data.tipo_licenca_id) {
    throw createValidationError('Documento precisa estar vinculado a atividade, regra ou tipo de licenca.', {
      field: 'vinculo',
    });
  }

  return data;
}

function validateTaxaPayload(payload = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'tipo_licenca_id')) {
    data.tipo_licenca_id = normalizePositiveInteger(payload.tipo_licenca_id, 'tipo_licenca_id');
  }

  ['classe_id', 'potencial_poluidor_id'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizePositiveInteger(payload[field], field);
    }
  });

  [
    'porte',
    'formula',
    'unidade_referencia',
    'observacao',
    'tipo_atividade',
    'servico_administrativo_codigo',
    'formula_codigo',
    'formula_descricao',
    'fundamento_normativo',
  ].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = sanitizeText(payload[field], field === 'formula'
        || field === 'observacao'
        || field === 'formula_descricao'
        || field === 'fundamento_normativo'
        ? TEXT_LIMITS.text
        : TEXT_LIMITS.medium, field);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'valor_fixo')) {
    data.valor_fixo = normalizeNumber(payload.valor_fixo, 'valor_fixo', { min: 0 });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'quantidade_vrte')) {
    data.quantidade_vrte = normalizeNumber(payload.quantidade_vrte, 'quantidade_vrte', { min: 0 });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'fator_padrao')) {
    data.fator_padrao = normalizeNumber(payload.fator_padrao, 'fator_padrao', { min: 0 }) ?? 1;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'tipo_taxa')) {
    data.tipo_taxa = normalizeOption(payload.tipo_taxa, 'tipo_taxa', TIPO_TAXA_OPTIONS, { defaultValue: null });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'tipo_atividade')) {
    data.tipo_atividade = normalizeOption(payload.tipo_atividade, 'tipo_atividade', TIPO_ATIVIDADE_TAXA_OPTIONS, {
      defaultValue: null,
    });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'usa_formula')) {
    data.usa_formula = normalizeBoolean(payload.usa_formula, false);
  }

  ['vigencia_inicio', 'vigencia_fim'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeDateOnly(payload[field], field);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ativo')) {
    data.ativo = normalizeBoolean(payload.ativo, true);
  }

  validateVigencia(data);

  if (data.formula && /eval|function|=>|require|process|global|constructor/i.test(data.formula)) {
    throw createValidationError('Formula contem termos nao permitidos para parametrizacao.', {
      field: 'formula',
    });
  }

  if (data.formula_codigo && !FORMULA_SEGURA_OPTIONS.includes(data.formula_codigo)) {
    throw createValidationError('Codigo de formula nao permitido.', {
      field: 'formula_codigo',
      allowed: FORMULA_SEGURA_OPTIONS,
    });
  }

  if (!partial && !data.tipo_licenca_id && data.tipo_taxa !== 'servico_administrativo') {
    throw createValidationError('Informe tipo de licenca ou classifique a taxa como servico administrativo.', {
      field: 'tipo_licenca_id',
    });
  }

  return data;
}

function validateVrtePayload(payload = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ano')) {
    data.ano = normalizeInteger(payload.ano, 'ano', { required: true, min: 2000 });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'valor_vrte')) {
    data.valor_vrte = normalizeNumber(payload.valor_vrte, 'valor_vrte', { required: true, min: 0 });
  }

  ['data_inicio_vigencia', 'data_fim_vigencia'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeDateOnly(payload[field], field);
    }
  });

  ['fundamento_normativo', 'observacao'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = sanitizeText(payload[field], TEXT_LIMITS.text, field);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ativo')) {
    data.ativo = normalizeBoolean(payload.ativo, true);
  }

  if (data.data_inicio_vigencia && data.data_fim_vigencia && data.data_fim_vigencia < data.data_inicio_vigencia) {
    throw createValidationError('Vigencia final nao pode ser anterior a inicial.', {
      field: 'data_fim_vigencia',
    });
  }

  return data;
}

function validateNormaPayload(payload = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'codigo')) {
    data.codigo = sanitizeText(payload.codigo, TEXT_LIMITS.medium, 'codigo');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'titulo')) {
    data.titulo = requireText(payload.titulo, 'titulo', 220);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'tipo')) {
    data.tipo = requireText(payload.tipo, 'tipo', TEXT_LIMITS.short).toLowerCase();
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'esfera')) {
    data.esfera = requireText(payload.esfera, 'esfera', TEXT_LIMITS.short).toLowerCase();
  }

  ['numero', 'orgao', 'ementa', 'link_url', 'observacao'].forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = sanitizeText(payload[field], field === 'ementa' || field === 'observacao'
        ? TEXT_LIMITS.text
        : 220, field);
    }
  });

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ano')) {
    data.ano = normalizeInteger(payload.ano, 'ano', { min: 1800 });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'arquivo_documento_id')) {
    data.arquivo_documento_id = normalizePositiveInteger(payload.arquivo_documento_id, 'arquivo_documento_id');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'ativo')) {
    data.ativo = normalizeBoolean(payload.ativo, true);
  }

  return data;
}

function validateNormaVinculoPayload(payload = {}) {
  const data = {
    atividade_id: normalizePositiveInteger(payload.atividade_id, 'atividade_id'),
    regra_enquadramento_id: normalizePositiveInteger(payload.regra_enquadramento_id, 'regra_enquadramento_id'),
    tipo_licenca_id: normalizePositiveInteger(payload.tipo_licenca_id, 'tipo_licenca_id'),
    descricao_vinculo: sanitizeText(payload.descricao_vinculo, TEXT_LIMITS.text, 'descricao_vinculo'),
  };

  if (!data.atividade_id && !data.regra_enquadramento_id && !data.tipo_licenca_id) {
    throw createValidationError('Vinculo de norma precisa referenciar atividade, regra ou tipo de licenca.', {
      field: 'vinculo',
    });
  }

  return data;
}

function normalizeAdminFilters(query = {}) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || 20);

  return {
    q: sanitizeText(query.q, 120, 'q'),
    categoria: sanitizeText(query.categoria, 120, 'categoria'),
    codigo: sanitizeText(query.codigo, 40, 'codigo'),
    tipo: sanitizeText(query.tipo, 40, 'tipo'),
    esfera: sanitizeText(query.esfera, 40, 'esfera'),
    atividade_id: normalizePositiveInteger(query.atividade_id, 'atividade_id'),
    regra_enquadramento_id: normalizePositiveInteger(query.regra_enquadramento_id, 'regra_enquadramento_id'),
    status: normalizeOptionalString(query.status),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    page_size: Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20,
  };
}

function validateSimulacaoPayload(payload = {}) {
  const tipoPessoa = normalizeString(payload.tipo_pessoa || 'juridica').toLowerCase();
  const tipoImovel = normalizeString(payload.tipo_imovel || 'urbano').toLowerCase();

  if (!TIPO_PESSOA_OPTIONS.includes(tipoPessoa)) {
    throw createValidationError('Tipo de pessoa invalido.', { field: 'tipo_pessoa', allowed: TIPO_PESSOA_OPTIONS });
  }

  if (!TIPO_IMOVEL_OPTIONS.includes(tipoImovel)) {
    throw createValidationError('Tipo de imovel invalido.', { field: 'tipo_imovel', allowed: TIPO_IMOVEL_OPTIONS });
  }

  const parametrosInformados = normalizeJsonObject(payload.parametros_informados || payload.parametros, 'parametros_informados') || {};
  const respostasCondicionais = normalizeJsonObject(
    payload.respostas_condicionais || payload.condicionantes || {},
    'respostas_condicionais'
  ) || {};
  const valorParametro = payload.valor_parametro === undefined || payload.valor_parametro === null || payload.valor_parametro === ''
    ? null
    : normalizeNumber(payload.valor_parametro, 'valor_parametro', { min: 0 });

  if (valorParametro === null && Object.keys(parametrosInformados).length === 0) {
    throw createValidationError('Informe o parametro principal ou os parametros compostos da simulacao.', {
      field: 'valor_parametro',
    });
  }

  return {
    atividade_id: normalizePositiveInteger(payload.atividade_id, 'atividade_id', { required: true }),
    valor_parametro: valorParametro,
    parametros_informados: parametrosInformados,
    respostas_condicionais: respostasCondicionais,
    parametro_unidade: sanitizeText(payload.parametro_unidade, TEXT_LIMITS.short, 'parametro_unidade'),
    tipo_pessoa: tipoPessoa,
    tipo_imovel: tipoImovel,
    possui_intervencao_app: normalizeBoolean(payload.possui_intervencao_app, false),
    possui_supressao_vegetacao: normalizeBoolean(payload.possui_supressao_vegetacao, false),
    possui_uso_recursos_hidricos: normalizeBoolean(payload.possui_uso_recursos_hidricos, false),
    gera_residuos: normalizeBoolean(payload.gera_residuos, false),
    nome_interessado: sanitizeText(payload.nome_interessado, 160, 'nome_interessado'),
    email_interessado: normalizeEmail(payload.email_interessado, 'email_interessado'),
    telefone_interessado: normalizePhone(payload.telefone_interessado, 'telefone_interessado'),
  };
}

module.exports = {
  TAXA_STATUS,
  TIPO_CALCULO_OPTIONS,
  TIPO_IMOVEL_OPTIONS,
  TIPO_PESSOA_OPTIONS,
  TIPO_TAXA_OPTIONS,
  TIPO_ATIVIDADE_TAXA_OPTIONS,
  FORMULA_SEGURA_OPTIONS,
  sanitizeText,
  normalizeBoolean,
  normalizeNumber,
  validateAtividadePayload,
  validateTipoLicencaPayload,
  validatePotencialPayload,
  validateClassePayload,
  validateRegraPayload,
  validateRegraParametroPayload,
  validateDocumentoPayload,
  validateTaxaPayload,
  validateVrtePayload,
  validateNormaPayload,
  validateNormaVinculoPayload,
  validateSimulacaoPayload,
  normalizeAdminFilters,
};
