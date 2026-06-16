export const ASSISTENTE_MOTOR_VERSION = 'assistente-enquadramento-v1';

const CLASSIFICATION_RULES = [
  {
    slug: 'reciclagem_ferro_velho_sucata',
    atividadeProvavel: 'Armazenamento, triagem e/ou comercializacao de materiais reciclaveis ou sucata',
    grupo: 'Residuos solidos / Reciclagem',
    nivelAtencaoInicial: 'medio',
    confiancaBase: 0.86,
    keywords: [
      'ferro velho',
      'ferro-velho',
      'sucata',
      'reciclagem',
      'reciclavel',
      'reciclaveis',
      'deposito de material',
      'material reciclavel',
      'materiais reciclaveis',
      'quintal',
    ],
    perguntasObrigatorias: [
      'materiais_recebidos',
      'area_armazenamento_m2',
      'tipo_piso',
      'cobertura',
      'residuos_perigosos',
      'semob_viabilidade',
    ],
    observacoes: [
      'Atividade em quintal ou imovel residencial pode exigir analise urbanistica.',
      'E necessario confirmar se ha residuos perigosos ou especiais.',
      'E necessario verificar as condicoes de armazenamento e protecao do solo.',
    ],
  },
  {
    slug: 'terraplenagem_aterro',
    atividadeProvavel: 'Terraplenagem, aterro, nivelamento ou movimentacao de terra',
    grupo: 'Uso e ocupacao do solo',
    nivelAtencaoInicial: 'medio',
    confiancaBase: 0.78,
    keywords: ['aterro', 'aterrar', 'nivelar terreno', 'cortar barranco', 'terraplenagem', 'movimentacao de terra'],
    perguntasObrigatorias: ['area_intervencao', 'altura_talude', 'finalidade', 'app', 'supressao'],
    observacoes: ['Formulario especifico em construcao. A simulacao tecnica avancada permanece disponivel.'],
  },
  {
    slug: 'lava_jato',
    atividadeProvavel: 'Lavagem de veiculos ou lava-jato',
    grupo: 'Atividades diversas',
    nivelAtencaoInicial: 'medio',
    confiancaBase: 0.76,
    keywords: ['lava-jato', 'lava jato', 'lavar carro', 'lavagem de carro', 'estetica automotiva'],
    perguntasObrigatorias: ['area_util', 'efluente', 'ssao', 'destinacao'],
    observacoes: ['Formulario especifico em construcao. Verificar efluente oleoso e sistema de tratamento.'],
  },
  {
    slug: 'oficina_mecanica',
    atividadeProvavel: 'Oficina mecanica, manutencao veicular ou troca de oleo',
    grupo: 'Atividades diversas',
    nivelAtencaoInicial: 'medio',
    confiancaBase: 0.74,
    keywords: ['oficina', 'mecanica', 'troca de oleo', 'manutencao veicular', 'auto center'],
    perguntasObrigatorias: ['area_util', 'oleo', 'efluente', 'residuos'],
    observacoes: ['Formulario especifico em construcao. Verificar oleo, residuos contaminados e efluente.'],
  },
  {
    slug: 'comercio_supermercado',
    atividadeProvavel: 'Comercio, supermercado, mercado ou mercearia',
    grupo: 'Comercio e servicos associados',
    nivelAtencaoInicial: 'baixo',
    confiancaBase: 0.68,
    keywords: ['supermercado', 'mercado', 'mercearia', 'hortifruti', 'acougue'],
    perguntasObrigatorias: ['corte_carne', 'residuos', 'efluente', 'area'],
    observacoes: ['Formulario especifico em construcao. Algumas atividades internas podem exigir verificacao ambiental.'],
  },
  {
    slug: 'supressao_vegetal',
    atividadeProvavel: 'Supressao ou corte de vegetacao',
    grupo: 'Vegetacao / Intervencao ambiental',
    nivelAtencaoInicial: 'alto',
    confiancaBase: 0.8,
    keywords: ['cortar arvore', 'cortar arvores', 'supressao', 'retirar vegetacao', 'remover vegetacao', 'desmatar'],
    perguntasObrigatorias: ['quantidade_arvores', 'app', 'motivo', 'imovel'],
    observacoes: ['Formulario especifico em construcao. Pode exigir autorizacao propria e analise tecnica.'],
  },
  {
    slug: 'construcao_obra',
    atividadeProvavel: 'Construcao, obra, galpao, loteamento ou implantacao de empreendimento',
    grupo: 'Uso e ocupacao do solo',
    nivelAtencaoInicial: 'medio',
    confiancaBase: 0.7,
    keywords: ['construcao', 'construir', 'obra', 'galpao', 'loteamento', 'condominio', 'regularizar obra'],
    perguntasObrigatorias: ['area', 'uso_solo', 'terraplenagem', 'app', 'supressao'],
    observacoes: ['Formulario especifico em construcao. Pode exigir manifestacao urbanistica e analise de localizacao.'],
  },
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function detectKeywords(description, keywords) {
  const normalized = normalizeText(description);
  return keywords.filter((keyword) => normalized.includes(normalizeText(keyword)));
}

export function classificarAtividadeAmbiental(descricaoOriginal, perfilUsuario = 'nao_sei') {
  const normalizedDescription = normalizeText(descricaoOriginal);
  if (!normalizedDescription) {
    return {
      atividadeProvavel: '',
      grupo: '',
      slug: '',
      confianca: 0,
      nivelAtencaoInicial: 'medio',
      palavrasChaveDetectadas: [],
      perguntasObrigatorias: [],
      observacoes: ['Descreva a atividade pretendida para iniciar a analise preliminar.'],
      perfilUsuario,
      versaoMotor: ASSISTENTE_MOTOR_VERSION,
    };
  }

  const ranked = CLASSIFICATION_RULES
    .map((rule) => {
      const palavrasChaveDetectadas = detectKeywords(normalizedDescription, rule.keywords);
      const score = palavrasChaveDetectadas.length;
      const confianca = Math.min(0.94, rule.confiancaBase + Math.max(0, score - 1) * 0.03);
      return {
        ...rule,
        palavrasChaveDetectadas,
        score,
        confianca: score > 0 ? confianca : 0,
      };
    })
    .filter((rule) => rule.score > 0)
    .sort((left, right) => right.score - left.score || right.confianca - left.confianca);

  const best = ranked[0];

  if (!best) {
    return {
      atividadeProvavel: 'Atividade nao identificada pelo motor local',
      grupo: 'A definir',
      slug: 'atividade_nao_identificada',
      confianca: 0.28,
      nivelAtencaoInicial: 'medio',
      palavrasChaveDetectadas: [],
      perguntasObrigatorias: ['descricao_detalhada', 'localizacao', 'area', 'residuos', 'app'],
      observacoes: [
        'O texto informado nao possui palavras-chave suficientes para uma sugestao segura.',
        'Use o modo tecnico avancado ou procure a SMAD para orientacao preliminar.',
      ],
      perfilUsuario,
      versaoMotor: ASSISTENTE_MOTOR_VERSION,
    };
  }

  return {
    atividadeProvavel: best.atividadeProvavel,
    grupo: best.grupo,
    slug: best.slug,
    confianca: Number(best.confianca.toFixed(2)),
    nivelAtencaoInicial: best.nivelAtencaoInicial,
    palavrasChaveDetectadas: best.palavrasChaveDetectadas,
    perguntasObrigatorias: best.perguntasObrigatorias,
    observacoes: best.observacoes,
    perfilUsuario,
    versaoMotor: ASSISTENTE_MOTOR_VERSION,
  };
}
