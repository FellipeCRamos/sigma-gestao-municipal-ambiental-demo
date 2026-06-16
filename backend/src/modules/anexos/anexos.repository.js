const db = require('../../config/db');

function baseSelect() {
  return `
    SELECT
      a.*,
      enviado_por.nome AS enviado_por_nome,
      removido_por.nome AS removido_por_nome
    FROM sigma_anexos a
    LEFT JOIN usuarios_internos enviado_por ON enviado_por.id = a.enviado_por_id
    LEFT JOIN usuarios_internos removido_por ON removido_por.id = a.removido_por_id
  `;
}

async function createAnexo(client, payload) {
  const result = await client.query(
    `
      INSERT INTO sigma_anexos (
        protocolo,
        modulo_origem,
        entidade_tipo,
        entidade_id,
        nome_original,
        nome_armazenado,
        caminho_armazenamento,
        mime_type,
        extensao,
        tamanho_bytes,
        hash_sha256,
        categoria_documental,
        descricao,
        origem_upload,
        enviado_por_tipo,
        enviado_por_id,
        visibilidade,
        sensivel,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, 'ativo'
      )
      RETURNING *;
    `,
    [
      payload.protocolo,
      payload.modulo_origem,
      payload.entidade_tipo,
      payload.entidade_id,
      payload.nome_original,
      payload.nome_armazenado,
      payload.caminho_armazenamento,
      payload.mime_type,
      payload.extensao,
      payload.tamanho_bytes,
      payload.hash_sha256,
      payload.categoria_documental,
      payload.descricao,
      payload.origem_upload,
      payload.enviado_por_tipo,
      payload.enviado_por_id,
      payload.visibilidade,
      payload.sensivel,
    ]
  );

  return result.rows[0];
}

async function listAnexos(filters = {}) {
  const where = ['a.status = $1'];
  const params = ['ativo'];

  if (filters.modulo_origem) {
    params.push(filters.modulo_origem);
    where.push(`a.modulo_origem = $${params.length}`);
  }

  if (filters.entidade_tipo) {
    params.push(filters.entidade_tipo);
    where.push(`a.entidade_tipo = $${params.length}`);
  }

  if (filters.entidade_id) {
    params.push(filters.entidade_id);
    where.push(`a.entidade_id = $${params.length}`);
  }

  if (filters.protocolo) {
    params.push(filters.protocolo);
    where.push(`a.protocolo = $${params.length}`);
  }

  const result = await db.query(
    `
      ${baseSelect()}
      WHERE ${where.join(' AND ')}
      ORDER BY a.criado_em DESC, a.id DESC;
    `,
    params
  );

  return result.rows;
}

async function getAnexoById(id, options = {}) {
  const statusFilter = options.includeRemoved ? '' : "AND a.status = 'ativo'";
  const result = await db.query(
    `
      ${baseSelect()}
      WHERE a.id = $1
        ${statusFilter};
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getAnexoForEntity(id, filters = {}) {
  const where = ['a.id = $1', "a.status = 'ativo'"];
  const params = [id];

  if (filters.modulo_origem) {
    params.push(filters.modulo_origem);
    where.push(`a.modulo_origem = $${params.length}`);
  }

  if (filters.entidade_tipo) {
    params.push(filters.entidade_tipo);
    where.push(`a.entidade_tipo = $${params.length}`);
  }

  if (filters.entidade_id) {
    params.push(filters.entidade_id);
    where.push(`a.entidade_id = $${params.length}`);
  }

  const result = await db.query(
    `
      ${baseSelect()}
      WHERE ${where.join(' AND ')};
    `,
    params
  );

  return result.rows[0] || null;
}

async function softRemoveAnexo(client, id, payload) {
  const result = await client.query(
    `
      UPDATE sigma_anexos
      SET
        status = 'removido',
        removido_em = CURRENT_TIMESTAMP,
        removido_por_id = $2::integer,
        motivo_remocao = $3,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
        AND status = 'ativo'
      RETURNING *;
    `,
    [id, payload.removido_por_id || null, payload.motivo_remocao]
  );

  return result.rows[0] || null;
}

module.exports = {
  db,
  createAnexo,
  listAnexos,
  getAnexoById,
  getAnexoForEntity,
  softRemoveAnexo,
};
