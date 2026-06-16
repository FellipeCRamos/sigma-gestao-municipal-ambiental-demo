const db = require('../../../config/db');
const seedLicenciamentoFase2D1 = require('./seedLicenciamentoFase2D1');

const TARGET_GROUP_CODES = ['15', '16', '17', '23'];
const TARGET_ACTIVITY_CODES = [
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

const FASE_2D2_BLOCKED_MESSAGE =
  'Fase 2D.2 bloqueada. A Fase 2D.1 nao esta consolidada, a liberacao tecnica da Fase 2D nao foi localizada ou os bloqueios de producao nao estao preservados.';

const GROUP_CATEGORIES = Object.freeze({
  15: 'Industria de Produtos Alimentares',
  16: 'Industria de Bebidas',
  17: 'Industrias Diversas',
  23: 'Servicos de Saude e Areas Afins',
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
    'exige_validacao_resina',
    'exige_validacao_solvente',
    'exige_validacao_emissao_atmosferica',
    'exige_validacao_residuo_perigoso',
    'exige_validacao_inflamavel',
  ],
  23: [
    'exige_validacao_sanitaria',
    'exige_validacao_rss',
    'exige_validacao_pgrss',
    'exige_validacao_biologico',
    'exige_validacao_quimico',
    'exige_validacao_cirurgia',
    'exige_validacao_internacao',
    'exige_validacao_laboratorio',
    'exige_validacao_efluentes',
    'exige_validacao_tanatopraxia',
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
  'ART/RRT ou responsabilidade tecnica',
  'Plano de Gerenciamento de Residuos Solidos',
  'Comprovantes ou contratos de destinacao de residuos',
  'Autorizacao de supressao vegetal, quando aplicavel',
  'Manifestacao sobre APP, quando aplicavel',
  'Projeto de drenagem',
  'Projeto de controle de efluentes',
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
    'Relacao de produtos quimicos',
    'FISPQ',
    'PGRS com residuos perigosos',
    'Contrato de destinacao de Classe I, quando aplicavel',
    'Projeto de exaustao ou ventilacao',
    'Controle de emissoes, odor ou VOC',
    'Plano de emergencia',
    'Armazenamento de inflamaveis',
  ],
  23: [
    'PGRSS',
    'Licenca ou alvara sanitario ou protocolo',
    'Contrato de coleta, transporte, tratamento e destinacao de RSS',
    'Layout setorizado',
    'Declaracao de numero de leitos',
    'Relacao de procedimentos',
    'Relacao de reagentes',
    'Descricao de efluentes',
    'Plano de emergencia ou contingencia',
    'Responsabilidade tecnica',
  ],
});

function json(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
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
  const potential = options.potencial || 'medio';
  const derived = options.tipoLicenca === null || options.classe === null
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
    tipo_atividade: options.tipo_atividade || (grupo === '23' ? 'nao_industrial' : 'industrial'),
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
  activity('15.20', 'Industrializacao e beneficiamento de carne e embutidos', 'Industrializacao, beneficiamento de carne, desossa, charqueada, embutidos e outros produtos alimentares de origem animal.', {
    unidade: 't_mes',
    parametro: 'Capacidade de producao mensal',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 100,
    formula: 'PRODUCAO_MES_DIRETA',
    parametros_entrada: ['producao_mes_toneladas'],
    perguntas: [
      question('produto_alimenticio', 'Produto alimenticio fabricado ou beneficiado', 'text'),
      question('producao_mes_toneladas', 'Capacidade produtiva mensal', 'number', 't/mes'),
      question('possui_abate', 'Ha abate no empreendimento?'),
      question('graxaria', 'Ha graxaria?'),
      question('subproduto_animal', 'Ha subproduto animal?'),
      question('efluente_organico', 'Ha efluente organico?'),
      question('efluente_sem_tratamento', 'Ha efluente sem tratamento?'),
      question('lancamento_corpo_hidrico', 'Ha lancamento em corpo hidrico?'),
      question('camara_fria', 'Ha camara fria?'),
      question('inspecao_sanitaria', 'Ha inspecao sanitaria ou protocolo?'),
    ],
    alertas: [
      { severidade: 'atencao', mensagem: 'Atividade alimenticia pode exigir manifestacao ou registro sanitario.' },
      { severidade: 'atencao', mensagem: 'Efluente de lavagem e residuos organicos devem possuir tratamento e destinacao regular.' },
      { severidade: 'atencao', mensagem: 'Resultado preliminar e nao substitui analise tecnica da SMAD.' },
    ],
    bloqueios: [
      block('15.20_ABATE', 'Se houver abate animal, nao concluir automaticamente em 15.20.', null, 'atividade_associada_detectada'),
      block('15.20_EFLUENTE_SEM_TRATAMENTO', 'Efluente industrial sem tratamento exige validacao tecnica.'),
    ],
    observacoes: 'Atividade piloto preservada da Fase 2B. A lista completa do Grupo 15 nao foi localizada nas fontes internas desta rodada; demais codigos dependem de validacao normativa antes de parametrizacao.',
    docs: ['Descricao do sistema de refrigeracao', 'Destinacao de sangue residual, gordura, salmoura, residuos organicos, embalagens e lodo'],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 10, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada', expressao: 'CMP <= 10 t/mes' },
      { suffix: 'pequeno', porte: 'pequeno', min: 10, max: 30, expressao: '10 < CMP <= 30 t/mes' },
      { suffix: 'medio', porte: 'medio', min: 30, max: 60, expressao: '30 < CMP <= 60 t/mes' },
      { suffix: 'grande', porte: 'grande', min: 60, max: 100, expressao: '60 < CMP <= 100 t/mes' },
    ], 'PRODUCAO_MES_DIRETA'),
  }),
  activity('16.06', 'Fabricacao de cervejas, chopes e maltes', 'Fabricacao de cervejas, chopes e maltes, exceto artesanal.', {
    unidade: 'litros_dia',
    parametro: 'Producao diaria',
    potencial: 'alto',
    limiteTipo: 'valor_maximo',
    limiteValor: 25000,
    formula: 'PRODUCAO_DIA_DIRETA',
    parametros_entrada: ['producao_dia_litros'],
    perguntas: [
      question('tipo_bebida', 'Tipo de bebida', 'text'),
      question('producao_dia_litros', 'Producao diaria', 'number', 'L/dia'),
      question('artesanal', 'A producao e artesanal?'),
      question('envase', 'Ha envase?'),
      question('fermentacao', 'Ha fermentacao?'),
      question('lavagem_recipientes', 'Ha lavagem de garrafas, barris ou recipientes?'),
      question('efluente_sem_tratamento', 'Ha efluente sem tratamento?'),
      question('lancamento_corpo_hidrico', 'Ha lancamento em corpo hidrico?'),
      question('caldeira', 'Ha caldeira?'),
      question('gases', 'Ha armazenamento de CO2 ou gases?'),
    ],
    alertas: [
      { severidade: 'atencao', mensagem: 'Industria de bebidas pode apresentar alto consumo de agua e efluente organico.' },
      { severidade: 'atencao', mensagem: 'Lavagem de recipientes e produtos quimicos de limpeza exigem controle de efluentes.' },
    ],
    bloqueios: [
      block('16.06_ARTESANAL', 'Producao artesanal nao deve ser concluida automaticamente em 16.06.', null, 'bloqueada_por_inconsistencia'),
      block('16.06_EFLUENTE_SEM_TRATAMENTO', 'Efluente sem tratamento exige validacao tecnica.'),
    ],
    observacoes: 'Atividade piloto preservada da Fase 2B. A lista completa do Grupo 16 nao foi localizada nas fontes internas desta rodada; demais codigos dependem de validacao normativa.',
    regras: directRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 10000, operador: 'menor_igual', expressao: 'PD <= 10.000 L/dia' },
      { suffix: 'medio', porte: 'medio', min: 10000, max: 20000, expressao: '10.000 < PD <= 20.000 L/dia' },
      { suffix: 'grande', porte: 'grande', min: 20000, max: 25000, expressao: '20.000 < PD <= 25.000 L/dia' },
    ], 'PRODUCAO_DIA_DIRETA'),
  }),
  activity('17.05', 'Fabricacao com fibra de vidro e resina', 'Fabricacao de pecas, artefatos e estruturas utilizando fibra de vidro e resina.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'alto',
    limiteTipo: 'valor_maximo',
    limiteValor: 2000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [
      question('produto_fabricado', 'Produto fabricado', 'text'),
      question('area_construida_m2', 'Area construida', 'number', 'm2'),
      question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'),
      question('resina', 'Ha uso de resina?'),
      question('solvente', 'Ha uso de solvente?'),
      question('catalisador', 'Ha uso de catalisador?'),
      question('tinta_verniz', 'Ha tinta ou verniz?'),
      question('emissao_atmosferica', 'Ha emissao atmosferica?'),
      question('residuo_perigoso', 'Ha residuo perigoso?'),
      question('inflamavel', 'Ha armazenamento de inflamaveis?'),
      question('residuo_classe_i_sem_destinacao', 'Ha residuo Classe I sem destinacao?'),
      question('quimico_perigoso_sem_controle', 'Ha produto quimico perigoso sem controle?'),
    ],
    alertas: [
      { severidade: 'atencao', mensagem: 'Resinas, solventes, catalisadores e tintas podem gerar residuos Classe I e emissao atmosferica.' },
      { severidade: 'atencao', mensagem: 'FISPQ, segregacao, ventilacao e controle de incendio devem ser validados.' },
    ],
    bloqueios: [
      block('17.05_RESIDUO_CLASSE_I_SEM_DESTINACAO', 'Residuo Classe I sem destinacao impede conclusao orientativa.'),
      block('17.05_QUIMICO_SEM_CONTROLE', 'Produto quimico perigoso sem controle impede conclusao orientativa.'),
    ],
    observacoes: 'Atividade piloto preservada da Fase 2B. A lista completa do Grupo 17 nao foi localizada nas fontes internas desta rodada; demais codigos dependem de validacao normativa.',
    regras: directRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 500, operador: 'menor_igual', expressao: 'I <= 500 m2' },
      { suffix: 'medio', porte: 'medio', min: 500, max: 1000, expressao: '500 < I <= 1.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 1000, max: 2000, expressao: '1.000 < I <= 2.000 m2' },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('23.01', 'Hospital', 'Hospital com atendimento, internacao e servicos de saude correlatos.', {
    unidade: 'leitos',
    parametro: 'Numero de leitos',
    potencial: 'alto',
    limiteTipo: 'valor_maximo',
    limiteValor: 200,
    formula: 'NUMERO_LEITOS_DIRETA',
    parametros_entrada: ['numero_leitos'],
    validacoes: ['exige_validacao_tecnica_obrigatoria'],
    perguntas: [
      question('numero_leitos', 'Numero de leitos', 'number', 'leitos'),
      question('internacao', 'Ha internacao?'),
      question('centro_cirurgico', 'Ha centro cirurgico?'),
      question('uti', 'Ha UTI?'),
      question('laboratorio_interno', 'Ha laboratorio interno?'),
      question('lavanderia_hospitalar', 'Ha lavanderia hospitalar?'),
      question('necrotorio', 'Ha necroterio?'),
      question('rss_infectante', 'Ha RSS infectante?'),
      question('rss_quimico', 'Ha RSS quimico?'),
      question('contrato_rss', 'Ha contrato de coleta e destinacao de RSS?'),
    ],
    docs: ['PGRSS', 'Contrato de coleta e tratamento de RSS', 'Declaracao de numero de leitos'],
    bloqueios: [
      block('23.01_LIMITE_NLE', 'Hospitais com mais de 200 leitos excedem o limite de impacto local.', null, 'limite_impacto_local_excedido'),
    ],
    regras: directRules('alto', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 50, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 50, max: 100 },
      { suffix: 'grande', porte: 'grande', min: 100, max: 200 },
    ], 'NUMERO_LEITOS_DIRETA'),
  }),
  activity('23.02', 'Laboratorios de analises clinicas e biologicas', 'Laboratorios de analises clinicas, patologicas, microbiologicas e/ou biologia molecular.', {
    unidade: 'todos',
    parametro: 'Todos',
    potencial: 'medio',
    formula: 'PARAMETRO_SANITARIO_QUALITATIVO',
    validacoes: ['exige_validacao_tecnica_obrigatoria'],
    perguntas: [
      question('analises_clinicas', 'Realiza analises clinicas?'),
      question('patologicas', 'Realiza analises patologicas?'),
      question('microbiologicas', 'Realiza analises microbiologicas?'),
      question('biologia_molecular', 'Realiza biologia molecular?'),
      question('material_biologico', 'Ha coleta ou manipulacao de material biologico?'),
      question('autoclave', 'Ha autoclave?'),
      question('reagentes_quimicos', 'Ha reagentes quimicos?'),
      question('rss', 'Ha armazenamento temporario de RSS?'),
    ],
    regras: [rule('todos', 'medio', null, null, { potencial: 'medio', operador: 'qualquer', formula: 'PARAMETRO_SANITARIO_QUALITATIVO' })],
  }),
  activity('23.03', 'Laboratorio tecnico com reagente quimico', 'Laboratorio ambiental, de alimentos, farmaceutico ou agronomico com uso de reagente quimico.', {
    unidade: 'm2',
    parametro: 'Area construida + area de estocagem',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 3000,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [
      question('tipo_analise', 'Tipo de analise', 'text'),
      question('reagente_quimico', 'Ha uso de reagente quimico?'),
      question('solventes', 'Ha solventes?'),
      question('acidos_bases', 'Ha acidos ou bases?'),
      question('residuo_quimico', 'Ha residuo quimico?'),
      question('capela_exaustao', 'Ha capela ou exaustao?'),
      question('fispq', 'Ha FISPQ?'),
    ],
    regras: directRules('medio', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 500, operador: 'menor_igual' },
      { suffix: 'medio', porte: 'medio', min: 500, max: 1000 },
      { suffix: 'grande', porte: 'grande', min: 1000, max: 3000 },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM'),
  }),
  activity('23.04', 'Hospital veterinario', 'Hospital veterinario com internacao e servicos correlatos.', {
    unidade: 'leitos',
    parametro: 'Numero de leitos',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 100,
    formula: 'NUMERO_LEITOS_DIRETA',
    parametros_entrada: ['numero_leitos'],
    validacoes: ['exige_validacao_tecnica_obrigatoria', 'exige_validacao_normativa'],
    perguntas: [
      question('numero_leitos', 'Numero de leitos', 'number', 'leitos'),
      question('internacao', 'Ha internacao?'),
      question('centro_cirurgico', 'Ha centro cirurgico?'),
      question('raio_x', 'Ha raio-X?'),
      question('laboratorio_interno', 'Ha laboratorio interno?'),
      question('necropsia_carcacas', 'Ha necroterio ou carcacas?'),
      question('rss_veterinario', 'Ha RSS veterinario?'),
    ],
    observacoes: 'A extracao anterior indicou lacuna normativa para 25 < NLE <= 50. Essa faixa foi mantida como requer_validacao_normativa, sem inventar classe ou taxa.',
    bloqueios: [
      block('23.04_FAIXA_INTERMEDIARIA', 'Faixa de 25 < NLE <= 50 depende de validacao normativa.', null, 'requer_validacao_normativa'),
    ],
    regras: directRules('medio', [
      { suffix: 'ate_25', porte: 'simplificado', min: null, max: 25, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada', expressao: 'NLE <= 25' },
      { suffix: 'faixa_intermediaria_pendente', porte: 'medio', min: 25, max: 50, status: 'requer_validacao_normativa', tipoLicenca: null, classe: null, expressao: '25 < NLE <= 50 - pendente de validacao normativa', observacaoInterna: 'Faixa intermediaria de hospital veterinario nao confirmada no acervo interno.' },
      { suffix: 'superior_confirmada', porte: 'medio', min: 50, max: 100, status: 'requer_validacao_normativa', tipoLicenca: null, classe: null, expressao: '50 < NLE <= 100 - faixa superior indicada, classe pendente de confirmacao', observacaoInterna: 'Faixa superior indicada pela extracao, mas sem classe confirmada nesta rodada.' },
    ], 'NUMERO_LEITOS_DIRETA'),
  }),
  activity('23.05', 'UBS e clinicas com procedimentos cirurgicos', 'Unidade Basica de Saude, clinicas medicas e veterinarias com procedimentos cirurgicos.', {
    unidade: 'todos',
    parametro: 'Todos',
    potencial: 'baixo',
    formula: 'PARAMETRO_SANITARIO_QUALITATIVO',
    validacoes: ['exige_validacao_tecnica_obrigatoria'],
    perguntas: [
      question('procedimento_cirurgico', 'Ha procedimento cirurgico?'),
      question('sala_cirurgica', 'Ha sala cirurgica?'),
      question('anestesia', 'Ha anestesia?'),
      question('internacao', 'Ha internacao?'),
      question('material_biologico', 'Ha coleta de material biologico?'),
      question('perfurocortantes', 'Ha perfurocortantes?'),
      question('rss', 'Ha RSS?'),
    ],
    bloqueios: [
      block('23.05_SEM_CIRURGIA', 'Clinica sem procedimento cirurgico deve ser tratada como possivel dispensa ou consulta previa.', null, 'possivel_dispensa_verificar'),
    ],
    regras: [rule('todos', 'simplificado', null, null, { potencial: 'baixo', operador: 'qualquer', formula: 'PARAMETRO_SANITARIO_QUALITATIVO' })],
  }),
  activity('23.06', 'Medicina legal e funerarios com tanatopraxia', 'Medicina legal e servicos funerarios com embalsamento, tanatopraxia ou somatoconservacao.', {
    unidade: 'ha',
    parametro: 'Area construida + area de estocagem convertida para ha',
    potencial: 'medio',
    limiteTipo: 'valor_maximo',
    limiteValor: 1,
    formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM_M2_PARA_HA',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    perguntas: [
      question('area_construida_m2', 'Area construida', 'number', 'm2'),
      question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'),
      question('medicina_legal', 'Ha medicina legal?'),
      question('servico_funerario', 'Ha servico funerario?'),
      question('embalsamento', 'Ha embalsamento?'),
      question('tanatopraxia', 'Ha tanatopraxia?'),
      question('somatoconservacao', 'Ha somatoconservacao?'),
      question('formol_conservantes', 'Ha formol, conservantes ou desinfetantes?'),
      question('efluente_liquido', 'Ha efluente liquido?'),
      question('residuo_biologico_quimico', 'Ha residuo biologico, quimico ou perfurocortante?'),
      question('funeraria_sem_tanatopraxia', 'Funeraria sem tanatopraxia, embalsamento ou somatoconservacao?'),
      question('cremacao', 'Ha cremacao?'),
    ],
    bloqueios: [
      block('23.06_FUNERARIA_SEM_TANATOPRAXIA', 'Funeraria sem tanatopraxia, embalsamento ou somatoconservacao deve ser tratada como possivel dispensa ou consulta previa.', null, 'possivel_dispensa_verificar'),
      block('23.06_CREMACAO', 'Cremacao exige analise tecnica e normativa especifica.', null, 'requer_validacao_normativa'),
    ],
    regras: directRules('medio', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 0.05, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada', expressao: 'I <= 0,05 ha' },
      { suffix: 'pequeno', porte: 'pequeno', min: 0.05, max: 0.1, expressao: '0,05 < I <= 0,1 ha' },
      { suffix: 'medio', porte: 'medio', min: 0.1, max: 0.5, expressao: '0,1 < I <= 0,5 ha' },
      { suffix: 'grande', porte: 'grande', min: 0.5, max: 1, expressao: '0,5 < I <= 1 ha' },
    ], 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM_M2_PARA_HA'),
  }),
];

async function validateFase2D2Gate(client = db) {
  const releaseResult = await client.query(`
    SELECT ready, status, bloqueios_producao_json
    FROM licenciamento_homologacao_liberacoes
    WHERE status = 'liberada_tecnicamente' AND ready = true
    ORDER BY confirmado_em DESC NULLS LAST, id DESC
    LIMIT 1;
  `);
  const release = releaseResult.rows[0] || null;
  const blockers = release?.bloqueios_producao_json || {};
  const bloqueiosOk = blockers.dam_real === true
    && blockers.cobranca_oficial === true
    && blockers.protocolo_definitivo === true
    && blockers.decisao_automatica === true;

  const fase2d1Codes = seedLicenciamentoFase2D1.TARGET_ACTIVITY_CODES || [];
  const fase2d1Result = await client.query(
    `
      SELECT
        COUNT(*)::int AS atividades,
        COUNT(DISTINCT split_part(codigo, '.', 1))::int AS grupos
      FROM licenciamento_atividades
      WHERE deleted_at IS NULL AND ativo = true AND codigo = ANY($1);
    `,
    [fase2d1Codes]
  );
  const fase2d1 = fase2d1Result.rows[0] || {};
  const fase2d1Ok = Number(fase2d1.atividades) === fase2d1Codes.length && Number(fase2d1.grupos) === 4;

  if (!release || !bloqueiosOk || !fase2d1Ok) {
    const error = new Error(FASE_2D2_BLOCKED_MESSAGE);
    error.statusCode = 409;
    error.details = {
      liberacao_tecnica: Boolean(release),
      bloqueios_producao_ok: bloqueiosOk,
      fase2d1_consolidada: fase2d1Ok,
    };
    throw error;
  }

  return {
    ready: true,
    liberacao: release,
    bloqueios_producao_ok: true,
    fase2d1_consolidada: true,
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
    const error = new Error(`Parametro base ausente para Fase 2D.2: ${label} ${key}. Execute as fases anteriores antes do seed.`);
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
    seed_piloto_codigo: existing.rows[0]?.seed_piloto_codigo || 'fase2d2',
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
  const seedPrefix = activityRow.seed_piloto_codigo === 'fase2b' ? 'fase2b' : 'fase2d2';
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
    exige_responsavel_tecnico: /ART|RRT|projeto|estudo|planta|layout|plano|responsabilidade tecnica/i.test(name),
    exige_art_rrt: /ART|RRT|projeto|estudo/i.test(name),
    ordem: order,
    fundamento: 'Decreto Municipal n. 021/2020, Anexo I-C e parametrizacao Fase 2D.2.',
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
        (
          SELECT COUNT(*)::int
          FROM licenciamento_regras_enquadramento r
          JOIN atividades_base a ON a.id = r.atividade_id
          WHERE r.deleted_at IS NULL
        ) AS regras,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_regra_parametros rp
          JOIN licenciamento_regras_enquadramento r ON r.id = rp.regra_enquadramento_id
          JOIN atividades_base a ON a.id = r.atividade_id
          WHERE rp.deleted_at IS NULL AND r.deleted_at IS NULL
        ) AS parametros_regra,
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
    regras: summary.rows[0].regras,
    parametros_regra: summary.rows[0].parametros_regra,
    perguntas_publicas: summary.rows[0].perguntas,
    alertas_publicos: summary.rows[0].alertas,
    bloqueios_publicos: summary.rows[0].bloqueios,
    documentos: summary.rows[0].documentos,
  };
}

async function seedLicenciamentoFase2D2({ silent = false } = {}) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const gate = await validateFase2D2Gate(client);
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

      await upsertNormLink(client, lookups.normas.DECRETO_MUNICIPAL_021_2020?.id, row.id, 'Regulamento operacional municipal para parametrizacao Fase 2D.2.');
      await upsertNormLink(client, lookups.normas.ANEXO_II_A?.id, row.id, 'Atividade sujeita ao licenciamento ambiental municipal.');
      await upsertNormLink(client, lookups.normas.CONSEMA_001_2022_REFERENCIA?.id, row.id, 'Referencia comparativa, sem substituicao automatica da matriz municipal.');
    }

    const summary = await collectSummary(client);
    await client.query('COMMIT');

    const result = {
      success: true,
      fase: '2D.2',
      gate,
      summary,
      pendencias_normativas: [
        'Lista completa e faixas dos Grupos 15, 16 e 17 nao foram localizadas nas fontes internas desta rodada; apenas atividades-piloto confirmadas foram enriquecidas.',
        'Hospital veterinario 23.04 possui faixa intermediaria 25 < NLE <= 50 pendente de validacao normativa.',
      ],
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
  seedLicenciamentoFase2D2()
    .then(() => db.end())
    .catch(() => db.end().finally(() => process.exit(1)));
}

module.exports = seedLicenciamentoFase2D2;
module.exports.ACTIVITIES = ACTIVITIES;
module.exports.TARGET_ACTIVITY_CODES = TARGET_ACTIVITY_CODES;
module.exports.validateFase2D2Gate = validateFase2D2Gate;
