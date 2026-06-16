const db = require('../../../config/db');
const seedLicenciamentoFase2D1 = require('./seedLicenciamentoFase2D1');
const seedLicenciamentoFase2D21 = require('./seedLicenciamentoFase2D21');
const enquadramentoService = require('../licenciamentoEnquadramento.service');

const TARGET_ACTIVITY_CODES = ['19.01', '19.02', '19.04'];
const EXPECTED_GROUP19_CODES = ['19.01', '19.02', '19.03', '19.04'];
const PRESERVED_PILOT_CODE = '19.03';

const FASE_2D4B_BLOCKED_MESSAGE =
  'Fase 2D.4-B bloqueada. A liberacao tecnica da Fase 2D, a conferencia 2D.4-A, as fases anteriores ou os bloqueios de producao nao estao preservados.';

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
  'ART/RRT ou responsabilidade tecnica, quando aplicavel',
];

const GROUP_DOCS = [
  'Memorial descritivo da atividade energetica',
  'Planta de situacao e layout do empreendimento',
  'Documentacao fundiaria ou autorizacao de uso da area',
  'Mapa de APP, vegetacao e cursos hidricos, quando aplicavel',
  'Autorizacao de supressao vegetal, quando aplicavel',
  'Projeto de drenagem e controle de erosao, quando aplicavel',
  'AVCB/CBMES ou protocolo, quando aplicavel',
  'Plano de emergencia ou contingencia, quando aplicavel',
];

function json(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function question(chave, label, tipo = 'boolean', unidade = null, ajuda = null) {
  return { chave, label, tipo, unidade, ajuda };
}

function alert(message, severidade = 'atencao') {
  return { severidade, mensagem: message };
}

function block(codigo, mensagem, sugestao = null, status = 'requer_validacao_tecnica') {
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
  const derived = classFor(potential, porte);

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
    observacaoInterna: options.observacaoInterna || null,
    alertas: options.alertas || [],
    bloqueios: options.bloqueios || [],
  };
}

function rulesFrom(potencial, formula, entries) {
  return entries.map((entry) => rule(entry.suffix, entry.porte, entry.min, entry.max, {
    potencial,
    formula,
    operador: entry.operador,
    expressao: entry.expressao,
    tipoLicenca: entry.tipoLicenca,
    classe: entry.classe,
    observacaoInterna: entry.observacaoInterna,
  }));
}

function activity(codigo, nome, descricao, options) {
  const docs = [...COMMON_DOCS, ...GROUP_DOCS, ...(options.docs || [])];
  return {
    codigo,
    nome,
    descricao,
    categoria: 'Energia',
    tipo_atividade: options.tipo_atividade || 'nao_industrial',
    unidade_parametro_principal: options.unidade || 'unidade',
    parametro_principal_label: options.parametro || 'Parametro principal',
    potencial_poluidor_padrao: options.potencial || 'medio',
    limite_impacto_local_tipo: options.limiteValor === null || options.limiteValor === undefined ? 'todos' : 'valor_maximo',
    limite_impacto_local_valor: options.limiteValor === undefined ? null : options.limiteValor,
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
    validacoes_requeridas: [
      'exige_validacao_energia',
      'exige_validacao_locacional',
      'exige_validacao_app',
      'exige_validacao_supressao',
      ...(options.validacoes || []),
    ],
    regras: options.regras || [],
    docs,
  };
}

const ACTIVITIES = [
  activity('19.01', 'Envasamento e industrializacao de gas', 'Envasamento e industrializacao de gas.', {
    tipo_atividade: 'industrial',
    parametro: 'Area construida + area de estocagem',
    unidade: 'm2',
    potencial: 'medio',
    limiteValor: 10000,
    formula: 'AREA_CONSTRUIDA_ESTOCAGEM_DIRETA',
    parametros_entrada: ['area_construida_m2', 'area_estocagem_m2'],
    expressao: 'I = Area construida (m2) + area de estocagem (m2), quando houver',
    observacoes: 'Fase 2D.4-B. Parametrizacao controlada apos conferencia normativa 2D.4-A. Atividade sensivel por gas inflamavel; simulacao nao substitui validacao tecnica da SMAD.',
    perguntas: [
      question('area_construida_m2', 'Area construida', 'number', 'm2'),
      question('area_estocagem_m2', 'Area de estocagem', 'number', 'm2'),
      question('gas_inflamavel', 'Ha gas inflamavel ou pressurizado?'),
      question('risco_explosao', 'Ha risco operacional de explosao ou incendio?'),
      question('possui_avcb', 'Possui AVCB/CBMES ou protocolo equivalente?'),
      question('sem_avcb', 'Nao possui AVCB/CBMES ou documento equivalente?'),
      question('armazenamento_externo', 'Ha armazenamento externo ou patio de estocagem?'),
      question('emissoes_atmosfericas', 'Ha emissao atmosferica associada ao processo?'),
      question('gera_residuos', 'Ha geracao de residuos industriais?'),
      question('efluente_industrial', 'Ha efluente industrial associado?'),
    ],
    alertas: [
      alert('Atividade com gas inflamavel exige validacao tecnica de seguranca operacional e risco de incendio/explosao.'),
      alert('AVCB/CBMES ou documento equivalente pode ser exigido conforme caracteristicas do empreendimento.'),
      alert('Resultado orientativo; nao autoriza operacao, DAM real, cobranca oficial ou decisao administrativa automatica.'),
    ],
    bloqueios: [
      block('19_01_GAS_INFLAMAVEL', 'Gas inflamavel ou risco de explosao exige validacao tecnica antes de conclusao administrativa.'),
      block('19_01_SEM_AVCB', 'Ausencia de AVCB/CBMES ou documento equivalente exige conferencia documental pela SMAD.'),
    ],
    docs: [
      'Memorial de seguranca operacional para envasamento ou industrializacao de gas',
      'Layout de tanques, cilindros, linhas, areas de envase e area de estocagem',
      'AVCB/CBMES ou protocolo/documento equivalente, quando aplicavel',
      'ART/RRT do responsavel tecnico pelo sistema de gas',
      'Plano de emergencia para incendio, explosao e vazamento',
      'FISPQ dos gases/produtos manipulados, quando aplicavel',
      'Projeto de contencao, ventilacao e afastamentos de seguranca, quando aplicavel',
      'Comprovantes de destinacao de residuos e efluentes, quando aplicavel',
    ],
    regras: rulesFrom('medio', 'AREA_CONSTRUIDA_ESTOCAGEM_DIRETA', [
      { suffix: 'pequeno', porte: 'pequeno', min: null, max: 2000, operador: 'menor_igual', expressao: 'I <= 2.000 m2' },
      { suffix: 'medio', porte: 'medio', min: 2000, max: 5000, expressao: '2.000 < I <= 5.000 m2' },
      { suffix: 'grande', porte: 'grande', min: 5000, max: 10000, expressao: '5.000 < I <= 10.000 m2' },
    ]),
  }),
  activity('19.02', 'Implantacao de Linhas de Transmissao de energia eletrica', 'Implantacao de Linhas de Transmissao de energia eletrica.', {
    parametro: 'Tensao',
    unidade: 'kV',
    potencial: 'medio',
    formula: 'TENSAO_KV_DIRETA',
    parametros_entrada: ['tensao_kv'],
    expressao: 'Tensao (kV)',
    observacoes: 'Fase 2D.4-B. Parametrizacao controlada apos conferencia normativa 2D.4-A. Exige conferencia locacional, fundiaria e ambiental antes de conclusao administrativa.',
    perguntas: [
      question('tensao_kv', 'Tensao da linha', 'number', 'kV'),
      question('extensao_km', 'Extensao aproximada da linha', 'number', 'km'),
      question('faixa_servidao', 'Ha faixa de servidao definida?'),
      question('sem_anuencia_passagem', 'Ha pendencia de anuencia de passagem ou uso de faixa?'),
      question('intervencao_app', 'Havera intervencao em APP?'),
      question('supressao_vegetal', 'Havera supressao vegetal?'),
      question('travessia_curso_hidrico', 'Havera travessia de curso hidrico?'),
      question('unidade_conservacao', 'Ha interferencia em unidade de conservacao ou zona de amortecimento?'),
      question('tracado_georreferenciado', 'Ha tracado georreferenciado?'),
      question('areas_terceiros', 'Havera passagem por areas de terceiros?'),
    ],
    alertas: [
      alert('Linhas de transmissao exigem conferencia de faixa de servidao, APP, supressao, travessias hidricas e anuencias de passagem.'),
      alert('Traçado georreferenciado e documentos fundiarios devem ser avaliados pela SMAD.'),
      alert('Resultado orientativo; nao autoriza protocolo definitivo, obra ou decisao administrativa automatica.'),
    ],
    bloqueios: [
      block('19_02_APP_SUPRESSAO', 'Intervencao em APP, supressao vegetal ou travessia hidrica exige validacao tecnica.'),
      block('19_02_SEM_ANUENCIA', 'Pendencia de anuencia de passagem/faixa de servidao impede conclusao automatica.'),
      block('19_02_UC', 'Interferencia em unidade de conservacao ou zona de amortecimento exige analise tecnica e institucional.'),
    ],
    docs: [
      'Memorial descritivo da linha de transmissao',
      'Tracado georreferenciado da linha e faixa de servidao',
      'Anuencias de passagem ou autorizacoes de uso de faixa',
      'Relacao de propriedades interceptadas, quando aplicavel',
      'Manifestacao sobre APP e travessias de cursos hidricos',
      'Autorizacao de supressao vegetal, quando aplicavel',
      'ART/RRT do projeto eletrico e ambiental, quando aplicavel',
      'Mapa de unidades de conservacao e zonas de amortecimento, quando aplicavel',
    ],
    regras: rulesFrom('medio', 'TENSAO_KV_DIRETA', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 138, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada', expressao: 'T <= 138 kV' },
      { suffix: 'pequeno', porte: 'pequeno', min: 138, max: 230, expressao: '138 < T <= 230 kV' },
      { suffix: 'medio', porte: 'medio', min: 230, max: null, operador: 'maior_igual', expressao: 'T > 230 kV' },
    ]),
  }),
  activity('19.04', 'Implantacao de Subestacao de energia eletrica', 'Implantacao de Subestacao de energia eletrica.', {
    parametro: 'Area de intervencao',
    unidade: 'm2',
    potencial: 'baixo',
    formula: 'AREA_INTERVENCAO_DIRETA',
    parametros_entrada: ['area_intervencao_m2'],
    expressao: 'Area de intervencao (m2)',
    observacoes: 'Fase 2D.4-B. Parametrizacao controlada apos conferencia normativa 2D.4-A. Validacao tecnica obrigatoria quando houver APP, supressao, oleo isolante, drenagem ou potencial contaminante.',
    perguntas: [
      question('area_intervencao_m2', 'Area de intervencao', 'number', 'm2'),
      question('impermeabilizacao', 'Havera impermeabilizacao relevante?'),
      question('drenagem', 'Ha sistema de drenagem previsto?'),
      question('oleo_isolante', 'Ha equipamentos com oleo isolante?'),
      question('equipamento_contaminante', 'Ha equipamentos com potencial contaminante?'),
      question('ruido', 'Ha potencial de ruido operacional?'),
      question('intervencao_app', 'Havera intervencao em APP?'),
      question('supressao_vegetal', 'Havera supressao vegetal?'),
      question('documentacao_fundiaria', 'Ha documentacao fundiaria ou autorizacao de uso da area?'),
      question('layout_subestacao', 'Ha planta/layout da subestacao?'),
    ],
    alertas: [
      alert('Subestacoes podem exigir controle de drenagem, impermeabilizacao, ruido e equipamentos com oleo isolante.'),
      alert('APP, supressao vegetal e potencial contaminante exigem validacao tecnica da SMAD.'),
      alert('Resultado orientativo; nao autoriza operacao, protocolo definitivo ou decisao administrativa automatica.'),
    ],
    bloqueios: [
      block('19_04_APP_SUPRESSAO', 'Intervencao em APP ou supressao vegetal exige validacao tecnica antes de conclusao administrativa.'),
      block('19_04_OLEO_ISOLANTE', 'Oleo isolante ou equipamento com potencial contaminante exige conferencia tecnica de contencao, drenagem e emergencia.'),
    ],
    docs: [
      'Memorial descritivo da subestacao',
      'Planta/layout da subestacao',
      'Declaracao da area de intervencao',
      'Projeto de drenagem e impermeabilizacao, quando aplicavel',
      'Plano de controle de ruido, quando aplicavel',
      'Plano de contencao para oleo isolante ou contaminantes, quando aplicavel',
      'ART/RRT do projeto eletrico e ambiental, quando aplicavel',
      'Documentacao fundiaria ou autorizacao de uso da area',
    ],
    regras: rulesFrom('baixo', 'AREA_INTERVENCAO_DIRETA', [
      { suffix: 'simplificado', porte: 'simplificado', min: null, max: 13000, operador: 'menor_igual', tipoLicenca: 'LMS', classe: 'simplificada', expressao: 'AIN <= 13.000 m2' },
      { suffix: 'pequeno', porte: 'pequeno', min: 13000, max: 20000, expressao: '13.000 < AIN <= 20.000 m2' },
    ]),
  }),
];

async function countActiveCodes(client, codes) {
  const result = await client.query(
    `
      SELECT codigo
      FROM licenciamento_atividades
      WHERE deleted_at IS NULL
        AND ativo = true
        AND codigo = ANY($1)
      ORDER BY codigo;
    `,
    [codes]
  );
  return result.rows.map((item) => item.codigo);
}

async function validatePreviousPhases(client) {
  const gate = await seedLicenciamentoFase2D1.validateFase2D1Gate(client);
  const status2d1 = await countActiveCodes(client, seedLicenciamentoFase2D1.TARGET_ACTIVITY_CODES || []);
  const status2d2 = await countActiveCodes(client, ['15.20', '16.06', '17.05', '23.01', '23.02', '23.03', '23.04', '23.05', '23.06']);
  const status2d21 = await countActiveCodes(client, seedLicenciamentoFase2D21.TARGET_ACTIVITY_CODES || []);
  const status2d4a = await enquadramentoService.getParametrizacaoFase2D4AGrupo19ConferenciaStatus();

  const phasesOk = status2d1.length === (seedLicenciamentoFase2D1.TARGET_ACTIVITY_CODES || []).length
    && status2d2.length === 9
    && status2d21.length === (seedLicenciamentoFase2D21.TARGET_ACTIVITY_CODES || []).length
    && status2d4a.fase === '2D.4-A'
    && status2d4a.codigos_identificados.join(',') === EXPECTED_GROUP19_CODES.join(',')
    && status2d4a.codigos_com_lacuna.length === 0
    && status2d4a.codigos_divergentes_do_piloto.length === 0
    && status2d4a.piloto_1903?.preservado === true
    && status2d4a.piloto_1903?.divergencia_material === false;

  if (!phasesOk) {
    const error = new Error(FASE_2D4B_BLOCKED_MESSAGE);
    error.statusCode = 409;
    error.details = {
      fase2d1: status2d1.length,
      fase2d2: status2d2.length,
      fase2d21: status2d21.length,
      fase2d4a: status2d4a.fase,
      divergencias_piloto: status2d4a.codigos_divergentes_do_piloto,
    };
    throw error;
  }

  return { gate, fase2d1: true, fase2d2: true, fase2d21: true, fase2d3: true, fase2d4a: true };
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
    const error = new Error(`Parametro base ausente para Fase 2D.4-B: ${label} ${key}. Execute as fases anteriores antes do seed.`);
    error.statusCode = 409;
    throw error;
  }
  return item.id;
}

async function upsertActivity(client, item) {
  if (item.codigo === PRESERVED_PILOT_CODE) {
    throw new Error('Seed 2D.4-B nao pode sobrescrever o piloto 19.03.');
  }

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
    seed_piloto_codigo: existing.rows[0]?.seed_piloto_codigo || 'fase2d4b',
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
  const seedCode = `fase2d4b:${activityRow.codigo}:${item.suffix}`;
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
    dispensa_possivel: false,
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

  const parametros = activityRow.parametros_entrada || ['valor_parametro'];
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
    exige_responsavel_tecnico: /ART|RRT|projeto|estudo|planta|layout|plano|seguranca/i.test(name),
    exige_art_rrt: /ART|RRT|projeto|estudo/i.test(name),
    ordem: order,
    fundamento: 'Decreto Municipal n. 021/2020, Anexo I-C e parametrizacao Fase 2D.4-B.',
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
  const result = await client.query(
    `
      WITH atividades_base AS (
        SELECT *
        FROM licenciamento_atividades
        WHERE deleted_at IS NULL
          AND ativo = true
          AND codigo = ANY($1)
      )
      SELECT
        COUNT(*)::int AS atividades,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_regras_enquadramento r
          JOIN atividades_base a ON a.id = r.atividade_id
          WHERE r.deleted_at IS NULL AND r.ativo = true
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
    [EXPECTED_GROUP19_CODES]
  );

  return {
    grupo: '19',
    atividades: result.rows[0].atividades || 0,
    regras: result.rows[0].regras || 0,
    perguntas_publicas: result.rows[0].perguntas || 0,
    alertas_publicos: result.rows[0].alertas || 0,
    bloqueios_publicos: result.rows[0].bloqueios || 0,
    documentos: result.rows[0].documentos || 0,
    codigos_novos: TARGET_ACTIVITY_CODES,
    codigo_preservado: PRESERVED_PILOT_CODE,
  };
}

async function seedLicenciamentoFase2D4B({ silent = false } = {}) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('licenciamento_fase2d4b_grupo19'));");

    const validation = await validatePreviousPhases(client);
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

      await upsertNormLink(client, lookups.normas.DECRETO_MUNICIPAL_021_2020?.id, row.id, 'Regulamento operacional municipal para parametrizacao controlada Fase 2D.4-B.');
      await upsertNormLink(client, lookups.normas.ANEXO_II_A?.id, row.id, 'Atividade do Grupo 19 sujeita ao licenciamento ambiental municipal.');
      await upsertNormLink(client, lookups.normas.CONSEMA_001_2022_REFERENCIA?.id, row.id, 'Referencia comparativa, sem substituicao automatica da matriz municipal.');
    }

    const summary = await collectSummary(client);
    await client.query('COMMIT');

    const result = {
      success: true,
      fase: '2D.4-B',
      validation,
      summary,
      observacao: 'Seed idempotente executado sem alterar o piloto 19.03, VRTE, tabela de taxas, matriz operacional ou normas.',
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
  seedLicenciamentoFase2D4B()
    .then(() => db.end())
    .catch(() => db.end().finally(() => process.exit(1)));
}

module.exports = seedLicenciamentoFase2D4B;
module.exports.ACTIVITIES = ACTIVITIES;
module.exports.TARGET_ACTIVITY_CODES = TARGET_ACTIVITY_CODES;
module.exports.EXPECTED_GROUP19_CODES = EXPECTED_GROUP19_CODES;
