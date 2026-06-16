const db = require('../../config/db');

async function getStatus() {
  const result = await db.query(
    `
      SELECT
        EXISTS (SELECT 1 FROM licenciamento_normas WHERE codigo = 'LEI_MUNICIPAL_1191_2019' AND deleted_at IS NULL) AS lei_1191,
        EXISTS (SELECT 1 FROM licenciamento_normas WHERE codigo = 'LEI_MUNICIPAL_1192_2019' AND deleted_at IS NULL AND preferencial_taxas = TRUE) AS lei_1192,
        EXISTS (SELECT 1 FROM licenciamento_normas WHERE codigo = 'LEI_MUNICIPAL_1193_2019' AND deleted_at IS NULL) AS lei_1193,
        EXISTS (SELECT 1 FROM licenciamento_normas WHERE codigo = 'LEI_MUNICIPAL_1093_2017' AND deleted_at IS NULL AND norma_historica = TRUE) AS lei_1093,
        EXISTS (SELECT 1 FROM licenciamento_normas WHERE codigo = 'DECRETO_MUNICIPAL_021_2020' AND deleted_at IS NULL) AS decreto_021,
        EXISTS (SELECT 1 FROM licenciamento_tabelas_taxas WHERE codigo = 'TAXAS_ANEXO_I_A_FASE_2B_OPERACIONAL_PILOTO' AND deleted_at IS NULL AND operacional = TRUE) AS tabela_operacional_piloto,
        EXISTS (SELECT 1 FROM licenciamento_tabelas_taxas WHERE deleted_at IS NULL AND validada_para_cobranca = TRUE) AS tabela_validada_para_cobranca,
        EXISTS (SELECT 1 FROM licenciamento_matrizes_enquadramento_versionadas WHERE codigo = 'MATRIZ_ENQUADRAMENTO_FASE_2B_PILOTO' AND deleted_at IS NULL AND operacional = TRUE) AS matriz_operacional_piloto,
        EXISTS (SELECT 1 FROM licenciamento_matrizes_enquadramento_versionadas WHERE codigo = 'MATRIZ_ENQUADRAMENTO_LEI_1192_2019_EM_CONFERENCIA' AND deleted_at IS NULL AND operacional = FALSE) AS matriz_lei_1192_em_conferencia,
        EXISTS (SELECT 1 FROM licenciamento_divergencias_normativas WHERE codigo = 'DIVERGENCIA_MATRIZ_GRANDE_BAIXO' AND deleted_at IS NULL) AS divergencia_grande_baixo,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_divergencias_normativas
          WHERE deleted_at IS NULL
            AND status NOT IN ('resolvida', 'resolvido', 'encerrada')
        ) AS divergencias_pendentes,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_homologacao_checklists
        ) AS homologacao_total,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_homologacao_checklists
          WHERE status IN ('aprovado', 'aprovado_com_observacao')
        ) AS homologacao_aprovados,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_homologacao_checklists
          WHERE status = 'aprovado_com_observacao'
        ) AS homologacao_aprovados_com_observacao,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_homologacao_checklists
          WHERE status = 'nao_aplicavel'
        ) AS homologacao_nao_aplicaveis,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_homologacao_checklists
          WHERE status = 'pendente'
        ) AS homologacao_pendentes,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_homologacao_checklists
          WHERE status = 'reprovado'
        ) AS homologacao_reprovados,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_homologacao_checklists
          WHERE obrigatorio = TRUE
            AND status = 'reprovado'
        ) AS homologacao_obrigatorios_reprovados,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_homologacao_checklists
          WHERE obrigatorio = TRUE
            AND status = 'pendente'
        ) AS homologacao_obrigatorios_pendentes,
        (
          SELECT COUNT(*)::int
          FROM licenciamento_atividades
          WHERE deleted_at IS NULL
            AND ativo = TRUE
            AND codigo IN ('18.06', '18.01', '20.01', '20.09', '19.03', '15.20', '16.06', '17.05')
        ) AS atividades_piloto_ativas,
        EXISTS (
          SELECT 1
          FROM licenciamento_vrte_exercicios
          WHERE deleted_at IS NULL
            AND ativo = TRUE
            AND ano = 2026
            AND valor_vrte = 4.927900
        ) AS vrte_2026_ativa,
        EXISTS (
          SELECT 1
          FROM licenciamento_atividades a
          JOIN licenciamento_regras_enquadramento r
            ON r.atividade_id = a.id
           AND r.deleted_at IS NULL
           AND r.ativo = TRUE
          JOIN licenciamento_tipos_licenca tl
            ON tl.id = r.tipo_licenca_id
           AND tl.codigo = 'LMU'
          JOIN licenciamento_classes c
            ON c.id = r.classe_id
           AND c.codigo = 'classe_ii'
          JOIN licenciamento_potenciais_poluidor p
            ON p.id = r.potencial_poluidor_id
           AND p.codigo = 'medio'
          JOIN licenciamento_regras_taxas rt
            ON rt.tipo_licenca_id = tl.id
           AND rt.classe_id = c.id
           AND rt.deleted_at IS NULL
           AND rt.ativo = TRUE
           AND rt.tipo_atividade = a.tipo_atividade
           AND rt.quantidade_vrte = 194
          WHERE a.codigo = '18.06'
            AND a.deleted_at IS NULL
            AND a.ativo = TRUE
            AND r.porte_resultante = 'medio'
            AND r.requer_validacao_tecnica = TRUE
        ) AS simulacao_1806_prerequisitos,
        EXISTS (
          SELECT 1
          FROM licenciamento_homologacao_checklists
          WHERE grupo = 'Nao regressao'
        ) AS checklist_nao_regressao;
    `
  );

  return result.rows[0];
}

async function listNormas() {
  const result = await db.query(
    `
      SELECT
        n.*,
        COALESCE(
          json_agg(
            json_build_object(
              'modulo', vm.modulo,
              'tipo_vinculo', vm.tipo_vinculo,
              'observacao', vm.observacao
            )
            ORDER BY vm.modulo
          ) FILTER (WHERE vm.id IS NOT NULL),
          '[]'::json
        ) AS modulos_vinculados
      FROM licenciamento_normas n
      LEFT JOIN licenciamento_normas_modulos_vinculos vm
        ON vm.norma_id = n.id
       AND vm.ativo = TRUE
      WHERE n.deleted_at IS NULL
      GROUP BY n.id
      ORDER BY n.ano DESC NULLS LAST, n.titulo ASC;
    `
  );

  return result.rows;
}

async function listTabelasTaxas() {
  const result = await db.query(
    `
      SELECT
        tt.*,
        n.codigo AS norma_codigo,
        n.titulo AS norma_titulo,
        COUNT(rt.id)::int AS regras_vinculadas
      FROM licenciamento_tabelas_taxas tt
      LEFT JOIN licenciamento_normas n ON n.id = tt.norma_id
      LEFT JOIN licenciamento_regras_taxas rt
        ON rt.tabela_taxa_id = tt.id
       AND rt.deleted_at IS NULL
      WHERE tt.deleted_at IS NULL
      GROUP BY tt.id, n.codigo, n.titulo
      ORDER BY tt.operacional DESC, tt.prioridade_aplicacao DESC, tt.nome ASC;
    `
  );

  return result.rows;
}

async function listMatrizes() {
  const result = await db.query(
    `
      SELECT
        m.*,
        n.codigo AS norma_codigo,
        n.titulo AS norma_titulo,
        COUNT(r.id)::int AS regras_cadastradas
      FROM licenciamento_matrizes_enquadramento_versionadas m
      LEFT JOIN licenciamento_normas n ON n.id = m.norma_id
      LEFT JOIN licenciamento_matriz_enquadramento_regras r
        ON r.matriz_id = m.id
       AND r.deleted_at IS NULL
      WHERE m.deleted_at IS NULL
      GROUP BY m.id, n.codigo, n.titulo
      ORDER BY m.operacional DESC, m.nome ASC;
    `
  );

  return result.rows;
}

async function listDivergencias() {
  const result = await db.query(
    `
      SELECT
        d.*,
        np.codigo AS norma_principal_codigo,
        np.titulo AS norma_principal_titulo,
        nc.codigo AS norma_comparada_codigo,
        nc.titulo AS norma_comparada_titulo
      FROM licenciamento_divergencias_normativas d
      LEFT JOIN licenciamento_normas np ON np.id = d.norma_principal_id
      LEFT JOIN licenciamento_normas nc ON nc.id = d.norma_comparada_id
      WHERE d.deleted_at IS NULL
      ORDER BY
        CASE d.criticidade
          WHEN 'critica' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'media' THEN 3
          ELSE 4
        END,
        d.titulo ASC;
    `
  );

  return result.rows;
}

async function listHomologacao() {
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_homologacao_checklists
      ORDER BY grupo ASC, codigo ASC;
    `
  );

  return result.rows;
}

async function getHomologacaoItem(id, client = db) {
  const result = await client.query(
    `
      SELECT *
      FROM licenciamento_homologacao_checklists
      WHERE id = $1
      FOR UPDATE;
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function updateHomologacaoItem(id, payload, client = db) {
  const result = await client.query(
    `
      UPDATE licenciamento_homologacao_checklists
      SET status = $1::varchar,
          resultado = $2,
          evidencias_json = COALESCE($3::jsonb, evidencias_json),
          validado_por = $4,
          validado_em = CASE WHEN $1::varchar = 'pendente' THEN NULL ELSE CURRENT_TIMESTAMP END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `,
    [
      payload.status,
      payload.resultado || null,
      payload.evidencias_json ? JSON.stringify(payload.evidencias_json) : null,
      payload.validado_por || null,
      id,
    ]
  );

  return result.rows[0] || null;
}

async function withTransaction(callback) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listLegislacaoPublica() {
  const result = await db.query(
    `
      SELECT
        n.id,
        n.codigo,
        n.titulo,
        n.tipo,
        n.tipo_norma,
        n.numero,
        n.ano,
        n.esfera,
        n.orgao,
        n.ementa,
        n.status_normativo,
        n.modulo_principal,
        COALESCE(n.fonte_url, n.link_url) AS fonte_url,
        n.observacao AS observacao_publica,
        COALESCE(
          json_agg(vm.modulo ORDER BY vm.modulo) FILTER (WHERE vm.id IS NOT NULL),
          '[]'::json
        ) AS modulos_relacionados
      FROM licenciamento_normas n
      LEFT JOIN licenciamento_normas_modulos_vinculos vm
        ON vm.norma_id = n.id
       AND vm.ativo = TRUE
      WHERE n.deleted_at IS NULL
        AND n.ativo = TRUE
        AND n.codigo IN (
          'LEI_MUNICIPAL_1191_2019',
          'LEI_MUNICIPAL_1192_2019',
          'LEI_MUNICIPAL_1193_2019',
          'LEI_MUNICIPAL_1093_2017',
          'DECRETO_MUNICIPAL_021_2020',
          'ANEXO_I_A',
          'ANEXO_II_A',
          'ANEXO_III_A',
          'ANEXO_I_C',
          'CONSEMA_001_2022_REFERENCIA'
        )
      GROUP BY n.id
      ORDER BY
        CASE n.codigo
          WHEN 'LEI_MUNICIPAL_1191_2019' THEN 1
          WHEN 'LEI_MUNICIPAL_1192_2019' THEN 2
          WHEN 'LEI_MUNICIPAL_1193_2019' THEN 3
          WHEN 'DECRETO_MUNICIPAL_021_2020' THEN 4
          ELSE 5
        END,
        n.ano DESC NULLS LAST,
        n.titulo ASC;
    `
  );

  return result.rows;
}

async function getLegislacaoPublicaByCodigo(codigo) {
  const result = await db.query(
    `
      SELECT *
      FROM (
        SELECT
          n.id,
          n.codigo,
          n.titulo,
          n.tipo,
          n.tipo_norma,
          n.numero,
          n.ano,
          n.esfera,
          n.orgao,
          n.ementa,
          n.status_normativo,
          n.modulo_principal,
          COALESCE(n.fonte_url, n.link_url) AS fonte_url,
          n.observacao AS observacao_publica,
          COALESCE(
            json_agg(vm.modulo ORDER BY vm.modulo) FILTER (WHERE vm.id IS NOT NULL),
            '[]'::json
          ) AS modulos_relacionados
        FROM licenciamento_normas n
        LEFT JOIN licenciamento_normas_modulos_vinculos vm
          ON vm.norma_id = n.id
         AND vm.ativo = TRUE
        WHERE n.deleted_at IS NULL
          AND n.ativo = TRUE
          AND LOWER(n.codigo) = LOWER($1)
        GROUP BY n.id
      ) safe_norma;
    `,
    [codigo]
  );

  return result.rows[0] || null;
}

async function listAvisosNormativosPublicos() {
  const result = await db.query(
    `
      SELECT
        codigo,
        titulo,
        criticidade,
        status,
        'A tabela ou matriz normativa aplicavel esta sujeita a validacao administrativa. O valor apresentado nao constitui cobranca oficial.' AS aviso_publico
      FROM licenciamento_divergencias_normativas
      WHERE deleted_at IS NULL
        AND criticidade IN ('alta', 'critica')
        AND status NOT IN ('resolvida', 'resolvido', 'encerrada')
      ORDER BY criticidade DESC, titulo ASC;
    `
  );

  return result.rows;
}

module.exports = {
  db,
  withTransaction,
  getStatus,
  listNormas,
  listTabelasTaxas,
  listMatrizes,
  listDivergencias,
  listHomologacao,
  getHomologacaoItem,
  updateHomologacaoItem,
  listLegislacaoPublica,
  getLegislacaoPublicaByCodigo,
  listAvisosNormativosPublicos,
};
