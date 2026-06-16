const db = require('../config/db');
const territorioService = require('./territorioService');

const NAO_INFORMADO = 'Não informado';
const TERRITORY_LABELS = {
  'Nao informado': 'Não informado',
  MunicipioDemo: 'Município demonstrativo',
  'MunicipioDemo sede/outras localidades': 'Município demonstrativo sede/outras localidades',
};
const PUBLIC_MIN_COUNT = 3;
const CAMPANHA_BACKLOG_STATUSES = [
  'em_analise',
  'pendente_documentacao',
  'pre_selecionado',
  'agendado',
  'ausente'
];
const OCORRENCIA_BACKLOG_STATUSES = [
  'aberta',
  'em_analise',
  'pendente_informacao',
  'em_atendimento',
  'encaminhada'
];

function buildActiveStatusFilter(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(${prefix}status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')`;
}

const ACTIVE_ANIMAL_FILTER_A = buildActiveStatusFilter('a');
const ACTIVE_TUTOR_FILTER_T = buildActiveStatusFilter('t');

function toNumber(value) {
  return Number(value || 0);
}

function percent(part, total) {
  const numerator = toNumber(part);
  const denominator = toNumber(total);
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;
}

function normalizeBairro(value) {
  const normalized = String(value || '').trim();
  return TERRITORY_LABELS[normalized] || normalized || NAO_INFORMADO;
}

function ensureTerritory(map, bairro) {
  const key = normalizeBairro(bairro);

  if (!map.has(key)) {
    map.set(key, {
      bairro: key,
      animais: 0,
      caninos: 0,
      felinos: 0,
      castrados: 0,
      vacinados: 0,
      microchipados: 0,
      animais_sem_microchip: 0,
      animais_sem_tutor: 0,
      animais_com_vacinacao_estruturada: 0,
      animais_apenas_legado_vacinal: 0,
      tutores: 0,
      tutores_sem_contato: 0,
      vacinacoes_registros: 0,
      vacinacoes_animais: 0,
      vacinacoes_campanha: 0,
      vacinacoes_comprovadas: 0,
      campanha_inscricoes: 0,
      campanha_atendidas: 0,
      campanha_demanda_reprimida: 0,
      campanha_pendencias: 0,
      ocorrencias: 0,
      ocorrencias_ativas: 0,
      ocorrencias_perda_ativas: 0,
      fila_vencida: 0,
      territorio_controlado: 0,
      territorio_legado: 0,
      territorio_nao_informado: 0,
    });
  }

  return map.get(key);
}

function mergeRows(rows, map, mapper) {
  rows.forEach((row) => {
    const target = ensureTerritory(map, row.bairro);
    const values = mapper(row);

    Object.entries(values).forEach(([key, value]) => {
      target[key] = toNumber(target[key]) + toNumber(value);
    });
  });
}

function formatSeriesRows(rows) {
  return rows.map((row) => ({
    periodo: row.periodo,
    animais_cadastrados: toNumber(row.animais_cadastrados),
    tutores_cadastrados: toNumber(row.tutores_cadastrados),
    campanha_inscricoes: toNumber(row.campanha_inscricoes),
    campanha_atendimentos: toNumber(row.campanha_atendimentos),
    vacinacoes_estruturadas: toNumber(row.vacinacoes_estruturadas),
    ocorrencias_registradas: toNumber(row.ocorrencias_registradas),
    ocorrencias_concluidas: toNumber(row.ocorrencias_concluidas),
  }));
}

function applyPublicSuppression(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const totalPublico = toNumber(row.animais) + toNumber(row.ocorrencias) + toNumber(row.campanha_inscricoes);
    const bairro = totalPublico > 0 && totalPublico < PUBLIC_MIN_COUNT
      ? 'Outros territórios agregados'
      : normalizeBairro(row.bairro);
    const target = ensureTerritory(grouped, bairro);

    Object.entries(row).forEach(([key, value]) => {
      if (key !== 'bairro' && typeof value === 'number') {
        target[key] = toNumber(target[key]) + toNumber(value);
      }
    });
    target.territorio_informado = bairro !== NAO_INFORMADO;
  });

  return Array.from(grouped.values())
    .sort((a, b) => b.animais - a.animais || b.ocorrencias - a.ocorrencias || a.bairro.localeCompare(b.bairro))
    .slice(0, 12);
}

async function getTerritorialRows() {
  const animalsQuery = `
    SELECT
      COALESCE(ta.nome, tt.nome, NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), ''), '${NAO_INFORMADO}') AS bairro,
      COUNT(a.id)::int AS animais,
      COUNT(a.id) FILTER (WHERE a.especie = 'canino')::int AS caninos,
      COUNT(a.id) FILTER (WHERE a.especie = 'felino')::int AS felinos,
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
      COUNT(a.id) FILTER (WHERE a.microchip IS NOT NULL AND TRIM(a.microchip) <> '')::int AS microchipados,
      COUNT(a.id) FILTER (WHERE a.microchip IS NULL OR TRIM(a.microchip) = '')::int AS animais_sem_microchip,
      COUNT(a.id) FILTER (WHERE a.tutor_id IS NULL)::int AS animais_sem_tutor,
      COUNT(a.id) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM animal_vacinacoes av
          WHERE av.animal_id = a.id
            AND av.status_registro <> 'cancelado'
        )
      )::int AS animais_com_vacinacao_estruturada,
      COUNT(a.id) FILTER (
        WHERE NOT EXISTS (
          SELECT 1
          FROM animal_vacinacoes av
          WHERE av.animal_id = a.id
            AND av.status_registro <> 'cancelado'
        )
        AND jsonb_array_length(
          CASE
            WHEN jsonb_typeof(a.vacinas) = 'array' THEN a.vacinas
            ELSE '[]'::jsonb
          END
        ) > 0
      )::int AS animais_apenas_legado_vacinal,
      COUNT(a.id) FILTER (WHERE COALESCE(a.territorio_id, t.territorio_id) IS NOT NULL)::int AS territorio_controlado,
      COUNT(a.id) FILTER (
        WHERE COALESCE(a.territorio_id, t.territorio_id) IS NULL
          AND COALESCE(NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), '')) IS NOT NULL
      )::int AS territorio_legado,
      COUNT(a.id) FILTER (
        WHERE COALESCE(a.territorio_id, t.territorio_id) IS NULL
          AND COALESCE(NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), '')) IS NULL
      )::int AS territorio_nao_informado
    FROM animais a
    LEFT JOIN tutores t ON t.id = a.tutor_id
    LEFT JOIN territorios ta ON ta.id = a.territorio_id
    LEFT JOIN territorios tt ON tt.id = t.territorio_id
    WHERE ${ACTIVE_ANIMAL_FILTER_A}
    GROUP BY 1;
  `;

  const tutoresQuery = `
    SELECT
      COALESCE(tr.nome, NULLIF(TRIM(t.bairro), ''), '${NAO_INFORMADO}') AS bairro,
      COUNT(*)::int AS tutores,
      COUNT(*) FILTER (
        WHERE t.telefone_normalizado IS NULL
          AND t.email_normalizado IS NULL
      )::int AS tutores_sem_contato,
      COUNT(*) FILTER (WHERE t.territorio_id IS NOT NULL)::int AS territorio_controlado,
      COUNT(*) FILTER (
        WHERE t.territorio_id IS NULL
          AND NULLIF(TRIM(t.bairro), '') IS NOT NULL
      )::int AS territorio_legado,
      COUNT(*) FILTER (
        WHERE t.territorio_id IS NULL
          AND NULLIF(TRIM(t.bairro), '') IS NULL
      )::int AS territorio_nao_informado
    FROM tutores t
    LEFT JOIN territorios tr ON tr.id = t.territorio_id
    WHERE ${ACTIVE_TUTOR_FILTER_T}
    GROUP BY 1;
  `;

  const vacinacoesQuery = `
    SELECT
      COALESCE(ta.nome, tt.nome, NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), ''), '${NAO_INFORMADO}') AS bairro,
      COUNT(av.id)::int AS vacinacoes_registros,
      COUNT(DISTINCT av.animal_id)::int AS vacinacoes_animais,
      COUNT(av.id) FILTER (WHERE av.origem_registro = 'campanha')::int AS vacinacoes_campanha,
      COUNT(av.id) FILTER (WHERE av.status_registro = 'comprovado' OR av.documento_id IS NOT NULL)::int AS vacinacoes_comprovadas,
      COUNT(av.id) FILTER (WHERE COALESCE(a.territorio_id, t.territorio_id) IS NOT NULL)::int AS territorio_controlado,
      COUNT(av.id) FILTER (
        WHERE COALESCE(a.territorio_id, t.territorio_id) IS NULL
          AND COALESCE(NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), '')) IS NOT NULL
      )::int AS territorio_legado,
      COUNT(av.id) FILTER (
        WHERE COALESCE(a.territorio_id, t.territorio_id) IS NULL
          AND COALESCE(NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), '')) IS NULL
      )::int AS territorio_nao_informado
    FROM animal_vacinacoes av
    JOIN animais a ON a.id = av.animal_id
    LEFT JOIN tutores t ON t.id = a.tutor_id
    LEFT JOIN territorios ta ON ta.id = a.territorio_id
    LEFT JOIN territorios tt ON tt.id = t.territorio_id
    WHERE av.status_registro <> 'cancelado'
      AND ${ACTIVE_ANIMAL_FILTER_A}
    GROUP BY 1;
  `;

  const campanhasQuery = `
    SELECT
      COALESCE(ti.nome, ta.nome, tt.nome, NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), ''), '${NAO_INFORMADO}') AS bairro,
      COUNT(i.id)::int AS campanha_inscricoes,
      COUNT(i.id) FILTER (WHERE i.status = 'atendido')::int AS campanha_atendidas,
      COUNT(i.id) FILTER (WHERE i.status = ANY($1::text[]))::int AS campanha_demanda_reprimida,
      COUNT(i.id) FILTER (WHERE i.pendencia_aberta = true OR i.status = 'pendente_documentacao')::int AS campanha_pendencias,
      COUNT(i.id) FILTER (
        WHERE i.status = ANY($1::text[])
          AND i.prazo_limite_operacional IS NOT NULL
          AND i.prazo_limite_operacional < CURRENT_TIMESTAMP
      )::int AS fila_vencida,
      COUNT(i.id) FILTER (WHERE COALESCE(i.territorio_id, a.territorio_id, t.territorio_id) IS NOT NULL)::int AS territorio_controlado,
      COUNT(i.id) FILTER (
        WHERE COALESCE(i.territorio_id, a.territorio_id, t.territorio_id) IS NULL
          AND COALESCE(NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), '')) IS NOT NULL
      )::int AS territorio_legado,
      COUNT(i.id) FILTER (
        WHERE COALESCE(i.territorio_id, a.territorio_id, t.territorio_id) IS NULL
          AND COALESCE(NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), '')) IS NULL
      )::int AS territorio_nao_informado
    FROM campanha_inscricoes i
    LEFT JOIN animais a ON a.id = i.animal_id
    LEFT JOIN tutores t ON t.id = COALESCE(i.tutor_id, a.tutor_id)
    LEFT JOIN territorios ti ON ti.id = i.territorio_id
    LEFT JOIN territorios ta ON ta.id = a.territorio_id
    LEFT JOIN territorios tt ON tt.id = t.territorio_id
    GROUP BY 1;
  `;

  const ocorrenciasQuery = `
    SELECT
      COALESCE(tor.nome, ta.nome, tt.nome, NULLIF(TRIM(o.bairro), ''), NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), ''), '${NAO_INFORMADO}') AS bairro,
      COUNT(o.id)::int AS ocorrencias,
      COUNT(o.id) FILTER (WHERE o.status = ANY($1::text[]))::int AS ocorrencias_ativas,
      COUNT(o.id) FILTER (WHERE o.tipo = 'perda' AND o.status = ANY($1::text[]))::int AS ocorrencias_perda_ativas,
      COUNT(o.id) FILTER (
        WHERE o.status = ANY($1::text[])
          AND o.prazo_limite_operacional IS NOT NULL
          AND o.prazo_limite_operacional < CURRENT_TIMESTAMP
      )::int AS fila_vencida,
      COUNT(o.id) FILTER (WHERE COALESCE(o.territorio_id, a.territorio_id, t.territorio_id) IS NOT NULL)::int AS territorio_controlado,
      COUNT(o.id) FILTER (
        WHERE COALESCE(o.territorio_id, a.territorio_id, t.territorio_id) IS NULL
          AND COALESCE(NULLIF(TRIM(o.bairro), ''), NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), '')) IS NOT NULL
      )::int AS territorio_legado,
      COUNT(o.id) FILTER (
        WHERE COALESCE(o.territorio_id, a.territorio_id, t.territorio_id) IS NULL
          AND COALESCE(NULLIF(TRIM(o.bairro), ''), NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), '')) IS NULL
      )::int AS territorio_nao_informado
    FROM animal_ocorrencias o
    LEFT JOIN animais a ON a.id = o.animal_id
    LEFT JOIN tutores t ON t.id = a.tutor_id
    LEFT JOIN territorios tor ON tor.id = o.territorio_id
    LEFT JOIN territorios ta ON ta.id = a.territorio_id
    LEFT JOIN territorios tt ON tt.id = t.territorio_id
    GROUP BY 1;
  `;

  const [
    animalsResult,
    tutoresResult,
    vacinacoesResult,
    campanhasResult,
    ocorrenciasResult
  ] = await Promise.all([
    db.query(animalsQuery),
    db.query(tutoresQuery),
    db.query(vacinacoesQuery),
    db.query(campanhasQuery, [CAMPANHA_BACKLOG_STATUSES]),
    db.query(ocorrenciasQuery, [OCORRENCIA_BACKLOG_STATUSES]),
  ]);

  const map = new Map();

  mergeRows(animalsResult.rows, map, (row) => ({
    animais: row.animais,
    caninos: row.caninos,
    felinos: row.felinos,
    castrados: row.castrados,
    vacinados: row.vacinados,
    microchipados: row.microchipados,
    animais_sem_microchip: row.animais_sem_microchip,
    animais_sem_tutor: row.animais_sem_tutor,
    animais_com_vacinacao_estruturada: row.animais_com_vacinacao_estruturada,
    animais_apenas_legado_vacinal: row.animais_apenas_legado_vacinal,
    territorio_controlado: row.territorio_controlado,
    territorio_legado: row.territorio_legado,
    territorio_nao_informado: row.territorio_nao_informado,
  }));
  mergeRows(tutoresResult.rows, map, (row) => ({
    tutores: row.tutores,
    tutores_sem_contato: row.tutores_sem_contato,
    territorio_controlado: row.territorio_controlado,
    territorio_legado: row.territorio_legado,
    territorio_nao_informado: row.territorio_nao_informado,
  }));
  mergeRows(vacinacoesResult.rows, map, (row) => ({
    vacinacoes_registros: row.vacinacoes_registros,
    vacinacoes_animais: row.vacinacoes_animais,
    vacinacoes_campanha: row.vacinacoes_campanha,
    vacinacoes_comprovadas: row.vacinacoes_comprovadas,
    territorio_controlado: row.territorio_controlado,
    territorio_legado: row.territorio_legado,
    territorio_nao_informado: row.territorio_nao_informado,
  }));
  mergeRows(campanhasResult.rows, map, (row) => ({
    campanha_inscricoes: row.campanha_inscricoes,
    campanha_atendidas: row.campanha_atendidas,
    campanha_demanda_reprimida: row.campanha_demanda_reprimida,
    campanha_pendencias: row.campanha_pendencias,
    fila_vencida: row.fila_vencida,
    territorio_controlado: row.territorio_controlado,
    territorio_legado: row.territorio_legado,
    territorio_nao_informado: row.territorio_nao_informado,
  }));
  mergeRows(ocorrenciasResult.rows, map, (row) => ({
    ocorrencias: row.ocorrencias,
    ocorrencias_ativas: row.ocorrencias_ativas,
    ocorrencias_perda_ativas: row.ocorrencias_perda_ativas,
    fila_vencida: row.fila_vencida,
    territorio_controlado: row.territorio_controlado,
    territorio_legado: row.territorio_legado,
    territorio_nao_informado: row.territorio_nao_informado,
  }));

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      cobertura_vacinal_estruturada_percentual: percent(row.animais_com_vacinacao_estruturada, row.animais),
      taxa_demanda_campanha_pendente_percentual: percent(row.campanha_demanda_reprimida, row.campanha_inscricoes),
      territorio_controlado_percentual: percent(
        row.territorio_controlado,
        row.territorio_controlado + row.territorio_legado + row.territorio_nao_informado
      ),
      territorio_informado: row.bairro !== NAO_INFORMADO,
    }))
    .sort((a, b) => (
      b.campanha_demanda_reprimida - a.campanha_demanda_reprimida ||
      b.ocorrencias_ativas - a.ocorrencias_ativas ||
      b.animais - a.animais ||
      a.bairro.localeCompare(b.bairro)
    ));
}

async function getSeriesHistoricas() {
  const result = await db.query(
    `
      WITH eventos AS (
        SELECT date_trunc('month', created_at)::date AS periodo, 'animais_cadastrados' AS metrica, COUNT(*)::int AS total
        FROM animais
        GROUP BY 1

        UNION ALL
        SELECT date_trunc('month', created_at)::date AS periodo, 'tutores_cadastrados' AS metrica, COUNT(*)::int AS total
        FROM tutores
        GROUP BY 1

        UNION ALL
        SELECT date_trunc('month', created_at)::date AS periodo, 'campanha_inscricoes' AS metrica, COUNT(*)::int AS total
        FROM campanha_inscricoes
        GROUP BY 1

        UNION ALL
        SELECT date_trunc('month', COALESCE(atendimento_confirmado_em, updated_at, created_at))::date AS periodo, 'campanha_atendimentos' AS metrica, COUNT(*)::int AS total
        FROM campanha_inscricoes
        WHERE status = 'atendido'
        GROUP BY 1

        UNION ALL
        SELECT date_trunc('month', COALESCE(data_aplicacao::timestamp, created_at))::date AS periodo, 'vacinacoes_estruturadas' AS metrica, COUNT(*)::int AS total
        FROM animal_vacinacoes
        WHERE status_registro <> 'cancelado'
        GROUP BY 1

        UNION ALL
        SELECT date_trunc('month', created_at)::date AS periodo, 'ocorrencias_registradas' AS metrica, COUNT(*)::int AS total
        FROM animal_ocorrencias
        GROUP BY 1

        UNION ALL
        SELECT date_trunc('month', COALESCE(encerrada_em, updated_at, created_at))::date AS periodo, 'ocorrencias_concluidas' AS metrica, COUNT(*)::int AS total
        FROM animal_ocorrencias
        WHERE status IN ('resolvida', 'cancelada', 'arquivada')
        GROUP BY 1
      )
      SELECT
        TO_CHAR(periodo, 'YYYY-MM') AS periodo,
        SUM(total) FILTER (WHERE metrica = 'animais_cadastrados')::int AS animais_cadastrados,
        SUM(total) FILTER (WHERE metrica = 'tutores_cadastrados')::int AS tutores_cadastrados,
        SUM(total) FILTER (WHERE metrica = 'campanha_inscricoes')::int AS campanha_inscricoes,
        SUM(total) FILTER (WHERE metrica = 'campanha_atendimentos')::int AS campanha_atendimentos,
        SUM(total) FILTER (WHERE metrica = 'vacinacoes_estruturadas')::int AS vacinacoes_estruturadas,
        SUM(total) FILTER (WHERE metrica = 'ocorrencias_registradas')::int AS ocorrencias_registradas,
        SUM(total) FILTER (WHERE metrica = 'ocorrencias_concluidas')::int AS ocorrencias_concluidas
      FROM eventos
      GROUP BY periodo
      ORDER BY periodo DESC
      LIMIT 18;
    `
  );

  return formatSeriesRows(result.rows).reverse();
}

async function getCoberturaVacinal(territorial = []) {
  const [geralResult, especieResult, vacinaResult, origemResult] = await Promise.all([
    db.query(`
      WITH animais_base AS (
        SELECT
          a.id,
          EXISTS (
            SELECT 1
            FROM animal_vacinacoes av
            WHERE av.animal_id = a.id
              AND av.status_registro <> 'cancelado'
          ) AS possui_estruturado,
          jsonb_array_length(
            CASE
              WHEN jsonb_typeof(a.vacinas) = 'array' THEN a.vacinas
              ELSE '[]'::jsonb
            END
         ) > 0 AS possui_legado
        FROM animais a
        WHERE ${ACTIVE_ANIMAL_FILTER_A}
      )
      SELECT
        COUNT(*)::int AS animais_base,
        COUNT(*) FILTER (WHERE possui_estruturado)::int AS animais_com_vacinacao_estruturada,
        COUNT(*) FILTER (WHERE NOT possui_estruturado AND possui_legado)::int AS animais_apenas_legado,
        (
          SELECT COUNT(*)::int
          FROM animal_vacinacoes av
          WHERE av.status_registro <> 'cancelado'
        ) AS registros_ativos
      FROM animais_base;
    `),
    db.query(`
      SELECT
        a.especie,
        COUNT(DISTINCT a.id)::int AS animais,
        COUNT(DISTINCT a.id) FILTER (WHERE av.id IS NOT NULL)::int AS animais_com_vacinacao_estruturada,
        COUNT(av.id)::int AS registros
      FROM animais a
      LEFT JOIN animal_vacinacoes av ON av.animal_id = a.id AND av.status_registro <> 'cancelado'
      WHERE ${ACTIVE_ANIMAL_FILTER_A}
      GROUP BY a.especie
      ORDER BY a.especie;
    `),
    db.query(`
      SELECT
        COALESCE(vc.nome_popular, av.vacina_nome_popular, av.vacina_nome, 'Nao informado') AS vacina,
        COALESCE(vc.codigo, av.vacina_codigo, 'sem_codigo') AS codigo,
        COUNT(av.id)::int AS registros,
        COUNT(DISTINCT av.animal_id)::int AS animais,
        COUNT(av.id) FILTER (WHERE av.origem_registro = 'campanha')::int AS campanha,
        COUNT(av.id) FILTER (WHERE av.status_registro = 'comprovado' OR av.documento_id IS NOT NULL)::int AS comprovados
      FROM animal_vacinacoes av
      LEFT JOIN vacina_catalogo vc ON vc.id = av.vacina_catalogo_id
      WHERE av.status_registro <> 'cancelado'
        AND EXISTS (
          SELECT 1
          FROM animais a
          WHERE a.id = av.animal_id
            AND ${ACTIVE_ANIMAL_FILTER_A}
        )
      GROUP BY 1, 2
      ORDER BY registros DESC, vacina ASC
      LIMIT 12;
    `),
    db.query(`
      SELECT
        origem_registro,
        COUNT(*)::int AS registros,
        COUNT(DISTINCT animal_id)::int AS animais
      FROM animal_vacinacoes
      WHERE status_registro <> 'cancelado'
        AND EXISTS (
          SELECT 1
          FROM animais a
          WHERE a.id = animal_vacinacoes.animal_id
            AND ${ACTIVE_ANIMAL_FILTER_A}
        )
      GROUP BY origem_registro
      ORDER BY registros DESC, origem_registro ASC;
    `),
  ]);

  const geral = geralResult.rows[0] || {};

  return {
    geral: {
      animais_base: toNumber(geral.animais_base),
      animais_com_vacinacao_estruturada: toNumber(geral.animais_com_vacinacao_estruturada),
      animais_apenas_legado: toNumber(geral.animais_apenas_legado),
      registros_ativos: toNumber(geral.registros_ativos),
      percentual_base_cadastrada: percent(geral.animais_com_vacinacao_estruturada, geral.animais_base),
    },
    por_especie: especieResult.rows.map((row) => ({
      ...row,
      animais: toNumber(row.animais),
      animais_com_vacinacao_estruturada: toNumber(row.animais_com_vacinacao_estruturada),
      registros: toNumber(row.registros),
      percentual_base_cadastrada: percent(row.animais_com_vacinacao_estruturada, row.animais),
    })),
    por_bairro: territorial
      .filter((row) => row.animais > 0)
      .map((row) => ({
        bairro: row.bairro,
        animais: row.animais,
        animais_com_vacinacao_estruturada: row.animais_com_vacinacao_estruturada,
        animais_apenas_legado: row.animais_apenas_legado_vacinal,
        percentual_base_cadastrada: row.cobertura_vacinal_estruturada_percentual,
      }))
      .sort((a, b) => b.animais_com_vacinacao_estruturada - a.animais_com_vacinacao_estruturada)
      .slice(0, 12),
    por_vacina: vacinaResult.rows,
    por_origem: origemResult.rows,
    observacao: 'Cobertura calculada sobre a base cadastrada no módulo de Bem-estar Animal da Plataforma SIGMA; nao representa cobertura populacional oficial do municipio.',
  };
}

async function getDemandaReprimida(territorial = []) {
  const [campanhaStatusResult, ocorrenciaStatusResult, campanhaServicoResult, slaResult] = await Promise.all([
    db.query(`
      SELECT
        status,
        COUNT(*)::int AS total
      FROM campanha_inscricoes
      GROUP BY status
      ORDER BY total DESC, status ASC;
    `),
    db.query(`
      SELECT
        status,
        COUNT(*)::int AS total
      FROM animal_ocorrencias
      GROUP BY status
      ORDER BY total DESC, status ASC;
    `),
    db.query(
      `
        SELECT
          servico_desejado,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = ANY($1::text[]))::int AS demanda_reprimida,
          COUNT(*) FILTER (WHERE status = 'atendido')::int AS atendidos,
          COUNT(*) FILTER (WHERE pendencia_aberta = true OR status = 'pendente_documentacao')::int AS pendencias
        FROM campanha_inscricoes
        GROUP BY servico_desejado
        ORDER BY demanda_reprimida DESC, total DESC, servico_desejado ASC;
      `,
      [CAMPANHA_BACKLOG_STATUSES]
    ),
    db.query(
      `
        SELECT
          'campanha_inscricao' AS tipo_item,
          COUNT(*) FILTER (WHERE status = ANY($1::text[]))::int AS ativos,
          COUNT(*) FILTER (
            WHERE status = ANY($1::text[])
              AND prazo_limite_operacional IS NOT NULL
              AND prazo_limite_operacional < CURRENT_TIMESTAMP
          )::int AS vencidos,
          COUNT(*) FILTER (
            WHERE status = ANY($1::text[])
              AND prazo_limite_operacional IS NOT NULL
              AND prazo_limite_operacional >= CURRENT_TIMESTAMP
              AND prazo_limite_operacional <= CURRENT_TIMESTAMP + INTERVAL '1 day'
          )::int AS em_atencao
        FROM campanha_inscricoes

        UNION ALL

        SELECT
          'ocorrencia' AS tipo_item,
          COUNT(*) FILTER (WHERE status = ANY($2::text[]))::int AS ativos,
          COUNT(*) FILTER (
            WHERE status = ANY($2::text[])
              AND prazo_limite_operacional IS NOT NULL
              AND prazo_limite_operacional < CURRENT_TIMESTAMP
          )::int AS vencidos,
          COUNT(*) FILTER (
            WHERE status = ANY($2::text[])
              AND prazo_limite_operacional IS NOT NULL
              AND prazo_limite_operacional >= CURRENT_TIMESTAMP
              AND prazo_limite_operacional <= CURRENT_TIMESTAMP + INTERVAL '1 day'
          )::int AS em_atencao
        FROM animal_ocorrencias;
      `,
      [CAMPANHA_BACKLOG_STATUSES, OCORRENCIA_BACKLOG_STATUSES]
    ),
  ]);

  const campanhaBacklog = campanhaStatusResult.rows
    .filter((row) => CAMPANHA_BACKLOG_STATUSES.includes(row.status))
    .reduce((acc, row) => acc + toNumber(row.total), 0);
  const ocorrenciaBacklog = ocorrenciaStatusResult.rows
    .filter((row) => OCORRENCIA_BACKLOG_STATUSES.includes(row.status))
    .reduce((acc, row) => acc + toNumber(row.total), 0);

  return {
    totais: {
      campanha_inscricoes_pendentes: campanhaBacklog,
      ocorrencias_ativas: ocorrenciaBacklog,
      total_operacional_reprimido: campanhaBacklog + ocorrenciaBacklog,
    },
    campanhas_por_status: campanhaStatusResult.rows,
    ocorrencias_por_status: ocorrenciaStatusResult.rows,
    por_servico: campanhaServicoResult.rows,
    sla: slaResult.rows,
    por_bairro: territorial
      .filter((row) => row.campanha_demanda_reprimida > 0 || row.ocorrencias_ativas > 0 || row.fila_vencida > 0)
      .map((row) => ({
        bairro: row.bairro,
        campanha_demanda_reprimida: row.campanha_demanda_reprimida,
        ocorrencias_ativas: row.ocorrencias_ativas,
        fila_vencida: row.fila_vencida,
        total_pressao: row.campanha_demanda_reprimida + row.ocorrencias_ativas,
      }))
      .sort((a, b) => b.total_pressao - a.total_pressao || b.fila_vencida - a.fila_vencida)
      .slice(0, 12),
    observacao: 'Demanda reprimida considera inscricoes e ocorrencias em status ativos da matriz operacional; nao inclui demandas externas nao cadastradas.',
  };
}

async function getCampanhasOperacao() {
  const result = await db.query(
    `
      SELECT
        c.id,
        c.nome,
        c.status,
        c.data_inicio,
        c.data_fim,
        COUNT(i.id)::int AS inscricoes,
        COUNT(i.id) FILTER (WHERE i.status = 'em_analise')::int AS em_analise,
        COUNT(i.id) FILTER (WHERE i.status = 'pendente_documentacao')::int AS pendentes_documentacao,
        COUNT(i.id) FILTER (WHERE i.status = 'pre_selecionado')::int AS pre_selecionadas,
        COUNT(i.id) FILTER (WHERE i.status = 'agendado')::int AS agendadas,
        COUNT(i.id) FILTER (WHERE i.status = 'atendido')::int AS atendidas,
        COUNT(i.id) FILTER (WHERE i.status = 'ausente')::int AS ausentes,
        COUNT(i.id) FILTER (WHERE i.status IN ('indeferido', 'cancelado'))::int AS encerradas_sem_atendimento,
        COUNT(i.id) FILTER (WHERE i.status = ANY($1::text[]))::int AS demanda_reprimida,
        COUNT(DISTINCT cvi.id) FILTER (WHERE cvi.status = 'ativo')::int AS vacinas_aplicadas_estruturadas,
        COUNT(DISTINCT av.id) FILTER (WHERE av.status_registro <> 'cancelado')::int AS registros_vacinais
      FROM campanhas c
      LEFT JOIN campanha_inscricoes i ON i.campanha_id = c.id
      LEFT JOIN campanha_vacinacao_itens cvi ON cvi.inscricao_id = i.id
      LEFT JOIN animal_vacinacoes av ON av.campanha_inscricao_id = i.id
      GROUP BY c.id
      ORDER BY c.data_inicio DESC NULLS LAST, c.id DESC
      LIMIT 20;
    `,
    [CAMPANHA_BACKLOG_STATUSES]
  );

  return result.rows.map((row) => ({
    ...row,
    percentual_atendimento: percent(row.atendidas, row.inscricoes),
    indicador_parcial:
      'Vacinas aplicadas estruturadas dependem do atendimento vacinal 2C; registros antigos podem aparecer apenas como legado ou gerados automaticamente.',
  }));
}

async function getPublicoAgregadoFromRows(territorial, series, cobertura, demanda) {
  return {
    territorial: applyPublicSuppression(territorial).map((row) => ({
      bairro: row.bairro,
      animais: row.animais,
      animais_com_vacinacao_estruturada: row.animais_com_vacinacao_estruturada,
      campanha_inscricoes: row.campanha_inscricoes,
      campanha_atendidas: row.campanha_atendidas,
      ocorrencias: row.ocorrencias,
      territorio_informado: row.territorio_informado,
      territorio_controlado_percentual: row.territorio_controlado_percentual,
    })),
    series_historicas: series.slice(-12).map((row) => ({
      periodo: row.periodo,
      campanha_inscricoes: row.campanha_inscricoes,
      campanha_atendimentos: row.campanha_atendimentos,
      vacinacoes_estruturadas: row.vacinacoes_estruturadas,
      ocorrencias_registradas: row.ocorrencias_registradas,
    })),
    cobertura_vacinal: cobertura.geral,
    demanda_reprimida: {
      campanha_inscricoes_pendentes: demanda.totais.campanha_inscricoes_pendentes,
      ocorrencias_ativas: demanda.totais.ocorrencias_ativas,
    },
    metodologia_publica: {
      supressao_baixa_contagem: `Territórios com menos de ${PUBLIC_MIN_COUNT} referências agregadas são agrupados.`,
      escopo: 'Indicadores representam a base cadastrada no módulo de Bem-estar Animal da Plataforma SIGMA, não o universo total de animais do município.',
      privacidade: 'Não há exposição de Documento, telefone, e-mail, documentos ou dados individualizados de tutores.',
      territorio: 'A visão pública prioriza território controlado pelo catálogo; registros legados ou sem bairro permanecem agregados quando necessário.',
    },
  };
}

exports.getBiTerritorialInterno = async () => {
  const territorial = await getTerritorialRows();
  const [series, cobertura, demanda, campanhas, gestaoTerritorial] = await Promise.all([
    getSeriesHistoricas(),
    getCoberturaVacinal(territorial),
    getDemandaReprimida(territorial),
    getCampanhasOperacao(),
    territorioService.getGestaoStats(),
  ]);

  return {
    territorial,
    series_historicas: series,
    cobertura_vacinal: cobertura,
    demanda_reprimida: demanda,
    campanhas_operacao: campanhas,
    qualidade_territorial: gestaoTerritorial.qualidade,
    gestao_territorial: gestaoTerritorial,
    metodologia: {
      territorio: 'Territorio prioriza catalogo controlado (territorio_id); aliases controlados sao usados apenas por correspondencia normalizada exata; campos textuais bairro permanecem como legado seguro e registros sem classificacao aparecem como Nao informado.',
      cobertura_vacinal: cobertura.observacao,
      demanda_reprimida: demanda.observacao,
      limites: [
        'Indicadores territoriais sao parciais quando o cadastro nao informa bairro/localidade controlado.',
        'Enderecos livres nao sao usados para inferir bairro automaticamente.',
        'Aliases territoriais dependem de homologacao administrativa previa.',
        'Cobertura vacinal e calculada sobre animais cadastrados no módulo de Bem-estar Animal da Plataforma SIGMA.',
        'Registros legados sao separados da carteira vacinal estruturada sempre que impactam interpretacao.',
      ],
    },
    atualizado_em: new Date().toISOString(),
  };
};

exports.getBiPublicoAgregado = async () => {
  const territorial = await getTerritorialRows();
  const [series, cobertura, demanda] = await Promise.all([
    getSeriesHistoricas(),
    getCoberturaVacinal(territorial),
    getDemandaReprimida(territorial),
  ]);

  return getPublicoAgregadoFromRows(territorial, series, cobertura, demanda);
};
