const db = require('../../../config/db');

const VRTE_2026 = {
  ano: 2026,
  valor_vrte: 4.9279,
  data_inicio_vigencia: '2026-01-01',
  data_fim_vigencia: '2026-12-31',
  ativo: true,
  fundamento_normativo: 'Valor informado para simulacao interna da SMAD, sujeito a atualizacao conforme ato oficial vigente.',
  observacao: 'Valor utilizado para validacao tecnica do motor de taxas por VRTE.',
};

const NORMA_CODES = Object.freeze({
  DECRETO: 'DECRETO_MUNICIPAL_021_2020',
  ANEXO_I_A: 'ANEXO_I_A',
  ANEXO_II_A: 'ANEXO_II_A',
  ANEXO_III_A: 'ANEXO_III_A',
  ANEXO_I_C: 'ANEXO_I_C',
  CONAMA_307: 'CONAMA_307_2002',
  ABNT_10004: 'ABNT_NBR_10004',
  ABNT_12235: 'ABNT_NBR_12235',
  ABNT_11174: 'ABNT_NBR_11174',
  CONSEMA: 'CONSEMA_001_2022_REFERENCIA',
});

const BASE_TYPES = [
  ['LMP', 'Licenca Municipal Previa', 'licenca'],
  ['LMI', 'Licenca Municipal de Instalacao', 'licenca'],
  ['LMO', 'Licenca Municipal de Operacao', 'licenca'],
  ['LMU', 'Licenca Municipal Unica', 'licenca'],
  ['LMA', 'Licenca Municipal de Ampliacao', 'licenca'],
  ['LMR', 'Licenca Municipal de Regularizacao', 'licenca'],
  ['LMS', 'Licenciamento Simplificado', 'licenca_simplificada'],
  ['AMA', 'Autorizacao Municipal Ambiental', 'autorizacao'],
  ['DISPENSA', 'Dispensa de licenciamento', 'dispensa'],
];

const BASE_CLASSES = [
  ['simplificada', 'Classe Simplificada', 0],
  ['classe_i', 'Classe I', 1],
  ['classe_ii', 'Classe II', 2],
  ['classe_iii', 'Classe III', 3],
  ['classe_iv', 'Classe IV', 4],
];

const BASE_POTENCIAIS = [
  ['baixo', 'Baixo', 1],
  ['medio', 'Medio', 2],
  ['alto', 'Alto', 3],
];

const TAX_TABLE = {
  industrial: {
    tipo_taxa: 'atividade_industrial_poluidora',
    tipo_atividade: 'industrial',
    LMP: [57, 115, 230, 460],
    LMI: [90, 181, 361, 723],
    LMO: [74, 148, 296, 591],
    LMU: [74, 148, 296, 591],
    LMA: [222, 443, 887, 1773],
    LMR: [222, 443, 887, 1773],
  },
  nao_industrial: {
    tipo_taxa: 'atividade_nao_industrial_degradadora',
    tipo_atividade: 'nao_industrial',
    LMP: [80, 161, 321, 643],
    LMI: [113, 227, 453, 906],
    LMO: [97, 194, 387, 774],
    LMU: [97, 194, 387, 774],
    LMA: [290, 581, 1162, 2323],
    LMR: [290, 581, 1162, 2323],
  },
};

const CLASS_CODES = ['classe_i', 'classe_ii', 'classe_iii', 'classe_iv'];

const NORMS = [
  {
    codigo: NORMA_CODES.DECRETO,
    titulo: 'Decreto Municipal n. 021/2020',
    tipo: 'decreto',
    numero: '021',
    ano: 2020,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Norma municipal de licenciamento ambiental usada como matriz principal da parametrizacao piloto.',
  },
  {
    codigo: NORMA_CODES.ANEXO_I_A,
    titulo: 'Anexo I-A do Decreto Municipal n. 021/2020',
    tipo: 'outro',
    numero: 'I-A',
    ano: 2020,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Matriz de enquadramento e tabela de valor do enquadramento em VRTE.',
  },
  {
    codigo: NORMA_CODES.ANEXO_II_A,
    titulo: 'Anexo II-A do Decreto Municipal n. 021/2020',
    tipo: 'outro',
    numero: 'II-A',
    ano: 2020,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Atividades sujeitas ao licenciamento ambiental municipal.',
  },
  {
    codigo: NORMA_CODES.ANEXO_III_A,
    titulo: 'Anexo III-A do Decreto Municipal n. 021/2020',
    tipo: 'outro',
    numero: 'III-A',
    ano: 2020,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Atividades dispensadas, conforme aplicabilidade tecnica.',
  },
  {
    codigo: NORMA_CODES.ANEXO_I_C,
    titulo: 'Anexo I-C do Decreto Municipal n. 021/2020',
    tipo: 'outro',
    numero: 'I-C',
    ano: 2020,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Documentacao basica para procedimentos de licenciamento.',
  },
  {
    codigo: NORMA_CODES.CONAMA_307,
    titulo: 'Resolucao CONAMA n. 307/2002',
    tipo: 'resolucao',
    numero: '307',
    ano: 2002,
    esfera: 'federal',
    orgao: 'CONAMA',
    ementa: 'Referencia tecnica sobre residuos da construcao civil.',
  },
  {
    codigo: NORMA_CODES.ABNT_10004,
    titulo: 'ABNT NBR 10004',
    tipo: 'norma_abnt',
    numero: '10004',
    esfera: 'tecnica',
    orgao: 'ABNT',
    ementa: 'Referencia tecnica para classificacao de residuos solidos.',
  },
  {
    codigo: NORMA_CODES.ABNT_12235,
    titulo: 'ABNT NBR 12235',
    tipo: 'norma_abnt',
    numero: '12235',
    esfera: 'tecnica',
    orgao: 'ABNT',
    ementa: 'Referencia tecnica para armazenamento de residuos Classe I.',
  },
  {
    codigo: NORMA_CODES.ABNT_11174,
    titulo: 'ABNT NBR 11174',
    tipo: 'norma_abnt',
    numero: '11174',
    esfera: 'tecnica',
    orgao: 'ABNT',
    ementa: 'Referencia tecnica para armazenamento de residuos Classe II.',
  },
  {
    codigo: NORMA_CODES.CONSEMA,
    titulo: 'Resolucao CONSEMA n. 001/2022',
    tipo: 'resolucao',
    numero: '001',
    ano: 2022,
    esfera: 'estadual',
    orgao: 'CONSEMA',
    ementa: 'Referencia comparativa para futura atualizacao normativa.',
    observacao: 'Referencia comparativa. Nao substituir automaticamente a matriz municipal do Decreto n. 021/2020.',
  },
];

const GENERAL_DOCUMENTS = [
  'Requerimento padrao',
  'Formulario de enquadramento',
  'Documento de identificacao do requerente',
  'Documento',
  'Contrato social ou equivalente, quando pessoa juridica',
  'Comprovante de inscricao municipal, quando aplicavel',
  'Comprovante de endereco',
  'Anuencia municipal de uso e ocupacao do solo',
  'Matricula atualizada do imovel',
  'Contrato de locacao, posse ou autorizacao de uso, quando aplicavel',
  'Planta de localizacao',
  'Croqui ou layout do empreendimento',
  'Memorial descritivo da atividade',
  'ART/RRT de projetos e estudos tecnicos, quando aplicavel',
  'Plano de Gerenciamento de Residuos Solidos, quando aplicavel',
  'Publicacao do requerimento, quando aplicavel',
  'CNDMA, quando exigivel',
  'Autorizacao de supressao vegetal, quando aplicavel',
  'Documentacao de destinacao de residuos, quando aplicavel',
];

const ACTIVITIES = [
  {
    codigo: '18.06',
    nome: 'Terraplenagem - corte e aterro',
    categoria: 'Uso e Ocupacao do Solo',
    tipo_atividade: 'nao_industrial',
    descricao: 'Terraplenagem (corte e aterro), quando vinculada a atividade nao sujeita ao licenciamento ambiental.',
    unidade_parametro_principal: 'm2',
    parametro_principal_label: 'Area terraplanada',
    potencial_poluidor_padrao: 'medio',
    limite_impacto_local_tipo: 'todos',
    formula_codigo: 'REGRA_COMPOSTA_AREA_TALUDE',
    parametros_entrada: ['area_terraplanada_m2', 'altura_talude_m'],
    expressao_original: 'Area terraplanada e altura maxima dos taludes, conforme matriz municipal.',
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo II-A',
    observacoes: 'Requer validacao tecnica, geotecnica, drenagem, APP e supressao quando aplicavel.',
    perguntas_publicas: [
      { chave: 'atividade_principal_sujeita_licenciamento', label: 'A atividade principal e sujeita ao licenciamento ambiental?', tipo: 'boolean' },
      { chave: 'havera_corte', label: 'Havera corte?', tipo: 'boolean' },
      { chave: 'havera_aterro', label: 'Havera aterro?', tipo: 'boolean' },
      { chave: 'bota_fora_residuos', label: 'Havera bota-fora com residuos?', tipo: 'boolean' },
      { chave: 'recebe_material_externo', label: 'Havera recebimento de material externo?', tipo: 'boolean' },
      { chave: 'havera_contencao_taludes', label: 'Havera contencao de taludes?', tipo: 'boolean' },
      { chave: 'havera_drenagem', label: 'Havera drenagem provisoria ou definitiva?', tipo: 'boolean' },
      { chave: 'rural_agropecuario', label: 'A terraplenagem ocorre em propriedade rural com objetivo agropecuario?', tipo: 'boolean' },
      { chave: 'aterro_rcc', label: 'Havera aterro com RCC?', tipo: 'boolean' },
    ],
    regras: [
      { suffix: 'simplificado', tipoLicenca: 'LMS', classe: 'simplificada', potencial: 'medio', porte: 'simplificado', formula: 'REGRA_COMPOSTA_AREA_TALUDE', min: 500, max: 5000, status: 'requer_validacao_tecnica', params: [
        ['area_terraplanada_m2', 'Area terraplanada', 'm2', 500, 5000, false, true],
        ['altura_talude_m', 'Altura maxima do talude', 'm', 3, 5, false, true],
      ], expressao: '500 < area terraplanada <= 5.000 e 3 < altura talude <= 5' },
      { suffix: 'pequeno', tipoLicenca: 'LMU', classe: 'classe_i', potencial: 'medio', porte: 'pequeno', min: 5000, max: 10000, params: [['area_terraplanada_m2', 'Area terraplanada', 'm2', 5000, 10000, false, true]], expressao: '5.000 < area terraplanada <= 10.000' },
      { suffix: 'medio', tipoLicenca: 'LMU', classe: 'classe_ii', potencial: 'medio', porte: 'medio', min: 10000, max: 30000, params: [['area_terraplanada_m2', 'Area terraplanada', 'm2', 10000, 30000, false, true]], expressao: '10.000 < area terraplanada <= 30.000' },
      { suffix: 'grande', tipoLicenca: 'LMU', classe: 'classe_iii', potencial: 'medio', porte: 'grande', min: 30000, max: null, operador: 'maior_igual', params: [['area_terraplanada_m2', 'Area terraplanada', 'm2', 30000, null, false, true]], expressao: 'area terraplanada > 30.000' },
    ],
    docs: [
      'Projeto de terraplenagem',
      'Levantamento planialtimetrico',
      'Projeto de drenagem',
      'Projeto de contencao e estabilidade de taludes, quando aplicavel',
      'Manifestacao sobre APP, curso hidrico ou nascente',
      'Plano de controle de erosao e carreamento de sedimentos',
      'Destinacao de material excedente ou origem do material de aterro',
      'PRAD, quando aplicavel',
    ],
  },
  {
    codigo: '18.01',
    nome: 'Loteamento predominantemente residencial',
    categoria: 'Uso e Ocupacao do Solo',
    tipo_atividade: 'nao_industrial',
    descricao: 'Loteamento predominantemente residencial ou para unidades habitacionais populares.',
    unidade_parametro_principal: 'indice',
    parametro_principal_label: 'Indice calculado',
    potencial_poluidor_padrao: 'medio',
    limite_impacto_local_tipo: 'valor_maximo',
    limite_impacto_local_valor: 3000,
    limite_impacto_local_unidade: 'indice',
    formula_codigo: 'LOTES_X_LOTES_X_AREA_HA_DIV_1000',
    parametros_entrada: ['numero_lotes', 'area_total_ha'],
    expressao_original: 'I = numero de lotes x numero de lotes x area total (ha) / 1000',
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo II-A',
    perguntas_publicas: [
      { chave: 'predominantemente_residencial', label: 'O loteamento e predominantemente residencial?', tipo: 'boolean' },
      { chave: 'unidades_habitacionais_populares', label: 'Ha unidades habitacionais populares?', tipo: 'boolean' },
      { chave: 'abertura_vias', label: 'Havera abertura de vias?', tipo: 'boolean' },
      { chave: 'havera_terraplenagem', label: 'Havera terraplenagem?', tipo: 'boolean' },
      { chave: 'sistema_drenagem', label: 'Havera sistema de drenagem?', tipo: 'boolean' },
      { chave: 'anuencia_uso_solo', label: 'Existe anuencia municipal de uso e ocupacao do solo?', tipo: 'boolean' },
    ],
    regras: [
      { suffix: 'pequeno', tipoLicenca: 'LMU', classe: 'classe_i', potencial: 'medio', porte: 'pequeno', formula: 'LOTES_X_LOTES_X_AREA_HA_DIV_1000', min: null, max: 80, operador: 'menor_igual', expressao: 'I <= 80' },
      { suffix: 'medio', tipoLicenca: 'LMU', classe: 'classe_ii', potencial: 'medio', porte: 'medio', formula: 'LOTES_X_LOTES_X_AREA_HA_DIV_1000', min: 80, max: 600, expressao: '80 < I <= 600' },
      { suffix: 'grande', tipoLicenca: 'LMU', classe: 'classe_iii', potencial: 'medio', porte: 'grande', formula: 'LOTES_X_LOTES_X_AREA_HA_DIV_1000', min: 600, max: 3000, expressao: '600 < I <= 3000' },
    ],
    docs: [
      'Certidao de viabilidade urbanistica',
      'Planta georreferenciada',
      'Projeto urbanistico',
      'Projeto de drenagem',
      'Diretrizes de abastecimento de agua',
      'Diretrizes de esgotamento sanitario',
      'Manifestacao sobre APP e vegetacao',
      'Estudos ambientais pertinentes',
    ],
  },
  {
    codigo: '20.01',
    nome: 'Triagem e armazenamento de reciclaveis nao perigosos',
    categoria: 'Gerenciamento de Residuos',
    tipo_atividade: 'industrial',
    descricao: 'Triagem, desmontagem e/ou armazenamento temporario de residuos solidos reutilizaveis e/ou reciclaveis nao perigosos.',
    unidade_parametro_principal: 'm2',
    parametro_principal_label: 'Area construida mais area de estocagem',
    potencial_poluidor_padrao: 'baixo',
    limite_impacto_local_tipo: 'todos',
    formula_codigo: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo II-A',
    perguntas_publicas: [
      { chave: 'residuo_perigoso', label: 'Ha recebimento de residuo Classe I ou perigoso?', tipo: 'boolean' },
      { chave: 'contaminado', label: 'Ha contaminacao por oleo, solvente, combustivel, agrotoxico ou produto quimico?', tipo: 'boolean' },
      { chave: 'controle_incendio', label: 'Ha medidas de controle de incendio?', tipo: 'boolean' },
    ],
    regras: [
      { suffix: 'simplificado', tipoLicenca: 'LMS', classe: 'simplificada', potencial: 'baixo', porte: 'simplificado', formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', min: null, max: 2000, operador: 'menor_igual', expressao: 'I <= 2.000' },
      { suffix: 'pequeno', tipoLicenca: 'LMS', classe: 'simplificada', potencial: 'baixo', porte: 'pequeno', formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', min: 2000, max: 5000, expressao: '2.000 < I <= 5.000' },
      { suffix: 'medio', tipoLicenca: 'LMU', classe: 'classe_i', potencial: 'baixo', porte: 'medio', formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', min: 5000, max: 10000, expressao: '5.000 < I <= 10.000' },
      { suffix: 'grande', tipoLicenca: 'LMU', classe: 'classe_i', potencial: 'baixo', porte: 'grande', formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', min: 10000, max: null, operador: 'maior_igual', expressao: 'I > 10.000' },
    ],
    docs: [
      'Layout operacional',
      'Relacao dos residuos recebidos',
      'Declaracao de classificacao dos residuos',
      'Plano de Gerenciamento de Residuos Solidos',
      'Contratos ou comprovantes de destinacao',
      'Controle de entrada e saida de residuos',
      'Medidas de controle de vetores, incendio, poeira e drenagem',
    ],
    normasExtras: [NORMA_CODES.ABNT_10004],
  },
  {
    codigo: '20.09',
    nome: 'Aterro de RCC Classe A',
    categoria: 'Gerenciamento de Residuos',
    tipo_atividade: 'nao_industrial',
    descricao: 'Aterro de residuos solidos e rejeitos oriundos de atividades de construcao civil - Classe A.',
    unidade_parametro_principal: 'm3',
    parametro_principal_label: 'Capacidade de armazenamento',
    potencial_poluidor_padrao: 'baixo',
    limite_impacto_local_tipo: 'valor_maximo',
    limite_impacto_local_valor: 10000,
    limite_impacto_local_unidade: 'm3',
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo II-A',
    observacoes: 'Ha divergencia entre matriz extraida do Decreto e entendimentos operacionais anteriores; validar tecnicamente antes de uso decisorio.',
    perguntas_publicas: [
      { chave: 'rcc_classe_a_exclusivo', label: 'O recebimento sera exclusivamente de RCC Classe A?', tipo: 'boolean' },
      { chave: 'mistura_classes_b_c_d', label: 'Havera mistura com Classes B, C, D, organico, perigoso ou contaminado?', tipo: 'boolean' },
      { chave: 'app_curso_hidrico', label: 'Ha APP, curso hidrico, nascente ou area alagavel proxima?', tipo: 'boolean' },
    ],
    regras: [
      { suffix: 'pequeno', tipoLicenca: 'LMS', classe: 'simplificada', potencial: 'baixo', porte: 'pequeno', min: null, max: 1000, operador: 'menor_igual', expressao: 'CA <= 1.000 m3', requerValidacao: true },
      { suffix: 'medio', tipoLicenca: 'LMU', classe: 'classe_i', potencial: 'baixo', porte: 'medio', min: 1000, max: 5000, expressao: '1.000 < CA <= 5.000 m3', requerValidacao: true },
      { suffix: 'grande', tipoLicenca: 'LMU', classe: 'classe_i', potencial: 'baixo', porte: 'grande', min: 5000, max: 10000, expressao: '5.000 < CA <= 10.000 m3', requerValidacao: true },
    ],
    docs: [
      'Poligonal georreferenciada',
      'Declaracao da capacidade de armazenamento',
      'Plano de Gerenciamento de RCC',
      'Controle de origem do material',
      'Projeto de drenagem superficial',
      'Projeto de estabilidade, compactacao e taludes, quando aplicavel',
      'PRAD ou plano de encerramento',
      'Comprovacao de recebimento exclusivo de RCC Classe A',
    ],
    normasExtras: [NORMA_CODES.CONAMA_307, NORMA_CODES.ABNT_10004],
  },
  {
    codigo: '19.03',
    nome: 'Usina de geracao de energia solar fotovoltaica',
    categoria: 'Energia',
    tipo_atividade: 'nao_industrial',
    descricao: 'Usina de geracao de energia solar fotovoltaica.',
    unidade_parametro_principal: 'm2',
    parametro_principal_label: 'Area de intervencao',
    potencial_poluidor_padrao: 'baixo',
    limite_impacto_local_tipo: 'valor_maximo',
    limite_impacto_local_valor: 500000,
    limite_impacto_local_unidade: 'm2',
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo II-A',
    perguntas_publicas: [
      { chave: 'instalada_em_solo', label: 'A usina sera instalada em solo?', tipo: 'boolean' },
      { chave: 'subestacao_propria', label: 'Havera subestacao propria?', tipo: 'boolean' },
      { chave: 'linha_transmissao_associada', label: 'Havera linha de transmissao associada?', tipo: 'boolean' },
      { chave: 'baterias', label: 'Havera baterias?', tipo: 'boolean' },
    ],
    regras: [
      { suffix: 'simplificado', tipoLicenca: 'LMS', classe: 'simplificada', potencial: 'baixo', porte: 'simplificado', min: null, max: 50000, operador: 'menor_igual', expressao: 'AIN <= 50.000 m2' },
      { suffix: 'pequeno', tipoLicenca: 'LMS', classe: 'simplificada', potencial: 'baixo', porte: 'pequeno', min: 50000, max: 100000, expressao: '50.000 < AIN <= 100.000 m2' },
      { suffix: 'medio', tipoLicenca: 'LMU', classe: 'classe_i', potential: 'baixo', potencial: 'baixo', porte: 'medio', min: 100000, max: 300000, expressao: '100.000 < AIN <= 300.000 m2' },
      { suffix: 'grande', tipoLicenca: 'LMU', classe: 'classe_i', potencial: 'baixo', porte: 'grande', min: 300000, max: 500000, expressao: '300.000 < AIN <= 500.000 m2' },
    ],
    docs: [
      'Poligonal georreferenciada',
      'Layout dos modulos, inversores, transformadores, acessos e cercamento',
      'Declaracao da area de intervencao',
      'Declaracao da potencia instalada',
      'Mapa de APP, vegetacao e curso hidrico',
      'Projeto de drenagem e controle de erosao',
      'Plano de Gerenciamento de Residuos Solidos, incluindo eletroeletronicos',
    ],
  },
  {
    codigo: '15.20',
    nome: 'Industrializacao e beneficiamento de carne e embutidos',
    categoria: 'Industria de Produtos Alimentares',
    tipo_atividade: 'industrial',
    descricao: 'Industrializacao/beneficiamento de carne, desossa, charqueada, embutidos e outros produtos alimentares de origem animal.',
    unidade_parametro_principal: 't_mes',
    parametro_principal_label: 'Capacidade de producao',
    potencial_poluidor_padrao: 'medio',
    limite_impacto_local_tipo: 'valor_maximo',
    limite_impacto_local_valor: 100,
    limite_impacto_local_unidade: 't_mes',
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo II-A',
    perguntas_publicas: [
      { chave: 'possui_abate', label: 'Ha abate no empreendimento?', tipo: 'boolean' },
      { chave: 'produto_origem_animal', label: 'Ha produto de origem animal?', tipo: 'boolean' },
      { chave: 'efluente_organico', label: 'Ha efluente organico?', tipo: 'boolean' },
    ],
    regras: [
      { suffix: 'simplificado', tipoLicenca: 'LMS', classe: 'simplificada', potencial: 'medio', porte: 'simplificado', min: null, max: 10, operador: 'menor_igual', expressao: 'CMP <= 10 t/mes' },
      { suffix: 'pequeno', tipoLicenca: 'LMU', classe: 'classe_i', potencial: 'medio', porte: 'pequeno', min: 10, max: 30, expressao: '10 < CMP <= 30 t/mes' },
      { suffix: 'medio', tipoLicenca: 'LMU', classe: 'classe_ii', potencial: 'medio', porte: 'medio', min: 30, max: 60, expressao: '30 < CMP <= 60 t/mes' },
      { suffix: 'grande', tipoLicenca: 'LMU', classe: 'classe_iii', potencial: 'medio', porte: 'grande', min: 60, max: 100, expressao: '60 < CMP <= 100 t/mes' },
    ],
    docs: [
      'Layout produtivo',
      'Declaracao de capacidade mensal',
      'Relacao de produtos fabricados',
      'Inspecao sanitaria ou registro, quando aplicavel',
      'Descricao do sistema de refrigeracao',
      'Caixa de gordura',
      'Sistema de tratamento de efluentes',
      'Destinacao de sangue residual, gordura, salmoura, residuos organicos, embalagens e lodo',
    ],
  },
  {
    codigo: '16.06',
    nome: 'Fabricacao de cervejas, chopes e maltes',
    categoria: 'Industria de Bebidas',
    tipo_atividade: 'industrial',
    descricao: 'Fabricacao de cervejas, chopes e maltes, exceto artesanal.',
    unidade_parametro_principal: 'litros_dia',
    parametro_principal_label: 'Producao diaria',
    potencial_poluidor_padrao: 'alto',
    limite_impacto_local_tipo: 'valor_maximo',
    limite_impacto_local_valor: 25000,
    limite_impacto_local_unidade: 'litros_dia',
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo II-A',
    perguntas_publicas: [
      { chave: 'artesanal', label: 'A producao e artesanal?', tipo: 'boolean' },
      { chave: 'efluente', label: 'Ha geracao de efluente?', tipo: 'boolean' },
      { chave: 'fermentacao', label: 'Ha fermentacao no processo?', tipo: 'boolean' },
    ],
    regras: [
      { suffix: 'pequeno', tipoLicenca: 'LMU', classe: 'classe_ii', potencial: 'alto', porte: 'pequeno', min: null, max: 10000, operador: 'menor_igual', expressao: 'PD <= 10.000 L/dia' },
      { suffix: 'medio', tipoLicenca: 'LMU', classe: 'classe_iii', potencial: 'alto', porte: 'medio', min: 10000, max: 20000, expressao: '10.000 < PD <= 20.000 L/dia' },
      { suffix: 'grande', tipoLicenca: 'LMU', classe: 'classe_iv', potencial: 'alto', porte: 'grande', min: 20000, max: 25000, expressao: '20.000 < PD <= 25.000 L/dia' },
    ],
    docs: [
      'Memorial descritivo do processo cervejeiro',
      'Declaracao da producao diaria',
      'Layout da area produtiva, fermentacao, maturacao, envase e estocagem',
      'Relacao de insumos',
      'Descricao do sistema de tratamento de efluentes',
      'Destinacao de bagaco de malte, levedura e residuos organicos',
      'Sistema de geracao de vapor ou caldeira, se houver',
      'Controle sanitario',
    ],
  },
  {
    codigo: '17.05',
    nome: 'Fabricacao com fibra de vidro e resina',
    categoria: 'Industrias Diversas',
    tipo_atividade: 'industrial',
    descricao: 'Fabricacao de pecas, artefatos e estruturas utilizando fibra de vidro e resina.',
    unidade_parametro_principal: 'm2',
    parametro_principal_label: 'Area construida mais area de estocagem',
    potencial_poluidor_padrao: 'alto',
    limite_impacto_local_tipo: 'valor_maximo',
    limite_impacto_local_valor: 2000,
    limite_impacto_local_unidade: 'm2',
    formula_codigo: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo II-A',
    perguntas_publicas: [
      { chave: 'uso_resina_solvente', label: 'Ha uso de resina, catalisador, solvente ou aditivo quimico?', tipo: 'boolean' },
      { chave: 'ventilacao_exaustao', label: 'Ha ventilacao ou exaustao?', tipo: 'boolean' },
    ],
    regras: [
      { suffix: 'pequeno', tipoLicenca: 'LMU', classe: 'classe_ii', potencial: 'alto', porte: 'pequeno', formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', min: null, max: 500, operador: 'menor_igual', expressao: 'I <= 500 m2' },
      { suffix: 'medio', tipoLicenca: 'LMU', classe: 'classe_iii', potencial: 'alto', porte: 'medio', formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', min: 500, max: 1000, expressao: '500 < I <= 1.000 m2' },
      { suffix: 'grande', tipoLicenca: 'LMU', classe: 'classe_iv', potencial: 'alto', porte: 'grande', formula: 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', min: 1000, max: 2000, expressao: '1.000 < I <= 2.000 m2' },
    ],
    docs: [
      'Layout da area produtiva e de estocagem',
      'Relacao de resinas, catalisadores, solventes, fibra de vidro e aditivos',
      'FISPQ',
      'Plano de Gerenciamento de Residuos Solidos',
      'Descricao de ventilacao e exaustao',
      'Comprovantes de destinacao de residuos contaminados',
      'Medidas de prevencao contra incendio',
    ],
  },
];

function json(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

async function upsertByCodigo(client, table, codigo, data) {
  const existing = await client.query(
    `SELECT id FROM ${table} WHERE LOWER(codigo) = LOWER($1) AND deleted_at IS NULL LIMIT 1;`,
    [codigo]
  );
  const fields = Object.keys(data);

  if (existing.rows[0]) {
    const values = fields.map((field) => data[field]);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    values.push(existing.rows[0].id);
    const result = await client.query(
      `UPDATE ${table} SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *;`,
      values
    );
    return result.rows[0];
  }

  const values = fields.map((field) => data[field]);
  const placeholders = fields.map((_, index) => `$${index + 1}`);
  const result = await client.query(
    `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *;`,
    values
  );
  return result.rows[0];
}

async function upsertBaseData(client) {
  const tipos = {};
  for (const [codigo, nome, natureza] of BASE_TYPES) {
    tipos[codigo] = await upsertByCodigo(client, 'licenciamento_tipos_licenca', codigo, {
      codigo,
      nome,
      natureza,
      descricao: `Tipo de ato ambiental parametrizado para a Fase 2B: ${nome}.`,
      exige_analise_tecnica: true,
      permite_emissao_publica: false,
      ativo: true,
    });
  }

  const classes = {};
  for (const [codigo, nome, ordem] of BASE_CLASSES) {
    classes[codigo] = await upsertByCodigo(client, 'licenciamento_classes', codigo, {
      codigo,
      nome,
      ordem,
      descricao: 'Classe usada no enquadramento preliminar do Licenciamento Ambiental.',
      ativo: true,
    });
  }

  const potenciais = {};
  for (const [codigo, nome, peso] of BASE_POTENCIAIS) {
    potenciais[codigo] = await upsertByCodigo(client, 'licenciamento_potenciais_poluidor', codigo, {
      codigo,
      nome,
      peso,
      descricao: 'Potencial poluidor/degradador usado na matriz municipal.',
      ativo: true,
    });
  }

  return { tipos, classes, potenciais };
}

async function upsertVrte(client) {
  const existing = await client.query(
    'SELECT id FROM licenciamento_vrte_exercicios WHERE ano = $1 AND deleted_at IS NULL LIMIT 1;',
    [VRTE_2026.ano]
  );

  if (existing.rows[0]) {
    const result = await client.query(
      `
        UPDATE licenciamento_vrte_exercicios
        SET valor_vrte = $1,
            data_inicio_vigencia = $2,
            data_fim_vigencia = $3,
            ativo = true,
            fundamento_normativo = $4,
            observacao = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *;
      `,
      [
        VRTE_2026.valor_vrte,
        VRTE_2026.data_inicio_vigencia,
        VRTE_2026.data_fim_vigencia,
        VRTE_2026.fundamento_normativo,
        VRTE_2026.observacao,
        existing.rows[0].id,
      ]
    );
    return result.rows[0];
  }

  const result = await client.query(
    `
      INSERT INTO licenciamento_vrte_exercicios (
        ano, valor_vrte, data_inicio_vigencia, data_fim_vigencia, ativo, fundamento_normativo, observacao
      )
      VALUES ($1, $2, $3, $4, true, $5, $6)
      RETURNING *;
    `,
    [
      VRTE_2026.ano,
      VRTE_2026.valor_vrte,
      VRTE_2026.data_inicio_vigencia,
      VRTE_2026.data_fim_vigencia,
      VRTE_2026.fundamento_normativo,
      VRTE_2026.observacao,
    ]
  );
  return result.rows[0];
}

async function upsertNorms(client) {
  const norms = {};
  for (const norma of NORMS) {
    norms[norma.codigo] = await upsertByCodigo(client, 'licenciamento_normas', norma.codigo, {
      codigo: norma.codigo,
      titulo: norma.titulo,
      tipo: norma.tipo,
      numero: norma.numero || null,
      ano: norma.ano || null,
      esfera: norma.esfera,
      orgao: norma.orgao || null,
      ementa: norma.ementa || null,
      observacao: norma.observacao || null,
      ativo: true,
    });
  }
  return norms;
}

async function upsertTaxRule(client, payload) {
  const existing = await client.query(
    `
      SELECT id
      FROM licenciamento_regras_taxas
      WHERE deleted_at IS NULL
        AND tipo_taxa IS NOT DISTINCT FROM $1
        AND tipo_atividade IS NOT DISTINCT FROM $2
        AND tipo_licenca_id IS NOT DISTINCT FROM $3
        AND classe_id IS NOT DISTINCT FROM $4
        AND servico_administrativo_codigo IS NOT DISTINCT FROM $5
      LIMIT 1;
    `,
    [
      payload.tipo_taxa || null,
      payload.tipo_atividade || null,
      payload.tipo_licenca_id || null,
      payload.classe_id || null,
      payload.servico_administrativo_codigo || null,
    ]
  );

  const fields = Object.keys(payload);
  if (existing.rows[0]) {
    const values = fields.map((field) => payload[field]);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    values.push(existing.rows[0].id);
    return (await client.query(
      `UPDATE licenciamento_regras_taxas SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *;`,
      values
    )).rows[0];
  }

  const values = fields.map((field) => payload[field]);
  const placeholders = fields.map((_, index) => `$${index + 1}`);
  return (await client.query(
    `INSERT INTO licenciamento_regras_taxas (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *;`,
    values
  )).rows[0];
}

async function seedTaxes(client, lookups) {
  for (const table of Object.values(TAX_TABLE)) {
    for (const tipoLicenca of ['LMP', 'LMI', 'LMO', 'LMU', 'LMA', 'LMR']) {
      table[tipoLicenca].forEach((quantidade, index) => {
        const classe = lookups.classes[CLASS_CODES[index]];
        const formulaCodigo = ['LMA', 'LMR'].includes(tipoLicenca)
          ? `${tipoLicenca}_SOMA_LMP_LMI_LMO`
          : null;
        lookups.pendingTaxRules.push({
          tipo_taxa: table.tipo_taxa,
          tipo_atividade: table.tipo_atividade,
          tipo_licenca_id: lookups.tipos[tipoLicenca].id,
          classe_id: classe.id,
          quantidade_vrte: quantidade,
          fator_padrao: 1,
          formula_codigo: formulaCodigo,
          usa_formula: Boolean(formulaCodigo),
          formula_descricao: formulaCodigo
            ? `${tipoLicenca} = LMP + LMI + LMO, com quantidade expressa cadastrada para calculo seguro.`
            : null,
          fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A',
          observacao: 'Taxa estimada conforme VRTE vigente cadastrada. A cobranca definitiva depende da validacao do enquadramento pela SMAD.',
          ativo: true,
        });
      });
    }
  }

  lookups.pendingTaxRules.push(
    {
      tipo_taxa: 'licenciamento_simplificado',
      tipo_atividade: 'industrial',
      tipo_licenca_id: lookups.tipos.LMS.id,
      classe_id: lookups.classes.simplificada.id,
      quantidade_vrte: 74,
      fator_padrao: 1,
      fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A',
      observacao: 'Licenciamento simplificado industrial.',
      ativo: true,
    },
    {
      tipo_taxa: 'licenciamento_simplificado',
      tipo_atividade: 'nao_industrial',
      tipo_licenca_id: lookups.tipos.LMS.id,
      classe_id: lookups.classes.simplificada.id,
      quantidade_vrte: 97,
      fator_padrao: 1,
      fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A',
      observacao: 'Licenciamento simplificado nao industrial.',
      ativo: true,
    },
    {
      tipo_taxa: 'autorizacao_ambiental',
      tipo_atividade: 'industrial',
      tipo_licenca_id: lookups.tipos.AMA.id,
      quantidade_vrte: 57,
      fator_padrao: 1,
      fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A',
      observacao: 'Autorizacao Ambiental Industrial.',
      ativo: true,
    },
    {
      tipo_taxa: 'autorizacao_ambiental',
      tipo_atividade: 'nao_industrial',
      tipo_licenca_id: lookups.tipos.AMA.id,
      quantidade_vrte: 80,
      fator_padrao: 1,
      fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A',
      observacao: 'Autorizacao Ambiental Nao Industrial.',
      ativo: true,
    },
    {
      tipo_taxa: 'servico_administrativo',
      tipo_atividade: 'servico_administrativo',
      servico_administrativo_codigo: 'cadastro_consultoria',
      quantidade_vrte: 16,
      fator_padrao: 1,
      fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A',
      observacao: 'Cadastro de Consultoria, emissao de documentos e certidoes.',
      ativo: true,
    },
    {
      tipo_taxa: 'servico_administrativo',
      tipo_atividade: 'servico_administrativo',
      servico_administrativo_codigo: 'idas_iema_documentacao_processos',
      quantidade_vrte: 60,
      fator_padrao: 1,
      fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A',
      observacao: 'IDAS ao IEMA para solicitar documentacao ou processos.',
      ativo: true,
    }
  );

  for (const payload of lookups.pendingTaxRules) {
    await upsertTaxRule(client, payload);
  }
}

async function upsertActivity(client, activity) {
  return upsertByCodigo(client, 'licenciamento_atividades', activity.codigo, {
    codigo: activity.codigo,
    nome: activity.nome,
    descricao: activity.descricao,
    categoria: activity.categoria,
    unidade_parametro_principal: activity.unidade_parametro_principal,
    parametro_principal_label: activity.parametro_principal_label,
    potencial_poluidor_padrao: activity.potencial_poluidor_padrao,
    limite_impacto_local_tipo: activity.limite_impacto_local_tipo,
    limite_impacto_local_valor: activity.limite_impacto_local_valor || null,
    limite_impacto_local_unidade: activity.limite_impacto_local_unidade || null,
    mensagem_extrapolacao_competencia: activity.mensagem_extrapolacao_competencia
      || 'A informacao prestada excede o limite de impacto local previsto na matriz municipal para esta atividade. Recomenda-se consulta formal a SMAD para verificacao de competencia e enquadramento aplicavel.',
    expressao_original: activity.expressao_original || null,
    fundamento_normativo: activity.fundamento_normativo,
    tipo_atividade: activity.tipo_atividade,
    formula_codigo: activity.formula_codigo || null,
    parametros_entrada: json(activity.parametros_entrada || []),
    perguntas_publicas: json(activity.perguntas_publicas || []),
    bloqueios_publicos: json(activity.bloqueios_publicos || []),
    alertas_publicos: json(activity.alertas_publicos || []),
    validacoes_requeridas: json(activity.validacoes_requeridas || []),
    seed_piloto_codigo: 'fase2b',
    ativo: true,
    observacoes: activity.observacoes || null,
  });
}

async function upsertRule(client, activityRow, rule, lookups) {
  const seedCode = `fase2b:${activityRow.codigo}:${rule.suffix}`;
  const existing = await client.query(
    'SELECT id FROM licenciamento_regras_enquadramento WHERE seed_piloto_codigo = $1 AND deleted_at IS NULL LIMIT 1;',
    [seedCode]
  );
  const payload = {
    atividade_id: activityRow.id,
    tipo_licenca_id: lookups.tipos[rule.tipoLicenca].id,
    classe_id: lookups.classes[rule.classe].id,
    potencial_poluidor_id: lookups.potenciais[rule.potencial].id,
    parametro_nome: activityRow.parametro_principal_label,
    parametro_unidade: activityRow.unidade_parametro_principal,
    valor_minimo: rule.min,
    valor_maximo: rule.max,
    operador: rule.operador || 'faixa',
    porte_resultante: rule.porte,
    dispensa_possivel: false,
    exige_vistoria: false,
    exige_estudo_ambiental: false,
    exige_anuencia: false,
    exige_georreferenciamento: false,
    observacao_publica: 'Resultado preliminar sujeito a validacao tecnica da SMAD.',
    observacao_interna: rule.observacaoInterna || null,
    fundamento_normativo: 'Decreto Municipal n. 021/2020, Anexo I-A e Anexo II-A',
    expressao_original: rule.expressao,
    requer_validacao_tecnica: rule.requerValidacao !== false,
    limite_impacto_local_tipo: null,
    limite_impacto_local_valor: null,
    limite_impacto_local_unidade: null,
    tipo_calculo: rule.formula ? 'formula_predefinida' : 'nenhum',
    formula_codigo: rule.formula || null,
    parametros_entrada: json(rule.params?.map((item) => item[0]) || null),
    status_resultado: rule.status || 'requer_validacao_tecnica',
    tipo_resultado: rule.tipoResultado || null,
    alertas_tecnicos: json(rule.alertas || []),
    bloqueios: json(rule.bloqueios || []),
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

  const params = rule.params || [[
    activityRow.formula_codigo ? `${activityRow.codigo}_indice` : 'valor_parametro',
    activityRow.parametro_principal_label,
    activityRow.unidade_parametro_principal,
    rule.min,
    rule.max,
    true,
    true,
  ]];

  let order = 1;
  for (const [chave, label, unidade, min, max, incluiMin = true, incluiMax = true] of params) {
    await client.query(
      `
        INSERT INTO licenciamento_regra_parametros (
          regra_enquadramento_id, parametro_chave, parametro_label, parametro_unidade,
          operador, valor_minimo, valor_maximo, inclui_minimo, inclui_maximo, obrigatorio, ordem, expressao_original
        )
        VALUES ($1, $2, $3, $4, 'faixa', $5, $6, $7, $8, true, $9, $10)
        ON CONFLICT (regra_enquadramento_id, parametro_chave)
        WHERE deleted_at IS NULL
        DO UPDATE SET
          parametro_label = EXCLUDED.parametro_label,
          parametro_unidade = EXCLUDED.parametro_unidade,
          valor_minimo = EXCLUDED.valor_minimo,
          valor_maximo = EXCLUDED.valor_maximo,
          inclui_minimo = EXCLUDED.inclui_minimo,
          inclui_maximo = EXCLUDED.inclui_maximo,
          ordem = EXCLUDED.ordem,
          expressao_original = EXCLUDED.expressao_original,
          updated_at = CURRENT_TIMESTAMP;
      `,
      [row.id, chave, label, unidade, min, max, incluiMin, incluiMax, order, rule.expressao]
    );
    order += 1;
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
    exige_responsavel_tecnico: /ART|RRT|projeto|estudo|planta|layout/i.test(name),
    exige_art_rrt: /ART|RRT|projeto|estudo/i.test(name),
    ordem: order,
    fundamento: 'Decreto Municipal n. 021/2020, Anexo I-C e parametrizacao piloto SMAD.',
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
    `
      INSERT INTO licenciamento_normas_vinculos (norma_id, atividade_id, descricao_vinculo)
      VALUES ($1, $2, $3);
    `,
    [normaId, activityId, descricao]
  );
}

async function seedActivities(client, lookups) {
  for (const activity of ACTIVITIES) {
    const row = await upsertActivity(client, activity);

    for (const rule of activity.regras) {
      await upsertRule(client, row, rule, lookups);
    }

    let order = 1;
    for (const doc of [...GENERAL_DOCUMENTS, ...activity.docs]) {
      await upsertDocument(client, row.id, doc, order);
      order += 1;
    }

    await upsertNormLink(client, lookups.norms[NORMA_CODES.DECRETO].id, row.id, 'Norma municipal principal.');
    await upsertNormLink(client, lookups.norms[NORMA_CODES.ANEXO_II_A].id, row.id, 'Atividade sujeita ao licenciamento ambiental municipal.');
    for (const normaCode of activity.normasExtras || []) {
      await upsertNormLink(client, lookups.norms[normaCode].id, row.id, 'Referencia tecnica complementar.');
    }
  }
}

async function seedLicenciamentoFase2B({ silent = false } = {}) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const lookups = await upsertBaseData(client);
    lookups.pendingTaxRules = [];
    await upsertVrte(client);
    lookups.norms = await upsertNorms(client);
    await seedTaxes(client, lookups);
    await seedActivities(client, lookups);
    await client.query('COMMIT');

    const summary = {
      vrte: 1,
      normas: NORMS.length,
      taxas: lookups.pendingTaxRules.length,
      atividades_piloto: ACTIVITIES.length,
    };

    if (!silent) {
      console.log(JSON.stringify({ success: true, summary }, null, 2));
    }

    return summary;
  } catch (error) {
    await client.query('ROLLBACK');
    if (!silent) console.error(error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedLicenciamentoFase2B()
    .then(() => db.end())
    .catch(() => db.end().finally(() => process.exit(1)));
}

module.exports = seedLicenciamentoFase2B;
