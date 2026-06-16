const db = require('../../config/db');

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    const error = new Error(`Campo invalido: ${fieldName}.`);
    error.statusCode = 400;
    error.details = { field: fieldName };
    throw error;
  }

  return parsed;
}

function assertPositive(value, fieldName, { allowZero = false } = {}) {
  const parsed = toNumber(value, fieldName);
  const valid = allowZero ? parsed >= 0 : parsed > 0;

  if (parsed === null || !valid) {
    const error = new Error(`Campo invalido: ${fieldName}.`);
    error.statusCode = 400;
    error.details = { field: fieldName };
    throw error;
  }

  return parsed;
}

function assertPositiveInteger(value, fieldName) {
  const parsed = toNumber(value, fieldName);

  if (parsed === null || !Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`Campo invalido: ${fieldName}.`);
    error.statusCode = 400;
    error.details = { field: fieldName };
    throw error;
  }

  return parsed;
}

function normalizePagination({ page = null, page_size = null } = {}, { defaultPageSize = 10, maxPageSize = 50 } = {}) {
  const parsedPage = page === undefined || page === null || page === '' ? null : Number(page);
  const parsedPageSize = page_size === undefined || page_size === null || page_size === '' ? null : Number(page_size);
  const paginationRequested = parsedPage !== null || parsedPageSize !== null;

  if (!paginationRequested) {
    return {
      requested: false,
      page: 1,
      page_size: defaultPageSize,
      limit: null,
      offset: null,
    };
  }

  const safePage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const safePageSize = Number.isInteger(parsedPageSize) && parsedPageSize > 0
    ? Math.min(parsedPageSize, maxPageSize)
    : defaultPageSize;

  return {
    requested: true,
    page: safePage,
    page_size: safePageSize,
    limit: safePageSize,
    offset: (safePage - 1) * safePageSize,
  };
}

function buildPaginatedResult(items, pagination, totalCount) {
  if (!pagination?.requested) {
    return items;
  }

  const totalItems = Number(totalCount || 0);
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pagination.page_size) : 1;

  return {
    items,
    pagination: {
      page: pagination.page,
      page_size: pagination.page_size,
      total_items: totalItems,
      total_pages: totalPages,
    },
  };
}

function createValidationError(message, details = null) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details;
  return error;
}

function getActor(user) {
  return {
    ator_tipo: 'usuario_interno',
    ator_id: user?.id || null,
  };
}

function buildProtocol(prefix, id, dateValue = new Date()) {
  const year = new Date(dateValue).getFullYear();
  return `${prefix}-${year}-${String(id).padStart(6, '0')}`;
}

function computeApprovedStatus(items) {
  const totalRequested = items.reduce((sum, item) => sum + Number(item.quantidade_solicitada || 0), 0);
  const totalApproved = items.reduce((sum, item) => sum + Number(item.quantidade_aprovada || 0), 0);

  if (totalApproved <= 0) {
    return 'rejeitada';
  }

  if (totalApproved >= totalRequested && items.every((item) => Number(item.quantidade_aprovada || 0) >= Number(item.quantidade_solicitada || 0))) {
    return 'aprovada_total';
  }

  return 'aprovada_parcial';
}

function computePostDeliveryStatus(items, previousStatus) {
  const totalApproved = items.reduce((sum, item) => sum + Number(item.quantidade_aprovada || 0), 0);
  const totalDelivered = items.reduce((sum, item) => sum + Number(item.quantidade_entregue || 0), 0);

  if (totalApproved > 0 && totalDelivered >= totalApproved && items.every((item) => Number(item.quantidade_entregue || 0) >= Number(item.quantidade_aprovada || 0))) {
    return 'entregue';
  }

  return previousStatus;
}

function computeLotStatus(currentStatus, quantityAvailable) {
  if (currentStatus === 'bloqueado' || currentStatus === 'encerrado') {
    return currentStatus;
  }

  return Number(quantityAvailable) <= 0 ? 'esgotado' : 'ativo';
}

async function ensureEspecieExists(client, especieId, { activeOnly = false } = {}) {
  const result = await client.query(
    `
      SELECT *
      FROM viveiro_especies
      WHERE id = $1
        AND ($2::boolean = false OR status = 'ativo');
    `,
    [especieId, activeOnly]
  );

  return result.rows[0] || null;
}

async function ensureTerritorioExists(client, territorioId) {
  if (!territorioId) {
    return null;
  }

  const result = await client.query(
    `
      SELECT id, nome
      FROM territorios
      WHERE id = $1;
    `,
    [territorioId]
  );

  return result.rows[0] || null;
}

async function ensureLoteExists(client, loteId, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      SELECT l.*, e.nome AS especie_nome
      FROM viveiro_lotes l
      INNER JOIN viveiro_especies e ON e.id = l.especie_id
      WHERE l.id = $1
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [loteId]
  );

  return result.rows[0] || null;
}

async function getSolicitacaoBase(client, solicitacaoId, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      SELECT s.*
      FROM viveiro_solicitacoes s
      WHERE s.id = $1
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [solicitacaoId]
  );

  return result.rows[0] || null;
}

async function getSolicitacaoItens(client, solicitacaoId, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      SELECT
        i.*,
        e.nome AS especie_nome,
        e.nome_cientifico,
        e.categoria,
        e.porte,
        e.unidade_medida,
        e.estoque_minimo_alerta,
        e.fator_arvometro,
        e.area_media_m2
      FROM viveiro_solicitacao_itens i
      INNER JOIN viveiro_especies e ON e.id = i.especie_id
      WHERE i.solicitacao_id = $1
      ORDER BY i.id
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [solicitacaoId]
  );

  return result.rows;
}

async function getReservaBase(client, solicitacaoId, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      SELECT *
      FROM viveiro_reservas
      WHERE solicitacao_id = $1
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [solicitacaoId]
  );

  return result.rows[0] || null;
}

async function getReservaItens(client, solicitacaoId, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      SELECT
        ri.*,
        r.status AS reserva_status,
        r.protocolo AS reserva_protocolo,
        l.codigo AS lote_codigo,
        l.status AS lote_status
      FROM viveiro_reserva_itens ri
      INNER JOIN viveiro_reservas r ON r.id = ri.reserva_id
      INNER JOIN viveiro_lotes l ON l.id = ri.lote_id
      WHERE r.solicitacao_id = $1
      ORDER BY ri.id
      ${forUpdate ? 'FOR UPDATE' : ''};
    `,
    [solicitacaoId]
  );

  return result.rows;
}

async function getEntregasDaSolicitacao(client, solicitacaoId) {
  const result = await client.query(
    `
      SELECT
        e.id,
        e.protocolo,
        e.status,
        e.data_entrega,
        e.recebedor_nome,
        e.recebedor_documento,
        e.observacoes,
        e.created_at,
        ui.nome AS registrado_por_nome
      FROM viveiro_entregas e
      LEFT JOIN usuarios_internos ui ON ui.id = e.created_by_interno_id
      WHERE e.solicitacao_id = $1
      ORDER BY e.data_entrega DESC, e.id DESC;
    `,
    [solicitacaoId]
  );

  return result.rows;
}

async function getSolicitacaoDetalhe(client, solicitacaoId) {
  const baseResult = await client.query(
    `
      SELECT
        s.*,
        t.nome AS territorio_nome,
        ui.nome AS analisado_por_nome,
        uc.nome AS criado_por_nome
      FROM viveiro_solicitacoes s
      LEFT JOIN territorios t ON t.id = s.territorio_id
      LEFT JOIN usuarios_internos ui ON ui.id = s.analisado_por_interno_id
      LEFT JOIN usuarios_internos uc ON uc.id = s.created_by_interno_id
      WHERE s.id = $1;
    `,
    [solicitacaoId]
  );

  const solicitacao = baseResult.rows[0];

  if (!solicitacao) {
    return null;
  }

  const itens = await getSolicitacaoItens(client, solicitacaoId);
  const entregas = await getEntregasDaSolicitacao(client, solicitacaoId);
  const reservaBase = await getReservaBase(client, solicitacaoId);
  const reservaItens = await getReservaItens(client, solicitacaoId);

  const reservaMap = new Map(reservaItens.map((item) => [Number(item.solicitacao_item_id), item]));

  return {
    ...solicitacao,
    itens: itens.map((item) => ({
      ...item,
      quantidade_solicitada: Number(item.quantidade_solicitada),
      quantidade_aprovada: Number(item.quantidade_aprovada),
      quantidade_entregue: Number(item.quantidade_entregue),
      estoque_minimo_alerta: Number(item.estoque_minimo_alerta),
      fator_arvometro: Number(item.fator_arvometro),
      area_media_m2: Number(item.area_media_m2),
      quantidade_pendente_entrega: Math.max(0, Number(item.quantidade_aprovada) - Number(item.quantidade_entregue)),
      quantidade_reservada: Number(reservaMap.get(Number(item.id))?.quantidade_reservada || 0),
      quantidade_atendida_reserva: Number(reservaMap.get(Number(item.id))?.quantidade_atendida || 0),
      reserva_item_id: reservaMap.get(Number(item.id))?.id || null,
      reserva_status: reservaMap.get(Number(item.id))?.reserva_status || reservaBase?.status || null,
      reserva_protocolo: reservaMap.get(Number(item.id))?.reserva_protocolo || reservaBase?.protocolo || null,
      lote_reservado_id: reservaMap.get(Number(item.id))?.lote_id || null,
      lote_reservado_codigo: reservaMap.get(Number(item.id))?.lote_codigo || null,
      lote_reservado_status: reservaMap.get(Number(item.id))?.lote_status || null,
    })),
    entregas,
    reserva: reservaBase
      ? {
          ...reservaBase,
          itens: reservaItens.map((item) => ({
            ...item,
            quantidade_reservada: Number(item.quantidade_reservada),
            quantidade_atendida: Number(item.quantidade_atendida),
          })),
        }
      : null,
  };
}

async function insertMovimentacao(client, payload) {
  await client.query(
    `
      INSERT INTO viveiro_movimentacoes (
        lote_id,
        especie_id,
        tipo,
        quantidade,
        saldo_anterior,
        saldo_posterior,
        referencia_tipo,
        referencia_id,
        observacoes,
        dados,
        created_by_interno_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11);
    `,
    [
      payload.lote_id,
      payload.especie_id,
      payload.tipo,
      payload.quantidade,
      payload.saldo_anterior,
      payload.saldo_posterior,
      payload.referencia_tipo || null,
      payload.referencia_id || null,
      payload.observacoes || null,
      JSON.stringify(payload.dados || {}),
      payload.created_by_interno_id || null,
    ]
  );
}

module.exports = {
  db,
  normalizeString,
  toNumber,
  assertPositive,
  assertPositiveInteger,
  normalizePagination,
  buildPaginatedResult,
  createValidationError,
  getActor,
  buildProtocol,
  computeApprovedStatus,
  computePostDeliveryStatus,
  computeLotStatus,
  ensureEspecieExists,
  ensureTerritorioExists,
  ensureLoteExists,
  getSolicitacaoBase,
  getSolicitacaoItens,
  getReservaBase,
  getReservaItens,
  getSolicitacaoDetalhe,
  insertMovimentacao,
};
