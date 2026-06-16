const db = require('../../../config/db');
const seedLicenciamentoFase2B = require('./seedLicenciamentoFase2B');

const NORMAS = [
  {
    codigo: 'LEI_MUNICIPAL_1191_2019',
    titulo: 'Lei Municipal n. 1.191/2019',
    tipo: 'lei',
    tipo_norma: 'codigo_ambiental_municipal',
    numero: '1.191',
    ano: 2019,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Codigo Municipal de Meio Ambiente e norma-mae da gestao ambiental municipal.',
    status_normativo: 'vigente',
    modulo_principal: 'licenciamento',
    observacao_tecnica: 'Vinculada ao Licenciamento, Fiscalizacao, Denuncias, Educacao Ambiental, Fundo Municipal e painel publico de legislacao.',
  },
  {
    codigo: 'LEI_MUNICIPAL_1192_2019',
    titulo: 'Lei Municipal n. 1.192/2019',
    tipo: 'lei',
    tipo_norma: 'lei_municipal_taxas',
    numero: '1.192',
    ano: 2019,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Norma principal/preferencial de taxas ambientais em VRTE.',
    status_normativo: 'vigente_preferencial',
    modulo_principal: 'taxas',
    preferencial_taxas: true,
    requer_validacao_juridica: true,
    observacao_juridica: 'Norma posterior e especifica de taxas ambientais. Aplicacao preferencial sobre normas anteriores incompativeis, sujeita a validacao juridica da SMAD/Procuradoria.',
    observacao_tecnica: 'A tabela da Fase 2B permanece operacional piloto ate conferencia visual integral com esta lei.',
  },
  {
    codigo: 'LEI_MUNICIPAL_1193_2019',
    titulo: 'Lei Municipal n. 1.193/2019',
    tipo: 'lei',
    tipo_norma: 'lei_municipal_fiscalizacao_dosimetria',
    numero: '1.193',
    ano: 2019,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Base de fiscalizacao, infracoes ambientais e dosimetria de multas.',
    status_normativo: 'vigente',
    modulo_principal: 'fiscalizacao',
    observacao_tecnica: 'Referencia para Fiscalizacao Ambiental, Denuncias, autos, notificacoes e dosimetria futura.',
  },
  {
    codigo: 'LEI_MUNICIPAL_1093_2017',
    titulo: 'Lei Municipal n. 1.093/2017',
    tipo: 'lei',
    tipo_norma: 'lei_municipal_taxas',
    numero: '1.093',
    ano: 2017,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Norma historica/anterior de taxas ambientais.',
    status_normativo: 'historica',
    modulo_principal: 'taxas',
    norma_historica: true,
    requer_validacao_juridica: true,
    observacao_juridica: 'Norma anterior a Lei n. 1.192/2019. Manter para rastreabilidade historica e validacao juridica de eventuais processos antigos. Aplicacao atual depende de analise juridica.',
  },
  {
    codigo: 'DECRETO_MUNICIPAL_021_2020',
    titulo: 'Decreto Municipal n. 021/2020',
    tipo: 'decreto',
    tipo_norma: 'decreto_municipal_regulamentar',
    numero: '021',
    ano: 2020,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Regulamento operacional do licenciamento ambiental municipal.',
    status_normativo: 'vigente',
    modulo_principal: 'licenciamento',
    preferencial_enquadramento: true,
    observacao_tecnica: 'Base operacional do motor de enquadramento ate conferencia normativa completa.',
  },
  {
    codigo: 'ANEXO_I_A',
    titulo: 'Anexo I-A do Decreto Municipal n. 021/2020',
    tipo: 'outro',
    tipo_norma: 'anexo_decreto',
    numero: 'I-A',
    ano: 2020,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Matriz de enquadramento e tabela de valor do enquadramento em VRTE.',
    status_normativo: 'em_validacao',
    modulo_principal: 'licenciamento',
    requer_validacao_juridica: true,
    observacao_tecnica: 'Tabela parametrizada na Fase 2B como operacional piloto, nao validada para cobranca oficial.',
  },
  {
    codigo: 'ANEXO_II_A',
    titulo: 'Anexo II-A do Decreto Municipal n. 021/2020',
    tipo: 'outro',
    tipo_norma: 'anexo_decreto',
    numero: 'II-A',
    ano: 2020,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Atividades sujeitas ao licenciamento ambiental municipal.',
    status_normativo: 'vigente',
    modulo_principal: 'licenciamento',
  },
  {
    codigo: 'ANEXO_III_A',
    titulo: 'Anexo III-A do Decreto Municipal n. 021/2020',
    tipo: 'outro',
    tipo_norma: 'anexo_decreto',
    numero: 'III-A',
    ano: 2020,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Atividades dispensadas conforme aplicabilidade tecnica.',
    status_normativo: 'vigente',
    modulo_principal: 'dispensa',
  },
  {
    codigo: 'ANEXO_I_C',
    titulo: 'Anexo I-C do Decreto Municipal n. 021/2020',
    tipo: 'outro',
    tipo_norma: 'anexo_decreto',
    numero: 'I-C',
    ano: 2020,
    esfera: 'municipal',
    orgao: 'Municipio demonstrativo',
    ementa: 'Documentacao basica para procedimentos de licenciamento.',
    status_normativo: 'vigente',
    modulo_principal: 'licenciamento',
  },
  {
    codigo: 'CONSEMA_001_2022_REFERENCIA',
    titulo: 'Resolucao CONSEMA n. 001/2022',
    tipo: 'resolucao',
    tipo_norma: 'resolucao_estadual_referencia',
    numero: '001',
    ano: 2022,
    esfera: 'estadual',
    orgao: 'CONSEMA',
    ementa: 'Referencia comparativa estadual para futura atualizacao normativa.',
    status_normativo: 'referencia_comparativa',
    modulo_principal: 'licenciamento',
    referencia_comparativa: true,
    observacao_juridica: 'Referencia comparativa. Nao substituir automaticamente a matriz municipal do Decreto n. 021/2020.',
  },
];

const MODULOS_POR_NORMA = {
  LEI_MUNICIPAL_1191_2019: ['licenciamento', 'fiscalizacao', 'denuncias', 'monitoramento', 'educacao_ambiental', 'fundo_municipal', 'painel_publico'],
  LEI_MUNICIPAL_1192_2019: ['licenciamento', 'taxas', 'ama', 'dispensa', 'painel_publico'],
  LEI_MUNICIPAL_1193_2019: ['fiscalizacao', 'denuncias', 'autos_infracao', 'notificacoes', 'dosimetria'],
  LEI_MUNICIPAL_1093_2017: ['taxas'],
  DECRETO_MUNICIPAL_021_2020: ['licenciamento', 'dispensa', 'ama', 'painel_publico'],
  ANEXO_I_A: ['licenciamento', 'taxas'],
  ANEXO_II_A: ['licenciamento'],
  ANEXO_III_A: ['dispensa'],
  ANEXO_I_C: ['licenciamento'],
  CONSEMA_001_2022_REFERENCIA: ['licenciamento'],
};

const MATRIZ_FASE_2B = [
  ['pequeno', 'baixo', 'simplificada'],
  ['pequeno', 'medio', 'classe_i'],
  ['pequeno', 'alto', 'classe_ii'],
  ['medio', 'baixo', 'classe_i'],
  ['medio', 'medio', 'classe_ii'],
  ['medio', 'alto', 'classe_iii'],
  ['grande', 'baixo', 'classe_i'],
  ['grande', 'medio', 'classe_iii'],
  ['grande', 'alto', 'classe_iv'],
];

const MATRIZ_LEI_1192_CONFERENCIA = [
  ['pequeno', 'baixo', 'simplificada'],
  ['pequeno', 'medio', 'classe_i'],
  ['pequeno', 'alto', 'classe_ii'],
  ['medio', 'baixo', 'classe_i'],
  ['medio', 'medio', 'classe_ii'],
  ['medio', 'alto', 'classe_iii'],
  ['grande', 'baixo', 'classe_ii'],
  ['grande', 'medio', 'classe_iii'],
  ['grande', 'alto', 'classe_iv'],
];

const DIVERGENCIAS = [
  {
    codigo: 'DIVERGENCIA_MATRIZ_GRANDE_BAIXO',
    titulo: 'Divergencia sobre classe para Grande Porte + Potencial Baixo',
    descricao: 'A matriz operacional da Fase 2B pode indicar Grande + Baixo como Classe I, enquanto a Lei n. 1.192/2019 pode indicar Classe II. Exige conferencia juridica antes de alteracao do motor.',
    norma_principal_codigo: 'LEI_MUNICIPAL_1192_2019',
    norma_comparada_codigo: 'DECRETO_MUNICIPAL_021_2020',
    tipo_divergencia: 'matriz_enquadramento',
    criticidade: 'alta',
    impacto_sistema: 'Altera classe, valor de taxa e enquadramento.',
    impacto_usuario: 'Pode alterar a orientacao preliminar e o valor estimado exibido ao requerente.',
    status: 'pendente_validacao_juridica',
    recomendacao: 'Manter motor Fase 2B sem alteracao e submeter a divergencia a SMAD/Procuradoria.',
  },
  {
    codigo: 'DIVERGENCIA_TABELA_TAXAS_LEI_1192_DECRETO_021',
    titulo: 'Conferencia entre tabela de taxas da Lei n. 1.192/2019 e Anexo I-A/Decreto n. 021/2020',
    descricao: 'A tabela operacional parametrizada na Fase 2B precisa ser conferida visualmente contra a Lei n. 1.192/2019 antes de DAM, cobranca oficial ou protocolo definitivo.',
    norma_principal_codigo: 'LEI_MUNICIPAL_1192_2019',
    norma_comparada_codigo: 'ANEXO_I_A',
    tipo_divergencia: 'tabela_taxa',
    criticidade: 'critica',
    impacto_sistema: 'Pode alterar cobranca tributaria.',
    impacto_usuario: 'O valor exibido permanece estimativo e nao constitui cobranca oficial.',
    status: 'pendente_conferencia_visual',
    recomendacao: 'Bloquear DAM real e cobranca oficial ate validacao da tabela.',
  },
  {
    codigo: 'LEI_1093_SUPERADA_POR_LEI_1192',
    titulo: 'Lei n. 1.093/2017 como norma anterior de taxas',
    descricao: 'A Lei n. 1.093/2017 e norma anterior de taxas e deve permanecer cadastrada para rastreabilidade historica.',
    norma_principal_codigo: 'LEI_MUNICIPAL_1192_2019',
    norma_comparada_codigo: 'LEI_MUNICIPAL_1093_2017',
    tipo_divergencia: 'tabela_taxa',
    criticidade: 'media',
    impacto_sistema: 'Evita aplicacao indevida de tabela historica como preferencial atual.',
    impacto_usuario: 'Processos antigos podem exigir validacao juridica especifica.',
    status: 'registrada',
    recomendacao: 'Manter historica e nao aplicar como tabela preferencial atual sem analise juridica.',
  },
];

const HOMOLOGACAO = [
  ['PUBLICO_SIMULADOR_ABRIR', 'Publico - Simulador', 'Abrir simulador publico', '?view=publico&module=licenciamento'],
  ['PUBLICO_SIMULADOR_LISTAR_ATIVIDADES', 'Publico - Simulador', 'Listar atividades-piloto', '?view=publico&module=licenciamento'],
  ['PUBLICO_SIMULADOR_1806_PERGUNTAS', 'Publico - Simulador', 'Exibir perguntas condicionais da 18.06', '?view=publico&module=licenciamento'],
  ['PUBLICO_SIMULADOR_1806_RESULTADO', 'Publico - Simulador', 'Simular 18.06 com 22.000 m2 e talude 4 m', '?view=publico&module=licenciamento'],
  ['PUBLICO_SIMULADOR_MEMORIA_TAXA', 'Publico - Simulador', 'Exibir classe II, taxa R$ 956,01 e memoria de calculo', '?view=publico&module=licenciamento'],
  ['PUBLICO_SIMULADOR_AVISO_PRELIMINAR', 'Publico - Simulador', 'Exibir aviso de resultado preliminar e validacao tecnica obrigatoria', '?view=publico&module=licenciamento'],
  ['PUBLICO_SIMULADOR_BLOQUEIO_2001', 'Publico - Simulador', 'Bloquear inconsistencia em 20.01 com residuo perigoso', '?view=publico&module=licenciamento'],
  ['PUBLICO_SIMULADOR_BLOQUEIO_1606', 'Publico - Simulador', 'Bloquear 16.06 quando marcado artesanal', '?view=publico&module=licenciamento'],
  ['PUBLICO_SIMULADOR_EXTRAPOLACAO_1903', 'Publico - Simulador', 'Alertar extrapolacao em 19.03 acima de 500.000 m2', '?view=publico&module=licenciamento'],
  ['ADMIN_PARAMETROS_ABRIR', 'Admin - Parametros', 'Abrir Admin Licenciamento e area de parametros', '?view=admin&module=licenciamento'],
  ['ADMIN_PARAMETROS_VRTE', 'Admin - Parametros', 'Visualizar VRTE ativa', '?view=admin&module=licenciamento'],
  ['ADMIN_PARAMETROS_TAXAS', 'Admin - Parametros', 'Visualizar tabela de taxas', '?view=admin&module=licenciamento'],
  ['ADMIN_PARAMETROS_NORMAS', 'Admin - Parametros', 'Visualizar normas', '?view=admin&module=licenciamento'],
  ['ADMIN_PARAMETROS_ATIVIDADES', 'Admin - Parametros', 'Visualizar atividades-piloto', '?view=admin&module=licenciamento'],
  ['ADMIN_PARAMETROS_REGRAS', 'Admin - Parametros', 'Visualizar regras de enquadramento', '?view=admin&module=licenciamento'],
  ['ADMIN_PARAMETROS_DOCUMENTOS', 'Admin - Parametros', 'Visualizar documentos', '?view=admin&module=licenciamento'],
  ['ADMIN_PARAMETROS_STATUS', 'Admin - Parametros', 'Visualizar endpoint de status da parametrizacao', '/licenciamento/parametrizacao/status'],
  ['NORMATIVO_LEI_1191', 'Normativo', 'Lei n. 1.191/2019 cadastrada', '/licenciamento/governanca-normativa/status'],
  ['NORMATIVO_LEI_1192', 'Normativo', 'Lei n. 1.192/2019 cadastrada como preferencial de taxas', '/licenciamento/governanca-normativa/status'],
  ['NORMATIVO_LEI_1193', 'Normativo', 'Lei n. 1.193/2019 cadastrada', '/licenciamento/governanca-normativa/status'],
  ['NORMATIVO_LEI_1093', 'Normativo', 'Lei n. 1.093/2017 cadastrada como historica', '/licenciamento/governanca-normativa/status'],
  ['NORMATIVO_DECRETO_021', 'Normativo', 'Decreto n. 021/2020 cadastrado', '/licenciamento/governanca-normativa/status'],
  ['NORMATIVO_DIVERGENCIA_GRANDE_BAIXO', 'Normativo', 'Divergencia Grande + Baixo registrada', '/licenciamento/governanca-normativa/divergencias'],
  ['NORMATIVO_DIVERGENCIA_TAXAS', 'Normativo', 'Divergencia de tabela de taxas registrada', '/licenciamento/governanca-normativa/divergencias'],
  ['NORMATIVO_TABELA_PILOTO', 'Normativo', 'Tabela Fase 2B marcada como operacional_piloto', '/licenciamento/governanca-normativa/tabelas-taxas'],
  ['NORMATIVO_COBRANCA_BLOQUEADA', 'Normativo', 'Cobranca oficial bloqueada', '/licenciamento/governanca-normativa/status'],
  ['REGRESSAO_SIGBA_PUBLICO', 'Nao regressao', 'SIGBA publico funcionando', '?view=publico&module=sigba'],
  ['REGRESSAO_PORTAL_TUTOR', 'Nao regressao', 'Portal do Tutor funcionando', '?view=portal&module=sigba'],
  ['REGRESSAO_VIVEIRO', 'Nao regressao', 'Viveiro funcionando', '?view=publico&module=viveiro'],
  ['REGRESSAO_DENUNCIAS', 'Nao regressao', 'Denuncias funcionando', '?view=denuncias'],
  ['REGRESSAO_PAINEL_SIGMA', 'Nao regressao', 'Painel Publico SIGMA funcionando', '?view=publico'],
];

async function upsertNorma(client, norma) {
  const existing = await client.query(
    'SELECT id FROM licenciamento_normas WHERE LOWER(codigo) = LOWER($1) AND deleted_at IS NULL LIMIT 1;',
    [norma.codigo]
  );
  const payload = {
    titulo: norma.titulo,
    codigo: norma.codigo,
    tipo: norma.tipo,
    tipo_norma: norma.tipo_norma,
    numero: norma.numero,
    ano: norma.ano,
    esfera: norma.esfera,
    orgao: norma.orgao,
    ementa: norma.ementa,
    status_normativo: norma.status_normativo,
    modulo_principal: norma.modulo_principal,
    preferencial_taxas: Boolean(norma.preferencial_taxas),
    preferencial_enquadramento: Boolean(norma.preferencial_enquadramento),
    referencia_comparativa: Boolean(norma.referencia_comparativa),
    norma_historica: Boolean(norma.norma_historica),
    requer_validacao_juridica: Boolean(norma.requer_validacao_juridica),
    fonte_url: norma.fonte_url || null,
    observacao_juridica: norma.observacao_juridica || null,
    observacao_tecnica: norma.observacao_tecnica || null,
    observacao: norma.observacao || null,
    ativo: true,
  };
  const fields = Object.keys(payload);

  if (existing.rows[0]) {
    const values = fields.map((field) => payload[field]);
    values.push(existing.rows[0].id);
    const result = await client.query(
      `
        UPDATE licenciamento_normas
        SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $${values.length}
        RETURNING *;
      `,
      values
    );
    return result.rows[0];
  }

  const values = fields.map((field) => payload[field]);
  const result = await client.query(
    `
      INSERT INTO licenciamento_normas (${fields.join(', ')})
      VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')})
      RETURNING *;
    `,
    values
  );
  return result.rows[0];
}

async function upsertTabelaTaxa(client, normaId) {
  const payload = {
    codigo: 'TAXAS_ANEXO_I_A_FASE_2B_OPERACIONAL_PILOTO',
    nome: 'Tabela de Taxas do Anexo I-A - Parametrizacao Piloto Fase 2B',
    descricao: 'Tabela operacional para simulacao publica. Nao autorizada para DAM/cobranca oficial sem validacao juridica e conferencia com Lei Municipal n. 1.192/2019.',
    norma_id: normaId,
    ano_referencia: 2026,
    status: 'operacional_piloto',
    prioridade_aplicacao: 10,
    operacional: true,
    preferencial: false,
    piloto: true,
    requer_conferencia_juridica: true,
    validada_para_cobranca: false,
    observacao_juridica: 'Confirmar compatibilidade com a Lei Municipal n. 1.192/2019 antes de cobranca oficial, DAM ou protocolo definitivo.',
    observacao_tecnica: 'Mantida como base de simulacao preliminar da Fase 2B.',
    fonte: 'Decreto Municipal n. 021/2020 / Anexo I-A - parametrizacao piloto Fase 2B.',
  };
  const existing = await client.query(
    'SELECT id FROM licenciamento_tabelas_taxas WHERE codigo = $1 AND deleted_at IS NULL LIMIT 1;',
    [payload.codigo]
  );
  const fields = Object.keys(payload);

  if (existing.rows[0]) {
    const values = fields.map((field) => payload[field]);
    values.push(existing.rows[0].id);
    const result = await client.query(
      `
        UPDATE licenciamento_tabelas_taxas
        SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $${values.length}
        RETURNING *;
      `,
      values
    );
    return result.rows[0];
  }

  const values = fields.map((field) => payload[field]);
  const result = await client.query(
    `
      INSERT INTO licenciamento_tabelas_taxas (${fields.join(', ')})
      VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')})
      RETURNING *;
    `,
    values
  );
  return result.rows[0];
}

async function linkTaxRules(client, tabelaTaxaId, normaId) {
  const result = await client.query(
    `
      UPDATE licenciamento_regras_taxas
      SET tabela_taxa_id = $1,
          norma_id = $2,
          status_validacao = 'operacional_piloto',
          fonte_normativa = 'Decreto Municipal n. 021/2020 / Anexo I-A - parametrizacao piloto Fase 2B',
          observacao_juridica = 'Nao validada para cobranca oficial sem conferencia com a Lei Municipal n. 1.192/2019.',
          validada_para_cobranca = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE deleted_at IS NULL
        AND ativo = TRUE
        AND (tabela_taxa_id IS NULL OR tabela_taxa_id = $1)
      RETURNING id;
    `,
    [tabelaTaxaId, normaId]
  );
  return result.rowCount;
}

async function upsertMatriz(client, payload) {
  const existing = await client.query(
    'SELECT id FROM licenciamento_matrizes_enquadramento_versionadas WHERE codigo = $1 AND deleted_at IS NULL LIMIT 1;',
    [payload.codigo]
  );
  const fields = Object.keys(payload);

  if (existing.rows[0]) {
    const values = fields.map((field) => payload[field]);
    values.push(existing.rows[0].id);
    const result = await client.query(
      `
        UPDATE licenciamento_matrizes_enquadramento_versionadas
        SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $${values.length}
        RETURNING *;
      `,
      values
    );
    return result.rows[0];
  }

  const values = fields.map((field) => payload[field]);
  const result = await client.query(
    `
      INSERT INTO licenciamento_matrizes_enquadramento_versionadas (${fields.join(', ')})
      VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')})
      RETURNING *;
    `,
    values
  );
  return result.rows[0];
}

async function upsertMatrizRegra(client, matrizId, [porte, potencial, classeResultante], statusValidacao, observacao) {
  const existing = await client.query(
    `
      SELECT id
      FROM licenciamento_matriz_enquadramento_regras
      WHERE matriz_id = $1
        AND LOWER(porte) = LOWER($2)
        AND LOWER(potencial) = LOWER($3)
        AND deleted_at IS NULL
      LIMIT 1;
    `,
    [matrizId, porte, potencial]
  );

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE licenciamento_matriz_enquadramento_regras
        SET classe_resultante = $1,
            status_validacao = $2,
            observacao = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4;
      `,
      [classeResultante, statusValidacao, observacao, existing.rows[0].id]
    );
    return;
  }

  await client.query(
    `
      INSERT INTO licenciamento_matriz_enquadramento_regras (
        matriz_id, porte, potencial, classe_resultante, status_validacao, observacao
      )
      VALUES ($1, $2, $3, $4, $5, $6);
    `,
    [matrizId, porte, potencial, classeResultante, statusValidacao, observacao]
  );
}

async function upsertDivergencia(client, item, normas) {
  const payload = {
    codigo: item.codigo,
    titulo: item.titulo,
    descricao: item.descricao,
    norma_principal_id: normas[item.norma_principal_codigo]?.id || null,
    norma_comparada_id: normas[item.norma_comparada_codigo]?.id || null,
    tipo_divergencia: item.tipo_divergencia,
    criticidade: item.criticidade,
    impacto_sistema: item.impacto_sistema,
    impacto_usuario: item.impacto_usuario,
    status: item.status,
    recomendacao: item.recomendacao,
  };
  const existing = await client.query(
    'SELECT id FROM licenciamento_divergencias_normativas WHERE codigo = $1 AND deleted_at IS NULL LIMIT 1;',
    [payload.codigo]
  );
  const fields = Object.keys(payload);

  if (existing.rows[0]) {
    const values = fields.map((field) => payload[field]);
    values.push(existing.rows[0].id);
    await client.query(
      `
        UPDATE licenciamento_divergencias_normativas
        SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $${values.length};
      `,
      values
    );
    return;
  }

  await client.query(
    `
      INSERT INTO licenciamento_divergencias_normativas (${fields.join(', ')})
      VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')});
    `,
    fields.map((field) => payload[field])
  );
}

async function upsertChecklist(client, [codigo, grupo, item, rota]) {
  const existing = await client.query(
    'SELECT id FROM licenciamento_homologacao_checklists WHERE codigo = $1 LIMIT 1;',
    [codigo]
  );
  const descricao = `Validacao obrigatoria da Fase 2C: ${item}.`;

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE licenciamento_homologacao_checklists
        SET grupo = $1,
            item = $2,
            descricao = $3,
            rota_relacionada = $4,
            obrigatorio = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5;
      `,
      [grupo, item, descricao, rota, existing.rows[0].id]
    );
    return;
  }

  await client.query(
    `
      INSERT INTO licenciamento_homologacao_checklists (
        codigo, grupo, item, descricao, rota_relacionada, obrigatorio, status
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, 'pendente');
    `,
    [codigo, grupo, item, descricao, rota]
  );
}

async function upsertNormaModulo(client, normaId, modulo, tipoVinculo = 'referencia', observacao = null) {
  const existing = await client.query(
    `
      SELECT id
      FROM licenciamento_normas_modulos_vinculos
      WHERE norma_id = $1
        AND LOWER(modulo) = LOWER($2)
        AND LOWER(tipo_vinculo) = LOWER($3)
        AND ativo = TRUE
      LIMIT 1;
    `,
    [normaId, modulo, tipoVinculo]
  );

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE licenciamento_normas_modulos_vinculos
        SET observacao = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2;
      `,
      [observacao, existing.rows[0].id]
    );
    return;
  }

  await client.query(
    `
      INSERT INTO licenciamento_normas_modulos_vinculos (norma_id, modulo, tipo_vinculo, observacao)
      VALUES ($1, $2, $3, $4);
    `,
    [normaId, modulo, tipoVinculo, observacao]
  );
}

async function seedLicenciamentoFase2C({ silent = false, skipFase2B = false } = {}) {
  if (!skipFase2B) {
    await seedLicenciamentoFase2B({ silent: true });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const normas = {};
    for (const norma of NORMAS) {
      normas[norma.codigo] = await upsertNorma(client, norma);
    }

    const tabelaTaxa = await upsertTabelaTaxa(client, normas.ANEXO_I_A.id);
    const regrasTaxasVinculadas = await linkTaxRules(client, tabelaTaxa.id, normas.ANEXO_I_A.id);

    const matrizFase2B = await upsertMatriz(client, {
      codigo: 'MATRIZ_ENQUADRAMENTO_FASE_2B_PILOTO',
      nome: 'Matriz de Enquadramento Fase 2B - Operacional Piloto',
      norma_id: normas.ANEXO_I_A.id,
      status: 'operacional_piloto',
      operacional: true,
      piloto: true,
      requer_conferencia_juridica: true,
      observacao_juridica: 'Matriz operacional para simulacao. Nao alterar classe final sem validacao juridica.',
      observacao_tecnica: 'Mantem Grande + Baixo como Classe I conforme motor validado na Fase 2B.',
    });
    for (const regra of MATRIZ_FASE_2B) {
      await upsertMatrizRegra(client, matrizFase2B.id, regra, 'operacional_piloto', 'Regra usada pelo motor Fase 2B.');
    }

    const matrizLei1192 = await upsertMatriz(client, {
      codigo: 'MATRIZ_ENQUADRAMENTO_LEI_1192_2019_EM_CONFERENCIA',
      nome: 'Matriz de Enquadramento Lei n. 1.192/2019 - Em Conferencia',
      norma_id: normas.LEI_MUNICIPAL_1192_2019.id,
      status: 'vigente_em_conferencia',
      operacional: false,
      piloto: false,
      requer_conferencia_juridica: true,
      observacao_juridica: 'Matriz cadastrada para comparacao. Nao operacional ate conferencia juridica.',
      observacao_tecnica: 'Ponto sensivel: Grande + Baixo pode resultar em Classe II.',
    });
    for (const regra of MATRIZ_LEI_1192_CONFERENCIA) {
      const isSensitive = regra[0] === 'grande' && regra[1] === 'baixo';
      await upsertMatrizRegra(
        client,
        matrizLei1192.id,
        regra,
        isSensitive ? 'requer_conferencia_juridica' : 'em_conferencia',
        isSensitive ? 'Divergencia sensivel em relacao a matriz operacional piloto.' : 'Regra em conferencia normativa.'
      );
    }

    for (const item of DIVERGENCIAS) {
      await upsertDivergencia(client, item, normas);
    }

    for (const item of HOMOLOGACAO) {
      await upsertChecklist(client, item);
    }

    for (const [normaCodigo, modulos] of Object.entries(MODULOS_POR_NORMA)) {
      for (const modulo of modulos) {
        await upsertNormaModulo(client, normas[normaCodigo].id, modulo, 'referencia', `Vinculo normativo ${normaCodigo} -> ${modulo}.`);
      }
    }

    await client.query('COMMIT');

    const summary = {
      normas: NORMAS.length,
      tabela_taxa: tabelaTaxa.codigo,
      regras_taxas_vinculadas: regrasTaxasVinculadas,
      matrizes: 2,
      divergencias: DIVERGENCIAS.length,
      checklist_itens: HOMOLOGACAO.length,
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
  seedLicenciamentoFase2C()
    .then(() => db.end())
    .catch(() => db.end().finally(() => process.exit(1)));
}

module.exports = seedLicenciamentoFase2C;
