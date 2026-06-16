const db = require('../../../config/db');
const seedLicenciamentoFase2D1 = require('./seedLicenciamentoFase2D1');
const seedLicenciamentoFase2D2 = require('./seedLicenciamentoFase2D2');

const TARGET_GROUP_CODES = ['15', '16', '17'];
const TARGET_ACTIVITY_CODES = [
  ...Array.from({ length: 27 }, (_, index) => `15.${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 8 }, (_, index) => `16.${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 17 }, (_, index) => `17.${String(index + 1).padStart(2, '0')}`),
];

const PRESERVED_2D2_CODES = ['15.20', '16.06', '17.05', '23.01', '23.02', '23.03', '23.04', '23.05', '23.06'];
const PRESERVED_2D1_CODES = seedLicenciamentoFase2D1.TARGET_ACTIVITY_CODES || [];

const STATUS_NORMATIVO = Object.freeze({
  CONFIRMADO: 'confirmado_decreto_021_2020',
  REQUER_VALIDACAO: 'requer_validacao_normativa',
  LACUNA_TEXTUAL: 'incompleto_por_lacuna_textual',
  SEM_BASE: 'nao_parametrizar_sem_base_normativa',
});

const FASE_2D21_BLOCKED_MESSAGE =
  'Fase 2D.2.1 bloqueada. A Fase 2D.1 ou a Fase 2D.2 nao esta consolidada, a liberacao tecnica da Fase 2D nao foi localizada ou os bloqueios de producao nao estao preservados.';

const GROUP_CATEGORIES = Object.freeze({
  15: 'Industria de Produtos Alimentares',
  16: 'Industria de Bebidas',
  17: 'Industrias Diversas',
});

const GROUP_VALIDATIONS = Object.freeze({
  15: [
    'exige_validacao_sanitaria',
    'exige_validacao_efluentes',
    'exige_validacao_residuos_organicos',
    'exige_validacao_odor',
    'exige_validacao_vetores',
    'exige_responsabilidade_tecnica',
  ],
  16: [
    'exige_validacao_hidrica',
    'exige_validacao_sanitaria',
    'exige_validacao_efluentes',
    'exige_validacao_envase',
    'exige_validacao_odor',
    'exige_responsabilidade_tecnica',
  ],
  17: [
    'exige_validacao_produto_quimico',
    'exige_validacao_emissao_atmosferica',
    'exige_validacao_residuo_perigoso',
    'exige_validacao_inflamavel',
    'exige_validacao_controle_operacional',
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
  'Memorial descritivo',
  'Layout operacional',
  'ART/RRT ou responsabilidade tecnica, quando aplicavel',
  'Plano de Gerenciamento de Residuos Solidos',
  'Comprovantes ou contratos de destinacao de residuos',
  'Projeto de controle de efluentes, quando aplicavel',
  'FISPQ, quando houver produtos quimicos',
  'AVCB/CBMES ou protocolo, quando aplicavel',
];

const GROUP_DOCS = Object.freeze({
  15: [
    'Fluxograma produtivo',
    'Capacidade produtiva',
    'Relacao de materias-primas e produtos',
    'Licenca ou alvara sanitario ou protocolo',
    'Plano de controle de efluentes',
    'Descricao de ETE ou sistema de tratamento',
    'Caixa de gordura ou SSAO, quando aplicavel',
    'Controle de residuos organicos',
    'Controle de odor e vetores',
  ],
  16: [
    'Fluxograma produtivo',
    'Capacidade produtiva',
    'Balanco hidrico simplificado, quando aplicavel',
    'Licenca ou alvara sanitario ou protocolo',
    'Plano de controle de efluentes',
    'Descricao de ETE ou sistema de tratamento',
    'Controle de residuos organicos',
    'FISPQ de produtos quimicos de limpeza',
  ],
  17: [
    'Fluxograma produtivo',
    'Relacao de materias-primas',
    'Relacao de produtos quimicos, quando aplicavel',
    'FISPQ, quando aplicavel',
    'PGRS com residuos perigosos, quando aplicavel',
    'Contrato de destinacao de Classe I, quando aplicavel',
    'Projeto de exaustao ou ventilacao, quando aplicavel',
    'Plano de emergencia, quando aplicavel',
  ],
});

function json(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function groupOf(codigo) {
  return String(codigo).split('.')[0];
}

function statusTag(statusNormativo) {
  return `status_normativo_${statusNormativo}`;
}

function question(chave, label, tipo = 'boolean', unidade = null, ajuda = null) {
  return { chave, label, tipo, unidade, ajuda };
}

function block(codigo, mensagem, sugestao = null, status = 'bloqueada_por_inconsistencia') {
  return {
    codigo,
    tipo: 'bloqueio_logico',
    status_resultante: status,
    mensagem_publica: mensagem,
    sugestao_codigo_atividade: sugestao,
  };
}

function classFor(potencial, porte) {
  if (porte === 'simplificado') return { tipoLicenca: 'LMS', classe: 'simplificada' };
  if (potencial === 'baixo') {
    if (porte === 'pequeno') return { tipoLicenca: 'LMS', classe: 'simplificada' };
    if (porte === 'medio') return { tipoLicenca: 'LMU', classe: 'classe_i' };
    return { tipoLicenca: 'LMU', classe: 'classe_ii' };
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
  const potential = options.potencial || 'medio';
  const normStatus = options.statusNormativo || STATUS_NORMATIVO.CONFIRMADO;
  const normativePending = normStatus !== STATUS_NORMATIVO.CONFIRMADO
    || options.status === 'requer_validacao_normativa';
  const derived = normativePending
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
    status: options.status || (normativePending ? 'requer_validacao_normativa' : 'requer_validacao_tecnica'),
    formula: options.formula,
    expressao: options.expressao,
    requerValidacao: true,
    observacaoInterna: options.observacaoInterna || null,
    alertas: options.alertas || [],
    bloqueios: options.bloqueios || [],
  };
}

function rulesFrom(potencial, formula, entries, statusNormativo = STATUS_NORMATIVO.CONFIRMADO) {
  return entries.map((entry) => rule(entry.suffix, entry.porte, entry.min, entry.max, {
    potencial,
    formula,
    operador: entry.operador,
    expressao: entry.expressao,
    status: entry.status,
    statusNormativo,
    tipoLicenca: entry.tipoLicenca,
    classe: entry.classe,
    observacaoInterna: entry.observacaoInterna,
  }));
}

function activity(codigo, nome, options) {
  const grupo = groupOf(codigo);
  const statusNormativo = options.statusNormativo || STATUS_NORMATIVO.CONFIRMADO;
  const statusValidation = statusTag(statusNormativo);
  const baseValidations = GROUP_VALIDATIONS[grupo] || [];
  const normativeValidations = statusNormativo === STATUS_NORMATIVO.CONFIRMADO
    ? []
    : ['exige_validacao_normativa', statusTag(STATUS_NORMATIVO.REQUER_VALIDACAO)];
  const docs = [...COMMON_DOCS, ...(GROUP_DOCS[grupo] || []), ...(options.docs || [])];

  return {
    codigo,
    nome,
    descricao: options.descricao || nome,
    categoria: GROUP_CATEGORIES[grupo],
    grupo,
    tipo_atividade: options.tipo_atividade || 'industrial',
    unidade_parametro_principal: options.unidade || 'unidade',
    parametro_principal_label: options.parametro || 'Parametro principal',
    potencial_poluidor_padrao: options.potencial || 'medio',
    limite_impacto_local_tipo: options.limiteValor === null || options.limiteValor === undefined ? 'todos' : 'valor_maximo',
    limite_impacto_local_valor: options.limiteValor === undefined ? null : options.limiteValor,
    limite_impacto_local_unidade: options.limiteUnidade || options.unidade || null,
    mensagem_extrapolacao_competencia: options.mensagemLimite || null,
    expressao_original: options.expressao || null,
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A e Anexo II-A',
    observacoes: [
      `status_normativo=${statusNormativo}`,
      options.observacoes || 'Dados cadastrados conforme conferencia do Decreto Municipal n. 021/2020 em PDF local.',
    ].filter(Boolean).join(' | '),
    formula_codigo: options.formula || 'PARAMETRO_DIRETO',
    parametros_entrada: options.parametros_entrada || [],
    perguntas_publicas: options.perguntas || [],
    bloqueios_publicos: options.bloqueios || [],
    alertas_publicos: [
      { severidade: 'atencao', mensagem: 'Simulacao preliminar. Nao constitui licenca, dispensa, DAM, cobranca oficial ou decisao administrativa.' },
      ...(statusNormativo === STATUS_NORMATIVO.CONFIRMADO
        ? []
        : [{ severidade: 'alerta', mensagem: 'Esta atividade possui pendencia normativa controlada e exige conferencia da SMAD antes de qualquer conclusao.' }]),
      ...(options.alertas || []),
    ],
    validacoes_requeridas: [...baseValidations, statusValidation, ...normativeValidations, ...(options.validacoes || [])],
    regras: options.regras || [],
    docs,
    status_normativo: statusNormativo,
  };
}

const commonFoodQuestions = [
  question('produto_alimenticio', 'Produto alimenticio fabricado ou beneficiado', 'text'),
  question('gera_efluente_liquido', 'Ha geracao de efluente liquido?'),
  question('lavagem_pisos_equipamentos', 'Ha lavagem de pisos ou equipamentos?'),
  question('residuos_organicos', 'Ha geracao de residuos organicos?'),
  question('controle_odor_vetores', 'Ha controle de odor e vetores?'),
  question('inspecao_sanitaria', 'Ha inspecao sanitaria, alvara ou protocolo?'),
];

const commonDrinkQuestions = [
  question('tipo_bebida', 'Tipo de bebida', 'text'),
  question('envase', 'Ha envase?'),
  question('uso_agua', 'Ha uso significativo de agua?'),
  question('gera_efluente_liquido', 'Ha geracao de efluente liquido?'),
  question('sistema_tratamento_efluentes', 'Ha sistema de tratamento de efluentes?'),
  question('licenca_sanitaria', 'Ha licenca sanitaria ou protocolo?'),
];

const commonIndustrialQuestions = [
  question('produto_fabricado', 'Produto fabricado', 'text'),
  question('processo_produtivo', 'Resumo do processo produtivo', 'text'),
  question('produto_quimico', 'Ha uso de produto quimico?'),
  question('emissao_atmosferica', 'Ha emissao atmosferica, po, odor ou VOC?'),
  question('residuo_perigoso', 'Ha geracao de residuo perigoso?'),
  question('armazenamento_inflamavel', 'Ha armazenamento de inflamaveis?'),
];

function areaRules(potencial, entries, statusNormativo) {
  return rulesFrom(potencial, 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', entries, statusNormativo);
}

function productionDayRules(potencial, entries, statusNormativo) {
  return rulesFrom(potencial, 'PRODUCAO_DIA_DIRETA', entries, statusNormativo);
}

function productionMonthRules(potencial, entries, statusNormativo) {
  return rulesFrom(potencial, 'PRODUCAO_MES_DIRETA', entries, statusNormativo);
}

function storageRules(potencial, entries, statusNormativo) {
  return rulesFrom(potencial, 'CAPACIDADE_ARMAZENAMENTO_DIRETA', entries, statusNormativo);
}

function qualitativeRules(potencial, statusNormativo = STATUS_NORMATIVO.CONFIRMADO) {
  return rulesFrom(potencial, 'PARAMETRO_QUALITATIVO_TODOS', [
    { suffix: 'todos', porte: 'simplificado', min: null, max: null, operador: 'qualquer', expressao: 'Todos' },
  ], statusNormativo);
}

const ACTIVITIES = [
  activity('15.01', 'Torrefacao e/ou moagem de cafe e outros graos', {
    parametro: 'Capacidade maxima de processamento',
    unidade: 'ton_dia',
    potencial: 'medio',
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia'],
    perguntas: [question('producao_dia', 'Capacidade maxima de processamento', 'number', 't/dia'), ...commonFoodQuestions],
    regras: productionDayRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 2, operador: 'menor_igual', expressao: 'CMP <= 2 t/dia' },
      { suffix: 'pequeno', porte: 'pequeno', min: 2, max: 5, expressao: '2 < CMP <= 5 t/dia' },
      { suffix: 'medio', porte: 'medio', min: 5, max: null, operador: 'maior_igual', expressao: 'CMP > 5 t/dia' },
    ]),
  }),
  activity('15.02', 'Fabricacao de balas, caramelos, pastilhas, drops, bombons, chocolates, gomas de mascar e afins, exceto producao artesanal', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    limiteValor: 3000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonFoodQuestions],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: 300, max: 1000, expressao: '300 < I <= 1.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 2000, expressao: '1.000 < I <= 2.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 3000, expressao: '2.000 < I <= 3.000 m2' },
    ]),
  }),
  activity('15.03', 'Entreposto e envase de mel, associado ou nao a producao de balas e doces deste produto, exceto producao artesanal', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonFoodQuestions],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: 500, max: 3000, expressao: '500 < I <= 3.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 3000, max: null, operador: 'maior_igual', expressao: 'I > 3.000 m2' },
    ]),
  }),
  activity('15.04', 'Fabricacao de doces, refeicoes conservadas, conservas de frutas, legumes e outros vegetais, exceto producao artesanal', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    limiteValor: 3000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonFoodQuestions],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: 500, max: 1000, expressao: '500 < I <= 1.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 2000, expressao: '1.000 < I <= 2.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 3000, expressao: '2.000 < I <= 3.000 m2' },
    ]),
  }),
  activity('15.05', 'Preparacao de sal de cozinha', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    limiteValor: 3000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonFoodQuestions],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 1000, operador: 'menor_igual', expressao: 'I <= 1.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 3000, expressao: '1.000 < I <= 3.000 m2' },
    ]),
  }),
  activity('15.06', 'Refino e preparacao de oleos e gorduras vegetais, producao de manteiga de cacau e gorduras de origem animal destinados a alimentacao', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'ha',
    potencial: 'alto',
    limiteValor: 2000,
    formula: 'PARAMETRO_DIRETO',
    parametros_entrada: [],
    statusNormativo: STATUS_NORMATIVO.LACUNA_TEXTUAL,
    observacoes: 'O Decreto extraido informa unidade em ha, mas as faixas numericas aparentam escala de m2. Manter sem taxa ate conferencia normativa.',
    perguntas: [question('valor_parametro', 'Area informada conforme texto normativo', 'number', 'ha'), ...commonFoodQuestions],
    regras: rulesFrom('alto', 'PARAMETRO_DIRETO', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 1000, operador: 'menor_igual', expressao: 'I <= 1.000 (unidade textual divergente)' },
      { suffix: 'medio', porte: 'medio', min: 1000, max: 2000, expressao: '1.000 < I <= 2.000 (unidade textual divergente)' },
    ], STATUS_NORMATIVO.LACUNA_TEXTUAL),
  }),
  activity('15.07', 'Fabricacao de vinagre', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    limiteValor: 3000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonFoodQuestions],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 1000, operador: 'menor_igual', expressao: 'I <= 1.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 3000, expressao: '1.000 < I <= 3.000 m2' },
    ]),
  }),
  activity('15.08', 'Industrializacao do leite, incluindo beneficiamento, pasteurizacao e producao de leite em po, com queijaria', {
    parametro: 'Capacidade maxima de processamento',
    unidade: 'litros_dia',
    potencial: 'alto',
    limiteValor: 30000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia_litros'],
    perguntas: [question('producao_dia_litros', 'Capacidade maxima de processamento', 'number', 'L/dia'), ...commonFoodQuestions, question('queijaria', 'Possui queijaria?')],
    regras: productionDayRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 10000, operador: 'menor_igual', expressao: 'CMP <= 10.000 L/dia' },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 20000, expressao: '10.000 < CMP <= 20.000 L/dia' },
      { suffix: 'grande', porte: 'grande', min: 20000, max: 30000, expressao: '20.000 < CMP <= 30.000 L/dia' },
    ]),
  }),
  activity('15.09', 'Industrializacao do leite, incluindo beneficiamento, pasteurizacao e producao de leite em po, sem queijaria', {
    parametro: 'Capacidade maxima de processamento',
    unidade: 'litros_dia',
    potencial: 'medio',
    limiteValor: 60000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia_litros'],
    perguntas: [question('producao_dia_litros', 'Capacidade maxima de processamento', 'number', 'L/dia'), ...commonFoodQuestions, question('queijaria', 'Possui queijaria?')],
    bloqueios: [block('15.09_COM_QUEIJARIA', 'Atividade com queijaria deve ser avaliada em 15.08.', '15.08', 'atividade_associada_detectada')],
    regras: productionDayRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 20000, operador: 'menor_igual', expressao: 'CMP <= 20.000 L/dia' },
      { suffix: 'medio', porte: 'medio', min: 20000, max: 40000, expressao: '20.000 < CMP <= 40.000 L/dia' },
      { suffix: 'grande', porte: 'grande', min: 40000, max: 60000, expressao: '40.000 < CMP <= 60.000 L/dia' },
    ]),
  }),
  activity('15.10', 'Fabricacao de massas alimenticias e biscoitos, exceto producao artesanal', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    limiteValor: 3000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonFoodQuestions],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: 300, max: 1000, expressao: '300 < I <= 1.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 2000, expressao: '1.000 < I <= 2.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 3000, expressao: '2.000 < I <= 3.000 m2' },
    ]),
  }),
  activity('15.11', 'Fabricacao artesanal de polpa de frutas, exceto producao artesanal', {
    parametro: 'Quantidade maxima de fruta processada',
    unidade: 't_dia',
    potencial: 'alto',
    limiteValor: 50000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia'],
    statusNormativo: STATUS_NORMATIVO.LACUNA_TEXTUAL,
    observacoes: 'Descricao normativa extraida apresenta contradicao textual com a expressao artesanal/exceto artesanal. Manter sem taxa ate conferencia.',
    perguntas: [question('producao_dia', 'Quantidade maxima de fruta processada', 'number', 't/dia'), ...commonFoodQuestions],
    regras: rulesFrom('alto', 'PRODUCAO_DIA_DIRETA', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 5000, operador: 'menor_igual', expressao: 'FP <= 5.000 t/dia' },
      { suffix: 'pequeno', porte: 'pequeno', min: 5000, max: 10000, expressao: '5.000 < FP <= 10.000 t/dia' },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 30000, expressao: '10.000 < FP <= 30.000 t/dia' },
      { suffix: 'grande', porte: 'grande', min: 30000, max: 50000, expressao: '30.000 < FP <= 50.000 t/dia' },
    ], STATUS_NORMATIVO.LACUNA_TEXTUAL),
  }),
  activity('15.12', 'Fabricacao de fermentos e leveduras', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    limiteValor: 3000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonFoodQuestions],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 1000, operador: 'menor_igual', expressao: 'I <= 1.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 2000, expressao: '1.000 < I <= 2.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 3000, expressao: '2.000 < I <= 3.000 m2' },
    ]),
  }),
  activity('15.13', 'Industrializacao e beneficiamento de pescado', {
    parametro: 'Capacidade maxima de processamento',
    unidade: 'kg_dia',
    potencial: 'medio',
    limiteValor: 6000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia'],
    perguntas: [question('producao_dia', 'Capacidade maxima de processamento', 'number', 'kg/dia'), ...commonFoodQuestions],
    regras: productionDayRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 3000, operador: 'menor_igual', expressao: 'CMP <= 3.000 kg/dia' },
      { suffix: 'medio', porte: 'medio', min: 3000, max: 4500, expressao: '3.000 < CMP <= 4.500 kg/dia' },
      { suffix: 'grande', porte: 'grande', min: 4500, max: 6000, expressao: '4.500 < CMP <= 6.000 kg/dia' },
    ]),
  }),
  activity('15.14', 'Acougues e/ou peixarias, quando nao localizados em area urbana consolidada', {
    tipo_atividade: 'nao_industrial',
    parametro: 'Todos',
    unidade: 'todos',
    potencial: 'medio',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    perguntas: [...commonFoodQuestions, question('area_urbana_consolidada', 'Localizado em area urbana consolidada?')],
    bloqueios: [block('15.14_AREA_URBANA_CONSOLIDADA', 'Acougue ou peixaria em area urbana consolidada pode depender de dispensa ou consulta previa.', null, 'possivel_dispensa_verificar')],
    regras: qualitativeRules('medio'),
  }),
  activity('15.15', 'Abatedouro de frango e outros animais de pequeno porte, exceto animais silvestres', {
    parametro: 'Capacidade maxima de abate',
    unidade: 'animais_dia',
    potencial: 'medio',
    limiteValor: 50000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia'],
    perguntas: [question('producao_dia', 'Capacidade maxima de abate', 'number', 'animais/dia'), ...commonFoodQuestions, question('animal_silvestre', 'Ha animal silvestre?')],
    bloqueios: [block('15.15_ANIMAL_SILVESTRE', 'Abate de animal silvestre exige analise especifica e nao deve ser concluido automaticamente.')],
    regras: productionDayRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 200, operador: 'menor_igual', expressao: 'CA <= 200 animais/dia' },
      { suffix: 'pequeno', porte: 'pequeno', min: 200, max: 15000, expressao: '200 < CA <= 15.000 animais/dia' },
      { suffix: 'medio', porte: 'medio', min: 15000, max: 30000, expressao: '15.000 < CA <= 30.000 animais/dia' },
      { suffix: 'grande', porte: 'grande', min: 30000, max: 50000, expressao: '30.000 < CA <= 50.000 animais/dia' },
    ]),
  }),
  activity('15.16', 'Abatedouro de suinos, ovinos e outros animais de medio porte', {
    parametro: 'Capacidade maxima de abate',
    unidade: 'animais_dia',
    potencial: 'alto',
    limiteValor: 80,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia'],
    perguntas: [question('producao_dia', 'Capacidade maxima de abate', 'number', 'animais/dia'), ...commonFoodQuestions],
    regras: productionDayRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 20, operador: 'menor_igual', expressao: 'CA <= 20 animais/dia' },
      { suffix: 'medio', porte: 'medio', min: 20, max: 40, expressao: '20 < CA <= 40 animais/dia' },
      { suffix: 'grande', porte: 'grande', min: 40, max: 80, expressao: '40 < CA <= 80 animais/dia' },
    ]),
  }),
  activity('15.17', 'Abatedouro de bovinos e outros animais de grande porte', {
    parametro: 'Capacidade maxima de abate',
    unidade: 'animais_dia',
    potencial: 'alto',
    limiteValor: 40,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia'],
    perguntas: [question('producao_dia', 'Capacidade maxima de abate', 'number', 'animais/dia'), ...commonFoodQuestions],
    regras: productionDayRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 10, operador: 'menor_igual', expressao: 'CA <= 10 animais/dia' },
      { suffix: 'medio', porte: 'medio', min: 10, max: 30, expressao: '10 < CA <= 30 animais/dia' },
      { suffix: 'grande', porte: 'grande', min: 30, max: 40, expressao: '30 < CA <= 40 animais/dia' },
    ]),
  }),
  activity('15.18', 'Abatedouros mistos de bovinos e suinos e outros animais de medio e grande porte', {
    parametro: 'Capacidade maxima de abates ponderada',
    unidade: 'indice_dia',
    potencial: 'alto',
    limiteValor: 80,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia'],
    perguntas: [
      question('producao_dia', 'Indice de abates: grandes x 3 + medios', 'number', 'indice/dia'),
      ...commonFoodQuestions,
    ],
    regras: productionDayRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 20, operador: 'menor_igual', expressao: 'CA <= 20' },
      { suffix: 'medio', porte: 'medio', min: 20, max: 40, expressao: '20 < CA <= 40' },
      { suffix: 'grande', porte: 'grande', min: 40, max: 80, expressao: '40 < CA <= 80' },
    ]),
  }),
  activity('15.19', 'Frigorificos sem abate', {
    parametro: 'Todos',
    unidade: 'todos',
    potencial: 'medio',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    perguntas: [...commonFoodQuestions, question('possui_abate', 'Ha abate no empreendimento?')],
    bloqueios: [block('15.19_COM_ABATE', 'Frigorifico com abate deve ser enquadrado em atividade especifica de abatedouro.', null, 'atividade_associada_detectada')],
    regras: qualitativeRules('medio'),
  }),
  activity('15.20', 'Industrializacao e beneficiamento de carne, incluindo desossa e charqueada; producao de embutidos e outros produtos alimentares de origem animal', {
    parametro: 'Capacidade maxima de producao',
    unidade: 't_mes',
    potencial: 'medio',
    limiteValor: 100,
    formula: 'PRODUCAO_MES_DIRETA',
    parametros_entrada: ['producao_mes_toneladas'],
    observacoes: 'Atividade piloto preservada da Fase 2B/2D.2 e confirmada no Decreto Municipal n. 021/2020.',
    perguntas: [question('producao_mes_toneladas', 'Capacidade maxima de producao', 'number', 't/mes'), ...commonFoodQuestions, question('possui_abate', 'Ha abate no empreendimento?')],
    bloqueios: [block('15.20_ABATE', 'Se houver abate animal, nao concluir automaticamente em 15.20.', null, 'atividade_associada_detectada')],
    regras: productionMonthRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 10, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada', expressao: 'CMP <= 10 t/mes' },
      { suffix: 'pequeno', porte: 'pequeno', min: 10, max: 30, expressao: '10 < CMP <= 30 t/mes' },
      { suffix: 'medio', porte: 'medio', min: 30, max: 60, expressao: '30 < CMP <= 60 t/mes' },
      { suffix: 'grande', porte: 'grande', min: 60, max: 100, expressao: '60 < CMP <= 100 t/mes' },
    ]),
  }),
  activity('15.21', 'Fabricacao de temperos e condimentos', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    limiteValor: 3000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonFoodQuestions],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 1000, operador: 'menor_igual', expressao: 'I <= 1.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 2000, expressao: '1.000 < I <= 2.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 3000, expressao: '2.000 < I <= 3.000 m2' },
    ]),
  }),
  activity('15.22', 'Supermercados e hipermercados com atividades de corte e limpeza de carnes, pescados e semelhantes, nao localizado em area urbana consolidada', {
    tipo_atividade: 'nao_industrial',
    parametro: 'Area construida + area de estocagem',
    unidade: 'ha',
    potencial: 'medio',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    perguntas: [...commonFoodQuestions, question('area_urbana_consolidada', 'Localizado em area urbana consolidada?')],
    bloqueios: [block('15.22_AREA_URBANA_CONSOLIDADA', 'Atividade em area urbana consolidada pode depender de dispensa ou consulta previa.', null, 'possivel_dispensa_verificar')],
    regras: qualitativeRules('medio'),
  }),
  activity('15.23', 'Producao artesanal de alimentos', {
    tipo_atividade: 'nao_industrial',
    parametro: 'Area construida',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'PARAMETRO_DIRETO',
    perguntas: [question('valor_parametro', 'Area construida', 'number', 'm2'), ...commonFoodQuestions],
    regras: rulesFrom('medio', 'PARAMETRO_DIRETO', [
      { suffix: 'simplificado', porte: 'simplificado', min: 75, max: 200, expressao: '75 < AC <= 200 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 200, max: 400, expressao: '200 < AC <= 400 m2' },
      { suffix: 'medio', porte: 'medio', min: 400, max: 800, expressao: '400 < AC <= 800 m2' },
      { suffix: 'grande', porte: 'grande', min: 800, max: null, operador: 'maior_igual', expressao: 'AC > 800 m2' },
    ]),
  }),
  activity('15.24', 'Resfriamento e distribuicao de leite, sem beneficiamento de qualquer natureza', {
    tipo_atividade: 'nao_industrial',
    parametro: 'Capacidade de armazenamento',
    unidade: 'litros',
    potencial: 'medio',
    formula: 'CAPACIDADE_ARMAZENAMENTO_DIRETA',
    parametros_entrada: ['capacidade_armazenamento_litros'],
    perguntas: [question('capacidade_armazenamento_litros', 'Capacidade de armazenamento', 'number', 'litros'), ...commonFoodQuestions, question('beneficiamento', 'Ha beneficiamento de leite?')],
    bloqueios: [block('15.24_COM_BENEFICIAMENTO', 'Havendo beneficiamento, avaliar 15.08 ou 15.09.', '15.09', 'atividade_associada_detectada')],
    regras: storageRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 5000, operador: 'menor_igual', expressao: 'CA <= 5.000 litros' },
      { suffix: 'pequeno', porte: 'pequeno', min: 5000, max: 40000, expressao: '5.000 < CA <= 40.000 litros' },
      { suffix: 'medio', porte: 'medio', min: 40000, max: 80000, expressao: '40.000 < CA <= 80.000 litros' },
      { suffix: 'grande', porte: 'grande', min: 80000, max: null, operador: 'maior_igual', expressao: 'CA > 80.000 litros' },
    ]),
  }),
  activity('15.25', 'Fabricacao de racao balanceada para animais, sem cozimento e/ou digestao, apenas mistura', {
    tipo_atividade: 'nao_industrial',
    parametro: 'Capacidade maxima de producao',
    unidade: 't_mes',
    potencial: 'medio',
    formula: 'PRODUCAO_MES_DIRETA',
    parametros_entrada: ['producao_mes'],
    perguntas: [question('producao_mes', 'Capacidade maxima de producao', 'number', 't/mes'), ...commonFoodQuestions, question('cozimento_digestao', 'Ha cozimento ou digestao?')],
    bloqueios: [block('15.25_COZIMENTO_DIGESTAO', 'Havendo cozimento ou digestao, a atividade nao deve ser concluida automaticamente em 15.25.')],
    regras: productionMonthRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: 100, max: 1000, expressao: '100 < CMP <= 1.000 t/mes' },
      { suffix: 'medio', porte: 'medio', min: 1000, max: null, operador: 'maior_igual', expressao: 'CMP > 1.000 t/mes' },
    ]),
  }),
  activity('15.26', 'Fabricacao de fecula, amido e seus derivados', {
    tipo_atividade: 'nao_industrial',
    parametro: 'Area construida',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'PARAMETRO_DIRETO',
    perguntas: [question('valor_parametro', 'Area construida', 'number', 'm2'), ...commonFoodQuestions],
    regras: rulesFrom('medio', 'PARAMETRO_DIRETO', [
      { suffix: 'pequeno', porte: 'pequeno', min: 200, max: 1000, expressao: '200 < AC <= 1.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 1000, max: null, operador: 'maior_igual', expressao: 'AC > 1.000 m2' },
    ]),
  }),
  activity('15.27', 'Fabricacao de sorvetes, tortas geladas e afins, exceto producao artesanal', {
    parametro: 'Capacidade maxima de producao',
    unidade: 't_mes',
    potencial: 'medio',
    limiteValor: 100,
    formula: 'PRODUCAO_MES_DIRETA',
    parametros_entrada: ['producao_mes_toneladas'],
    perguntas: [question('producao_mes_toneladas', 'Capacidade maxima de producao', 'number', 't/mes'), ...commonFoodQuestions],
    regras: productionMonthRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 20, operador: 'menor_igual', expressao: 'CMP <= 20 t/mes' },
      { suffix: 'pequeno', porte: 'pequeno', min: 20, max: 30, expressao: '20 < CMP <= 30 t/mes' },
      { suffix: 'medio', porte: 'medio', min: 30, max: 60, expressao: '30 < CMP <= 60 t/mes' },
      { suffix: 'grande', porte: 'grande', min: 60, max: 100, expressao: '60 < CMP <= 100 t/mes' },
    ]),
  }),

  activity('16.01', 'Padronizacao e envase de aguardente sem producao', {
    tipo_atividade: 'nao_industrial',
    parametro: 'Capacidade maxima de armazenamento',
    unidade: 'litros',
    potencial: 'baixo',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    perguntas: [question('capacidade_armazenamento_litros', 'Capacidade maxima de armazenamento', 'number', 'litros'), ...commonDrinkQuestions, question('producao', 'Ha producao de aguardente?')],
    bloqueios: [block('16.01_COM_PRODUCAO', 'Havendo producao, a atividade deve ser reavaliada em atividade especifica.', null, 'atividade_associada_detectada')],
    regras: qualitativeRules('baixo'),
  }),
  activity('16.02', 'Producao artesanal de bebidas', {
    tipo_atividade: 'nao_industrial',
    parametro: 'Area construida',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'PARAMETRO_DIRETO',
    perguntas: [question('valor_parametro', 'Area construida', 'number', 'm2'), ...commonDrinkQuestions],
    regras: rulesFrom('medio', 'PARAMETRO_DIRETO', [
      { suffix: 'simplificado', porte: 'simplificado', min: 75, max: 200, expressao: '75 < AC <= 200 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 200, max: 400, expressao: '200 < AC <= 400 m2' },
      { suffix: 'medio', porte: 'medio', min: 400, max: 800, expressao: '400 < AC <= 800 m2' },
      { suffix: 'grande', porte: 'grande', min: 800, max: null, operador: 'maior_igual', expressao: 'AC > 800 m2' },
    ]),
  }),
  activity('16.03', 'Padronizacao e envase, sem producao, de bebidas em geral, alcoolicas ou nao, exceto aguardente e agua de coco', {
    parametro: 'Capacidade maxima de armazenamento',
    unidade: 'litros',
    potencial: 'medio',
    limiteValor: 120000,
    formula: 'CAPACIDADE_ARMAZENAMENTO_DIRETA',
    parametros_entrada: ['capacidade_armazenamento_litros'],
    perguntas: [question('capacidade_armazenamento_litros', 'Capacidade maxima de armazenamento', 'number', 'litros'), ...commonDrinkQuestions, question('producao', 'Ha producao de bebida?')],
    bloqueios: [block('16.03_COM_PRODUCAO', 'Havendo producao, avaliar atividade especifica do Grupo 16.', null, 'atividade_associada_detectada')],
    regras: storageRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 15000, operador: 'menor_igual', expressao: 'CA <= 15.000 litros' },
      { suffix: 'pequeno', porte: 'pequeno', min: 15000, max: 50000, expressao: '15.000 < CA <= 50.000 litros' },
      { suffix: 'medio', porte: 'medio', min: 50000, max: 80000, expressao: '50.000 < CA <= 80.000 litros' },
      { suffix: 'grande', porte: 'grande', min: 80000, max: 120000, expressao: '80.000 < CA <= 120.000 litros' },
    ]),
  }),
  activity('16.04', 'Preparacao e envase de agua de coco', {
    parametro: 'Producao maxima diaria',
    unidade: 'litros_dia',
    potencial: 'medio',
    limiteValor: 30000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia_litros'],
    perguntas: [question('producao_dia_litros', 'Producao maxima diaria', 'number', 'L/dia'), ...commonDrinkQuestions],
    regras: productionDayRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 5000, operador: 'menor_igual', expressao: 'PD <= 5.000 L/dia' },
      { suffix: 'pequeno', porte: 'pequeno', min: 5000, max: 10000, expressao: '5.000 < PD <= 10.000 L/dia' },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 20000, expressao: '10.000 < PD <= 20.000 L/dia' },
      { suffix: 'grande', porte: 'grande', min: 20000, max: 30000, expressao: '20.000 < PD <= 30.000 L/dia' },
    ]),
  }),
  activity('16.05', 'Fabricacao de vinhos, licores e outras bebidas alcoolicas semelhantes, exceto aguardentes, cervejas, chopes e maltes, exceto artesanal', {
    parametro: 'Producao maxima diaria',
    unidade: 'litros_dia',
    potencial: 'alto',
    limiteValor: 25000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia_litros'],
    perguntas: [question('producao_dia_litros', 'Producao maxima diaria', 'number', 'L/dia'), ...commonDrinkQuestions, question('artesanal', 'A producao e artesanal?')],
    bloqueios: [block('16.05_ARTESANAL', 'Producao artesanal deve ser avaliada em 16.02.', '16.02', 'atividade_associada_detectada')],
    regras: productionDayRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 10000, operador: 'menor_igual', expressao: 'PD <= 10.000 L/dia' },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 20000, expressao: '10.000 < PD <= 20.000 L/dia' },
      { suffix: 'grande', porte: 'grande', min: 20000, max: 25000, expressao: '20.000 < PD <= 25.000 L/dia' },
    ]),
  }),
  activity('16.06', 'Fabricacao de cervejas, chopes e maltes, exceto artesanal', {
    parametro: 'Producao maxima diaria',
    unidade: 'litros_dia',
    potencial: 'alto',
    limiteValor: 25000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia_litros'],
    observacoes: 'Atividade piloto preservada da Fase 2B/2D.2 e confirmada no Decreto Municipal n. 021/2020.',
    perguntas: [question('producao_dia_litros', 'Producao maxima diaria', 'number', 'L/dia'), ...commonDrinkQuestions, question('artesanal', 'A producao e artesanal?')],
    bloqueios: [block('16.06_ARTESANAL', 'Producao artesanal deve ser avaliada em 16.02.', '16.02', 'bloqueada_por_inconsistencia')],
    regras: productionDayRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 10000, operador: 'menor_igual', expressao: 'PD <= 10.000 L/dia' },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 20000, expressao: '10.000 < PD <= 20.000 L/dia' },
      { suffix: 'grande', porte: 'grande', min: 20000, max: 25000, expressao: '20.000 < PD <= 25.000 L/dia' },
    ]),
  }),
  activity('16.07', 'Fabricacao de sucos', {
    parametro: 'Producao maxima diaria',
    unidade: 'litros_dia',
    potencial: 'alto',
    limiteValor: 10000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia_litros'],
    perguntas: [question('producao_dia_litros', 'Producao maxima diaria', 'number', 'L/dia'), ...commonDrinkQuestions],
    regras: productionDayRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 2000, operador: 'menor_igual', expressao: 'PD <= 2.000 L/dia' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 5000, expressao: '2.000 < PD <= 5.000 L/dia' },
      { suffix: 'grande', porte: 'grande', min: 5000, max: 10000, expressao: '5.000 < PD <= 10.000 L/dia' },
    ]),
  }),
  activity('16.08', 'Fabricacao de refrigerantes e outras bebidas nao alcoolicas, exceto sucos', {
    parametro: 'Producao maxima diaria',
    unidade: 'litros_dia',
    potencial: 'alto',
    limiteValor: 25000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia_litros'],
    perguntas: [question('producao_dia_litros', 'Producao maxima diaria', 'number', 'L/dia'), ...commonDrinkQuestions],
    regras: productionDayRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 10000, operador: 'menor_igual', expressao: 'PD <= 10.000 L/dia' },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 20000, expressao: '10.000 < PD <= 20.000 L/dia' },
      { suffix: 'grande', porte: 'grande', min: 20000, max: 25000, expressao: '20.000 < PD <= 25.000 L/dia' },
    ]),
  }),

  activity('17.01', 'Fabricacao de pecas, ornatos, estruturas e pre-moldados de cimento, gesso e lama do beneficiamento de rochas ornamentais', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'baixo',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions, question('lbro', 'Usa lama do beneficiamento de rochas ornamentais?')],
    alertas: [{ severidade: 'atencao', mensagem: 'Uso de LBRO exige conferencia tecnica de origem, armazenamento e destinacao.' }],
    regras: areaRules('baixo', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 1000, operador: 'menor_igual', expressao: 'I <= 1.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 5000, expressao: '1.000 < I <= 5.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 5000, max: null, operador: 'maior_igual', expressao: 'I > 5.000 m2' },
    ]),
  }),
  activity('17.02', 'Fabricacao e elaboracao de vidros e cristais', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions],
    regras: areaRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 5000, expressao: '1.000 < I <= 5.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 5000, max: 10000, expressao: '5.000 < I <= 10.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 10000, max: null, operador: 'maior_igual', expressao: 'I > 10.000 m2' },
    ]),
  }),
  activity('17.03', 'Corte e acabamento de vidros, sem fabricacao e/ou elaboracao', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions, question('fabricacao_vidro', 'Ha fabricacao ou elaboracao de vidro?')],
    bloqueios: [block('17.03_COM_FABRICACAO', 'Havendo fabricacao ou elaboracao, avaliar 17.02.', '17.02', 'atividade_associada_detectada')],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 1000, operador: 'menor_igual', expressao: 'I <= 1.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 5000, expressao: '1.000 < I <= 5.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 5000, max: 10000, expressao: '5.000 < I <= 10.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 10000, max: null, operador: 'maior_igual', expressao: 'I > 10.000 m2' },
    ]),
  }),
  activity('17.04', 'Fabricacao e elaboracao de produtos diversos de minerais nao metalicos, abrasivos, lixas, esmeril e outros', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 1000, operador: 'menor_igual', expressao: 'I <= 1.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 1000, max: 5000, expressao: '1.000 < I <= 5.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 5000, max: 10000, expressao: '5.000 < I <= 10.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 10000, max: null, operador: 'maior_igual', expressao: 'I > 10.000 m2' },
    ]),
  }),
  activity('17.05', 'Fabricacao de pecas, artefatos e estruturas utilizando fibra de vidro e resina', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'alto',
    limiteValor: 2000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    observacoes: 'Atividade piloto preservada da Fase 2B/2D.2 e confirmada no Decreto Municipal n. 021/2020.',
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions, question('resina', 'Ha uso de resina?'), question('solvente', 'Ha uso de solvente?')],
    regras: areaRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 500, operador: 'menor_igual', expressao: 'I <= 500 m2' },
      { suffix: 'medio', porte: 'medio', min: 500, max: 1000, expressao: '500 < I <= 1.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 1000, max: 2000, expressao: '1.000 < I <= 2.000 m2' },
    ]),
  }),
  activity('17.06', 'Graficas e editoras', {
    parametro: 'Area util',
    unidade: 'ha',
    potencial: 'baixo',
    formula: 'AREA_UTIL_DIRETA',
    parametros_entrada: ['area_util_m2'],
    statusNormativo: STATUS_NORMATIVO.LACUNA_TEXTUAL,
    observacoes: 'Extracao do Decreto apresenta unidade textual ambigua em area util (> 0,05 ha). Manter sem taxa ate conferencia.',
    perguntas: [question('area_util_m2', 'Area util informada', 'number', 'm2'), ...commonIndustrialQuestions],
    regras: rulesFrom('baixo', 'AREA_UTIL_DIRETA', [
      { suffix: 'simplificado', porte: 'simplificado', min: 0.05, max: null, operador: 'maior_igual', expressao: 'AU > 0,05 ha' },
    ], STATUS_NORMATIVO.LACUNA_TEXTUAL),
  }),
  activity('17.07', 'Fabricacao de instrumentos musicais, exceto de madeira, e fitas magneticas', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'baixo',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions, question('madeira', 'A fabricacao e de madeira?')],
    regras: areaRules('baixo', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 5000, operador: 'menor_igual', expressao: 'I <= 5.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 5000, max: 20000, expressao: '5.000 < I <= 20.000 m2' },
    ]),
  }),
  activity('17.08', 'Fabricacao de aparelhos ortopedicos', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions],
    regras: areaRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 2000, operador: 'menor_igual', expressao: 'I <= 2.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 5000, expressao: '2.000 < I <= 5.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 5000, max: null, operador: 'maior_igual', expressao: 'I > 5.000 m2' },
    ]),
  }),
  activity('17.09', 'Fabricacao de instrumentos de precisao nao eletricos', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions],
    regras: areaRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 2000, operador: 'menor_igual', expressao: 'I <= 2.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 5000, expressao: '2.000 < I <= 5.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 5000, max: null, operador: 'maior_igual', expressao: 'I > 5.000 m2' },
    ]),
  }),
  activity('17.10', 'Fabricacao de aparelhos para uso medico, odontologico e cirurgico', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions],
    regras: areaRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 1000, operador: 'menor_igual', expressao: 'I <= 1.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 1000, max: 3000, expressao: '1.000 < I <= 3.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 3000, max: null, operador: 'maior_igual', expressao: 'I > 3.000 m2' },
    ]),
  }),
  activity('17.11', 'Fabricacao de artigos esportivos', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions],
    regras: areaRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 2000, operador: 'menor_igual', expressao: 'I <= 2.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 5000, expressao: '2.000 < I <= 5.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 5000, max: null, operador: 'maior_igual', expressao: 'I > 5.000 m2' },
    ]),
  }),
  activity('17.12', 'Fabricacao de artigos de joalheria, bijuteria, ourivesaria e lapidacao', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions],
    regras: areaRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 1000, operador: 'menor_igual', expressao: 'I <= 1.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 1000, max: 3000, expressao: '1.000 < I <= 3.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 3000, max: null, operador: 'maior_igual', expressao: 'I > 3.000 m2' },
    ]),
  }),
  activity('17.13', 'Fabricacao de pinceis, vassouras, escovas e semelhantes, inclusive com reaproveitamento de materiais', {
    parametro: 'Todos',
    unidade: 'todos',
    potencial: 'baixo',
    formula: 'PARAMETRO_QUALITATIVO_TODOS',
    perguntas: [...commonIndustrialQuestions, question('reaproveitamento_materiais', 'Ha reaproveitamento de materiais?')],
    regras: qualitativeRules('baixo'),
  }),
  activity('17.14', 'Fabricacao de produtos descartaveis de higiene pessoal', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions],
    regras: areaRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 2000, operador: 'menor_igual', expressao: 'I <= 2.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 5000, expressao: '2.000 < I <= 5.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 5000, max: null, operador: 'maior_igual', expressao: 'I > 5.000 m2' },
    ]),
  }),
  activity('17.15', 'Beneficiamento e embalagem de produtos fitoterapicos naturais, inclusive medicamentos e suplementos alimentares', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions, question('produto_fitoterapico', 'Ha produto fitoterapico, medicamento ou suplemento?')],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: 300, max: 2000, expressao: '300 < I <= 2.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 2000, max: 5000, expressao: '2.000 < I <= 5.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 5000, max: null, operador: 'maior_igual', expressao: 'I > 5.000 m2' },
    ]),
  }),
  activity('17.16', 'Preparacao de fumo, fabricacao de cigarros, charutos e cigarrilhas e outras atividades de elaboracao do tabaco', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    limiteValor: 5000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions],
    regras: areaRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 500, operador: 'menor_igual', expressao: 'I <= 500 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 500, max: 1000, expressao: '500 < I <= 1.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 1000, max: 2000, expressao: '1.000 < I <= 2.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 2000, max: 5000, expressao: '2.000 < I <= 5.000 m2' },
    ]),
  }),
  activity('17.17', 'Fabricacao de velas de cera e parafina', {
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'baixo',
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [question('area_construida_m2', 'Area construida', 'number', 'm2'), question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'), ...commonIndustrialQuestions, question('parafina', 'Ha uso de parafina?')],
    regras: areaRules('baixo', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 2000, operador: 'menor_igual', expressao: 'I <= 2.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 2000, max: null, operador: 'maior_igual', expressao: 'I > 2.000 m2' },
    ]),
  }),
];

async function validateFase2D21Gate(client = db) {
  try {
    await seedLicenciamentoFase2D2.validateFase2D2Gate(client);
  } catch (error) {
    const wrapped = new Error(FASE_2D21_BLOCKED_MESSAGE);
    wrapped.statusCode = error.statusCode || 409;
    wrapped.cause = error;
    throw wrapped;
  }

  const [fase2d1, fase2d2, release] = await Promise.all([
    client.query(
      "SELECT COUNT(*)::int AS total FROM licenciamento_atividades WHERE deleted_at IS NULL AND ativo = true AND codigo = ANY($1);",
      [PRESERVED_2D1_CODES]
    ),
    client.query(
      "SELECT COUNT(*)::int AS total FROM licenciamento_atividades WHERE deleted_at IS NULL AND ativo = true AND codigo = ANY($1);",
      [PRESERVED_2D2_CODES]
    ),
    client.query(
      `SELECT bloqueios_producao_json
       FROM licenciamento_homologacao_liberacoes
       WHERE status = 'liberada_tecnicamente' AND ready = true
       ORDER BY confirmado_em DESC NULLS LAST, id DESC
       LIMIT 1;`
    ),
  ]);

  const blockers = release.rows[0]?.bloqueios_producao_json || {};
  const bloqueiosOk = blockers.dam_real === true
    && blockers.cobranca_oficial === true
    && blockers.protocolo_definitivo === true
    && blockers.decisao_automatica === true;
  const fase2d1Ok = Number(fase2d1.rows[0]?.total || 0) === PRESERVED_2D1_CODES.length;
  const fase2d2Ok = Number(fase2d2.rows[0]?.total || 0) === PRESERVED_2D2_CODES.length;

  if (!bloqueiosOk || !fase2d1Ok || !fase2d2Ok) {
    const error = new Error(FASE_2D21_BLOCKED_MESSAGE);
    error.statusCode = 409;
    error.details = {
      fase2d1_preservada: fase2d1Ok,
      fase2d2_preservada: fase2d2Ok,
      bloqueios_producao_ok: bloqueiosOk,
    };
    throw error;
  }

  return {
    ready: true,
    fase2d1_preservada: true,
    fase2d2_preservada: true,
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
    const error = new Error(`Parametro base ausente para Fase 2D.2.1: ${label} ${key}. Execute as fases anteriores antes do seed.`);
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
    mensagem_extrapolacao_competencia: item.mensagem_extrapolacao_competencia || 'A informacao prestada excede o limite de impacto local previsto na matriz municipal. Recomenda-se consulta formal a SMAD.',
    expressao_original: item.expressao_original,
    fundamento_normativo: item.fundamento_normativo,
    tipo_atividade: item.tipo_atividade,
    formula_codigo: item.formula_codigo,
    parametros_entrada: json(item.parametros_entrada),
    perguntas_publicas: json(item.perguntas_publicas),
    bloqueios_publicos: json(item.bloqueios_publicos),
    alertas_publicos: json(item.alertas_publicos),
    validacoes_requeridas: json(item.validacoes_requeridas),
    seed_piloto_codigo: existing.rows[0]?.seed_piloto_codigo || 'fase2d21',
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
  const seedPrefix = activityRow.seed_piloto_codigo === 'fase2b' ? 'fase2b' : 'fase2d21';
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

  const parametros = activityRow.parametros_entrada?.length ? activityRow.parametros_entrada : ['valor_parametro'];
  let ordem = 1;
  for (const chave of parametros) {
    const label = parametros.length === 1 ? activityRow.parametro_principal_label : chave;
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
      [row.id, chave, label, activityRow.unidade_parametro_principal, ordem, payload.expressao_original]
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
    exige_responsavel_tecnico: /ART|RRT|projeto|estudo|planta|layout|plano|responsabilidade tecnica/i.test(name),
    exige_art_rrt: /ART|RRT|projeto|estudo/i.test(name),
    ordem: order,
    fundamento: 'Decreto Municipal n. 021/2020, Anexo I-C e parametrizacao Fase 2D.2.1.',
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
  const summary = await client.query(
    `
      WITH atividades_base AS (
        SELECT *
        FROM licenciamento_atividades
        WHERE deleted_at IS NULL AND codigo = ANY($1)
      )
      SELECT
        COUNT(*)::int AS atividades,
        COUNT(*) FILTER (
          WHERE validacoes_requeridas::text NOT LIKE '%${statusTag(STATUS_NORMATIVO.REQUER_VALIDACAO)}%'
            AND validacoes_requeridas::text NOT LIKE '%${statusTag(STATUS_NORMATIVO.LACUNA_TEXTUAL)}%'
        )::int AS confirmadas,
        COUNT(*) FILTER (WHERE validacoes_requeridas::text LIKE '%${statusTag(STATUS_NORMATIVO.REQUER_VALIDACAO)}%')::int AS pendentes_normativas,
        COUNT(*) FILTER (WHERE validacoes_requeridas::text LIKE '%${statusTag(STATUS_NORMATIVO.LACUNA_TEXTUAL)}%')::int AS lacunas_textuais,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_regras_enquadramento r
          JOIN atividades_base a ON a.id = r.atividade_id
          WHERE r.deleted_at IS NULL
        ) AS regras,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_documentos_exigidos d
          JOIN atividades_base a ON a.id = d.atividade_id
          WHERE d.deleted_at IS NULL AND d.ativo = true
        ) AS documentos,
        COALESCE(SUM(jsonb_array_length(COALESCE(perguntas_publicas, '[]'::jsonb))), 0)::int AS perguntas,
        COALESCE(SUM(jsonb_array_length(COALESCE(alertas_publicos, '[]'::jsonb))), 0)::int AS alertas,
        COALESCE(SUM(jsonb_array_length(COALESCE(bloqueios_publicos, '[]'::jsonb))), 0)::int AS bloqueios
      FROM atividades_base;
    `,
    [TARGET_ACTIVITY_CODES]
  );

  const groups = await client.query(
    `
      SELECT split_part(codigo, '.', 1) AS grupo, COUNT(*)::int AS atividades
      FROM licenciamento_atividades
      WHERE deleted_at IS NULL AND codigo = ANY($1)
      GROUP BY split_part(codigo, '.', 1)
      ORDER BY grupo;
    `,
    [TARGET_ACTIVITY_CODES]
  );

  return {
    grupos: TARGET_GROUP_CODES,
    atividades_por_grupo: groups.rows,
    atividades: summary.rows[0].atividades,
    confirmadas: summary.rows[0].confirmadas,
    pendentes_normativas: summary.rows[0].pendentes_normativas,
    lacunas_textuais: summary.rows[0].lacunas_textuais,
    regras: summary.rows[0].regras,
    perguntas_publicas: summary.rows[0].perguntas,
    alertas_publicos: summary.rows[0].alertas,
    bloqueios_publicos: summary.rows[0].bloqueios,
    documentos: summary.rows[0].documentos,
  };
}

async function seedLicenciamentoFase2D21({ silent = false } = {}) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const gate = await validateFase2D21Gate(client);
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

      await upsertNormLink(client, lookups.normas.DECRETO_MUNICIPAL_021_2020?.id, row.id, 'Regulamento operacional municipal para complementacao normativa Fase 2D.2.1.');
      await upsertNormLink(client, lookups.normas.ANEXO_II_A?.id, row.id, 'Atividade sujeita ao licenciamento ambiental municipal.');
      await upsertNormLink(client, lookups.normas.CONSEMA_001_2022_REFERENCIA?.id, row.id, 'Referencia comparativa, sem substituicao automatica da matriz municipal.');
    }

    const summary = await collectSummary(client);
    await client.query('COMMIT');

    const result = {
      success: true,
      fase: '2D.2.1',
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
  seedLicenciamentoFase2D21()
    .then(() => db.end())
    .catch(() => db.end().finally(() => process.exit(1)));
}

module.exports = seedLicenciamentoFase2D21;
module.exports.ACTIVITIES = ACTIVITIES;
module.exports.TARGET_ACTIVITY_CODES = TARGET_ACTIVITY_CODES;
module.exports.TARGET_GROUP_CODES = TARGET_GROUP_CODES;
module.exports.STATUS_NORMATIVO = STATUS_NORMATIVO;
module.exports.validateFase2D21Gate = validateFase2D21Gate;
