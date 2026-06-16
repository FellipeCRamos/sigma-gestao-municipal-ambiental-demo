const FASE_SEED_CONTROLADO = '2D.5C.5';
const GRUPO = 21;
const NOME_GRUPO = 'Obras e Estruturas Diversas';
const SEED_CODE = 'fase2d5c5';

const CODIGOS_APTOS_SEED_CONTROLADO = ['21.02', '21.03', '21.05', '21.07', '21.08', '21.10'];
const CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO = ['21.01', '21.04', '21.06', '21.09'];

const BLOQUEIOS_CODIGOS_PARCIAIS = [
  {
    codigo: '21.01',
    condicao: 'dispensa condicionada',
    motivo: 'Contem hipotese de dispensa separada de licenca; nao converter dispensa em licenca simplificada.',
  },
  {
    codigo: '21.04',
    condicao: 'NE > 5',
    motivo: 'Apto apenas para NE <= 5; NE > 5 depende de fonte complementar de competencia/impacto local.',
  },
  {
    codigo: '21.06',
    condicao: 'EV = 30',
    motivo: 'Lacuna real de igualdade identificada na Fase 2D.5C.4.',
  },
  {
    codigo: '21.09',
    condicao: 'CE > 30',
    motivo: 'Apto apenas para CE <= 30; CE > 30 depende de fonte complementar de competencia/impacto local.',
  },
];

function parametro(chave, label, sigla, unidade) {
  return { chave, label, sigla, unidade };
}

function regra(id, expressao, porte, options = {}) {
  return {
    id,
    expressao,
    porte,
    tipoLicenca: options.tipoLicenca,
    classe: options.classe,
    potencial: options.potencial,
    operadorRegra: options.operadorRegra || 'faixa',
    operadorParametro: options.operadorParametro || options.operadorRegra || 'faixa',
    valorMinimo: options.valorMinimo ?? null,
    valorMaximo: options.valorMaximo ?? null,
    incluiMinimo: options.incluiMinimo !== false,
    incluiMaximo: options.incluiMaximo !== false,
    statusResultado: options.statusResultado || 'requer_validacao_tecnica',
    tipoResultado: 'licenciamento_controlado',
    tipoAtoLicenciamento: options.tipoAtoLicenciamento,
    observacao: options.observacao || 'Regra operacional liberada exclusivamente para seed controlado 2D.5C.5.',
  };
}

function atividade({
  codigo,
  nome,
  descricao,
  parametroPrincipal,
  potencial,
  regras,
  enquadramento,
  fundamentoLiberacao,
}) {
  return {
    codigo,
    nome,
    descricao,
    grupo: GRUPO,
    nomeGrupo: NOME_GRUPO,
    categoria: NOME_GRUPO,
    tipo: 'N',
    tipoAtividade: 'nao_industrial',
    parametroPrincipal,
    parametro: parametroPrincipal,
    potencialPoluidorDegradador: potencial,
    potencialPoluidorPadrao: potencial.toLowerCase(),
    impactoLocal: 'Todos',
    limiteImpactoLocal: {
      tipo: 'todos',
      valor: null,
      unidade: parametroPrincipal.unidade,
    },
    regraNormativaEnquadramento: enquadramento,
    tipoAtoLicenciamento: [...new Set(regras.map((item) => item.tipoAtoLicenciamento))].join(' / '),
    fundamentoNormativo: 'Decreto Municipal n. 021/2020, Anexo II-A; planilha oficial analisada na Fase 2D.5C.4.',
    fundamentoLiberacao,
    status: 'apto_seed_controlado',
    origemLiberacao: 'Fase 2D.5C.4 - Revisao Normativa Controlada do Grupo 21',
    observacao: 'Liberacao operacional limitada aos codigos integralmente aptos; codigos 21.01, 21.04, 21.06 e 21.09 permanecem fora deste seed.',
    parametrosEntrada: [parametroPrincipal.chave],
    perguntasPublicas: [],
    bloqueiosPublicos: [],
    alertasPublicos: [
      {
        severidade: 'atencao',
        mensagem: 'Simulacao preliminar. Nao constitui licenca, dispensa, DAM, cobranca oficial ou decisao administrativa.',
      },
      {
        severidade: 'atencao',
        mensagem: 'Seed controlado 2D.5C.5: apenas codigos integralmente aptos do Grupo 21 foram parametrizados.',
      },
    ],
    validacoesRequeridas: [
      'exige_validacao_tecnica_sigma',
      'status_normativo_apto_seed_controlado_2d5c5',
      'preserva_bloqueios_parciais_2d5c4',
    ],
    regras,
  };
}

const MATRIZ_SEED_CONTROLADO_GRUPO21_2D5C5 = [
  atividade({
    codigo: '21.02',
    nome: 'Urbanizacao em margens de corpos hidricos interiores',
    descricao: 'Urbanizacao em margens de corpos hidricos interiores (lagunares, lacustres, fluviais e em reservatorios).',
    parametroPrincipal: parametro('area_intervencao_ha', 'Area de intervencao', 'AIN', 'ha'),
    potencial: 'Medio',
    enquadramento: 'AIN <= 1 pequeno; 1 < AIN <= 10 medio; AIN > 10 grande. Classe simplificada "-" tratada como nao aplicavel.',
    fundamentoLiberacao: 'Codigo integralmente apto na revisao 2D.5C.4, com impacto local universal e faixas AIN completas.',
    regras: [
      regra('21.02-ain-ate-1', 'AIN <= 1', 'pequeno', {
        tipoLicenca: 'LMU',
        classe: 'classe_i',
        potencial: 'medio',
        operadorRegra: 'menor_igual',
        operadorParametro: 'menor_igual',
        valorMaximo: 1,
        tipoAtoLicenciamento: 'Licenca Municipal Unica - Classe I',
      }),
      regra('21.02-ain-1-a-10', '1 < AIN <= 10', 'medio', {
        tipoLicenca: 'LMU',
        classe: 'classe_ii',
        potencial: 'medio',
        operadorRegra: 'faixa',
        operadorParametro: 'faixa',
        valorMinimo: 1,
        valorMaximo: 10,
        incluiMinimo: false,
        tipoAtoLicenciamento: 'Licenca Municipal Unica - Classe II',
      }),
      regra('21.02-ain-acima-10', 'AIN > 10', 'grande', {
        tipoLicenca: 'LMU',
        classe: 'classe_iii',
        potencial: 'medio',
        operadorRegra: 'faixa',
        operadorParametro: 'faixa',
        valorMinimo: 10,
        incluiMinimo: false,
        tipoAtoLicenciamento: 'Licenca Municipal Unica - Classe III',
      }),
    ],
  }),
  atividade({
    codigo: '21.03',
    nome: 'Urbanizacao de orlas maritimas e estuarinas',
    descricao: 'Urbanizacao de orlas maritimas e estuarinas.',
    parametroPrincipal: parametro('area_intervencao_ha', 'Area de intervencao', 'AIN', 'ha'),
    potencial: 'Alto',
    enquadramento: 'AIN <= 1 pequeno; 1 < AIN <= 10 medio; AIN > 10 grande. Potencial poluidor/degradador alto preservado.',
    fundamentoLiberacao: 'Codigo integralmente apto na revisao 2D.5C.4, com impacto local universal e potencial alto explicitado.',
    regras: [
      regra('21.03-ain-ate-1', 'AIN <= 1', 'pequeno', {
        tipoLicenca: 'LMU',
        classe: 'classe_ii',
        potencial: 'alto',
        operadorRegra: 'menor_igual',
        operadorParametro: 'menor_igual',
        valorMaximo: 1,
        tipoAtoLicenciamento: 'Licenca Municipal Unica - Classe II',
      }),
      regra('21.03-ain-1-a-10', '1 < AIN <= 10', 'medio', {
        tipoLicenca: 'LMU',
        classe: 'classe_iii',
        potencial: 'alto',
        operadorRegra: 'faixa',
        operadorParametro: 'faixa',
        valorMinimo: 1,
        valorMaximo: 10,
        incluiMinimo: false,
        tipoAtoLicenciamento: 'Licenca Municipal Unica - Classe III',
      }),
      regra('21.03-ain-acima-10', 'AIN > 10', 'grande', {
        tipoLicenca: 'LMU',
        classe: 'classe_iv',
        potencial: 'alto',
        operadorRegra: 'faixa',
        operadorParametro: 'faixa',
        valorMinimo: 10,
        incluiMinimo: false,
        tipoAtoLicenciamento: 'Licenca Municipal Unica - Classe IV',
      }),
    ],
  }),
  atividade({
    codigo: '21.05',
    nome: 'Rampa para lancamento de barcos',
    descricao: 'Rampa para lancamento de barcos.',
    parametroPrincipal: parametro('area_util_m2', 'Area util', 'AU', 'm2'),
    potencial: 'Medio',
    enquadramento: 'Classe simplificada Todos; demais portes nao aplicaveis; impacto local Todos.',
    fundamentoLiberacao: 'Codigo integralmente apto na revisao 2D.5C.4; "Todos" e regra normativa valida para classe simplificada e impacto local.',
    regras: [
      regra('21.05-todos', 'Todos', 'simplificado', {
        tipoLicenca: 'LMS',
        classe: 'simplificada',
        potencial: 'medio',
        operadorRegra: 'qualquer',
        operadorParametro: 'qualquer',
        tipoAtoLicenciamento: 'Licenciamento Simplificado',
      }),
    ],
  }),
  atividade({
    codigo: '21.07',
    nome: 'Pavimentacao de estradas e rodovias municipais e vicinais',
    descricao: 'Pavimentacao de estradas e rodovias municipais e vicinais.',
    parametroPrincipal: parametro('extensao_via_km', 'Extensao da via', 'EV', 'km'),
    potencial: 'Medio',
    enquadramento: 'Classe simplificada Todos; demais portes nao aplicaveis; impacto local Todos.',
    fundamentoLiberacao: 'Codigo integralmente apto na revisao 2D.5C.4; "Todos" e regra normativa valida para classe simplificada e impacto local.',
    regras: [
      regra('21.07-todos', 'Todos', 'simplificado', {
        tipoLicenca: 'LMS',
        classe: 'simplificada',
        potencial: 'medio',
        operadorRegra: 'qualquer',
        operadorParametro: 'qualquer',
        tipoAtoLicenciamento: 'Licenciamento Simplificado',
      }),
    ],
  }),
  atividade({
    codigo: '21.08',
    nome: 'Implantacao de obras de arte corrente em estradas e rodovias municipais e vicinais',
    descricao: 'Implantacao de obras de arte corrente em estradas e rodovias municipais e vicinais.',
    parametroPrincipal: parametro('largura_corpo_hidrico_m', 'Largura do corpo hidrico', 'LCH', 'm'),
    potencial: 'Medio',
    enquadramento: 'Classe simplificada Todos; demais portes nao aplicaveis; impacto local Todos.',
    fundamentoLiberacao: 'Codigo integralmente apto na revisao 2D.5C.4; "Todos" e regra normativa valida e "-" nao e lacuna.',
    regras: [
      regra('21.08-todos', 'Todos', 'simplificado', {
        tipoLicenca: 'LMS',
        classe: 'simplificada',
        potencial: 'medio',
        operadorRegra: 'qualquer',
        operadorParametro: 'qualquer',
        tipoAtoLicenciamento: 'Licenciamento Simplificado',
      }),
    ],
  }),
  atividade({
    codigo: '21.10',
    nome: 'Estabelecimentos prisionais e semelhantes',
    descricao: 'Estabelecimentos prisionais e semelhantes.',
    parametroPrincipal: parametro('capacidade_projetada_pessoas', 'Capacidade projetada', 'CP', 'numero de pessoas'),
    potencial: 'Medio',
    enquadramento: 'CP <= 150 classe simplificada; 150 < CP <= 450 pequeno; 450 < CP <= 800 medio; CP > 800 grande.',
    fundamentoLiberacao: 'Codigo integralmente apto na revisao 2D.5C.4; faixas CP cobrem integralmente o parametro e impacto local e Todos.',
    regras: [
      regra('21.10-cp-ate-150', 'CP <= 150', 'simplificado', {
        tipoLicenca: 'LMS',
        classe: 'simplificada',
        potencial: 'medio',
        operadorRegra: 'menor_igual',
        operadorParametro: 'menor_igual',
        valorMaximo: 150,
        tipoAtoLicenciamento: 'Licenciamento Simplificado',
      }),
      regra('21.10-cp-150-a-450', '150 < CP <= 450', 'pequeno', {
        tipoLicenca: 'LMU',
        classe: 'classe_i',
        potencial: 'medio',
        operadorRegra: 'faixa',
        operadorParametro: 'faixa',
        valorMinimo: 150,
        valorMaximo: 450,
        incluiMinimo: false,
        tipoAtoLicenciamento: 'Licenca Municipal Unica - Classe I',
      }),
      regra('21.10-cp-450-a-800', '450 < CP <= 800', 'medio', {
        tipoLicenca: 'LMU',
        classe: 'classe_ii',
        potencial: 'medio',
        operadorRegra: 'faixa',
        operadorParametro: 'faixa',
        valorMinimo: 450,
        valorMaximo: 800,
        incluiMinimo: false,
        tipoAtoLicenciamento: 'Licenca Municipal Unica - Classe II',
      }),
      regra('21.10-cp-acima-800', 'CP > 800', 'grande', {
        tipoLicenca: 'LMU',
        classe: 'classe_iii',
        potencial: 'medio',
        operadorRegra: 'faixa',
        operadorParametro: 'faixa',
        valorMinimo: 800,
        incluiMinimo: false,
        tipoAtoLicenciamento: 'Licenca Municipal Unica - Classe III',
      }),
    ],
  }),
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findDuplicatedCodes(codes) {
  const seen = new Set();
  const duplicated = new Set();
  codes.forEach((code) => {
    if (seen.has(code)) duplicated.add(code);
    seen.add(code);
  });
  return [...duplicated];
}

function validateMatrizSeedControladoGrupo21(matriz = MATRIZ_SEED_CONTROLADO_GRUPO21_2D5C5) {
  const codes = matriz.map((item) => item.codigo);
  const unexpectedCodes = codes.filter((code) => !CODIGOS_APTOS_SEED_CONTROLADO.includes(code));
  const missingCodes = CODIGOS_APTOS_SEED_CONTROLADO.filter((code) => !codes.includes(code));
  const partialCodesIncluded = codes.filter((code) => CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO.includes(code));
  const duplicatedCodes = findDuplicatedCodes(codes);

  return {
    success: unexpectedCodes.length === 0
      && missingCodes.length === 0
      && partialCodesIncluded.length === 0
      && duplicatedCodes.length === 0,
    expectedCodes: CODIGOS_APTOS_SEED_CONTROLADO,
    actualCodes: codes,
    unexpectedCodes,
    missingCodes,
    partialCodesIncluded,
    duplicatedCodes,
  };
}

function getMatrizSeedControladoGrupo21() {
  return clone(MATRIZ_SEED_CONTROLADO_GRUPO21_2D5C5);
}

function getBloqueiosCodigosParciaisGrupo21() {
  return clone(BLOQUEIOS_CODIGOS_PARCIAIS);
}

module.exports = {
  FASE_SEED_CONTROLADO,
  GRUPO,
  NOME_GRUPO,
  SEED_CODE,
  CODIGOS_APTOS_SEED_CONTROLADO,
  CODIGOS_PARCIAIS_BLOQUEADOS_SEED_CONTROLADO,
  getMatrizSeedControladoGrupo21,
  getBloqueiosCodigosParciaisGrupo21,
  validateMatrizSeedControladoGrupo21,
};
