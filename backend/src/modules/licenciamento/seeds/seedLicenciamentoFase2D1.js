const db = require('../../../config/db');

const TARGET_GROUP_CODES = ['18', '20', '22', '24'];
const TARGET_ACTIVITY_CODES = [
  '18.01', '18.02', '18.03', '18.04', '18.05', '18.06', '18.07', '18.08', '18.09', '18.10', '18.11', '18.12', '18.13', '18.14', '18.15', '18.16', '18.17',
  '20.01', '20.02', '20.03', '20.04', '20.05', '20.06', '20.07', '20.08', '20.09', '20.10', '20.11',
  '22.01', '22.02', '22.03', '22.04', '22.05', '22.06', '22.07', '22.08', '22.09', '22.10', '22.11',
  '24.01', '24.02', '24.03', '24.04', '24.05', '24.06', '24.07',
];

const GROUP_CATEGORIES = Object.freeze({
  18: 'Uso e Ocupacao do Solo',
  20: 'Gerenciamento de Residuos',
  22: 'Armazenamento e Estocagem',
  24: 'Atividades Diversas',
});

const GROUP_VALIDATIONS = Object.freeze({
  18: [
    'exige_validacao_app',
    'exige_validacao_supressao',
    'exige_validacao_drenagem',
    'exige_validacao_saneamento',
    'exige_validacao_urbanistica',
    'exige_validacao_geotecnica',
    'exige_validacao_terraplenagem',
    'exige_validacao_regularizacao_fundiaria',
    'exige_validacao_area_risco',
  ],
  20: [
    'exige_classificacao_residuo',
    'exige_validacao_classe_i',
    'exige_validacao_rcc',
    'exige_validacao_oleo',
    'exige_validacao_compostagem',
    'exige_validacao_agrotoxico',
    'exige_validacao_efluente',
    'exige_validacao_impermeabilizacao',
    'exige_validacao_drenagem',
    'exige_validacao_destinacao',
    'exige_validacao_app',
  ],
  22: [
    'exige_validacao_quimicos',
    'exige_validacao_combustivel',
    'exige_validacao_gas',
    'exige_validacao_produto_perigoso',
    'exige_validacao_lavagem',
    'exige_validacao_manutencao',
    'exige_validacao_drenagem_contaminada',
  ],
  24: [
    'exige_validacao_combustivel',
    'exige_validacao_tanque',
    'exige_validacao_lavagem',
    'exige_validacao_manutencao',
    'exige_validacao_efluente_oleoso',
    'exige_validacao_canteiro',
    'exige_validacao_delegacao',
  ],
});

const COMMON_DOCS = [
  'Requerimento padrao',
  'Formulario de enquadramento',
  'Documento',
  'Contrato social, quando aplicavel',
  'Comprovante de endereco',
  'Anuencia municipal de uso e ocupacao do solo',
  'Matricula ou documento do imovel',
  'Planta de localizacao',
  'Poligonal georreferenciada, quando aplicavel',
  'Memorial descritivo',
  'Layout operacional',
  'ART/RRT, quando aplicavel',
];

const GROUP_DOCS = Object.freeze({
  18: [
    'Projeto urbanistico ou layout de implantacao',
    'Projeto de drenagem',
    'Manifestacao sobre APP, quando aplicavel',
    'Autorizacao de supressao vegetal, quando aplicavel',
    'Estudo geotecnico, quando aplicavel',
  ],
  20: [
    'Plano de Gerenciamento de Residuos Solidos',
    'Comprovantes ou contratos de destinacao de residuos',
    'Classificacao dos residuos',
    'Projeto de impermeabilizacao e drenagem',
    'Documento tecnico de operacao do sistema',
  ],
  22: [
    'Memorial de armazenamento e estocagem',
    'Projeto de contencao, quando houver produto perigoso ou combustivel',
    'Plano de emergencia, quando aplicavel',
    'AVCB/CBMES ou protocolo, quando aplicavel',
    'Projeto de drenagem contaminada, quando aplicavel',
  ],
  24: [
    'Projeto de SSAO, quando houver oleo, lavagem ou combustivel',
    'Plano de emergencia, quando aplicavel',
    'Projeto de tanque ou armazenamento de combustivel, quando aplicavel',
    'Comprovacao de atividade principal licenciada ou dispensada, quando canteiro',
    'Comprovacao de delegacao formal, quando atividade delegada',
  ],
});

function json(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function question(chave, label, tipo = 'boolean', unidade = null, ajuda = null) {
  return { chave, label, tipo, unidade, ajuda };
}

function alert(message, severidade = 'atencao') {
  return { severidade, mensagem: message };
}

function block(codigo, mensagem, sugestao = null) {
  return { codigo, mensagem, sugestao_codigo_atividade: sugestao };
}

function groupOf(codigo) {
  return String(codigo).split('.')[0];
}

function classFor(potencial, porte) {
  if (porte === 'simplificado') return { tipoLicenca: 'LMS', classe: 'simplificada' };
  if (potencial === 'baixo') {
    if (porte === 'pequeno') return { tipoLicenca: 'LMS', classe: 'simplificada' };
    return { tipoLicenca: 'LMU', classe: 'classe_i' };
  }
  if (potencial === 'alto') {
    if (porte === 'pequeno') return { tipoLicenca: 'LMU', classe: 'classe_ii' };
    if (porte === 'medio') return { tipoLicenca: 'LMU', classe: 'classe_iii' };
    return { tipoLicenca: 'LMU', classe: 'classe_iv' };
  }
  if (porte === 'pequeno') return { tipoLicenca: 'LMU', classe: 'classe_i' };
  if (porte === 'medio') return { tipoLicenca: 'LMU', classe: 'classe_ii' };
  return { tipoLicenca: 'LMU', classe: 'classe_iii' };
}

function rule(suffix, porte, min, max, options = {}) {
  const potential = options.potencial || options.potential || 'medio';
  const derived = options.status === 'possivel_dispensa_verificar'
    ? { tipoLicenca: null, classe: null }
    : classFor(potential, porte);

  return {
    suffix,
    porte,
    min,
    max,
    operador: options.operador || 'faixa',
    tipoLicenca: options.tipoLicenca === undefined ? derived.tipoLicenca : options.tipoLicenca,
    classe: options.classe === undefined ? derived.classe : options.classe,
    potencial: potential,
    status: options.status || 'requer_validacao_tecnica',
    formula: options.formula,
    expressao: options.expressao,
    requerValidacao: options.requerValidacao,
    observacaoInterna: options.observacaoInterna,
    alertas: options.alertas || [],
    bloqueios: options.bloqueios || [],
  };
}

function directRules(potencial, entries, formula = 'PARAMETRO_DIRETO') {
  return entries.map((entry) => rule(entry.suffix, entry.porte, entry.min, entry.max, {
    potencial,
    operador: entry.operador,
    formula,
    status: entry.status,
    tipoLicenca: entry.tipoLicenca,
    classe: entry.classe,
    observacaoInterna: entry.observacaoInterna,
    expressao: entry.expressao,
  }));
}

function activity(codigo, nome, descricao, options) {
  const grupo = groupOf(codigo);
  const docs = [...COMMON_DOCS, ...(GROUP_DOCS[grupo] || []), ...(options.docs || [])];
  return {
    codigo,
    nome,
    descricao,
    categoria: GROUP_CATEGORIES[grupo],
    grupo,
    tipo_atividade: options.tipo_atividade || 'nao_industrial',
    unidade_parametro_principal: options.unidade || 'unidade',
    parametro_principal_label: options.parametro || 'Parametro principal',
    potencial_poluidor_padrao: options.potencial || 'medio',
    limite_impacto_local_tipo: options.limiteTipo || 'todos',
    limite_impacto_local_valor: options.limiteValor || null,
    limite_impacto_local_unidade: options.limiteUnidade || options.unidade || null,
    mensagem_extrapolacao_competencia: options.mensagemLimite || null,
    expressao_original: options.expressao || null,
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A e Anexo II-A',
    observacoes: options.observacoes || null,
    formula_codigo: options.formula || 'PARAMETRO_DIRETO',
    parametros_entrada: options.parametros_entrada || [],
    perguntas_publicas: options.perguntas || [],
    bloqueios_publicos: options.bloqueios || [],
    alertas_publicos: options.alertas || [],
    validacoes_requeridas: [...(GROUP_VALIDATIONS[grupo] || []), ...(options.validacoes || [])],
    regras: options.regras || [],
    docs,
  };
}

const ACTIVITIES = [
  activity('18.01', 'Loteamento predominantemente residencial ou habitacional popular', 'Loteamento predominantemente residencial ou para unidades habitacionais populares.', {
    unidade: 'indice',
    parametro: 'Indice: lotes x lotes x area total ha / 1000',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 3000,
    formula: 'LOTES_X_LOTES_X_AREA_HA_DIV_1000',
    parametros_entrada: ['numero_lotes', 'area_total_ha'],
    perguntas: [
      question('numero_lotes', 'Numero total de lotes', 'number'),
      question('area_total_ha', 'Area total em hectares', 'number', 'ha'),
      question('abertura_vias', 'Havera abertura de vias?'),
      question('terraplenagem', 'Havera terraplenagem?'),
      question('supressao', 'Havera supressao vegetal?'),
      question('intervencao_app', 'Havera intervencao em APP?'),
      question('drenagem', 'Havera drenagem?'),
      question('abastecimento_agua', 'Havera abastecimento de agua?'),
      question('esgotamento_sanitario', 'Havera esgotamento sanitario?'),
      question('area_urbana_ou_rural', 'Area urbana ou rural?', 'select'),
      question('anuencia_uso_solo', 'Ha anuencia municipal de uso e ocupacao do solo?'),
      question('condominio_horizontal', 'Trata-se de condominio horizontal?'),
    ],
    bloqueios: [block('18_01_CONDOMINIO_HORIZONTAL', 'Se for condominio horizontal, avaliar 18.02.', '18.02')],
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 80, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 80, max: 600 },
      { suffix: 'grande', porte: 'grande', min: 600, max: 3000 },
    ], 'LOTES_X_LOTES_X_AREA_HA_DIV_1000'),
  }),
  activity('18.02', 'Condominios horizontais', 'Condominios horizontais.', {
    unidade: 'indice',
    parametro: 'Indice: lotes x lotes x area total ha / 1000',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 3000,
    formula: 'LOTES_X_LOTES_X_AREA_HA_DIV_1000',
    parametros_entrada: ['numero_lotes', 'area_total_ha'],
    perguntas: [question('numero_lotes', 'Numero de unidades/lotes', 'number'), question('area_total_ha', 'Area total em hectares', 'number', 'ha'), question('loteamento_abertura_vias', 'Ha caracteristica de loteamento com abertura de vias?'), question('lotes_autonomos', 'Ha lotes autonomos?')],
    bloqueios: [block('18_02_LOTEAMENTO', 'Se for loteamento com vias ou lotes autonomos, avaliar 18.01.', '18.01')],
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 80, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 80, max: 600 },
      { suffix: 'grande', porte: 'grande', min: 600, max: 3000 },
    ], 'LOTES_X_LOTES_X_AREA_HA_DIV_1000'),
  }),
  activity('18.03', 'Parcelamento do solo por desmembramento', 'Parcelamento do solo exclusivamente sob forma de desmembramento.', {
    unidade: 'todos',
    parametro: 'Todos',
    potencial: 'baixo',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    perguntas: [question('abertura_vias', 'Havera abertura de vias?'), question('infraestrutura_nova', 'Havera infraestrutura nova?'), question('area_total_ha', 'Area total em hectares', 'number', 'ha')],
    bloqueios: [block('18_03_VIAS_INFRA', 'Se houver vias ou infraestrutura nova, avaliar 18.01.', '18.01')],
    regras: [rule('todos', 'simplificado', null, null, { potencial: 'baixo', operador: 'qualquer', formula: 'PARAMETRO_QUALITATIVO_TODOS' })],
  }),
  activity('18.04', 'Unidades habitacionais populares em loteamentos consolidados', 'Unidades habitacionais populares em loteamentos consolidados ou ja licenciados.', {
    unidade: 'unidades habitacionais',
    parametro: 'Numero de unidades habitacionais',
    potencial: 'medio',
    perguntas: [question('loteamento_consolidado', 'Loteamento consolidado?'), question('loteamento_licenciado', 'Loteamento ja licenciado?')],
    bloqueios: [block('18_04_LOTEAMENTO_NAO_CONSOLIDADO', 'Se o loteamento nao for consolidado nem licenciado, bloquear conclusao automatica.')],
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 300, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 300, max: null, operador: 'maior_igual' },
    ]),
  }),
  activity('18.05', 'Condominios ou conjuntos habitacionais verticais', 'Condominios ou conjuntos habitacionais verticais.', {
    unidade: 'indice',
    parametro: 'Indice: unidades x unidades x area total ha / 1000',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 3000,
    formula: 'UNIDADES_X_UNIDADES_X_AREA_HA_DIV_1000',
    parametros_entrada: ['numero_unidades', 'area_total_ha'],
    perguntas: [question('numero_unidades', 'Numero de unidades habitacionais', 'number'), question('area_total_ha', 'Area total em hectares', 'number', 'ha')],
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 10, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 10, max: 500 },
      { suffix: 'grande', porte: 'grande', min: 500, max: 3000 },
    ], 'UNIDADES_X_UNIDADES_X_AREA_HA_DIV_1000'),
  }),
  activity('18.06', 'Terraplenagem vinculada a atividade nao sujeita ao licenciamento', 'Terraplenagem vinculada a atividade nao sujeita ao licenciamento ambiental.', {
    unidade: 'm2',
    parametro: 'Area terraplanada',
    potencial: 'medio',
    formula: 'REGRA_COMPOSTA_AREA_TALUDE',
    parametros_entrada: ['area_terraplanada_m2', 'altura_talude_m'],
    perguntas: [question('area_terraplanada_m2', 'Area terraplanada', 'number', 'm2'), question('altura_talude_m', 'Altura maxima do talude', 'number', 'm'), question('rural_agropecuario', 'Objetivo rural agropecuario?'), question('recebe_material_externo', 'Recebe material externo?'), question('bota_fora_residuos', 'Ha bota-fora com residuos?'), question('atividade_principal_sujeita_licenciamento', 'Atividade principal sujeita ao licenciamento?')],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: 500, max: 5000, tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 5000, max: 10000 },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 30000 },
      { suffix: 'grande', porte: 'grande', min: 30000, max: null, operador: 'maior_igual' },
    ], 'REGRA_COMPOSTA_AREA_TALUDE'),
    docs: ['Projeto de terraplenagem', 'Projeto de drenagem', 'Projeto de contencao e estabilidade de taludes, quando aplicavel', 'Destinacao de material excedente ou origem do material de aterro'],
  }),
  activity('18.07', 'Terraplenagem rural com objetivo agropecuario', 'Terraplenagem no interior de propriedade rural com objetivo agropecuario.', {
    unidade: 'm2',
    parametro: 'Area terraplanada',
    potencial: 'medio',
    formula: 'REGRA_COMPOSTA_AREA_TALUDE',
    parametros_entrada: ['area_terraplanada_m2', 'altura_talude_m'],
    perguntas: [question('area_terraplanada_m2', 'Area terraplanada', 'number', 'm2'), question('altura_talude_m', 'Altura maxima do talude', 'number', 'm'), question('propriedade_rural', 'A area e propriedade rural?'), question('objetivo_agropecuario', 'O objetivo e agropecuario?'), question('recebe_material_externo', 'Recebe material externo?'), question('aterro_residuos', 'Ha aterro com residuos?')],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: 500, max: 5000, tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 5000, max: 10000 },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 30000 },
      { suffix: 'grande', porte: 'grande', min: 30000, max: null, operador: 'maior_igual' },
    ], 'REGRA_COMPOSTA_AREA_TALUDE'),
  }),
  activity('18.08', 'Loteamentos industriais', 'Loteamentos industriais.', {
    unidade: 'ha',
    parametro: 'Area total',
    potencial: 'alto',
    limiteTipo: 'valor_maximo',
    limiteValor: 20,
    regras: directRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 5, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 5, max: 10 },
      { suffix: 'grande', porte: 'grande', min: 10, max: 20 },
    ]),
  }),
  activity('18.09', 'Loteamentos ou distritos empresariais', 'Loteamentos ou distritos empresariais.', {
    unidade: 'ha',
    parametro: 'Area total',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 20,
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 5, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 5, max: 10 },
      { suffix: 'grande', porte: 'grande', min: 10, max: 20 },
    ]),
  }),
  activity('18.10', 'Empreendimentos desportivos, turisticos, recreativos ou de lazer', 'Empreendimentos desportivos, turisticos, recreativos ou de lazer.', {
    unidade: 'ha',
    parametro: 'Area util',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 10,
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 1, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1, max: 5 },
      { suffix: 'medio', porte: 'medio', min: 5, max: 10 },
    ]),
  }),
  activity('18.11', 'Projetos de Assentamento de Reforma Agraria', 'Projetos de Assentamento de Reforma Agraria.', {
    unidade: 'familias',
    parametro: 'Numero de familias',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 50,
    regras: [rule('simplificado', 'simplificado', null, 50, { potencial: 'medio', operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada', formula: 'PARAMETRO_DIRETO' })],
  }),
  activity('18.12', 'Urbanizacao em regularizacao fundiaria', 'Projetos de urbanizacao em programas de regularizacao fundiaria.', {
    unidade: 'ha',
    parametro: 'Area de abrangencia',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 5,
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 1, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 1, max: 3 },
      { suffix: 'grande', porte: 'grande', min: 3, max: 5 },
    ]),
  }),
  activity('18.13', 'Hospedagem rural: pousadas, hoteis e moteis', 'Hospedagem em area rural: pousadas, hoteis e moteis.', {
    unidade: 'indice',
    parametro: 'Indice: numero de leitos x area util ha',
    potencial: 'medio',
    formula: 'LEITOS_X_AREA_UTIL_HA',
    parametros_entrada: ['numero_leitos', 'area_util_ha'],
    perguntas: [question('numero_leitos', 'Numero de leitos', 'number'), question('area_util_ha', 'Area util em hectares', 'number', 'ha')],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 20, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 20, max: 50 },
      { suffix: 'medio', porte: 'medio', min: 50, max: 500 },
      { suffix: 'grande', porte: 'grande', min: 500, max: null, operador: 'maior_igual' },
    ], 'LEITOS_X_AREA_UTIL_HA'),
  }),
  activity('18.14', 'Hospedagem rural: casas de repouso e centros de reabilitacao', 'Hospedagem em area rural: casas de repouso e centros de reabilitacao.', {
    unidade: 'indice',
    parametro: 'Indice: numero de leitos x area util ha',
    potencial: 'medio',
    formula: 'LEITOS_X_AREA_UTIL_HA',
    parametros_entrada: ['numero_leitos', 'area_util_ha'],
    perguntas: [question('numero_leitos', 'Numero de leitos', 'number'), question('area_util_ha', 'Area util em hectares', 'number', 'ha')],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 50, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 50, max: 250 },
      { suffix: 'medio', porte: 'medio', min: 250, max: 500 },
      { suffix: 'validacao_maior_500', porte: 'grande', min: 500, max: null, operador: 'maior_igual', status: 'requer_validacao_tecnica' },
    ], 'LEITOS_X_AREA_UTIL_HA'),
  }),
  activity('18.15', 'Cemiterios horizontais ou cemiterios parques', 'Cemiterios horizontais ou cemiterios parques.', {
    unidade: 'jazigos',
    parametro: 'Numero de jazigos',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 3000,
    docs: ['Estudo hidrogeologico, quando aplicavel'],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 500, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 500, max: 1500 },
      { suffix: 'medio', porte: 'medio', min: 1500, max: 3000 },
    ]),
  }),
  activity('18.16', 'Cemiterios verticais', 'Cemiterios verticais.', {
    unidade: 'loculos',
    parametro: 'Numero de loculos',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 5000,
    observacoes: 'A matriz pode apresentar inconsistencia textual NJ em atividade de loculos. Parametro operacional padronizado como NL.',
    docs: ['Estudo hidrogeologico, quando aplicavel'],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 500, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 500, max: 1000 },
      { suffix: 'medio', porte: 'medio', min: 1000, max: 3000 },
      { suffix: 'grande', porte: 'grande', min: 3000, max: 5000 },
    ]),
  }),
  activity('18.17', 'Estacao de Telecomunicacoes', 'Estacao de Telecomunicacoes.', {
    unidade: 'todos',
    parametro: 'Todos',
    potencial: 'baixo',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    perguntas: [question('torre_antena_radio_base', 'Havera torre, antena ou radio-base?'), question('altura_estrutura_m', 'Altura da estrutura', 'number', 'm'), question('abrigo_tecnico', 'Havera abrigo tecnico?'), question('gerador', 'Havera gerador?'), question('bateria', 'Havera bateria?'), question('combustivel', 'Havera combustivel?'), question('supressao', 'Havera supressao?'), question('terraplenagem', 'Havera terraplenagem?')],
    alertas: [alert('Gerador, combustivel, supressao ou terraplenagem exigem validacao tecnica complementar.')],
    regras: [rule('todos', 'simplificado', null, null, { potencial: 'baixo', operador: 'qualquer', formula: 'PARAMETRO_QUALITATIVO_TODOS' })],
  }),

  activity('20.01', 'Triagem e armazenamento de reciclaveis nao perigosos', 'Triagem, desmontagem e armazenamento de reciclaveis nao perigosos.', {
    tipo_atividade: 'industrial',
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'baixo',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), question('residuo_perigoso', 'Ha residuo perigoso ou Classe I?'), question('contaminado', 'Ha contaminacao por oleo, graxa, solvente, combustivel, agrotoxico ou produto quimico?')],
    bloqueios: [block('20_01_CLASSE_I', 'Se houver Classe I ou contaminacao, avaliar 20.02.', '20.02')],
    regras: directRules('baixo', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 2000, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 2000, max: 5000, tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'medio', porte: 'medio', min: 5000, max: 10000 },
      { suffix: 'grande', porte: 'grande', min: 10000, max: null, operador: 'maior_igual' },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('20.02', 'Triagem e armazenamento temporario de residuos Classe I', 'Triagem, desmontagem e armazenamento temporario de residuos Classe I, incluindo ferro velho.', {
    tipo_atividade: 'industrial',
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 5000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    observacoes: 'Atividade sensivel. Preservar Decreto e manter validacao tecnica/juridica obrigatoria.',
    validacoes: ['exige_validacao_juridica'],
    docs: ['Plano de emergencia', 'Projeto de contencao', 'Classificacao e FISPQ, quando aplicavel'],
    regras: directRules('medio', [
      { suffix: 'medio', porte: 'medio', min: null, max: 3000, operador: 'menor_igual' },
      { suffix: 'grande', porte: 'grande', min: 3000, max: 5000 },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('20.03', 'Armazenamento de oleo vegetal usado sem beneficiamento', 'Armazenamento, reciclagem ou comercio de oleo vegetal usado, sem beneficiamento.', {
    unidade: 'm3',
    parametro: 'Capacidade total de armazenamento',
    potencial: 'baixo',
    limiteTipo: 'valor_maximo',
    limiteValor: 15000,
    formula: 'CAPACIDADE_ARMAZENAMENTO_DIRETA',
    parametros_entrada: ['capacidade_armazenamento_m3'],
    perguntas: [question('capacidade_armazenamento_m3', 'Capacidade de armazenamento', 'number', 'm3'), question('oleo_mineral', 'Ha oleo mineral/lubrificante/combustivel?'), question('beneficiamento_industrial', 'Ha beneficiamento industrial?')],
    regras: directRules('baixo', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 5000, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 5000, max: 10000 },
      { suffix: 'grande', porte: 'grande', min: 10000, max: 15000 },
    ], 'CAPACIDADE_ARMAZENAMENTO_DIRETA'),
  }),
  activity('20.04', 'Reciclagem ou recuperacao de residuos solidos triados nao perigosos', 'Reciclagem ou recuperacao de residuos solidos triados, nao perigosos.', {
    tipo_atividade: 'industrial',
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 5000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 1000, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 1000, max: 3000 },
      { suffix: 'grande', porte: 'grande', min: 3000, max: 5000 },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('20.05', 'Compostagem exceto residuos organicos agrosilvopastoris', 'Compostagem, exceto residuos organicos agrosilvopastoris.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 5000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('exclusivamente_agropecuario', 'Residuos exclusivamente agropecuarios?'), question('lodo', 'Ha lodo?'), question('residuo_saude', 'Ha residuo de saude?'), question('residuo_perigoso', 'Ha residuo perigoso?'), question('carcaca_animal', 'Ha carcaca animal?')],
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 1000, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 1000, max: 3000 },
      { suffix: 'grande', porte: 'grande', min: 3000, max: 5000 },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('20.06', 'Disposicao de rejeitos ou estereis da extracao de rochas', 'Disposicao de rejeitos ou estereis da extracao de rochas, exceto LBRO.', {
    unidade: 'm2',
    parametro: 'Area util',
    potencial: 'baixo',
    perguntas: [question('lbro', 'Ha lama do beneficiamento de rochas ornamentais?')],
    regras: directRules('baixo', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 3000, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 3000, max: 5000 },
      { suffix: 'medio', porte: 'medio', min: 5000, max: null, operador: 'maior_igual' },
    ]),
  }),
  activity('20.07', 'Transbordo de RSU e residuos nao perigosos Classes II-A e II-B', 'Transbordo de RSU, rejeitos de limpeza publica e residuos nao perigosos Classes II-A e II-B.', {
    unidade: 't/dia',
    parametro: 'Quantidade de residuos recebida por dia',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 30,
    formula: 'QUANTIDADE_RECEBIDA_DIA_DIRETA',
    parametros_entrada: ['quantidade_recebida_t_dia'],
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 5, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 5, max: 15 },
      { suffix: 'grande', porte: 'grande', min: 15, max: 30 },
    ], 'QUANTIDADE_RECEBIDA_DIA_DIRETA'),
  }),
  activity('20.08', 'Transbordo, triagem e armazenamento temporario de RCC ou volumosos', 'Transbordo, triagem e armazenamento temporario de RCC ou volumosos.', {
    unidade: 'todos',
    parametro: 'Todos',
    potencial: 'baixo',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    perguntas: [question('disposicao_final_rcc_classe_a', 'Ha disposicao final ou aterro de RCC Classe A?'), question('residuo_perigoso', 'Ha residuo perigoso?'), question('contaminado', 'Ha contaminacao?'), question('rsu_comum', 'Trata-se de RSU comum?')],
    regras: [rule('todos', 'simplificado', null, null, { potencial: 'baixo', operador: 'qualquer', formula: 'PARAMETRO_QUALITATIVO_TODOS' })],
  }),
  activity('20.09', 'Aterro de RCC Classe A', 'Aterro de RCC Classe A.', {
    unidade: 'm3',
    parametro: 'Capacidade de armazenamento',
    potencial: 'baixo',
    limiteTipo: 'valor_maximo',
    limiteValor: 10000,
    formula: 'CAPACIDADE_ARMAZENAMENTO_DIRETA',
    parametros_entrada: ['capacidade_armazenamento_m3'],
    perguntas: [question('capacidade_armazenamento_m3', 'Capacidade de armazenamento', 'number', 'm3'), question('rcc_classe_a_exclusivo', 'RCC Classe A exclusivo?'), question('rcc_misto', 'Ha RCC misto?')],
    observacoes: 'Ha divergencia entre matriz extraida e entendimentos/formularios anteriores da SMAD. Manter validacao tecnica obrigatoria.',
    regras: directRules('baixo', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 1000, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 1000, max: 5000 },
      { suffix: 'grande', porte: 'grande', min: 5000, max: 10000 },
    ], 'CAPACIDADE_ARMAZENAMENTO_DIRETA'),
  }),
  activity('20.10', 'Recebimento de embalagens de agrotoxicos', 'Posto ou central de recebimento de embalagens de agrotoxicos.', {
    unidade: 'todos',
    parametro: 'Todos',
    potencial: 'baixo',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    validacoes: ['exige_validacao_tecnica_obrigatoria'],
    perguntas: [question('produto_vencido', 'Ha produto vencido?'), question('remanescente', 'Ha remanescente?'), question('produto_vazando', 'Ha produto vazando?'), question('residuo_perigoso', 'Ha residuo perigoso?')],
    docs: ['Comprovacao de sistema de logistica reversa de embalagens de agrotoxicos'],
    regras: [rule('todos', 'simplificado', null, null, { potencial: 'baixo', operador: 'qualquer', formula: 'PARAMETRO_QUALITATIVO_TODOS' })],
  }),
  activity('20.11', 'Compostagem de residuos organicos exclusivamente agropecuarios', 'Compostagem de residuos organicos exclusivamente agropecuarios.', {
    unidade: 'm2',
    parametro: 'Area util',
    potencial: 'medio',
    perguntas: [question('residuos_urbanos', 'Ha residuos urbanos?'), question('residuos_comerciais', 'Ha residuos comerciais?'), question('residuos_industriais', 'Ha residuos industriais?'), question('lodo', 'Ha lodo?'), question('residuo_saude', 'Ha residuo de saude?'), question('residuo_perigoso', 'Ha residuo perigoso?'), question('carcaca_animal', 'Ha carcaca animal?')],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: 200, max: 500, tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 500, max: 2000 },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 5000 },
      { suffix: 'grande', porte: 'grande', min: 5000, max: null, operador: 'maior_igual' },
    ]),
  }),

  activity('22.01', 'Terminal de combustiveis liquidos', 'Terminal de combustiveis liquidos.', {
    unidade: 'm3',
    parametro: 'Capacidade de armazenamento',
    potencial: 'alto',
    limiteTipo: 'valor_maximo',
    limiteValor: 15000,
    formula: 'CAPACIDADE_ARMAZENAMENTO_DIRETA',
    parametros_entrada: ['capacidade_armazenamento_m3'],
    docs: ['Projeto de tanques e bacias de contencao', 'Plano de emergencia e atendimento a vazamentos'],
    regras: directRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 5000, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 5000, max: 10000 },
      { suffix: 'grande', porte: 'grande', min: 10000, max: 15000 },
    ], 'CAPACIDADE_ARMAZENAMENTO_DIRETA'),
  }),
  activity('22.02', 'Terminal de armazenamento de gas sem envasamento', 'Terminal de armazenamento de gas, sem envasamento ou processamento, nao portuario.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 1000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('envasamento', 'Ha envasamento?'), question('processamento', 'Ha processamento?'), question('atividade_portuaria', 'Associado a atividade portuaria?')],
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 500, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 500, max: 1000 },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('22.03', 'Armazenamento de produtos quimicos ou perigosos fracionados', 'Armazenamento de produtos quimicos ou perigosos fracionados ate 200 L/kg, exceto agrotoxicos.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 1000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('agrotoxico', 'Ha agrotoxicos?'), question('volume_recipiente_l_kg', 'Volume por recipiente L/kg', 'number', 'L/kg')],
    docs: ['FISPQ dos produtos armazenados', 'Projeto de contencao e segregacao de incompatibilidades'],
    regras: [rule('simplificado', 'simplificado', null, 1000, { potencial: 'medio', operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada', formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM' })],
  }),
  activity('22.04', 'Deposito de produtos extrativos minerais em bruto', 'Deposito exclusivo de produtos extrativos minerais em bruto.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    perguntas: [question('beneficiamento', 'Ha beneficiamento?'), question('britagem', 'Ha britagem?'), question('peneiramento', 'Ha peneiramento?'), question('lavagem', 'Ha lavagem?')],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 1000, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 10000 },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 35000 },
      { suffix: 'grande', porte: 'grande', min: 35000, max: null, operador: 'maior_igual' },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('22.05', 'Deposito exclusivo para blocos de rochas ornamentais', 'Deposito exclusivo para blocos de rochas ornamentais.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    perguntas: [question('corte', 'Ha corte?'), question('serragem', 'Ha serragem?'), question('polimento', 'Ha polimento?'), question('beneficiamento', 'Ha beneficiamento?')],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 30000, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 30000, max: 50000 },
      { suffix: 'medio', porte: 'medio', min: 50000, max: null, operador: 'maior_igual' },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('22.06', 'Deposito para graos e produtos alimenticios', 'Deposito exclusivo para graos e produtos alimenticios, incluindo frigorificados.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 10000, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 10000, max: null, operador: 'maior_igual' },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('22.07', 'Deposito de cargas gerais com manutencao, lavagem ou abastecimento', 'Deposito de cargas gerais com manutencao, lavagem ou abastecimento.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 30000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 1000, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 10000 },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 20000 },
      { suffix: 'grande', porte: 'grande', min: 20000, max: 30000 },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('22.08', 'Cargas gerais em galpao fechado sem manutencao', 'Cargas gerais em galpao fechado, sem manutencao, lavagem ou abastecimento.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'baixo',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    regras: directRules('baixo', [
      { suffix: 'possivel_dispensa', porte: 'simplificado', min: null, max: 10000, operador: 'menor_igual', status: 'possivel_dispensa_verificar', tipoLicenca: null, classe: null },
      { suffix: 'licenciavel', porte: 'pequeno', min: 10000, max: 50000 },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('22.09', 'Cargas gerais em area aberta ou mista sem manutencao', 'Cargas gerais em area aberta ou mista sem manutencao, lavagem ou abastecimento.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'baixo',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    perguntas: [question('manutencao', 'Ha manutencao?'), question('lavagem', 'Ha lavagem?'), question('abastecimento', 'Ha abastecimento?')],
    regras: directRules('baixo', [
      { suffix: 'possivel_dispensa', porte: 'simplificado', min: null, max: 1000, operador: 'menor_igual', status: 'possivel_dispensa_verificar', tipoLicenca: null, classe: null },
      { suffix: 'simplificado', porte: 'simplificado', min: 1000, max: 10000, tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 10000, max: null, operador: 'maior_igual' },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('22.10', 'Produtos domissanitarios, fumigacao e expurgo', 'Produtos domissanitarios, fumigacao e/ou expurgo.', {
    unidade: 'todos',
    parametro: 'Todos',
    potencial: 'medio',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    validacoes: ['exige_validacao_tecnica_obrigatoria'],
    regras: [rule('todos', 'medio', null, null, { potencial: 'medio', operador: 'qualquer', formula: 'PARAMETRO_QUALITATIVO_TODOS' })],
  }),
  activity('22.11', 'Deposito de materiais de construcao em geral', 'Deposito de materiais de construcao em geral.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'baixo',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    perguntas: [question('tintas', 'Ha tintas?'), question('solventes', 'Ha solventes?'), question('quimicos', 'Ha quimicos?'), question('inflamaveis', 'Ha inflamaveis?')],
    regras: directRules('baixo', [
      { suffix: 'possivel_dispensa', porte: 'simplificado', min: null, max: 500, operador: 'menor_igual', status: 'possivel_dispensa_verificar', tipoLicenca: null, classe: null },
      { suffix: 'simplificado', porte: 'simplificado', min: 500, max: 1000, tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 5000 },
      { suffix: 'medio', porte: 'medio', min: 5000, max: 10000 },
      { suffix: 'grande', porte: 'grande', min: 10000, max: null, operador: 'maior_igual' },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),

  activity('24.01', 'Posto revendedor de combustiveis ou tanque enterrado', 'Posto revendedor de combustiveis com qualquer tanque ou nao revendedor com tanque enterrado.', {
    unidade: 'm3',
    parametro: 'Capacidade de armazenamento',
    potencial: 'alto',
    formula: 'CAPACIDADE_ARMAZENAMENTO_DIRETA',
    parametros_entrada: ['capacidade_armazenamento_m3'],
    validacoes: ['exige_validacao_tecnica_obrigatoria'],
    docs: ['Projeto de tanques e bacias de contencao', 'Projeto de SSAO', 'Plano de emergencia'],
    regras: directRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 60, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 60, max: 110 },
      { suffix: 'grande', porte: 'grande', min: 110, max: null, operador: 'maior_igual' },
    ], 'CAPACIDADE_ARMAZENAMENTO_DIRETA'),
  }),
  activity('24.02', 'Posto nao revendedor com tanque aereo', 'Posto nao revendedor somente com tanque aereo.', {
    unidade: 'm3',
    parametro: 'Capacidade de armazenamento',
    potencial: 'alto',
    formula: 'CAPACIDADE_ARMAZENAMENTO_DIRETA',
    parametros_entrada: ['capacidade_armazenamento_m3'],
    perguntas: [question('tanque_enterrado', 'Ha tanque enterrado?'), question('revenda', 'Ha revenda?')],
    regras: directRules('alto', [
      { suffix: 'consulta_ate_15', porte: 'simplificado', min: null, max: 15, operador: 'menor_igual', status: 'requer_consulta_previa', tipoLicenca: null, classe: null },
      { suffix: 'pequeno', porte: 'pequeno', min: 15, max: 60 },
      { suffix: 'medio', porte: 'medio', min: 60, max: 150 },
      { suffix: 'grande', porte: 'grande', min: 150, max: null, operador: 'maior_igual' },
    ], 'CAPACIDADE_ARMAZENAMENTO_DIRETA'),
  }),
  activity('24.03', 'Lavador de veiculos', 'Lavador de veiculos.', {
    unidade: 'm2',
    parametro: 'Area util',
    potencial: 'medio',
    perguntas: [question('manutencao', 'Ha manutencao?'), question('troca_oleo', 'Ha troca de oleo?'), question('abastecimento', 'Ha abastecimento?'), question('vinculado_posto', 'Vinculado a posto?')],
    docs: ['Projeto de SSAO', 'Descricao do sistema de tratamento de efluente oleoso'],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 200, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 200, max: null, operador: 'maior_igual' },
    ]),
  }),
  activity('24.04', 'Garagens com manutencao, lavagem ou abastecimento', 'Garagens com manutencao, lavagem ou abastecimento.', {
    unidade: 'm2',
    parametro: 'Area total',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 30000,
    perguntas: [question('apenas_estacionamento', 'Apenas estacionamento?'), question('tanque_enterrado', 'Ha tanque enterrado?')],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 5000, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada' },
      { suffix: 'pequeno', porte: 'pequeno', min: 5000, max: 20000 },
      { suffix: 'medio', porte: 'medio', min: 20000, max: 30000 },
    ]),
  }),
  activity('24.05', 'Canteiros de obras vinculados a atividade licenciada ou dispensada', 'Canteiros de obras vinculados a atividade licenciada ou dispensada.', {
    unidade: 'm2',
    parametro: 'Area total',
    potencial: 'medio',
    perguntas: [question('atividade_principal_licenciada', 'Atividade principal licenciada?'), question('atividade_principal_dispensada', 'Atividade principal dispensada?'), question('alojamento', 'Ha alojamento?'), question('atividade_licenciavel_propria', 'Abriga atividade licenciavel propria?'), question('tanque_enterrado', 'Ha tanque enterrado?'), question('tanque_aereo_m3', 'Capacidade de tanque aereo', 'number', 'm3')],
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 1000, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 1000, max: 3000 },
      { suffix: 'grande', porte: 'grande', min: 3000, max: null, operador: 'maior_igual' },
    ]),
  }),
  activity('24.06', 'Atividades de baixo impacto sem enquadramento especifico', 'Atividades de baixo impacto sem enquadramento especifico.', {
    tipo_atividade: 'outro',
    unidade: 'todos',
    parametro: 'Todos',
    potencial: 'baixo',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    validacoes: ['exige_validacao_tecnica_obrigatoria'],
    perguntas: [question('descricao_detalhada', 'Descricao detalhada da atividade', 'textarea'), question('atividade_especifica_existente', 'Existe atividade especifica no Decreto?')],
    regras: [rule('todos', 'simplificado', null, null, { potencial: 'baixo', operador: 'qualquer', formula: 'PARAMETRO_QUALITATIVO_TODOS', status: 'requer_validacao_tecnica' })],
  }),
  activity('24.07', 'Atividades delegadas ao municipio sem enquadramento especifico', 'Atividades delegadas ao municipio sem enquadramento especifico.', {
    tipo_atividade: 'outro',
    unidade: 'todos',
    parametro: 'Todos',
    potencial: 'alto',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    validacoes: ['exige_validacao_tecnica_obrigatoria', 'exige_validacao_juridica'],
    perguntas: [question('delegacao_formal', 'Ha comprovacao de delegacao formal?'), question('descricao_detalhada', 'Descricao detalhada da atividade', 'textarea')],
    regras: [rule('todos', 'grande', null, null, { potencial: 'alto', operador: 'qualquer', formula: 'PARAMETRO_QUALITATIVO_TODOS', status: 'requer_validacao_tecnica_juridica' })],
  }),
];

async function validateFase2D1Gate(client = db) {
  const status = await client.query(`
    SELECT
      ready,
      status,
      bloqueios_producao_json
    FROM licenciamento_homologacao_liberacoes
    WHERE status = 'liberada_tecnicamente'
      AND ready = true
    ORDER BY confirmado_em DESC NULLS LAST, id DESC
    LIMIT 1;
  `);

  const release = status.rows[0] || null;
  const blockers = release?.bloqueios_producao_json || {};
  const bloqueiosOk = blockers.dam_real === true
    && blockers.cobranca_oficial === true
    && blockers.protocolo_definitivo === true
    && blockers.decisao_automatica === true;

  if (!release || !bloqueiosOk) {
    const error = new Error('Fase 2D.1 bloqueada. A liberacao tecnica da Fase 2D nao foi localizada ou os bloqueios de producao nao estao preservados.');
    error.statusCode = 409;
    error.details = { liberacao_tecnica: Boolean(release), bloqueios_producao_ok: bloqueiosOk };
    throw error;
  }

  return {
    ready: true,
    liberacao: release,
    bloqueios_producao_ok: true,
  };
}

async function getLookups(client) {
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

function requireLookup(lookup, key, label) {
  if (!key) return null;
  const item = lookup[key];
  if (!item) {
    const error = new Error(`Parametro base ausente para Fase 2D.1: ${label} ${key}. Execute as fases anteriores antes do seed.`);
    error.statusCode = 409;
    throw error;
  }
  return item.id;
}

async function upsertActivity(client, item) {
  const existing = await client.query(
    'SELECT id, seed_piloto_codigo FROM licenciamento_atividades WHERE deleted_at IS NULL AND LOWER(codigo) = LOWER($1) LIMIT 1;',
    [item.codigo]
  );

  const payload = {
    codigo: item.codigo,
    nome: item.nome,
    descricao: item.descricao,
    categoria: item.categoria,
    unidade_parametro_principal: item.unidade_parametro_principal,
    parametro_principal_label: item.parametro_principal_label,
    potencial_poluidor_padrao: item.potencial_poluidor_padrao,
    limite_impacto_local_tipo: item.limite_impacto_local_tipo,
    limite_impacto_local_valor: item.limite_impacto_local_valor,
    limite_impacto_local_unidade: item.limite_impacto_local_unidade,
    mensagem_extrapolacao_competencia: item.mensagem_extrapolacao_competencia || 'A informacao prestada excede o limite de impacto local previsto na matriz municipal para esta atividade. Recomenda-se consulta formal a SMAD para verificacao de competencia e enquadramento aplicavel.',
    expressao_original: item.expressao_original,
    fundamento_normativo: item.fundamento_normativo,
    tipo_atividade: item.tipo_atividade,
    formula_codigo: item.formula_codigo,
    parametros_entrada: json(item.parametros_entrada),
    perguntas_publicas: json(item.perguntas_publicas),
    bloqueios_publicos: json(item.bloqueios_publicos),
    alertas_publicos: json(item.alertas_publicos),
    validacoes_requeridas: json(item.validacoes_requeridas),
    seed_piloto_codigo: existing.rows[0]?.seed_piloto_codigo || 'fase2d1',
    ativo: true,
    observacoes: item.observacoes,
  };

  const fields = Object.keys(payload);
  if (existing.rows[0]) {
    const values = fields.map((field) => payload[field]);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    values.push(existing.rows[0].id);
    return (await client.query(
      `UPDATE licenciamento_atividades SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *;`,
      values
    )).rows[0];
  }

  const values = fields.map((field) => payload[field]);
  const placeholders = fields.map((_, index) => `$${index + 1}`);
  return (await client.query(
    `INSERT INTO licenciamento_atividades (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *;`,
    values
  )).rows[0];
}

async function upsertRule(client, activityRow, item, lookups) {
  const seedPrefix = activityRow.seed_piloto_codigo === 'fase2b' ? 'fase2b' : 'fase2d1';
  const seedCode = `${seedPrefix}:${activityRow.codigo}:${item.suffix}`;
  const existing = await client.query(
    'SELECT id FROM licenciamento_regras_enquadramento WHERE deleted_at IS NULL AND seed_piloto_codigo = $1 LIMIT 1;',
    [seedCode]
  );

  const payload = {
    atividade_id: activityRow.id,
    tipo_licenca_id: requireLookup(lookups.tipos, item.tipoLicenca, 'tipo de licenca'),
    classe_id: requireLookup(lookups.classes, item.classe, 'classe'),
    potencial_poluidor_id: requireLookup(lookups.potenciais, item.potencial, 'potencial'),
    parametro_nome: activityRow.parametro_principal_label,
    parametro_unidade: activityRow.unidade_parametro_principal,
    valor_minimo: item.min,
    valor_maximo: item.max,
    operador: item.operador || 'faixa',
    porte_resultante: item.porte,
    dispensa_possivel: item.status === 'possivel_dispensa_verificar',
    exige_vistoria: false,
    exige_estudo_ambiental: false,
    exige_anuencia: false,
    exige_georreferenciamento: false,
    observacao_publica: 'Resultado preliminar, orientativo e sujeito a validacao tecnica da SMAD.',
    observacao_interna: item.observacaoInterna || null,
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A e Anexo II-A',
    expressao_original: item.expressao || activityRow.expressao_original,
    requer_validacao_tecnica: item.requerValidacao !== false,
    limite_impacto_local_tipo: null,
    limite_impacto_local_valor: null,
    limite_impacto_local_unidade: null,
    tipo_calculo: item.formula ? 'formula_predefinida' : 'nenhum',
    formula_codigo: item.formula || null,
    parametros_entrada: json(activityRow.parametros_entrada),
    status_resultado: item.status || 'requer_validacao_tecnica',
    tipo_resultado: null,
    alertas_tecnicos: json(item.alertas || []),
    bloqueios: json(item.bloqueios || []),
    seed_piloto_codigo: seedCode,
    ativo: true,
  };

  const fields = Object.keys(payload);
  let row;
  if (existing.rows[0]) {
    const values = fields.map((field) => payload[field]);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    values.push(existing.rows[0].id);
    row = (await client.query(
      `UPDATE licenciamento_regras_enquadramento SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *;`,
      values
    )).rows[0];
  } else {
    const values = fields.map((field) => payload[field]);
    const placeholders = fields.map((_, index) => `$${index + 1}`);
    row = (await client.query(
      `INSERT INTO licenciamento_regras_enquadramento (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *;`,
      values
    )).rows[0];
  }

  const parametros = activityRow.formula_codigo
    ? activityRow.parametros_entrada || ['valor_parametro']
    : ['valor_parametro'];
  let ordem = 1;
  for (const chave of parametros.length ? parametros : ['valor_parametro']) {
    await client.query(
      `
        INSERT INTO licenciamento_regra_parametros (
          regra_enquadramento_id, parametro_chave, parametro_label, parametro_unidade,
          operador, valor_minimo, valor_maximo, inclui_minimo, inclui_maximo, obrigatorio, ordem, expressao_original
        )
        VALUES ($1, $2, $3, $4, 'faixa', NULL, NULL, true, true, true, $5, $6)
        ON CONFLICT (regra_enquadramento_id, parametro_chave)
        WHERE deleted_at IS NULL
        DO UPDATE SET
          parametro_label = EXCLUDED.parametro_label,
          parametro_unidade = EXCLUDED.parametro_unidade,
          ordem = EXCLUDED.ordem,
          expressao_original = EXCLUDED.expressao_original,
          updated_at = CURRENT_TIMESTAMP;
      `,
      [row.id, chave, chave === 'valor_parametro' ? activityRow.parametro_principal_label : chave, activityRow.unidade_parametro_principal, ordem, payload.expressao_original]
    );
    ordem += 1;
  }

  return row;
}

async function upsertDocument(client, activityId, name, order) {
  const existing = await client.query(
    `
      SELECT id
      FROM licenciamento_documentos_exigidos
      WHERE deleted_at IS NULL AND atividade_id = $1 AND LOWER(nome_documento) = LOWER($2)
      LIMIT 1;
    `,
    [activityId, name]
  );
  const payload = {
    atividade_id: activityId,
    nome_documento: name,
    descricao: null,
    obrigatorio: true,
    aplicavel_pessoa_fisica: true,
    aplicavel_pessoa_juridica: true,
    aplicavel_imovel_rural: true,
    aplicavel_imovel_urbano: true,
    exige_responsavel_tecnico: /ART|RRT|projeto|estudo|planta|layout|plano/i.test(name),
    exige_art_rrt: /ART|RRT|projeto|estudo/i.test(name),
    ordem: order,
    fundamento: 'Decreto Municipal n. 021/2020, Anexo I-C e parametrizacao Fase 2D.1.',
    ativo: true,
  };
  const fields = Object.keys(payload);

  if (existing.rows[0]) {
    const values = fields.map((field) => payload[field]);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    values.push(existing.rows[0].id);
    await client.query(
      `UPDATE licenciamento_documentos_exigidos SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length};`,
      values
    );
    return;
  }

  const values = fields.map((field) => payload[field]);
  const placeholders = fields.map((_, index) => `$${index + 1}`);
  await client.query(
    `INSERT INTO licenciamento_documentos_exigidos (${fields.join(', ')}) VALUES (${placeholders.join(', ')});`,
    values
  );
}

async function upsertNormLink(client, normaId, activityId, descricao) {
  if (!normaId) return;
  const existing = await client.query(
    `
      SELECT id
      FROM licenciamento_normas_vinculos
      WHERE deleted_at IS NULL
        AND norma_id = $1
        AND atividade_id IS NOT DISTINCT FROM $2
        AND regra_enquadramento_id IS NULL
        AND tipo_licenca_id IS NULL
      LIMIT 1;
    `,
    [normaId, activityId]
  );

  if (existing.rows[0]) {
    await client.query(
      'UPDATE licenciamento_normas_vinculos SET descricao_vinculo = $1 WHERE id = $2;',
      [descricao, existing.rows[0].id]
    );
    return;
  }

  await client.query(
    'INSERT INTO licenciamento_normas_vinculos (norma_id, atividade_id, descricao_vinculo) VALUES ($1, $2, $3);',
    [normaId, activityId, descricao]
  );
}

async function collectSummary(client) {
  const params = [TARGET_ACTIVITY_CODES];
  const summary = await client.query(
    `
      SELECT
        COUNT(DISTINCT a.id)::int AS atividades,
        COUNT(DISTINCT r.id)::int AS regras,
        COUNT(DISTINCT rp.id)::int AS perguntas_parametros,
        COUNT(DISTINCT d.id)::int AS documentos
      FROM licenciamento_atividades a
      LEFT JOIN licenciamento_regras_enquadramento r ON r.atividade_id = a.id AND r.deleted_at IS NULL
      LEFT JOIN licenciamento_regra_parametros rp ON rp.regra_enquadramento_id = r.id AND rp.deleted_at IS NULL
      LEFT JOIN licenciamento_documentos_exigidos d ON d.atividade_id = a.id AND d.deleted_at IS NULL AND d.ativo = true
      WHERE a.deleted_at IS NULL AND a.codigo = ANY($1);
    `,
    params
  );
  const groups = await client.query(
    `
      SELECT split_part(codigo, '.', 1) AS grupo, COUNT(*)::int AS atividades
      FROM licenciamento_atividades
      WHERE deleted_at IS NULL AND codigo = ANY($1)
      GROUP BY split_part(codigo, '.', 1)
      ORDER BY grupo;
    `,
    params
  );

  const perguntas = ACTIVITIES.reduce((total, item) => total + item.perguntas_publicas.length, 0);
  const alertas = ACTIVITIES.reduce((total, item) => total + item.alertas_publicos.length, 0);
  const bloqueios = ACTIVITIES.reduce((total, item) => total + item.bloqueios_publicos.length, 0);

  return {
    grupos: TARGET_GROUP_CODES,
    atividades_por_grupo: groups.rows,
    atividades: summary.rows[0].atividades,
    regras: summary.rows[0].regras,
    parametros_regra: summary.rows[0].perguntas_parametros,
    perguntas_publicas: perguntas,
    alertas_publicos: alertas,
    bloqueios_publicos: bloqueios,
    documentos: summary.rows[0].documentos,
  };
}

async function seedLicenciamentoFase2D1({ silent = false } = {}) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const gate = await validateFase2D1Gate(client);
    const lookups = await getLookups(client);

    for (const item of ACTIVITIES) {
      const row = await upsertActivity(client, item);
      for (const regra of item.regras) {
        await upsertRule(client, row, regra, lookups);
      }

      let order = 1;
      for (const doc of item.docs) {
        await upsertDocument(client, row.id, doc, order);
        order += 1;
      }

      await upsertNormLink(client, lookups.normas.DECRETO_MUNICIPAL_021_2020?.id, row.id, 'Regulamento operacional municipal para parametrizacao Fase 2D.1.');
      await upsertNormLink(client, lookups.normas.ANEXO_II_A?.id, row.id, 'Atividade sujeita ao licenciamento ambiental municipal.');
      await upsertNormLink(client, lookups.normas.CONSEMA_001_2022_REFERENCIA?.id, row.id, 'Referencia comparativa, sem substituicao automatica da matriz municipal.');
    }

    const summary = await collectSummary(client);
    await client.query('COMMIT');

    const result = {
      success: true,
      fase: '2D.1',
      gate,
      summary,
      observacao: 'Seed idempotente executado sem alterar VRTE, tabela de taxas, matriz operacional ou normas.',
    };

    if (!silent) {
      console.log(JSON.stringify(result, null, 2));
    }

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    if (!silent) {
      console.error(JSON.stringify({ success: false, error: error.message, details: error.details || null }, null, 2));
    }
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedLicenciamentoFase2D1()
    .then(() => db.end())
    .catch(() => db.end().finally(() => process.exit(1)));
}

module.exports = seedLicenciamentoFase2D1;
module.exports.ACTIVITIES = ACTIVITIES;
module.exports.TARGET_ACTIVITY_CODES = TARGET_ACTIVITY_CODES;
module.exports.validateFase2D1Gate = validateFase2D1Gate;
