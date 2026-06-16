const { db } = require('./shared');

exports.getQualidadeTerritorial = async () => {
  const result = await db.query(`
    SELECT *
    FROM (
      SELECT
        'animais' AS modulo,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE territorio_id IS NOT NULL)::int AS controlado,
        COUNT(*) FILTER (
          WHERE territorio_id IS NULL
            AND NULLIF(TRIM(COALESCE(bairro, '')), '') IS NOT NULL
        )::int AS legado_textual,
        COUNT(*) FILTER (
          WHERE territorio_id IS NULL
            AND NULLIF(TRIM(COALESCE(bairro, '')), '') IS NULL
        )::int AS nao_informado
      FROM animais

      UNION ALL

      SELECT
        'tutores' AS modulo,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE territorio_id IS NOT NULL)::int AS controlado,
        COUNT(*) FILTER (
          WHERE territorio_id IS NULL
            AND NULLIF(TRIM(COALESCE(bairro, '')), '') IS NOT NULL
        )::int AS legado_textual,
        COUNT(*) FILTER (
          WHERE territorio_id IS NULL
            AND NULLIF(TRIM(COALESCE(bairro, '')), '') IS NULL
        )::int AS nao_informado
      FROM tutores
      WHERE COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')

      UNION ALL

      SELECT
        'ocorrencias' AS modulo,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE territorio_id IS NOT NULL)::int AS controlado,
        COUNT(*) FILTER (
          WHERE territorio_id IS NULL
            AND NULLIF(TRIM(COALESCE(bairro, '')), '') IS NOT NULL
        )::int AS legado_textual,
        COUNT(*) FILTER (
          WHERE territorio_id IS NULL
            AND NULLIF(TRIM(COALESCE(bairro, '')), '') IS NULL
        )::int AS nao_informado
      FROM animal_ocorrencias

      UNION ALL

      SELECT
        'campanha_inscricoes' AS modulo,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE territorio_id IS NOT NULL)::int AS controlado,
        COUNT(*) FILTER (WHERE territorio_origem = 'legado_textual')::int AS legado_textual,
        COUNT(*) FILTER (
          WHERE territorio_id IS NULL
            AND COALESCE(territorio_origem, 'nao_informado') <> 'legado_textual'
        )::int AS nao_informado
      FROM campanha_inscricoes
    ) q
    ORDER BY modulo ASC;
  `);

  return result.rows.map((row) => ({
    ...row,
    percentual_controlado:
      Number(row.total || 0) > 0
        ? Number(((Number(row.controlado || 0) / Number(row.total || 0)) * 100).toFixed(2))
        : 0,
  }));
};

exports.getGestaoStats = async () => {
  const [qualidade, territoriosResult, aliasesResult, revisoesResult] = await Promise.all([
    exports.getQualidadeTerritorial(),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'ativo')::int AS ativos,
        COUNT(*) FILTER (WHERE status = 'inativo')::int AS inativos,
        COUNT(*) FILTER (WHERE homologado = true)::int AS homologados,
        COUNT(*) FILTER (WHERE homologado = false)::int AS nao_homologados
      FROM territorios;
    `),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'ativo')::int AS ativos,
        COUNT(*) FILTER (WHERE status = 'inativo')::int AS inativos
      FROM territorio_aliases;
    `),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE decisao = 'classificado')::int AS classificados,
        COUNT(*) FILTER (WHERE decisao = 'mantido_legado')::int AS mantidos_legado,
        COUNT(*) FILTER (WHERE decisao = 'nao_informado')::int AS marcados_nao_informado
      FROM territorio_revisoes;
    `)
  ]);
  const pendentesLegado = qualidade.reduce((acc, row) => acc + Number(row.legado_textual || 0), 0);
  const totalRegistros = qualidade.reduce((acc, row) => acc + Number(row.total || 0), 0);
  const totalControlado = qualidade.reduce((acc, row) => acc + Number(row.controlado || 0), 0);

  return {
    territorios: territoriosResult.rows[0],
    aliases: aliasesResult.rows[0],
    revisoes: {
      ...revisoesResult.rows[0],
      pendentes_legado: pendentesLegado
    },
    qualidade,
    progresso_normalizacao_percentual:
      totalRegistros > 0 ? Number(((totalControlado / totalRegistros) * 100).toFixed(2)) : 0,
  };
};
