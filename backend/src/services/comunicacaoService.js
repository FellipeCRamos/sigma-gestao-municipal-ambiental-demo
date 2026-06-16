const db = require('../config/db');
const { WEB_PUSH } = require('../config/env');
const webPushService = require('./webPushService');

const DELIVERY_STATUS_DEFINITIONS = Object.freeze({
  pendente: {
    label: 'Pendente',
    grupo: 'pendente',
    descricao: 'Entrega aguardando processamento pelo job operacional.',
  },
  entregue: {
    label: 'Entregue',
    grupo: 'sucesso',
    descricao: 'Entrega processada com sucesso pelo canal configurado.',
  },
  erro: {
    label: 'Falha temporária',
    grupo: 'falha_temporaria',
    descricao: 'Entrega falhou, mas ainda pode ser reprocessada.',
  },
  falha_permanente: {
    label: 'Falha permanente',
    grupo: 'falha_permanente',
    descricao: 'Entrega não deve ser tentada novamente sem ação corretiva.',
  },
  ignorada: {
    label: 'Ignorada',
    grupo: 'ignorada',
    descricao: 'Entrega descartada por configuração, preferência ou regra operacional.',
  },
});

const CHANNEL_DEFINITIONS = Object.freeze({
  portal: {
    label: 'Portal',
    status: 'ativo',
    descricao: 'Notificação disponível no centro de notificações do Portal do Tutor.',
  },
  web_push: {
    label: 'Web Push',
    status: 'condicionado_por_ambiente',
    descricao: 'Entrega depende de opt-in do tutor, service worker e chaves VAPID ativas.',
  },
  email: {
    label: 'E-mail',
    status: 'adiado',
    descricao: 'Canal previsto na modelagem, sem envio operacional real nesta fase.',
  },
});

const NOTIFIABLE_EVENTS = Object.freeze([
  {
    key: 'pendencia_aberta',
    label: 'Pendência aberta',
    status: 'ativo',
    canais: ['portal', 'web_push'],
    descricao: 'Comunicação ao tutor quando há necessidade de atenção ou informação complementar.',
  },
  {
    key: 'reagendamento',
    label: 'Reagendamento',
    status: 'preparado',
    canais: ['portal', 'web_push'],
    descricao: 'Evento legítimo quando houver alteração relevante de agendamento já sustentada pelo fluxo.',
  },
  {
    key: 'mudanca_status_inscricao',
    label: 'Mudança relevante de status',
    status: 'ativo',
    canais: ['portal', 'web_push'],
    descricao: 'Atualização relevante em inscrição de campanha ou atendimento.',
  },
  {
    key: 'ocorrencia_atualizada',
    label: 'Ocorrência atualizada',
    status: 'ativo',
    canais: ['portal', 'web_push'],
    descricao: 'Atualização de ocorrência do tutor com informação útil de acompanhamento.',
  },
  {
    key: 'atendimento_proximo',
    label: 'Atendimento próximo',
    status: 'preparado',
    canais: ['portal', 'web_push'],
    descricao: 'Lembrete operacional permitido apenas quando houver data confiável e regra objetiva.',
  },
  {
    key: 'lembrete_vacinal_sofisticado',
    label: 'Lembrete vacinal parametrizado',
    status: 'adiado',
    canais: [],
    descricao: 'Adiado até existir protocolo sanitário parametrizado e aprovado institucionalmente.',
  },
  {
    key: 'viveiro_entrega_retirada',
    label: 'Entrega ou retirada do Viveiro',
    status: 'adiado',
    canais: [],
    descricao: 'Adiado até decisão institucional sobre comunicação do módulo Viveiro.',
  },
  {
    key: 'newsletter',
    label: 'Newsletter',
    status: 'fora_escopo',
    canais: [],
    descricao: 'Comunicação massiva ou promocional fora da Fase 4A.',
  },
]);

const DELIVERY_STATUS_VALUES = new Set(Object.keys(DELIVERY_STATUS_DEFINITIONS));
const CHANNEL_VALUES = new Set(Object.keys(CHANNEL_DEFINITIONS));
const PRIORITY_VALUES = new Set(['baixa', 'normal', 'alta', 'urgente']);

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeInteger(value, fallback, { min = 1, max = 500 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function normalizeFilters(raw = {}) {
  const canal = normalizeString(raw.canal);
  const status = normalizeString(raw.status);
  const tipo = normalizeString(raw.tipo);
  const prioridade = normalizeString(raw.prioridade);

  return {
    canal: CHANNEL_VALUES.has(canal) ? canal : null,
    status: DELIVERY_STATUS_VALUES.has(status) ? status : null,
    tipo: tipo || null,
    prioridade: PRIORITY_VALUES.has(prioridade) ? prioridade : null,
    data_inicio: normalizeString(raw.data_inicio) || null,
    data_fim: normalizeString(raw.data_fim) || null,
  };
}

function buildDeliveryWhere(filters = {}) {
  const values = [];
  const clauses = [];

  function addClause(sql, value) {
    values.push(value);
    clauses.push(sql.replace('?', `$${values.length}`));
  }

  if (filters.canal) addClause('ne.canal = ?', filters.canal);
  if (filters.status) addClause('ne.status = ?', filters.status);
  if (filters.tipo) addClause('n.tipo = ?', filters.tipo);
  if (filters.prioridade) addClause('n.prioridade = ?', filters.prioridade);
  if (filters.data_inicio) addClause('ne.created_at >= ?::timestamp', filters.data_inicio);
  if (filters.data_fim) addClause('ne.created_at <= ?::timestamp', filters.data_fim);

  return {
    values,
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
  };
}

function decorateDelivery(row) {
  return {
    id: row.id,
    notificacao_id: row.notificacao_id,
    usuario_id: row.usuario_id,
    canal: row.canal,
    canal_label: CHANNEL_DEFINITIONS[row.canal]?.label || row.canal,
    status: row.status,
    status_label: DELIVERY_STATUS_DEFINITIONS[row.status]?.label || row.status,
    status_grupo: DELIVERY_STATUS_DEFINITIONS[row.status]?.grupo || 'desconhecido',
    tentativa_count: Number(row.tentativa_count || 0),
    erro_codigo: row.erro_codigo,
    erro_mensagem: row.erro_mensagem,
    entregue_em: row.entregue_em,
    ultima_tentativa_em: row.ultima_tentativa_em,
    created_at: row.created_at,
    updated_at: row.updated_at,
    notificacao: {
      titulo: row.titulo,
      mensagem: row.mensagem,
      status: row.notificacao_status,
      tipo: row.tipo,
      prioridade: row.prioridade,
      requer_acao: row.requer_acao,
      ref_tipo: row.ref_tipo,
      ref_id: row.ref_id,
      link_url: row.link_url,
    },
    subscription: row.subscription_id
      ? {
          id: row.subscription_id,
          endpoint_hash: row.endpoint_hash,
          status: row.subscription_status,
          falhas_consecutivas: Number(row.falhas_consecutivas || 0),
        }
      : null,
  };
}

function buildWebPushConfigStatus() {
  return {
    enabled: webPushService.isEnabled(),
    ambiente_habilitado: WEB_PUSH.enabled,
    public_key_configured: Boolean(WEB_PUSH.publicKey),
    private_key_configured: WEB_PUSH.privateKeyConfigured,
    subject_configured: Boolean(WEB_PUSH.subject),
    observacao: webPushService.isEnabled()
      ? 'Web Push está habilitado no ambiente.'
      : 'Web Push está preparado, mas depende de WEB_PUSH_ENABLED e chaves VAPID válidas.',
  };
}

exports.DELIVERY_STATUS_DEFINITIONS = DELIVERY_STATUS_DEFINITIONS;
exports.CHANNEL_DEFINITIONS = CHANNEL_DEFINITIONS;
exports.NOTIFIABLE_EVENTS = NOTIFIABLE_EVENTS;

exports.normalizeFilters = normalizeFilters;

exports.getResumo = async (rawFilters = {}) => {
  const filters = normalizeFilters(rawFilters);
  const { where, values } = buildDeliveryWhere(filters);

  const [
    totalsResult,
    canalStatusResult,
    falhasResult,
    pendentesResult,
    subscriptionsResult,
    preferenciasResult,
    tiposResult,
  ] = await Promise.all([
    db.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE ne.status = 'pendente')::int AS pendentes,
          COUNT(*) FILTER (WHERE ne.status = 'entregue')::int AS entregues,
          COUNT(*) FILTER (WHERE ne.status = 'erro')::int AS erros,
          COUNT(*) FILTER (WHERE ne.status = 'falha_permanente')::int AS falhas_permanentes,
          COUNT(*) FILTER (WHERE ne.status = 'ignorada')::int AS ignoradas,
          COUNT(*) FILTER (WHERE n.requer_acao = true)::int AS requer_acao,
          MAX(ne.updated_at) AS ultima_atualizacao
        FROM notificacao_entregas ne
        JOIN notificacoes n ON n.id = ne.notificacao_id
        ${where};
      `,
      values
    ),
    db.query(
      `
        SELECT ne.canal, ne.status, COUNT(*)::int AS total
        FROM notificacao_entregas ne
        JOIN notificacoes n ON n.id = ne.notificacao_id
        ${where}
        GROUP BY ne.canal, ne.status
        ORDER BY ne.canal, ne.status;
      `,
      values
    ),
    db.query(
      `
        SELECT
          ne.id,
          ne.notificacao_id,
          ne.usuario_id,
          ne.canal,
          ne.status,
          ne.tentativa_count,
          ne.erro_codigo,
          ne.erro_mensagem,
          ne.entregue_em,
          ne.ultima_tentativa_em,
          ne.created_at,
          ne.updated_at,
          n.titulo,
          n.mensagem,
          n.status AS notificacao_status,
          n.tipo,
          n.prioridade,
          n.requer_acao,
          n.ref_tipo,
          n.ref_id,
          n.link_url,
          s.id AS subscription_id,
          s.endpoint_hash,
          s.status AS subscription_status,
          s.falhas_consecutivas
        FROM notificacao_entregas ne
        JOIN notificacoes n ON n.id = ne.notificacao_id
        LEFT JOIN usuario_externo_push_subscriptions s ON s.id = ne.subscription_id
        WHERE ne.status IN ('erro', 'falha_permanente')
        ORDER BY COALESCE(ne.ultima_tentativa_em, ne.updated_at, ne.created_at) DESC
        LIMIT 10;
      `
    ),
    db.query(
      `
        SELECT ne.canal, ne.status, COUNT(*)::int AS total, MIN(ne.created_at) AS mais_antiga
        FROM notificacao_entregas ne
        WHERE ne.status IN ('pendente', 'erro')
        GROUP BY ne.canal, ne.status
        ORDER BY ne.canal, ne.status;
      `
    ),
    db.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'ativa')::int AS ativas,
          COUNT(*) FILTER (WHERE status = 'revogada')::int AS revogadas,
          COUNT(*) FILTER (WHERE status = 'ativa' AND falhas_consecutivas > 0)::int AS ativas_com_falha,
          MAX(last_success_at) AS ultimo_sucesso,
          MAX(last_error_at) AS ultimo_erro
        FROM usuario_externo_push_subscriptions;
      `
    ),
    db.query(
      `
        SELECT
          COUNT(*)::int AS usuarios_externos,
          COUNT(*) FILTER (WHERE (preferencias_comunicacao->>'portal') IS DISTINCT FROM 'false')::int AS portal_ativo,
          COUNT(*) FILTER (WHERE (preferencias_comunicacao->>'web_push') = 'true')::int AS web_push_opt_in,
          COUNT(*) FILTER (WHERE (preferencias_comunicacao->>'email') = 'true')::int AS email_opt_in
        FROM usuarios_externos
        WHERE status = 'ativo';
      `
    ),
    db.query(
      `
        SELECT n.tipo, n.prioridade, COUNT(*)::int AS total
        FROM notificacao_entregas ne
        JOIN notificacoes n ON n.id = ne.notificacao_id
        ${where}
        GROUP BY n.tipo, n.prioridade
        ORDER BY total DESC, n.tipo ASC, n.prioridade ASC
        LIMIT 20;
      `,
      values
    ),
  ]);

  const totals = totalsResult.rows[0] || {};

  return {
    filtros_aplicados: filters,
    web_push: buildWebPushConfigStatus(),
    canais: CHANNEL_DEFINITIONS,
    status_entrega: DELIVERY_STATUS_DEFINITIONS,
    entregas: {
      total: Number(totals.total || 0),
      pendentes: Number(totals.pendentes || 0),
      entregues: Number(totals.entregues || 0),
      erros: Number(totals.erros || 0),
      falhas_permanentes: Number(totals.falhas_permanentes || 0),
      ignoradas: Number(totals.ignoradas || 0),
      requer_acao: Number(totals.requer_acao || 0),
      ultima_atualizacao: totals.ultima_atualizacao,
      por_canal_status: canalStatusResult.rows,
      por_tipo_prioridade: tiposResult.rows,
    },
    pendencias: pendentesResult.rows,
    falhas_recentes: falhasResult.rows.map(decorateDelivery),
    subscriptions: subscriptionsResult.rows[0] || {
      total: 0,
      ativas: 0,
      revogadas: 0,
      ativas_com_falha: 0,
      ultimo_sucesso: null,
      ultimo_erro: null,
    },
    preferencias: preferenciasResult.rows[0] || {
      usuarios_externos: 0,
      portal_ativo: 0,
      web_push_opt_in: 0,
      email_opt_in: 0,
    },
    eventos: exports.getEventosNotificaveis(),
    meta: {
      tipo: 'comunicacao_observavel',
      versao: '4A',
      observacao: 'Resumo interno de observabilidade da comunicação existente. Não executa disparos.',
    },
  };
};

exports.listEntregas = async (rawFilters = {}) => {
  const filters = normalizeFilters(rawFilters);
  const page = normalizeInteger(rawFilters.page, 1, { min: 1, max: 10000 });
  const perPage = normalizeInteger(rawFilters.per_page || rawFilters.limit, 25, { min: 1, max: 100 });
  const offset = (page - 1) * perPage;
  const { where, values } = buildDeliveryWhere(filters);
  const paginationValues = [...values, perPage, offset];
  const limitParam = `$${values.length + 1}`;
  const offsetParam = `$${values.length + 2}`;

  const [itemsResult, totalResult] = await Promise.all([
    db.query(
      `
        SELECT
          ne.id,
          ne.notificacao_id,
          ne.usuario_id,
          ne.canal,
          ne.status,
          ne.tentativa_count,
          ne.erro_codigo,
          ne.erro_mensagem,
          ne.entregue_em,
          ne.ultima_tentativa_em,
          ne.created_at,
          ne.updated_at,
          n.titulo,
          n.mensagem,
          n.status AS notificacao_status,
          n.tipo,
          n.prioridade,
          n.requer_acao,
          n.ref_tipo,
          n.ref_id,
          n.link_url,
          s.id AS subscription_id,
          s.endpoint_hash,
          s.status AS subscription_status,
          s.falhas_consecutivas
        FROM notificacao_entregas ne
        JOIN notificacoes n ON n.id = ne.notificacao_id
        LEFT JOIN usuario_externo_push_subscriptions s ON s.id = ne.subscription_id
        ${where}
        ORDER BY ne.created_at DESC, ne.id DESC
        LIMIT ${limitParam}
        OFFSET ${offsetParam};
      `,
      paginationValues
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM notificacao_entregas ne
        JOIN notificacoes n ON n.id = ne.notificacao_id
        ${where};
      `,
      values
    ),
  ]);

  const total = Number(totalResult.rows[0]?.total || 0);

  return {
    items: itemsResult.rows.map(decorateDelivery),
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
    filtros_aplicados: filters,
    status_entrega: DELIVERY_STATUS_DEFINITIONS,
    canais: CHANNEL_DEFINITIONS,
  };
};

exports.getEventosNotificaveis = () => ({
  ativos: NOTIFIABLE_EVENTS.filter((event) => event.status === 'ativo'),
  preparados: NOTIFIABLE_EVENTS.filter((event) => event.status === 'preparado'),
  adiados: NOTIFIABLE_EVENTS.filter((event) => event.status === 'adiado'),
  fora_escopo: NOTIFIABLE_EVENTS.filter((event) => event.status === 'fora_escopo'),
});
