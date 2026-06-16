const { db, workflowService } = require('./shared');

exports.findAll = async () => {
  const result = await db.query(`
    SELECT *
    FROM campanhas
    ORDER BY data_inicio DESC NULLS LAST, id DESC;
  `);

  return result.rows;
};

exports.findById = async (id) => {
  const result = await db.query(
    `
      SELECT *
      FROM campanhas
      WHERE id = $1;
    `,
    [id]
  );

  return result.rows[0];
};

exports.createInscricao = async (usuarioId, data) => {
  const territorialData = await territorioService.enrichTerritorioPayload(data);

  const query = `
    INSERT INTO campanha_inscricoes (
      campanha_id,
      usuario_id,
      protocolo,
      criterio_prioridade,
      prioridade_detalhes,
      servico_desejado,
      animal_nome,
      territorio_id,
      territorio_origem,
      animal_endereco,
      animal_especie,
      animal_raca,
      animal_sexo,
      idade_aproximada,
      peso_kg,
      condicoes_saude,
      condicao_femea,
      cirurgia_anterior,
      agressivo,
      microchip,
      localizacao_perda,
      carteira_vacinacao,
      declaracoes
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23::jsonb
    )
    RETURNING *;
  `;

  const values = [
    territorialData.campanha_id,
    usuarioId,
    generateProtocolo(),
    territorialData.criterio_prioridade || null,
    territorialData.prioridade_detalhes || null,
    territorialData.servico_desejado,
    territorialData.animal_nome,
    territorialData.territorio_id || null,
    territorialData.territorio_origem || 'nao_informado',
    territorialData.animal_endereco || null,
    territorialData.animal_especie,
    territorialData.animal_raca || null,
    territorialData.animal_sexo,
    territorialData.idade_aproximada || null,
    territorialData.peso_kg || null,
    toJsonb(territorialData.condicoes_saude),
    territorialData.condicao_femea || null,
    territorialData.cirurgia_anterior ?? false,
    territorialData.agressivo ?? false,
    territorialData.microchip || null,
    territorialData.localizacao_perda || null,
    territorialData.carteira_vacinacao || null,
    toJsonb(territorialData.declaracoes)
  ];

  const result = await db.query(query, values);
  const inscricao = result.rows[0];

  await auditService.log({
    ator_tipo: 'externo',
    ator_id: usuarioId,
    acao: 'criar_inscricao',
    entidade: 'campanha_inscricoes',
    entidade_id: inscricao.id,
    dados: {
      campanha_id: inscricao.campanha_id,
      protocolo: inscricao.protocolo,
      status: inscricao.status
    }
  });

  await historicoOperacionalService.log({
    tipo_item: 'campanha_inscricao',
    item_id: inscricao.id,
    evento: 'criacao_item',
    status_novo: inscricao.status,
    pendencia_aberta: false,
    observacao: 'Inscricao recebida pelo portal do tutor.',
    dados: {
      campanha_id: inscricao.campanha_id,
      protocolo: inscricao.protocolo,
      ator_tipo: 'externo',
      ator_id: usuarioId
    }
  });

  return inscricao;
};

exports.findByUsuario = async (usuarioId) => {
  const result = await db.query(
    `
      SELECT
        i.*,
        tr.nome AS territorio_nome,
        tr.categoria AS territorio_categoria,
        c.nome AS campanha_nome,
        c.slug AS campanha_slug,
        (
        SELECT COUNT(*)::int
        FROM campanha_documentos d
        WHERE d.inscricao_id = i.id
      ) AS documentos_total,
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', d.id,
            'tipo', d.tipo,
            'nome_original', d.nome_original,
            'mime_type', d.mime_type,
            'tamanho_bytes', d.tamanho_bytes,
            'created_at', d.created_at
          )
          ORDER BY d.created_at DESC, d.id DESC
        )
        FROM campanha_documentos d
        WHERE d.inscricao_id = i.id
      ), '[]'::json) AS documentos
      FROM campanha_inscricoes i
      JOIN campanhas c ON c.id = i.campanha_id
      LEFT JOIN territorios tr ON tr.id = i.territorio_id
      WHERE i.usuario_id = $1
      ORDER BY i.created_at DESC, i.id DESC;
    `,
    [usuarioId]
  );

  return result.rows;
};

exports.findAllInscricoes = async () => {
  const result = await db.query(`
    SELECT
      i.*,
      tr.nome AS territorio_nome,
      tr.categoria AS territorio_categoria,
      c.nome AS campanha_nome,
      u.nome AS usuario_nome,
      u.cpf AS usuario_cpf,
      u.email AS usuario_email,
      u.telefone AS usuario_telefone,
      u.endereco AS usuario_endereco,
      (
        SELECT COUNT(*)::int
        FROM campanha_documentos d
        WHERE d.inscricao_id = i.id
      ) AS documentos_total,
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', d.id,
            'tipo', d.tipo,
            'nome_original', d.nome_original,
            'mime_type', d.mime_type,
            'tamanho_bytes', d.tamanho_bytes,
            'created_at', d.created_at
          )
          ORDER BY d.created_at DESC, d.id DESC
        )
        FROM campanha_documentos d
        WHERE d.inscricao_id = i.id
      ), '[]'::json) AS documentos,
      (
        SELECT COUNT(*)::int
        FROM campanha_vacinacao_itens cvi
        WHERE cvi.inscricao_id = i.id
          AND cvi.status = 'ativo'
      ) AS vacinacoes_total,
      (
        SELECT COUNT(*)::int
        FROM campanha_vacinacao_itens cvi
        WHERE cvi.inscricao_id = i.id
          AND cvi.documento_id IS NOT NULL
          AND cvi.status = 'ativo'
      ) AS vacinacoes_com_documento,
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', cvi.id,
            'vacina_catalogo_id', cvi.vacina_catalogo_id,
            'vacina_nome', COALESCE(vc.nome_popular, vc.nome_comercial, vc.nome_tecnico),
            'dose', cvi.dose,
            'data_aplicacao', cvi.data_aplicacao,
            'proxima_dose_em', cvi.proxima_dose_em,
            'lote', cvi.lote,
            'fabricante', cvi.fabricante,
            'documento_id', cvi.documento_id,
            'documento_nome_original', d.nome_original,
            'observacoes', cvi.observacoes,
            'animal_vacinacao_id', cvi.animal_vacinacao_id,
            'status', cvi.status
          )
          ORDER BY cvi.data_aplicacao DESC, cvi.id DESC
        )
        FROM campanha_vacinacao_itens cvi
        JOIN vacina_catalogo vc ON vc.id = cvi.vacina_catalogo_id
        LEFT JOIN campanha_documentos d ON d.id = cvi.documento_id
        WHERE cvi.inscricao_id = i.id
          AND cvi.status = 'ativo'
      ), '[]'::json) AS vacinacoes_aplicadas
    FROM campanha_inscricoes i
    JOIN campanhas c ON c.id = i.campanha_id
    LEFT JOIN territorios tr ON tr.id = i.territorio_id
    JOIN usuarios_externos u ON u.id = i.usuario_id
    ORDER BY i.created_at DESC, i.id DESC;
  `);

  return result.rows.map((row) => ({
    ...row,
    workflow: workflowService.buildCampanhaWorkflow(row),
  }));
};

exports.findAgenda = async () => {
  const result = await db.query(`
    SELECT
      i.id,
      i.protocolo,
      i.status,
      i.agendamento_data,
      i.servico_desejado,
      i.animal_nome,
      i.animal_especie,
      i.animal_sexo,
      i.territorio_id,
      tr.nome AS territorio_nome,
      i.tutor_id,
      i.animal_id,
      c.nome AS campanha_nome,
      u.nome AS usuario_nome,
      u.telefone AS usuario_telefone,
      u.email AS usuario_email
    FROM campanha_inscricoes i
    JOIN campanhas c ON c.id = i.campanha_id
    LEFT JOIN territorios tr ON tr.id = i.territorio_id
    JOIN usuarios_externos u ON u.id = i.usuario_id
    WHERE i.agendamento_data IS NOT NULL
    ORDER BY i.agendamento_data ASC, i.id ASC;
  `);

  return result.rows.map((row) => ({
    ...row,
    workflow: workflowService.buildCampanhaWorkflow(row),
  }));
};

exports.findRelatorioInscricoes = async () => {
  const result = await db.query(`
    SELECT
      i.protocolo,
      c.nome AS campanha_nome,
      i.status,
      i.agendamento_data,
      i.servico_desejado,
      i.criterio_prioridade,
      u.nome AS tutor_nome,
      u.cpf AS tutor_cpf,
      u.email AS tutor_email,
      u.telefone AS tutor_telefone,
      i.animal_nome,
      i.animal_especie,
      i.animal_sexo,
      i.animal_raca,
      i.territorio_id,
      tr.nome AS territorio_nome,
      i.peso_kg,
      i.microchip,
      i.tutor_id,
      i.animal_id,
      (
        SELECT COUNT(*)::int
        FROM campanha_documentos d
        WHERE d.inscricao_id = i.id
      ) AS documentos_total,
      i.created_at,
      i.updated_at
    FROM campanha_inscricoes i
    JOIN campanhas c ON c.id = i.campanha_id
    LEFT JOIN territorios tr ON tr.id = i.territorio_id
    JOIN usuarios_externos u ON u.id = i.usuario_id
    ORDER BY i.created_at DESC, i.id DESC;
  `);

  return result.rows;
};
