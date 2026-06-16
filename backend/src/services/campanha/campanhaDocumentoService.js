const { db, fs, path, auditService, getFileHash, sanitizeDocumento } = require('./shared');

exports.createDocumento = async (usuarioId, inscricaoId, tipo, file, req = null) => {
  const inscricaoResult = await db.query(
    `
      SELECT id
      FROM campanha_inscricoes
      WHERE id = $1
        AND usuario_id = $2;
    `,
    [inscricaoId, usuarioId]
  );

  if (!inscricaoResult.rows[0]) {
    return null;
  }

  const extensao = path.extname(file.originalname || '').toLowerCase();
  const fileHash = getFileHash(file.path);

  const result = await db.query(
    `
      INSERT INTO campanha_documentos (
        inscricao_id,
        usuario_id,
        tipo,
        nome_original,
        nome_arquivo,
        caminho_arquivo,
        mime_type,
        tamanho_bytes,
        extensao,
        file_hash_sha256
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `,
    [
      inscricaoId,
      usuarioId,
      tipo || 'documento',
      file.originalname,
      file.filename,
      file.path,
      file.mimetype,
      file.size,
      extensao,
      fileHash
    ]
  );

  const documento = result.rows[0];

  await auditService.log({
    ator_tipo: 'externo',
    ator_id: usuarioId,
    acao: 'enviar_documento_campanha',
    entidade: 'campanha_documentos',
    entidade_id: documento.id,
    dados: {
      inscricao_id: inscricaoId,
      tipo: documento.tipo,
      nome_original: documento.nome_original,
      mime_type: documento.mime_type,
      tamanho_bytes: documento.tamanho_bytes,
      extensao: documento.extensao
    },
    req
  });

  return sanitizeDocumento(documento);
};

exports.findDocumentosByInscricaoForUsuario = async (usuarioId, inscricaoId) => {
  const result = await db.query(
    `
      SELECT d.*
      FROM campanha_documentos d
      JOIN campanha_inscricoes i ON i.id = d.inscricao_id
      WHERE d.inscricao_id = $1
        AND i.usuario_id = $2
      ORDER BY d.created_at DESC, d.id DESC;
    `,
    [inscricaoId, usuarioId]
  );

  return result.rows.map(sanitizeDocumento);
};

exports.findDocumentoForUsuario = async (usuarioId, documentoId) => {
  const result = await db.query(
    `
      SELECT d.*
      FROM campanha_documentos d
      JOIN campanha_inscricoes i ON i.id = d.inscricao_id
      WHERE d.id = $1
        AND i.usuario_id = $2;
    `,
    [documentoId, usuarioId]
  );

  return result.rows[0];
};

exports.findDocumentoInterno = async (documentoId) => {
  const result = await db.query(
    `
      SELECT d.*
      FROM campanha_documentos d
      WHERE d.id = $1;
    `,
    [documentoId]
  );

  return result.rows[0];
};

exports.fileExists = (documento) => {
  return Boolean(documento?.caminho_arquivo && fs.existsSync(documento.caminho_arquivo));
};
