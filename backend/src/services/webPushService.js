const webPush = require('web-push');
const db = require('../config/db');
const { WEB_PUSH } = require('../config/env');
const logger = require('../utils/logger');

const MAX_TENTATIVAS = 3;

let configured = false;

function isEnabled() {
  return Boolean(WEB_PUSH.enabled && WEB_PUSH.publicKey && WEB_PUSH.privateKey && WEB_PUSH.subject);
}

function configure() {
  if (!isEnabled() || configured) return;

  webPush.setVapidDetails(WEB_PUSH.subject, WEB_PUSH.publicKey, WEB_PUSH.privateKey);
  configured = true;
}

function getPreferencias(preferencias = {}) {
  return {
    portal: preferencias.portal !== false,
    web_push: preferencias.web_push === true,
    campanhas: preferencias.campanhas !== false,
    inscricoes: preferencias.inscricoes !== false,
    ocorrencias: preferencias.ocorrencias !== false,
    carteira_vacinal: preferencias.carteira_vacinal !== false,
    operacional_essencial: preferencias.operacional_essencial !== false,
  };
}

function canDeliverWebPush(preferencias, categoria = 'portal', essencial = false) {
  const normalized = getPreferencias(preferencias);

  if (!normalized.web_push) return false;
  if (essencial) return normalized.operacional_essencial;

  return normalized[categoria] !== false;
}

function buildUrl(notificacao) {
  if (notificacao.link_url) return notificacao.link_url;

  if (notificacao.ref_tipo && notificacao.ref_id) {
    return `/?view=portal#portal-notificacoes`;
  }

  return '/?view=portal#portal-notificacoes';
}

function buildPayload(notificacao) {
  return {
    title: notificacao.titulo || 'SIGMA',
    body: notificacao.mensagem || 'Ha uma nova atualizacao no portal.',
    url: buildUrl(notificacao),
    tag: `sigba-notificacao-${notificacao.id}`,
    notification_id: notificacao.id,
    ref_tipo: notificacao.ref_tipo || null,
    ref_id: notificacao.ref_id || null,
    tipo: notificacao.tipo || 'operacional',
    prioridade: notificacao.prioridade || 'normal',
    requireInteraction: Boolean(notificacao.requer_acao),
  };
}

exports.isEnabled = isEnabled;

exports.queueNotificationWithClient = async (client, notificacao, options = {}) => {
  if (!isEnabled() || !notificacao?.usuario_id) {
    return { queued: 0, skipped: isEnabled() ? 'notificacao_invalida' : 'web_push_disabled' };
  }

  const usuarioResult = await client.query(
    `
      SELECT preferencias_comunicacao
      FROM usuarios_externos
      WHERE id = $1
        AND status = 'ativo';
    `,
    [notificacao.usuario_id]
  );

  const usuario = usuarioResult.rows[0];

  if (!usuario || !canDeliverWebPush(usuario.preferencias_comunicacao || {}, options.categoria, options.essencial)) {
    return { queued: 0, skipped: 'preferencia_nao_permite' };
  }

  const subscriptionsResult = await client.query(
    `
      SELECT id
      FROM usuario_externo_push_subscriptions
      WHERE usuario_externo_id = $1
        AND status = 'ativa';
    `,
    [notificacao.usuario_id]
  );

  let queued = 0;

  for (const subscription of subscriptionsResult.rows) {
    const result = await client.query(
      `
        INSERT INTO notificacao_entregas (
          notificacao_id,
          usuario_id,
          canal,
          subscription_id,
          status
        )
        VALUES ($1, $2, 'web_push', $3, 'pendente')
        ON CONFLICT (notificacao_id, canal, COALESCE(subscription_id, 0)) DO NOTHING
        RETURNING id;
      `,
      [notificacao.id, notificacao.usuario_id, subscription.id]
    );

    queued += result.rowCount;
  }

  return { queued };
};

exports.queueNotification = async (notificacao, options = {}) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const result = await exports.queueNotificationWithClient(client, notificacao, options);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.deliverPending = async ({ limit = 50, notificacaoId = null } = {}) => {
  if (!isEnabled()) {
    return { enabled: false, delivered: 0, failed: 0, permanentFailures: 0, skipped: 'web_push_disabled' };
  }

  configure();

  const values = [Math.max(1, Math.min(Number(limit) || 50, 200))];
  let notificationFilter = '';

  if (notificacaoId) {
    values.push(Number(notificacaoId));
    notificationFilter = 'AND ne.notificacao_id = $2';
  }

  const result = await db.query(
    `
      SELECT
        ne.id AS entrega_id,
        ne.tentativa_count,
        n.*,
        s.id AS subscription_id,
        s.subscription
      FROM notificacao_entregas ne
      JOIN notificacoes n ON n.id = ne.notificacao_id
      JOIN usuario_externo_push_subscriptions s ON s.id = ne.subscription_id
      WHERE ne.canal = 'web_push'
        AND ne.status IN ('pendente', 'erro')
        AND ne.tentativa_count < ${MAX_TENTATIVAS}
        AND s.status = 'ativa'
        ${notificationFilter}
      ORDER BY ne.created_at ASC, ne.id ASC
      LIMIT $1;
    `,
    values
  );

  let delivered = 0;
  let failed = 0;
  let permanentFailures = 0;

  for (const row of result.rows) {
    try {
      await webPush.sendNotification(row.subscription, JSON.stringify(buildPayload(row)), {
        TTL: 60 * 60,
      });

      await db.query(
        `
          UPDATE notificacao_entregas
          SET
            status = 'entregue',
            tentativa_count = tentativa_count + 1,
            entregue_em = CURRENT_TIMESTAMP,
            ultima_tentativa_em = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            erro_codigo = NULL,
            erro_mensagem = NULL
          WHERE id = $1;
        `,
        [row.entrega_id]
      );

      await db.query(
        `
          UPDATE usuario_externo_push_subscriptions
          SET
            last_success_at = CURRENT_TIMESTAMP,
            last_error_at = NULL,
            last_error = NULL,
            falhas_consecutivas = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [row.subscription_id]
      );

      delivered += 1;
    } catch (error) {
      const isPermanent = [404, 410].includes(Number(error.statusCode));

      await db.query(
        `
          UPDATE notificacao_entregas
          SET
            status = $2,
            tentativa_count = tentativa_count + 1,
            ultima_tentativa_em = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            erro_codigo = $3,
            erro_mensagem = $4
          WHERE id = $1;
        `,
        [
          row.entrega_id,
          isPermanent ? 'falha_permanente' : 'erro',
          error.statusCode ? String(error.statusCode) : error.name || 'WEB_PUSH_ERROR',
          String(error.message || 'Falha ao enviar Web Push.').slice(0, 500),
        ]
      );

      await db.query(
        `
          UPDATE usuario_externo_push_subscriptions
          SET
            status = CASE WHEN $2::boolean THEN 'revogada' ELSE status END,
            revoked_at = CASE WHEN $2::boolean THEN COALESCE(revoked_at, CURRENT_TIMESTAMP) ELSE revoked_at END,
            last_error_at = CURRENT_TIMESTAMP,
            last_error = $3,
            falhas_consecutivas = falhas_consecutivas + 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [
          row.subscription_id,
          isPermanent,
          String(error.message || 'Falha ao enviar Web Push.').slice(0, 500),
        ]
      );

      if (isPermanent) {
        permanentFailures += 1;
      } else {
        failed += 1;
      }

      logger.warn('web_push.deliver_failed', {
        entrega_id: row.entrega_id,
        notificacao_id: row.id,
        subscription_id: row.subscription_id,
        status_code: error.statusCode || null,
        permanent: isPermanent,
        message: error.message,
      });
    }
  }

  return {
    enabled: true,
    processed: result.rows.length,
    delivered,
    failed,
    permanentFailures,
  };
};

exports.cleanupInvalidSubscriptions = async ({ olderThanDays = 30 } = {}) => {
  const result = await db.query(
    `
      UPDATE usuario_externo_push_subscriptions
      SET
        status = 'revogada',
        revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE status = 'ativa'
        AND falhas_consecutivas >= 5
        AND last_error_at < CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 day')
      RETURNING id, endpoint_hash;
    `,
    [Math.max(1, Number(olderThanDays) || 30)]
  );

  return {
    revoked: result.rowCount,
    subscriptions: result.rows,
  };
};
