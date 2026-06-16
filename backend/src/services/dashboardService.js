const db = require('../config/db');

function buildActiveStatusFilter(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(${prefix}status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')`;
}

const ACTIVE_ANIMAL_FILTER = buildActiveStatusFilter();
const ACTIVE_ANIMAL_FILTER_A = buildActiveStatusFilter('a');
const ACTIVE_TUTOR_FILTER = buildActiveStatusFilter();
const ACTIVE_TUTOR_FILTER_T = buildActiveStatusFilter('t');

exports.getSummary = async () => {
  const totalAnimaisQuery = `
    SELECT COUNT(*)::int AS total
    FROM animais
    WHERE ${ACTIVE_ANIMAL_FILTER};
  `;

  const totalTutoresQuery = `
    SELECT COUNT(*)::int AS total
    FROM tutores
    WHERE ${ACTIVE_TUTOR_FILTER};
  `;

  const animaisCastradosQuery = `
    SELECT COUNT(*)::int AS total
    FROM animais
    WHERE ${ACTIVE_ANIMAL_FILTER}
      AND castrado = true;
  `;

  const animaisVacinadosQuery = `
    SELECT COUNT(*)::int AS total
    FROM animais a
    WHERE ${ACTIVE_ANIMAL_FILTER_A}
      AND (
        a.vacinado = true
       OR EXISTS (
        SELECT 1
        FROM animal_vacinacoes av
        WHERE av.animal_id = a.id
          AND av.status_registro <> 'cancelado'
      ));
  `;

  const animaisCastracaoPendenteQuery = `
    SELECT COUNT(*)::int AS total
    FROM animais
    WHERE ${ACTIVE_ANIMAL_FILTER}
      AND castracao_pendente = true;
  `;

  const animaisPorEspecieQuery = `
    SELECT especie, COUNT(*)::int AS total
    FROM animais
    WHERE ${ACTIVE_ANIMAL_FILTER}
    GROUP BY especie
    ORDER BY especie;
  `;

  const animaisPorStatusQuery = `
    SELECT status, COUNT(*)::int AS total
    FROM animais
    WHERE ${ACTIVE_ANIMAL_FILTER}
    GROUP BY status
    ORDER BY status;
  `;

  const [
    totalAnimaisResult,
    totalTutoresResult,
    animaisCastradosResult,
    animaisVacinadosResult,
    animaisCastracaoPendenteResult,
    animaisPorEspecieResult,
    animaisPorStatusResult
  ] = await Promise.all([
    db.query(totalAnimaisQuery),
    db.query(totalTutoresQuery),
    db.query(animaisCastradosQuery),
    db.query(animaisVacinadosQuery),
    db.query(animaisCastracaoPendenteQuery),
    db.query(animaisPorEspecieQuery),
    db.query(animaisPorStatusQuery)
  ]);

  return {
    total_animais: totalAnimaisResult.rows[0].total,
    total_tutores: totalTutoresResult.rows[0].total,
    animais_castrados: animaisCastradosResult.rows[0].total,
    animais_vacinados: animaisVacinadosResult.rows[0].total,
    animais_castracao_pendente: animaisCastracaoPendenteResult.rows[0].total,
    animais_por_especie: animaisPorEspecieResult.rows,
    animais_por_status: animaisPorStatusResult.rows
  };
};

exports.getGerencialDashboard = async () => {
  const query = `
    WITH base AS (
      SELECT
        a.id,
        a.especie,
        a.status,
        a.castrado,
        a.castracao_pendente,
        (
          a.vacinado = true
          OR EXISTS (
            SELECT 1
            FROM animal_vacinacoes av
            WHERE av.animal_id = a.id
              AND av.status_registro <> 'cancelado'
          )
        ) AS vacinado,
        a.microchip,
        a.tutor_id
      FROM animais a
      WHERE ${ACTIVE_ANIMAL_FILTER_A}
    ),
    totais AS (
      SELECT
        COUNT(*)::int AS total_animais,
        COUNT(*) FILTER (WHERE castrado = true)::int AS animais_castrados,
        COUNT(*) FILTER (WHERE castracao_pendente = true)::int AS animais_castracao_pendente,
        COUNT(*) FILTER (WHERE vacinado = true)::int AS animais_vacinados,
        COUNT(*) FILTER (
          WHERE microchip IS NOT NULL AND TRIM(microchip) <> ''
        )::int AS animais_microchipados,
        COUNT(*) FILTER (WHERE tutor_id IS NULL)::int AS animais_sem_tutor,
        COUNT(*) FILTER (
          WHERE microchip IS NULL OR TRIM(microchip) = ''
        )::int AS animais_sem_microchip
      FROM base
    ),
    tutores AS (
      SELECT COUNT(*)::int AS total_tutores
      FROM tutores
      WHERE ${ACTIVE_TUTOR_FILTER}
    ),
    especies AS (
      SELECT
        COUNT(*) FILTER (WHERE especie = 'canino')::int AS caninos,
        COUNT(*) FILTER (WHERE especie = 'felino')::int AS felinos
      FROM base
    ),
    status_agg AS (
      SELECT
        COUNT(*) FILTER (WHERE status = 'ativo')::int AS ativo,
        COUNT(*) FILTER (WHERE status = 'acompanhamento')::int AS acompanhamento,
        COUNT(*) FILTER (WHERE status = 'tratamento')::int AS tratamento,
        COUNT(*) FILTER (WHERE status = 'disponivel_adocao')::int AS disponivel_adocao,
        COUNT(*) FILTER (WHERE status = 'adotado')::int AS adotado,
        COUNT(*) FILTER (WHERE status = 'inativo')::int AS inativo
      FROM base
    )
    SELECT
      t.total_animais,
      tu.total_tutores,
      t.animais_castrados,
      t.animais_castracao_pendente,
      t.animais_vacinados,
      t.animais_microchipados,
      t.animais_sem_tutor,
      t.animais_sem_microchip,
      e.caninos,
      e.felinos,
      s.ativo,
      s.acompanhamento,
      s.tratamento,
      s.disponivel_adocao,
      s.adotado,
      s.inativo
    FROM totais t
    CROSS JOIN tutores tu
    CROSS JOIN especies e
    CROSS JOIN status_agg s;
  `;

  const result = await db.query(query);
  const territorialResult = await db.query(`
    WITH bairros AS (
      SELECT
        COALESCE(ta.nome, tt.nome, NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), ''), 'Nao informado') AS bairro,
        COUNT(a.id)::int AS animais,
        COUNT(a.id) FILTER (WHERE a.castrado = true)::int AS castrados,
        COUNT(a.id) FILTER (
          WHERE a.vacinado = true
             OR EXISTS (
              SELECT 1
              FROM animal_vacinacoes av
              WHERE av.animal_id = a.id
                AND av.status_registro <> 'cancelado'
            )
        )::int AS vacinados,
        COUNT(a.id) FILTER (WHERE a.microchip IS NOT NULL AND TRIM(a.microchip) <> '')::int AS microchipados
      FROM animais a
      LEFT JOIN tutores t ON t.id = a.tutor_id
      LEFT JOIN territorios ta ON ta.id = a.territorio_id
      LEFT JOIN territorios tt ON tt.id = t.territorio_id
      WHERE ${ACTIVE_ANIMAL_FILTER_A}
      GROUP BY 1
    ),
    ocorrencias AS (
      SELECT
        COALESCE(tr.nome, NULLIF(TRIM(o.bairro), ''), 'Nao informado') AS bairro,
        COUNT(*)::int AS ocorrencias,
        COUNT(*) FILTER (WHERE o.status = 'aberta')::int AS ocorrencias_abertas
      FROM animal_ocorrencias o
      LEFT JOIN territorios tr ON tr.id = o.territorio_id
      GROUP BY 1
    )
    SELECT
      COALESCE(b.bairro, o.bairro) AS bairro,
      COALESCE(b.animais, 0)::int AS animais,
      COALESCE(b.castrados, 0)::int AS castrados,
      COALESCE(b.vacinados, 0)::int AS vacinados,
      COALESCE(b.microchipados, 0)::int AS microchipados,
      COALESCE(o.ocorrencias, 0)::int AS ocorrencias,
      COALESCE(o.ocorrencias_abertas, 0)::int AS ocorrencias_abertas
    FROM bairros b
    FULL OUTER JOIN ocorrencias o ON o.bairro = b.bairro
    ORDER BY ocorrencias_abertas DESC, animais DESC, bairro ASC
    LIMIT 12;
  `);
  const ocorrenciasResult = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE o.status = 'aberta')::int AS abertas,
      COUNT(*) FILTER (WHERE o.tipo = 'perda' AND o.status IN ('aberta', 'em_atendimento'))::int AS perdas_ativas,
      COUNT(*) FILTER (WHERE o.tipo = 'encontro' AND o.status IN ('aberta', 'em_atendimento'))::int AS encontrados_ativos
    FROM animal_ocorrencias o;
  `);
  const row = result.rows[0] || {};
  const ocorrenciasRow = ocorrenciasResult.rows[0] || {};

  const totalAnimais = Number(row.total_animais || 0);
  const totalTutores = Number(row.total_tutores || 0);
  const animaisCastrados = Number(row.animais_castrados || 0);
  const animaisCastracaoPendente = Number(row.animais_castracao_pendente || 0);
  const animaisVacinados = Number(row.animais_vacinados || 0);
  const animaisMicrochipados = Number(row.animais_microchipados || 0);
  const animaisSemTutor = Number(row.animais_sem_tutor || 0);
  const animaisSemMicrochip = Number(row.animais_sem_microchip || 0);

  const pendentesVacinacao = totalAnimais - animaisVacinados;

  const percentualCastracao =
    totalAnimais > 0
      ? Number(((animaisCastrados / totalAnimais) * 100).toFixed(2))
      : 0;

  const percentualVacinacao =
    totalAnimais > 0
      ? Number(((animaisVacinados / totalAnimais) * 100).toFixed(2))
      : 0;

  const percentualMicrochipagem =
    totalAnimais > 0
      ? Number(((animaisMicrochipados / totalAnimais) * 100).toFixed(2))
      : 0;

  return {
    totais: {
      animais: totalAnimais,
      tutores: totalTutores,
      castrados: animaisCastrados,
      castracao_pendente: animaisCastracaoPendente,
      vacinados: animaisVacinados,
      microchipados: animaisMicrochipados,
      sem_tutor: animaisSemTutor
    },
    percentuais: {
      castracao: percentualCastracao,
      vacinacao: percentualVacinacao,
      microchipagem: percentualMicrochipagem
    },
    por_especie: {
      caninos: Number(row.caninos || 0),
      felinos: Number(row.felinos || 0)
    },
    por_status: {
      ativo: Number(row.ativo || 0),
      acompanhamento: Number(row.acompanhamento || 0),
      tratamento: Number(row.tratamento || 0),
      disponivel_adocao: Number(row.disponivel_adocao || 0),
      adotado: Number(row.adotado || 0),
      inativo: Number(row.inativo || 0)
    },
    alertas: {
      sem_microchip: animaisSemMicrochip,
      sem_tutor: animaisSemTutor,
      pendentes_vacinacao: pendentesVacinacao,
      pendentes_castracao: animaisCastracaoPendente
    },
    ocorrencias: {
      total: Number(ocorrenciasRow.total || 0),
      abertas: Number(ocorrenciasRow.abertas || 0),
      perdas_ativas: Number(ocorrenciasRow.perdas_ativas || 0),
      encontrados_ativos: Number(ocorrenciasRow.encontrados_ativos || 0)
    },
    territorial: territorialResult.rows
  };
};

exports.getVacinacaoDashboard = async () => {
  const baseWhere = `
    WHERE av.status_registro <> 'cancelado'
      AND EXISTS (
        SELECT 1
        FROM animais ax
        WHERE ax.id = av.animal_id
          AND ${buildActiveStatusFilter('ax')}
      )
  `;
  const totalsQuery = `
    WITH estruturados AS (
      SELECT
        av.*,
        a.especie,
        COALESCE(ta.nome, tt.nome, NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), ''), 'Nao informado') AS bairro
      FROM animal_vacinacoes av
      JOIN animais a ON a.id = av.animal_id
      LEFT JOIN tutores t ON t.id = a.tutor_id
      LEFT JOIN territorios ta ON ta.id = a.territorio_id
      LEFT JOIN territorios tt ON tt.id = t.territorio_id
      ${baseWhere}
    ),
    legado_sem_estruturado AS (
      SELECT COUNT(*)::int AS total
      FROM animais a
      WHERE ${ACTIVE_ANIMAL_FILTER_A}
        AND jsonb_array_length(
        CASE
          WHEN jsonb_typeof(a.vacinas) = 'array' THEN a.vacinas
          ELSE '[]'::jsonb
        END
      ) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM animal_vacinacoes av
          WHERE av.animal_id = a.id
            AND av.status_registro <> 'cancelado'
        )
    )
    SELECT
      COUNT(*)::int AS registros_ativos,
      COUNT(DISTINCT animal_id)::int AS animais_com_registro_estruturado,
      COUNT(*) FILTER (WHERE status_registro = 'comprovado')::int AS registros_comprovados,
      COUNT(*) FILTER (WHERE status_registro = 'pendente_comprovacao')::int AS registros_declarados_pendentes,
      COUNT(*) FILTER (WHERE origem_registro = 'tutor_declarado')::int AS registros_declarados,
      COUNT(*) FILTER (WHERE origem_registro = 'campanha')::int AS registros_campanha,
      COUNT(*) FILTER (
        WHERE origem_registro = 'campanha'
          AND fonte_lancamento = 'campanha_atendimento_estruturado'
      )::int AS registros_campanha_estruturados,
      COUNT(*) FILTER (
        WHERE origem_registro = 'campanha'
          AND fonte_lancamento = 'campanha_status_atendido_auto'
      )::int AS registros_campanha_genericos,
      COUNT(*) FILTER (WHERE origem_registro = 'legado_jsonb')::int AS registros_legado_importados,
      COUNT(*) FILTER (WHERE documento_id IS NOT NULL)::int AS registros_com_documento,
      COUNT(*) FILTER (WHERE status_registro = 'vencido' OR (proxima_dose_em IS NOT NULL AND proxima_dose_em < CURRENT_DATE))::int AS registros_vencidos,
      (SELECT total FROM legado_sem_estruturado)::int AS animais_apenas_legado_jsonb
    FROM estruturados;
  `;

  const porVacinaQuery = `
    SELECT
      COALESCE(vc.codigo, av.vacina_codigo, 'sem_codigo') AS codigo,
      COALESCE(vc.nome_popular, av.vacina_nome_popular, av.vacina_nome, 'Nao informado') AS vacina,
      COUNT(*)::int AS registros,
      COUNT(DISTINCT av.animal_id)::int AS animais,
      COUNT(*) FILTER (WHERE av.origem_registro = 'campanha')::int AS registros_campanha,
      COUNT(*) FILTER (WHERE av.fonte_lancamento = 'campanha_atendimento_estruturado')::int AS campanha_estruturados,
      COUNT(*) FILTER (WHERE av.status_registro = 'comprovado')::int AS comprovados
    FROM animal_vacinacoes av
    LEFT JOIN vacina_catalogo vc ON vc.id = av.vacina_catalogo_id
    ${baseWhere}
    GROUP BY 1, 2
    ORDER BY registros DESC, vacina ASC
    LIMIT 12;
  `;

  const porEspecieQuery = `
    SELECT
      COALESCE(a.especie, av.especie, 'Nao informado') AS especie,
      COUNT(*)::int AS registros,
      COUNT(DISTINCT av.animal_id)::int AS animais
    FROM animal_vacinacoes av
    JOIN animais a ON a.id = av.animal_id
    ${baseWhere}
    GROUP BY 1
    ORDER BY registros DESC, especie ASC;
  `;

  const porOrigemQuery = `
    SELECT
      origem_registro,
      COUNT(*)::int AS registros,
      COUNT(DISTINCT animal_id)::int AS animais
    FROM animal_vacinacoes av
    ${baseWhere}
    GROUP BY origem_registro
    ORDER BY registros DESC, origem_registro ASC;
  `;

  const porStatusQuery = `
    SELECT
      status_registro,
      COUNT(*)::int AS registros,
      COUNT(DISTINCT animal_id)::int AS animais
    FROM animal_vacinacoes av
    ${baseWhere}
    GROUP BY status_registro
    ORDER BY registros DESC, status_registro ASC;
  `;

  const porCampanhaQuery = `
    SELECT
      COALESCE(c.nome, 'Sem campanha vinculada') AS campanha,
      COALESCE(c.id, 0) AS campanha_id,
      COUNT(*)::int AS registros,
      COUNT(DISTINCT av.animal_id)::int AS animais,
      COUNT(*) FILTER (WHERE av.documento_id IS NOT NULL)::int AS com_documento,
      COUNT(*) FILTER (WHERE av.fonte_lancamento = 'campanha_atendimento_estruturado')::int AS estruturados,
      COUNT(*) FILTER (WHERE av.fonte_lancamento = 'campanha_status_atendido_auto')::int AS genericos
    FROM animal_vacinacoes av
    LEFT JOIN campanha_inscricoes ci ON ci.id = av.campanha_inscricao_id
    LEFT JOIN campanhas c ON c.id = COALESCE(av.campanha_id, ci.campanha_id)
    ${baseWhere}
    GROUP BY 1, 2
    ORDER BY registros DESC, campanha ASC
    LIMIT 12;
  `;

  const porBairroQuery = `
    SELECT
      COALESCE(ta.nome, tt.nome, NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), ''), 'Nao informado') AS bairro,
      COUNT(*)::int AS registros,
      COUNT(DISTINCT av.animal_id)::int AS animais,
      COUNT(*) FILTER (WHERE av.origem_registro = 'campanha')::int AS registros_campanha,
      COUNT(*) FILTER (WHERE av.documento_id IS NOT NULL)::int AS com_documento
    FROM animal_vacinacoes av
    JOIN animais a ON a.id = av.animal_id
    LEFT JOIN tutores t ON t.id = a.tutor_id
    LEFT JOIN territorios ta ON ta.id = a.territorio_id
    LEFT JOIN territorios tt ON tt.id = t.territorio_id
    ${baseWhere}
    GROUP BY 1
    ORDER BY registros DESC, bairro ASC
    LIMIT 12;
  `;

  const porPeriodoQuery = `
    SELECT
      TO_CHAR(date_trunc('month', COALESCE(av.data_aplicacao::timestamp, av.created_at)), 'YYYY-MM') AS periodo,
      COUNT(*)::int AS registros,
      COUNT(DISTINCT av.animal_id)::int AS animais,
      COUNT(*) FILTER (WHERE av.origem_registro = 'campanha')::int AS registros_campanha
    FROM animal_vacinacoes av
    ${baseWhere}
    GROUP BY 1
    ORDER BY periodo DESC
    LIMIT 12;
  `;

  const [
    totalsResult,
    porVacinaResult,
    porEspecieResult,
    porOrigemResult,
    porStatusResult,
    porCampanhaResult,
    porBairroResult,
    porPeriodoResult
  ] = await Promise.all([
    db.query(totalsQuery),
    db.query(porVacinaQuery),
    db.query(porEspecieQuery),
    db.query(porOrigemQuery),
    db.query(porStatusQuery),
    db.query(porCampanhaQuery),
    db.query(porBairroQuery),
    db.query(porPeriodoQuery)
  ]);

  return {
    totais: totalsResult.rows[0] || {
      registros_ativos: 0,
      animais_com_registro_estruturado: 0,
      registros_comprovados: 0,
      registros_declarados: 0,
      registros_campanha: 0,
      registros_campanha_estruturados: 0,
      registros_campanha_genericos: 0,
      registros_legado_importados: 0,
      registros_com_documento: 0,
      registros_vencidos: 0,
      animais_apenas_legado_jsonb: 0
    },
    por_vacina: porVacinaResult.rows,
    por_especie: porEspecieResult.rows,
    por_origem: porOrigemResult.rows,
    por_status: porStatusResult.rows,
    por_campanha: porCampanhaResult.rows,
    por_bairro: porBairroResult.rows,
    por_periodo: porPeriodoResult.rows,
    observacao:
      'Indicadores estruturados usam animal_vacinacoes como fonte principal; campos legados permanecem apenas como fallback de transicao.'
  };
};

exports.getQualidadeCadastralDashboard = async () => {
  const tutorQuery = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE confiabilidade_nivel = 'baixo')::int AS baixa_confiabilidade,
      COUNT(*) FILTER (WHERE confiabilidade_nivel = 'medio')::int AS media_confiabilidade,
      COUNT(*) FILTER (WHERE confiabilidade_nivel = 'alto')::int AS alta_confiabilidade,
      COUNT(*) FILTER (
        WHERE telefone_normalizado IS NULL
          AND email_normalizado IS NULL
      )::int AS sem_contato_minimo,
      COUNT(*) FILTER (
        WHERE cpf_normalizado IS NULL
      )::int AS sem_cpf,
      COUNT(*) FILTER (
        WHERE jsonb_array_length(
          CASE
            WHEN jsonb_typeof(duplicidade_alertas) = 'array' THEN duplicidade_alertas
            ELSE '[]'::jsonb
          END
        ) > 0
      )::int AS com_alerta_duplicidade
    FROM tutores
    WHERE ${ACTIVE_TUTOR_FILTER};
  `;

  const animalQuery = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE confiabilidade_nivel = 'baixo')::int AS baixa_confiabilidade,
      COUNT(*) FILTER (WHERE confiabilidade_nivel = 'medio')::int AS media_confiabilidade,
      COUNT(*) FILTER (WHERE confiabilidade_nivel = 'alto')::int AS alta_confiabilidade,
      COUNT(*) FILTER (
        WHERE microchip_normalizado IS NULL
      )::int AS sem_microchip,
      COUNT(*) FILTER (WHERE tutor_id IS NULL)::int AS sem_tutor,
      COUNT(*) FILTER (
        WHERE jsonb_array_length(
          CASE
            WHEN jsonb_typeof(duplicidade_alertas) = 'array' THEN duplicidade_alertas
            ELSE '[]'::jsonb
          END
        ) > 0
      )::int AS com_alerta_duplicidade
    FROM animais
    WHERE ${ACTIVE_ANIMAL_FILTER};
  `;

  const tutorDuplicatesQuery = `
    SELECT
      id,
      nome,
      cpf,
      email,
      telefone,
      confiabilidade_score,
      confiabilidade_nivel,
      duplicidade_alertas
    FROM tutores
    WHERE ${ACTIVE_TUTOR_FILTER}
      AND jsonb_array_length(
      CASE
        WHEN jsonb_typeof(duplicidade_alertas) = 'array' THEN duplicidade_alertas
        ELSE '[]'::jsonb
      END
    ) > 0
    ORDER BY confiabilidade_score ASC, id DESC
    LIMIT 10;
  `;

  const animalDuplicatesQuery = `
    SELECT
      a.id,
      a.nome,
      a.especie,
      a.microchip,
      a.tutor_id,
      t.nome AS tutor_nome,
      a.confiabilidade_score,
      a.confiabilidade_nivel,
      a.duplicidade_alertas
    FROM animais a
    LEFT JOIN tutores t ON t.id = a.tutor_id
    WHERE ${ACTIVE_ANIMAL_FILTER_A}
      AND jsonb_array_length(
      CASE
        WHEN jsonb_typeof(a.duplicidade_alertas) = 'array' THEN a.duplicidade_alertas
        ELSE '[]'::jsonb
      END
    ) > 0
    ORDER BY a.confiabilidade_score ASC, a.id DESC
    LIMIT 10;
  `;

  const lowQualityAnimalsQuery = `
    SELECT
      id,
      nome,
      especie,
      microchip,
      tutor_id,
      confiabilidade_score,
      confiabilidade_nivel,
      confiabilidade_pendencias
    FROM animais
    WHERE ${ACTIVE_ANIMAL_FILTER}
      AND confiabilidade_nivel = 'baixo'
    ORDER BY confiabilidade_score ASC, id DESC
    LIMIT 10;
  `;

  const saneamentoQuery = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
      COUNT(*) FILTER (WHERE status = 'em_revisao')::int AS em_revisao,
      COUNT(*) FILTER (WHERE status = 'falso_positivo')::int AS falsos_positivos,
      COUNT(*) FILTER (WHERE status = 'mesclado')::int AS mesclados,
      COUNT(*) FILTER (WHERE entidade = 'tutor')::int AS tutores,
      COUNT(*) FILTER (WHERE entidade = 'animal')::int AS animais,
      COUNT(*) FILTER (WHERE criticidade IN ('alta', 'critica') AND status IN ('pendente', 'em_revisao', 'aprovado_para_merge'))::int AS criticos_abertos
    FROM cadastro_saneamento_casos;
  `;

  const mergesQuery = `
    SELECT COUNT(*)::int AS total
    FROM cadastro_merges
    WHERE status = 'concluido';
  `;

  const [
    tutorResult,
    animalResult,
    tutorDuplicatesResult,
    animalDuplicatesResult,
    lowQualityAnimalsResult,
    saneamentoResult,
    mergesResult
  ] = await Promise.all([
    db.query(tutorQuery),
    db.query(animalQuery),
    db.query(tutorDuplicatesQuery),
    db.query(animalDuplicatesQuery),
    db.query(lowQualityAnimalsQuery),
    db.query(saneamentoQuery),
    db.query(mergesQuery)
  ]);

  return {
    tutores: tutorResult.rows[0] || {
      total: 0,
      baixa_confiabilidade: 0,
      media_confiabilidade: 0,
      alta_confiabilidade: 0,
      sem_contato_minimo: 0,
      sem_cpf: 0,
      com_alerta_duplicidade: 0
    },
    animais: animalResult.rows[0] || {
      total: 0,
      baixa_confiabilidade: 0,
      media_confiabilidade: 0,
      alta_confiabilidade: 0,
      sem_microchip: 0,
      sem_tutor: 0,
      com_alerta_duplicidade: 0
    },
    duplicidades: {
      tutores: tutorDuplicatesResult.rows,
      animais: animalDuplicatesResult.rows
    },
    baixa_confiabilidade_animais: lowQualityAnimalsResult.rows,
    saneamento: {
      ...(saneamentoResult.rows[0] || {
        total: 0,
        pendentes: 0,
        em_revisao: 0,
        falsos_positivos: 0,
        mesclados: 0,
        tutores: 0,
        animais: 0,
        criticos_abertos: 0
      }),
      merges_realizados: mergesResult.rows[0]?.total || 0
    },
    observacao:
      'Indicador operacional de qualidade cadastral; nao substitui revisao manual nem autoriza merge automatico.'
  };
};
