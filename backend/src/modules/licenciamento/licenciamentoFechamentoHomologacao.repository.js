const db = require('../../config/db');

async function listChecklist() {
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_homologacao_checklists
      ORDER BY
        CASE WHEN obrigatorio = TRUE AND status IN ('pendente', 'reprovado') THEN 0 ELSE 1 END,
        grupo ASC,
        codigo ASC;
    `
  );

  return result.rows;
}

async function listLiberacoes() {
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_homologacao_liberacoes
      ORDER BY created_at DESC, id DESC;
    `
  );

  return result.rows;
}

async function createLiberacao(payload) {
  const result = await db.query(
    `
      INSERT INTO licenciamento_homologacao_liberacoes (
        codigo,
        fase,
        status,
        ready,
        total_itens,
        obrigatorios_pendentes,
        obrigatorios_reprovados,
        aprovados,
        aprovados_com_observacao,
        nao_aplicaveis,
        diagnostico_status,
        bloqueios_producao_json,
        divergencias_pendentes_json,
        relatorio_json,
        confirmado_por_usuario_id,
        confirmado_por_nome,
        confirmado_em,
        observacao
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16, $17, $18
      )
      RETURNING *;
    `,
    [
      payload.codigo,
      payload.fase,
      payload.status,
      payload.ready,
      payload.total_itens,
      payload.obrigatorios_pendentes,
      payload.obrigatorios_reprovados,
      payload.aprovados,
      payload.aprovados_com_observacao,
      payload.nao_aplicaveis,
      payload.diagnostico_status,
      JSON.stringify(payload.bloqueios_producao_json || {}),
      JSON.stringify(payload.divergencias_pendentes_json || []),
      JSON.stringify(payload.relatorio_json || {}),
      payload.confirmado_por_usuario_id || null,
      payload.confirmado_por_nome || null,
      payload.confirmado_em || null,
      payload.observacao || null,
    ]
  );

  return result.rows[0];
}

module.exports = {
  db,
  listChecklist,
  listLiberacoes,
  createLiberacao,
};
