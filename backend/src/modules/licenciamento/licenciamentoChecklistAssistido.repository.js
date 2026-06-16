const db = require('../../config/db');

async function listChecklist() {
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_homologacao_checklists
      ORDER BY
        CASE
          WHEN obrigatorio = TRUE AND status = 'reprovado' THEN 1
          WHEN obrigatorio = TRUE AND status = 'pendente' THEN 2
          WHEN status = 'reprovado' THEN 3
          WHEN status = 'pendente' THEN 4
          ELSE 5
        END,
        grupo ASC,
        codigo ASC;
    `
  );

  return result.rows;
}

async function getChecklistItem(id) {
  const result = await db.query(
    `
      SELECT *
      FROM licenciamento_homologacao_checklists
      WHERE id = $1;
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function countAuditLogs(action, itemId, actorId = null) {
  const params = [action, itemId];
  let actorFilter = '';

  if (actorId) {
    params.push(actorId);
    actorFilter = `AND ator_id = $3`;
  }

  const result = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM audit_logs
      WHERE acao = $1
        AND entidade_id = $2
        ${actorFilter};
    `,
    params
  );

  return Number(result.rows[0]?.total || 0);
}

module.exports = {
  db,
  listChecklist,
  getChecklistItem,
  countAuditLogs,
};
