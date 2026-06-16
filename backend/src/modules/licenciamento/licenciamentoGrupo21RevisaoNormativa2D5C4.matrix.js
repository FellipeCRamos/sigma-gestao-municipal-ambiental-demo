const FASE_REVISAO_NORMATIVA = '2D.5C.4';
const GRUPO = 21;
const NOME_GRUPO = 'Obras e Estruturas Diversas';

function campo(texto, interpretacao = 'regra_normativa', extra = {}) {
  return {
    texto,
    interpretacao,
    naoAplicavel: false,
    valorNormativoValido: true,
    ...extra,
  };
}

function naoAplicavel() {
  return {
    texto: '-',
    interpretacao: 'nao_aplicavel',
    naoAplicavel: true,
    valorNormativoValido: true,
  };
}

function regra(id, coluna, texto, classe, extra = {}) {
  return {
    id,
    coluna,
    texto,
    classe,
    tipo: extra.tipo || 'enquadramento',
    condicional: extra.condicional === true,
    residual: extra.residual === true,
    dispensa: extra.dispensa === true,
    parametro: extra.parametro || null,
    operador: extra.operador || null,
    valorInicial: extra.valorInicial ?? null,
    valorFinal: extra.valorFinal ?? null,
    minimoInclusivo: extra.minimoInclusivo ?? null,
    maximoInclusivo: extra.maximoInclusivo ?? null,
    unidade: extra.unidade || '',
    impactoLocal: extra.impactoLocal || 'Todos',
    aptoParaSeedRevisado: extra.aptoParaSeedRevisado !== false,
    observacao: extra.observacao || '',
  };
}

function lacuna(campoNormativo, descricao, consequencia, codigo = null) {
  return {
    codigo,
    campo: campoNormativo,
    descricao,
    consequencia,
    severidade: 'bloqueante_para_seed_integral',
  };
}

function bloqueio(codigo, parametro, condicao, motivo) {
  return {
    codigo,
    parametro,
    condicao,
    motivo,
    acao: 'bloquear_enquadramento_municipal_automatico',
  };
}

const MATRIZ_GRUPO21_2D5C4 = [
  {
    codigo: '21.01',
    atividade: 'Microdrenagem (redes de drenagem de aguas pluviais com diametro de tubulacao requerida menor que 1.000 mm e seus dispositivos de drenagem), sem necessidade de intervencao em corpos hidricos (drenagens, canalizacao e/ou retificacoes, dentre outros). Nao inclui canais de drenagem.',
    tipo: 'N',
    parametro: { nome: 'Comprimento da Linha', sigla: 'CL', unidade: 'km' },
    enquadramento: {
      classeSimplificada: campo(
        'Todos, desde que vinculada a obras de pavimentacao e recapeamento asfaltico, dispensada de licenciamento em area urbana',
        'regra_condicional_de_dispensa'
      ),
      pequeno: campo('Demais casos', 'regra_residual'),
      medio: naoAplicavel(),
      grande: naoAplicavel(),
    },
    potencialPoluidorDegradador: 'Baixo',
    impactoLocal: { texto: 'Todos', tipo: 'universal', parametro: null },
    regras: [
      regra(
        '21.01-dispensa-urbana-vinculada',
        'classeSimplificada',
        'Todos, desde que vinculada a obras de pavimentacao e recapeamento asfaltico, dispensada de licenciamento em area urbana',
        'dispensa_condicionada',
        {
          tipo: 'dispensa_de_licenciamento',
          condicional: true,
          dispensa: true,
          parametro: 'CL',
          unidade: 'km',
          aptoParaSeedRevisado: false,
          observacao: 'Nao converter a dispensa condicionada em licenca simplificada.',
        }
      ),
      regra('21.01-demais-casos', 'pequeno', 'Demais casos', 'Pequeno', {
        residual: true,
        condicional: true,
        parametro: 'CL',
        unidade: 'km',
        observacao: 'Regra residual valida para casos nao enquadrados na dispensa condicionada.',
      }),
    ],
    regrasCondicionais: [
      'Separar a dispensa de licenciamento em area urbana vinculada a pavimentacao/recapeamento da regra residual "Demais casos".',
      'Nao aplicar a linha quando houver intervencao em corpos hidricos ou canais de drenagem.',
    ],
    lacunasReais: [],
    bloqueiosMunicipais: [],
    statusRevisado: 'parcialmente_apto_regra_condicional',
    aptidaoSeed: 'parcial',
    aptoIntegralParaSeed: false,
    observacaoTecnica: 'A linha possui fonte suficiente para matriz tecnica, mas exige parametrizacao condicional. A dispensa nao deve ser achatada em classe simplificada.',
  },
  {
    codigo: '21.02',
    atividade: 'Urbanizacao em margens de corpos hidricos interiores (lagunares, lacustres, fluviais e em reservatorios).',
    tipo: 'N',
    parametro: { nome: 'Area de intervencao', sigla: 'AIN', unidade: 'ha' },
    enquadramento: {
      classeSimplificada: naoAplicavel(),
      pequeno: campo('AIN <= 1'),
      medio: campo('1 < AIN <= 10'),
      grande: campo('AIN > 10'),
    },
    potencialPoluidorDegradador: 'Medio',
    impactoLocal: { texto: 'Todos', tipo: 'universal', parametro: null },
    regras: [
      regra('21.02-ain-ate-1', 'pequeno', 'AIN <= 1', 'Pequeno', { parametro: 'AIN', operador: 'menor_ou_igual', valorFinal: 1, maximoInclusivo: true, unidade: 'ha' }),
      regra('21.02-ain-1-a-10', 'medio', '1 < AIN <= 10', 'Medio', { parametro: 'AIN', operador: 'entre', valorInicial: 1, valorFinal: 10, minimoInclusivo: false, maximoInclusivo: true, unidade: 'ha' }),
      regra('21.02-ain-acima-10', 'grande', 'AIN > 10', 'Grande', { parametro: 'AIN', operador: 'maior_que', valorInicial: 10, minimoInclusivo: false, unidade: 'ha' }),
    ],
    regrasCondicionais: [],
    lacunasReais: [],
    bloqueiosMunicipais: [],
    statusRevisado: 'apto_para_seed_revisado',
    aptidaoSeed: 'sim',
    aptoIntegralParaSeed: true,
    observacaoTecnica: 'Classe simplificada ausente por nao aplicabilidade, nao por lacuna. As tres faixas AIN cobrem o parametro.',
  },
  {
    codigo: '21.03',
    atividade: 'Urbanizacao de orlas maritimas e estuarinas.',
    tipo: 'N',
    parametro: { nome: 'Area de intervencao', sigla: 'AIN', unidade: 'ha' },
    enquadramento: {
      classeSimplificada: naoAplicavel(),
      pequeno: campo('AIN <= 1'),
      medio: campo('1 < AIN <= 10'),
      grande: campo('AIN > 10'),
    },
    potencialPoluidorDegradador: 'Alto',
    impactoLocal: { texto: 'Todos', tipo: 'universal', parametro: null },
    regras: [
      regra('21.03-ain-ate-1', 'pequeno', 'AIN <= 1', 'Pequeno', { parametro: 'AIN', operador: 'menor_ou_igual', valorFinal: 1, maximoInclusivo: true, unidade: 'ha' }),
      regra('21.03-ain-1-a-10', 'medio', '1 < AIN <= 10', 'Medio', { parametro: 'AIN', operador: 'entre', valorInicial: 1, valorFinal: 10, minimoInclusivo: false, maximoInclusivo: true, unidade: 'ha' }),
      regra('21.03-ain-acima-10', 'grande', 'AIN > 10', 'Grande', { parametro: 'AIN', operador: 'maior_que', valorInicial: 10, minimoInclusivo: false, unidade: 'ha' }),
    ],
    regrasCondicionais: [],
    lacunasReais: [],
    bloqueiosMunicipais: [],
    statusRevisado: 'apto_para_seed_revisado',
    aptidaoSeed: 'sim',
    aptoIntegralParaSeed: true,
    observacaoTecnica: 'Potencial poluidor/degradador alto preservado. Classe simplificada "-" tratada como nao aplicavel.',
  },
  {
    codigo: '21.04',
    atividade: 'Atracadouro, ancoradouro, pieres e trapiches, sem realizacao de obras de dragagem, aterros, enrocamento e/ou quebra-mar.',
    tipo: 'N',
    parametro: { nome: 'Capacidade de atracacao/ancoragem', sigla: 'NE', unidade: 'numero de embarcacoes' },
    enquadramento: {
      classeSimplificada: campo('NE <= 5'),
      pequeno: naoAplicavel(),
      medio: naoAplicavel(),
      grande: naoAplicavel(),
    },
    potencialPoluidorDegradador: 'Medio',
    impactoLocal: { texto: 'NE <= 5', tipo: 'limitado', parametro: 'NE', operador: 'menor_ou_igual', valor: 5 },
    regras: [
      regra('21.04-ne-ate-5', 'classeSimplificada', 'NE <= 5', 'Classe Simplificada', { parametro: 'NE', operador: 'menor_ou_igual', valorFinal: 5, maximoInclusivo: true, unidade: 'numero de embarcacoes' }),
    ],
    regrasCondicionais: [
      'A atividade somente foi reconhecida como impacto local municipal ate NE <= 5.',
      'Nao aplicar quando houver dragagem, aterros, enrocamento e/ou quebra-mar.',
    ],
    lacunasReais: [],
    bloqueiosMunicipais: [
      bloqueio('21.04', 'NE', 'NE > 5', 'Extrapola o porte limite de impacto local informado pela tabela.'),
    ],
    statusRevisado: 'parcialmente_apto_impacto_local_limitado',
    aptidaoSeed: 'parcial',
    aptoIntegralParaSeed: false,
    observacaoTecnica: 'A seed municipal pode simular apenas NE <= 5. Valores acima devem permanecer bloqueados sem fonte complementar.',
  },
  {
    codigo: '21.05',
    atividade: 'Rampa para lancamento de barcos.',
    tipo: 'N',
    parametro: { nome: 'Area util', sigla: 'AU', unidade: 'm2' },
    enquadramento: {
      classeSimplificada: campo('Todos'),
      pequeno: naoAplicavel(),
      medio: naoAplicavel(),
      grande: naoAplicavel(),
    },
    potencialPoluidorDegradador: 'Medio',
    impactoLocal: { texto: 'Todos', tipo: 'universal', parametro: null },
    regras: [
      regra('21.05-todos', 'classeSimplificada', 'Todos', 'Classe Simplificada', { parametro: 'AU', operador: 'todos', unidade: 'm2' }),
    ],
    regrasCondicionais: [],
    lacunasReais: [],
    bloqueiosMunicipais: [],
    statusRevisado: 'apto_para_seed_revisado',
    aptidaoSeed: 'sim',
    aptoIntegralParaSeed: true,
    observacaoTecnica: '"Todos" e valor normativo valido para classe simplificada e impacto local.',
  },
  {
    codigo: '21.06',
    atividade: 'Restauracao, reabilitacao e/ou melhoramento de estradas ou rodovias municipais e vicinais.',
    tipo: 'N',
    parametro: { nome: 'Extensao da via', sigla: 'EV', unidade: 'km' },
    enquadramento: {
      classeSimplificada: campo('EV < 30'),
      pequeno: campo('EV > 30'),
      medio: naoAplicavel(),
      grande: naoAplicavel(),
    },
    potencialPoluidorDegradador: 'Medio',
    impactoLocal: { texto: 'Todos', tipo: 'universal', parametro: null },
    regras: [
      regra('21.06-ev-menor-30', 'classeSimplificada', 'EV < 30', 'Classe Simplificada', { parametro: 'EV', operador: 'menor_que', valorFinal: 30, maximoInclusivo: false, unidade: 'km' }),
      regra('21.06-ev-maior-30', 'pequeno', 'EV > 30', 'Pequeno', { parametro: 'EV', operador: 'maior_que', valorInicial: 30, minimoInclusivo: false, unidade: 'km' }),
    ],
    regrasCondicionais: [
      'A igualdade EV = 30 nao fica coberta quando a leitura adotada e EV < 30 e EV > 30.',
    ],
    lacunasReais: [
      lacuna('EV = 30', 'A planilha apresentada na fase informa EV < 30 e EV > 30, deixando a igualdade sem classe expressa.', 'Bloquear seed integral ate confirmacao da igualdade.', '21.06'),
    ],
    divergenciasConferenciaAnterior: [
      'A matriz visual 2D.5C.3 registrava EV <= 30; a leitura apresentada para 2D.5C.4 usa EV < 30. A igualdade deve ser confirmada em fonte complementar antes de parametrizacao operacional integral.',
    ],
    bloqueiosMunicipais: [],
    statusRevisado: 'parcialmente_apto_lacuna_igualdade',
    aptidaoSeed: 'parcial',
    aptoIntegralParaSeed: false,
    observacaoTecnica: 'As faixas EV < 30 e EV > 30 sao validas, mas EV = 30 permanece pendente na revisao controlada.',
  },
  {
    codigo: '21.07',
    atividade: 'Pavimentacao de estradas e rodovias municipais e vicinais.',
    tipo: 'N',
    parametro: { nome: 'Extensao da via', sigla: 'EV', unidade: 'km' },
    enquadramento: {
      classeSimplificada: campo('Todos'),
      pequeno: naoAplicavel(),
      medio: naoAplicavel(),
      grande: naoAplicavel(),
    },
    potencialPoluidorDegradador: 'Medio',
    impactoLocal: { texto: 'Todos', tipo: 'universal', parametro: null },
    regras: [
      regra('21.07-todos', 'classeSimplificada', 'Todos', 'Classe Simplificada', { parametro: 'EV', operador: 'todos', unidade: 'km' }),
    ],
    regrasCondicionais: [],
    lacunasReais: [],
    bloqueiosMunicipais: [],
    statusRevisado: 'apto_para_seed_revisado',
    aptidaoSeed: 'sim',
    aptoIntegralParaSeed: true,
    observacaoTecnica: '"Todos" e regra valida para classe simplificada e impacto local.',
  },
  {
    codigo: '21.08',
    atividade: 'Implantacao de obras de arte corrente em estradas e rodovias municipais e vicinais.',
    tipo: 'N',
    parametro: { nome: 'Largura do corpo hidrico', sigla: 'LCH', unidade: 'm' },
    enquadramento: {
      classeSimplificada: campo('Todos'),
      pequeno: naoAplicavel(),
      medio: naoAplicavel(),
      grande: naoAplicavel(),
    },
    potencialPoluidorDegradador: 'Medio',
    impactoLocal: { texto: 'Todos', tipo: 'universal', parametro: null },
    regras: [
      regra('21.08-todos', 'classeSimplificada', 'Todos', 'Classe Simplificada', { parametro: 'LCH', operador: 'todos', unidade: 'm' }),
    ],
    regrasCondicionais: [],
    lacunasReais: [],
    bloqueiosMunicipais: [],
    statusRevisado: 'apto_para_seed_revisado',
    aptidaoSeed: 'sim',
    aptoIntegralParaSeed: true,
    observacaoTecnica: 'A revisao trata "Todos" como classe simplificada valida. O campo "-" nos demais portes nao e lacuna.',
  },
  {
    codigo: '21.09',
    atividade: 'Implantacao de obras de arte especiais.',
    tipo: 'N',
    parametro: { nome: 'Comprimento da estrutura', sigla: 'CE', unidade: 'm' },
    enquadramento: {
      classeSimplificada: campo('CE <= 15'),
      pequeno: campo('15 < CE <= 30'),
      medio: naoAplicavel(),
      grande: naoAplicavel(),
    },
    potencialPoluidorDegradador: 'Medio',
    impactoLocal: { texto: 'CE <= 30', tipo: 'limitado', parametro: 'CE', operador: 'menor_ou_igual', valor: 30 },
    regras: [
      regra('21.09-ce-ate-15', 'classeSimplificada', 'CE <= 15', 'Classe Simplificada', { parametro: 'CE', operador: 'menor_ou_igual', valorFinal: 15, maximoInclusivo: true, unidade: 'm' }),
      regra('21.09-ce-15-a-30', 'pequeno', '15 < CE <= 30', 'Pequeno', { parametro: 'CE', operador: 'entre', valorInicial: 15, valorFinal: 30, minimoInclusivo: false, maximoInclusivo: true, unidade: 'm' }),
    ],
    regrasCondicionais: [
      'A competencia municipal de impacto local fica limitada a CE <= 30.',
    ],
    lacunasReais: [],
    bloqueiosMunicipais: [
      bloqueio('21.09', 'CE', 'CE > 30', 'A tabela nao reconhece CE > 30 como impacto local municipal.'),
    ],
    statusRevisado: 'parcialmente_apto_impacto_local_limitado',
    aptidaoSeed: 'parcial',
    aptoIntegralParaSeed: false,
    observacaoTecnica: 'Seed municipal somente para CE <= 30. CE > 30 deve permanecer bloqueado sem fonte complementar.',
  },
  {
    codigo: '21.10',
    atividade: 'Estabelecimentos prisionais e semelhantes.',
    tipo: 'N',
    parametro: { nome: 'Capacidade projetada', sigla: 'CP', unidade: 'numero de pessoas' },
    enquadramento: {
      classeSimplificada: campo('CP <= 150'),
      pequeno: campo('150 < CP <= 450'),
      medio: campo('450 < CP <= 800'),
      grande: campo('CP > 800'),
    },
    potencialPoluidorDegradador: 'Medio',
    impactoLocal: { texto: 'Todos', tipo: 'universal', parametro: null },
    regras: [
      regra('21.10-cp-ate-150', 'classeSimplificada', 'CP <= 150', 'Classe Simplificada', { parametro: 'CP', operador: 'menor_ou_igual', valorFinal: 150, maximoInclusivo: true, unidade: 'numero de pessoas' }),
      regra('21.10-cp-150-a-450', 'pequeno', '150 < CP <= 450', 'Pequeno', { parametro: 'CP', operador: 'entre', valorInicial: 150, valorFinal: 450, minimoInclusivo: false, maximoInclusivo: true, unidade: 'numero de pessoas' }),
      regra('21.10-cp-450-a-800', 'medio', '450 < CP <= 800', 'Medio', { parametro: 'CP', operador: 'entre', valorInicial: 450, valorFinal: 800, minimoInclusivo: false, maximoInclusivo: true, unidade: 'numero de pessoas' }),
      regra('21.10-cp-acima-800', 'grande', 'CP > 800', 'Grande', { parametro: 'CP', operador: 'maior_que', valorInicial: 800, minimoInclusivo: false, unidade: 'numero de pessoas' }),
    ],
    regrasCondicionais: [],
    lacunasReais: [],
    bloqueiosMunicipais: [],
    statusRevisado: 'apto_para_seed_revisado',
    aptidaoSeed: 'sim',
    aptoIntegralParaSeed: true,
    observacaoTecnica: 'As quatro faixas CP cobrem a capacidade projetada e impacto local e "Todos".',
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function flattenCampos(matriz) {
  return matriz.flatMap((item) => Object.entries(item.enquadramento).map(([campoNormativo, valor]) => ({
    codigo: item.codigo,
    campo: campoNormativo,
    texto: valor.texto,
    interpretacao: valor.interpretacao,
    naoAplicavel: valor.naoAplicavel === true,
  })));
}

function buildResumoMatriz(matriz = MATRIZ_GRUPO21_2D5C4) {
  const campos = flattenCampos(matriz);
  const camposNaoAplicaveis = campos.filter((item) => item.naoAplicavel);
  const camposTodos = campos.filter((item) => String(item.texto).toLowerCase() === 'todos');
  const camposDemaisCasos = campos.filter((item) => String(item.texto).toLowerCase() === 'demais casos');
  const lacunasReais = matriz.flatMap((item) => (item.lacunasReais || []).map((lacunaItem) => ({
    ...lacunaItem,
    codigo: lacunaItem.codigo || item.codigo,
  })));
  const bloqueiosMunicipais = matriz.flatMap((item) => item.bloqueiosMunicipais || []);

  return {
    totalCodigos: matriz.length,
    codigosComFonteSuficiente: matriz.map((item) => item.codigo),
    codigosAptos: matriz.filter((item) => item.aptidaoSeed === 'sim').map((item) => item.codigo),
    codigosParcialmenteAptos: matriz.filter((item) => item.aptidaoSeed === 'parcial').map((item) => item.codigo),
    codigosAindaBloqueados: matriz.filter((item) => item.aptidaoSeed === 'nao').map((item) => item.codigo),
    codigosComRegraCondicional: matriz.filter((item) => (item.regrasCondicionais || []).length > 0).map((item) => item.codigo),
    codigosComImpactoLocalLimitado: matriz.filter((item) => item.impactoLocal?.tipo === 'limitado').map((item) => item.codigo),
    camposNaoAplicaveis,
    camposTodos,
    camposDemaisCasos,
    lacunasReais,
    bloqueiosMunicipais,
  };
}

function getMatrizRevisaoNormativaGrupo21() {
  return clone(MATRIZ_GRUPO21_2D5C4);
}

module.exports = {
  FASE_REVISAO_NORMATIVA,
  GRUPO,
  NOME_GRUPO,
  getMatrizRevisaoNormativaGrupo21,
  buildResumoMatriz,
};
