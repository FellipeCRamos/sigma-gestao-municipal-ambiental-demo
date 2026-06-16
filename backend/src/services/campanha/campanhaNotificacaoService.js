const { db, auditService, webPushService, createNotification } = require('./shared');

exports.findNotificacoesByUsuario = async (usuarioId, filters = {}) => {
  const values = [usuarioId];
  const where = ['usuario_id = $1'];

  if (filters.status) {
    values.push(filters.status);
    where.push(`status = $${values.length}`);
  }

  const limit = Math.max(1, Math.min(Number(filters.limit) || 100, 200));
  values.push(limit);

  const result = await db.query(
    `
      SELECT *
      FROM notificacoes
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE WHEN status = 'nao_lida' THEN 0 ELSE 1 END,
        CASE prioridade WHEN 'alta' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
        created_at DESC,
        id DESC
      LIMIT $${values.length};
    `,
    values
  );

  return result.rows;
};

exports.markNotificacaoLida = async (usuarioId, notificacaoId) => {
  const result = await db.query(
    `
      UPDATE notificacoes
      SET
        status = 'lida',
        lida_em = COALESCE(lida_em, CURRENT_TIMESTAMP)
      WHERE id = $1
        AND usuario_id = $2
      RETURNING *;
    `,
    [notificacaoId, usuarioId]
  );

  return result.rows[0];
};

exports.markTodasNotificacoesLidas = async (usuarioId) => {
  const result = await db.query(
    `
      UPDATE notificacoes
      SET
        status = 'lida',
        lida_em = COALESCE(lida_em, CURRENT_TIMESTAMP)
      WHERE usuario_id = $1
        AND status <> 'lida'
      RETURNING *;
    `,
    [usuarioId]
  );

  return {
    atualizadas: result.rowCount,
    notificacoes: result.rows
  };
};

exports.createMobileTestNotification = async (usuarioId, req = null) => {
  const client = await db.connect();
  let notificacao = null;

  try {
    await client.query('BEGIN');
    notificacao = await createNotification(client, usuarioId, {
      titulo: 'Teste de notificacao SIGBA',
      mensagem: 'Seu portal esta apto a receber avisos operacionais quando o Web Push estiver habilitado.',
      ref_tipo: 'portal_tutor',
      ref_id: null,
      tipo: 'teste_web_push',
      prioridade: 'normal',
      requer_acao: false,
      link_url: '/?view=portal#portal-notificacoes',
      metadata: {
        categoria_preferencia: 'portal',
        comunicacao_essencial: false,
        origem: 'portal_tutor'
      }
    });
    await webPushService.queueNotificationWithClient(client, notificacao, {
      categoria: 'portal',
      essencial: false
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const entrega = await webPushService.deliverPending({ notificacaoId: notificacao.id, limit: 20 });

  await auditService.log({
    ator_tipo: 'externo',
    ator_id: usuarioId,
    acao: 'criar_notificacao_teste_web_push',
    entidade: 'notificacoes',
    entidade_id: notificacao.id,
    dados: {
      entrega
    },
    req
  });

  return {
    notificacao,
    entrega
  };
};
