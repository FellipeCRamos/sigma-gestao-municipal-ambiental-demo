const auditService = require('../../services/auditService');
const {
  assertPositiveInteger,
  buildPaginatedResult,
  buildProtocol,
  computeLotStatus,
  createValidationError,
  db,
  ensureEspecieExists,
  ensureLoteExists,
  getActor,
  insertMovimentacao,
  normalizePagination,
} = require('./shared');
const {
  validateEspeciePayload,
  validateLotePayload,
  validateLoteUpdatePayload,
  validateMovimentacaoPayload,
} = require('./viveiroValidators');

async function findEspecieById(client, id) {
  const result = await client.query(
    `
      SELECT *
      FROM viveiro_especies
      WHERE id = $1;
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findLoteById(client, id) {
  const result = await client.query(
    `
      SELECT
        l.*,
        e.nome AS especie_nome,
        e.unidade_medida
      FROM viveiro_lotes l
      INNER JOIN viveiro_especies e ON e.id = l.especie_id
      WHERE l.id = $1;
    `,
    [id]
  );

  return result.rows[0] || null;
}

exports.listEspecies = async ({ incluir_inativas = false, busca = '', page = null, page_size = null } = {}) => {
  const pagination = normalizePagination({ page, page_size });
  const search = busca ? `%${String(busca).trim().toLowerCase()}%` : '';
  const params = [incluir_inativas, search];
  let paginationSql = '';

  if (pagination.requested) {
    params.push(pagination.offset, pagination.limit);
    paginationSql = `OFFSET $3 LIMIT $4`;
  }

  const result = await db.query(
    `
      WITH base AS (
        SELECT
          e.*,
          COALESCE(SUM(l.quantidade_disponivel) FILTER (WHERE l.status IN ('ativo', 'esgotado')), 0)::numeric AS estoque_total_fisico,
          COALESCE(SUM(l.quantidade_reservada) FILTER (WHERE l.status IN ('ativo', 'esgotado')), 0)::numeric AS estoque_total_reservado,
          COUNT(l.id) FILTER (WHERE l.status IN ('ativo', 'esgotado'))::int AS total_lotes
        FROM viveiro_especies e
        LEFT JOIN viveiro_lotes l ON l.especie_id = e.id
        WHERE ($1::boolean = true OR e.status = 'ativo')
          AND (
            $2::text = ''
            OR LOWER(e.nome) LIKE $2
            OR LOWER(COALESCE(e.nome_cientifico, '')) LIKE $2
          )
        GROUP BY e.id
      )
      SELECT
        *,
        COUNT(*) OVER()::int AS total_count
      FROM base
      ORDER BY LOWER(nome)
      ${paginationSql};
    `,
    params
  );

  const items = result.rows.map((row) => {
    const estoqueTotalFisico = Number(row.estoque_total_fisico);
    const estoqueTotalReservado = Number(row.estoque_total_reservado);

    return {
      ...row,
      estoque_total_fisico: estoqueTotalFisico,
      estoque_total_reservado: estoqueTotalReservado,
      estoque_total_disponivel: Math.max(0, estoqueTotalFisico - estoqueTotalReservado),
      estoque_minimo_alerta: Number(row.estoque_minimo_alerta),
      fator_arvometro: Number(row.fator_arvometro),
      area_media_m2: Number(row.area_media_m2),
    };
  });

  return buildPaginatedResult(items, pagination, result.rows[0]?.total_count || 0);
};

exports.listLotes = async ({ especie_id = null, status = '', busca = '', page = null, page_size = null } = {}) => {
  const pagination = normalizePagination({ page, page_size });
  const search = busca ? `%${String(busca).trim().toLowerCase()}%` : '';
  const params = [especie_id || null, status || '', search];
  let paginationSql = '';

  if (pagination.requested) {
    params.push(pagination.offset, pagination.limit);
    paginationSql = `OFFSET $4 LIMIT $5`;
  }

  const result = await db.query(
    `
      WITH base AS (
        SELECT
          l.*,
          e.nome AS especie_nome,
          e.categoria AS especie_categoria,
          e.unidade_medida,
          GREATEST(0, l.quantidade_disponivel - l.quantidade_reservada)::numeric AS quantidade_livre
        FROM viveiro_lotes l
        INNER JOIN viveiro_especies e ON e.id = l.especie_id
        WHERE ($1::int IS NULL OR l.especie_id = $1)
          AND ($2::text = '' OR l.status = $2)
          AND (
            $3::text = ''
            OR LOWER(l.codigo) LIKE $3
            OR LOWER(e.nome) LIKE $3
            OR LOWER(COALESCE(l.local_armazenamento, '')) LIKE $3
          )
      )
      SELECT
        *,
        COUNT(*) OVER()::int AS total_count
      FROM base
      ORDER BY data_entrada DESC, id DESC
      ${paginationSql};
    `,
    params
  );

  const items = result.rows.map((row) => ({
    ...row,
    quantidade_inicial: Number(row.quantidade_inicial),
    quantidade_disponivel: Number(row.quantidade_disponivel),
    quantidade_reservada: Number(row.quantidade_reservada),
    quantidade_livre: Number(row.quantidade_livre),
  }));

  return buildPaginatedResult(items, pagination, result.rows[0]?.total_count || 0);
};

exports.createEspecie = async (payload, user, req) => {
  const input = validateEspeciePayload(payload);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      `
        INSERT INTO viveiro_especies (
          nome,
          nome_cientifico,
          categoria,
          porte,
          unidade_medida,
          estoque_minimo_alerta,
          fator_arvometro,
          area_media_m2,
          status,
          observacoes,
          created_by_interno_id,
          updated_by_interno_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        RETURNING *;
      `,
      [
        input.nome,
        input.nome_cientifico,
        input.categoria,
        input.porte,
        input.unidade_medida,
        input.estoque_minimo_alerta,
        input.fator_arvometro,
        input.area_media_m2,
        input.status,
        input.observacoes,
        user?.id || null,
      ]
    );

    await client.query('COMMIT');

    const created = insertResult.rows[0];

    await auditService.logChange({
      ...getActor(user),
      acao: 'viveiro.especie.create',
      entidade: 'viveiro_especies',
      entidade_id: created.id,
      before: null,
      after: created,
      req,
    });

    return created;
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      throw createValidationError('Ja existe uma especie cadastrada com esse nome.', { field: 'nome' });
    }

    throw error;
  } finally {
    client.release();
  }
};

exports.updateEspecie = async (id, payload, user, req) => {
  const especieId = assertPositiveInteger(id, 'id');
  const input = validateEspeciePayload(payload);
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const before = await findEspecieById(client, especieId);

    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }

    const updateResult = await client.query(
      `
        UPDATE viveiro_especies
        SET
          nome = $2,
          nome_cientifico = $3,
          categoria = $4,
          porte = $5,
          unidade_medida = $6,
          estoque_minimo_alerta = $7,
          fator_arvometro = $8,
          area_media_m2 = $9,
          status = $10,
          observacoes = $11,
          updated_by_interno_id = $12,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `,
      [
        especieId,
        input.nome,
        input.nome_cientifico,
        input.categoria,
        input.porte,
        input.unidade_medida,
        input.estoque_minimo_alerta,
        input.fator_arvometro,
        input.area_media_m2,
        input.status,
        input.observacoes,
        user?.id || null,
      ]
    );

    await client.query('COMMIT');

    const updated = updateResult.rows[0];

    await auditService.logChange({
      ...getActor(user),
      acao: 'viveiro.especie.update',
      entidade: 'viveiro_especies',
      entidade_id: updated.id,
      before,
      after: updated,
      req,
    });

    return updated;
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      throw createValidationError('Ja existe uma especie cadastrada com esse nome.', { field: 'nome' });
    }

    throw error;
  } finally {
    client.release();
  }
};

exports.createLote = async (payload, user, req) => {
  const input = validateLotePayload(payload);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const especie = await ensureEspecieExists(client, input.especie_id, { activeOnly: true });

    if (!especie) {
      throw createValidationError('Especie ativa nao encontrada para o lote.', { field: 'especie_id' });
    }

    const normalizedStatus = computeLotStatus(input.status, input.quantidade_inicial);

    const insertResult = await client.query(
      `
        INSERT INTO viveiro_lotes (
          especie_id,
          codigo,
          origem_lote,
          local_armazenamento,
          data_entrada,
          quantidade_inicial,
          quantidade_disponivel,
          status,
          observacoes,
          created_by_interno_id,
          updated_by_interno_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $9)
        RETURNING *;
      `,
      [
        input.especie_id,
        input.codigo,
        input.origem_lote,
        input.local_armazenamento,
        input.data_entrada,
        input.quantidade_inicial,
        normalizedStatus,
        input.observacoes,
        user?.id || null,
      ]
    );

    const lote = insertResult.rows[0];

    await insertMovimentacao(client, {
      lote_id: lote.id,
      especie_id: lote.especie_id,
      tipo: 'entrada_lote',
      quantidade: lote.quantidade_inicial,
      saldo_anterior: 0,
      saldo_posterior: lote.quantidade_disponivel,
      referencia_tipo: 'lote',
      referencia_id: lote.id,
      observacoes: lote.observacoes || 'Entrada inicial do lote.',
      created_by_interno_id: user?.id || null,
      dados: {
        codigo_lote: lote.codigo,
        origem_lote: lote.origem_lote,
      },
    });

    await client.query('COMMIT');

    const created = await findLoteById(db, lote.id);

    await auditService.logChange({
      ...getActor(user),
      acao: 'viveiro.lote.create',
      entidade: 'viveiro_lotes',
      entidade_id: lote.id,
      before: null,
      after: lote,
      req,
    });

    return created;
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      throw createValidationError('Ja existe um lote com esse codigo.', { field: 'codigo' });
    }

    throw error;
  } finally {
    client.release();
  }
};

exports.updateLote = async (id, payload, user, req) => {
  const loteId = assertPositiveInteger(id, 'id');
  const input = validateLoteUpdatePayload(payload);
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const before = await findLoteById(client, loteId);

    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }

    const normalizedStatus = computeLotStatus(input.status, before.quantidade_disponivel);

    const updateResult = await client.query(
      `
        UPDATE viveiro_lotes
        SET
          origem_lote = $2,
          local_armazenamento = $3,
          data_entrada = $4,
          status = $5,
          observacoes = $6,
          updated_by_interno_id = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `,
      [
        loteId,
        input.origem_lote,
        input.local_armazenamento,
        input.data_entrada,
        normalizedStatus,
        input.observacoes,
        user?.id || null,
      ]
    );

    await client.query('COMMIT');

    const updated = await findLoteById(db, loteId);

    await auditService.logChange({
      ...getActor(user),
      acao: 'viveiro.lote.update',
      entidade: 'viveiro_lotes',
      entidade_id: loteId,
      before,
      after: updateResult.rows[0],
      req,
    });

    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.getEstoqueConsolidado = async () => {
  const [especiesResult, lotesResult] = await Promise.all([
    db.query(
      `
        WITH lotes_agg AS (
          SELECT
            especie_id,
            COALESCE(SUM(quantidade_disponivel) FILTER (WHERE status IN ('ativo', 'esgotado')), 0)::numeric AS estoque_fisico,
            COALESCE(SUM(quantidade_reservada) FILTER (WHERE status IN ('ativo', 'esgotado')), 0)::numeric AS estoque_reservado,
            COUNT(id) FILTER (WHERE status IN ('ativo', 'esgotado'))::int AS lotes_ativos
          FROM viveiro_lotes
          GROUP BY especie_id
        ),
        entregas_agg AS (
          SELECT
            ei.especie_id,
            COALESCE(SUM(ei.quantidade_entregue) FILTER (WHERE ve.status = 'concluida'), 0)::numeric AS estoque_entregue
          FROM viveiro_entrega_itens ei
          INNER JOIN viveiro_entregas ve ON ve.id = ei.entrega_id
          GROUP BY ei.especie_id
        )
        SELECT
          e.id,
          e.nome,
          e.categoria,
          e.porte,
          e.unidade_medida,
          e.estoque_minimo_alerta,
          COALESCE(la.estoque_fisico, 0)::numeric AS estoque_fisico,
          COALESCE(la.estoque_reservado, 0)::numeric AS estoque_reservado,
          COALESCE(ea.estoque_entregue, 0)::numeric AS estoque_entregue,
          COALESCE(la.lotes_ativos, 0)::int AS lotes_ativos
        FROM viveiro_especies e
        LEFT JOIN lotes_agg la ON la.especie_id = e.id
        LEFT JOIN entregas_agg ea ON ea.especie_id = e.id
        WHERE e.status = 'ativo'
        ORDER BY LOWER(e.nome);
      `
    ),
    db.query(
      `
        SELECT
          l.id,
          l.codigo,
          l.especie_id,
          e.nome AS especie_nome,
          e.unidade_medida,
          l.origem_lote,
          l.local_armazenamento,
          l.data_entrada,
          l.quantidade_inicial,
          l.quantidade_disponivel,
          l.quantidade_reservada,
          l.status
        FROM viveiro_lotes l
        INNER JOIN viveiro_especies e ON e.id = l.especie_id
        ORDER BY l.data_entrada DESC, l.id DESC;
      `
    ),
  ]);

  const porEspecie = especiesResult.rows.map((row) => {
    const estoqueFisico = Number(row.estoque_fisico);
    const estoqueReservado = Number(row.estoque_reservado);
    const estoqueMinimo = Number(row.estoque_minimo_alerta);
    const estoqueDisponivel = Math.max(0, estoqueFisico - estoqueReservado);

    return {
      ...row,
      estoque_fisico: estoqueFisico,
      estoque_reservado: estoqueReservado,
      estoque_disponivel: estoqueDisponivel,
      estoque_entregue: Number(row.estoque_entregue),
      estoque_minimo_alerta: estoqueMinimo,
      abaixo_do_minimo: estoqueDisponivel <= estoqueMinimo,
    };
  });

  const lotes = lotesResult.rows.map((row) => ({
    ...row,
    quantidade_inicial: Number(row.quantidade_inicial),
    quantidade_disponivel: Number(row.quantidade_disponivel),
    quantidade_reservada: Number(row.quantidade_reservada),
    quantidade_livre: Math.max(0, Number(row.quantidade_disponivel) - Number(row.quantidade_reservada)),
  }));

  return {
    totais: {
      especies_ativas: porEspecie.length,
      lotes_cadastrados: lotes.length,
      lotes_disponiveis: lotes.filter((item) => item.status === 'ativo').length,
      mudas_disponiveis: porEspecie.reduce((sum, item) => sum + item.estoque_disponivel, 0),
      mudas_reservadas: porEspecie.reduce((sum, item) => sum + item.estoque_reservado, 0),
      mudas_entregues: porEspecie.reduce((sum, item) => sum + item.estoque_entregue, 0),
      especies_abaixo_minimo: porEspecie.filter((item) => item.abaixo_do_minimo).length,
    },
    por_especie: porEspecie,
    lotes,
  };
};

exports.listMovimentacoes = async ({ especie_id = null, lote_id = null, tipo = '', page = null, page_size = null } = {}) => {
  const pagination = normalizePagination({ page, page_size }, { defaultPageSize: 20, maxPageSize: 100 });
  const params = [especie_id || null, lote_id || null, tipo || ''];
  let paginationSql = 'LIMIT 200';

  if (pagination.requested) {
    params.push(pagination.offset, pagination.limit);
    paginationSql = 'OFFSET $4 LIMIT $5';
  }

  const result = await db.query(
    `
      WITH base AS (
        SELECT
          m.*,
          e.nome AS especie_nome,
          e.unidade_medida,
          l.codigo AS lote_codigo,
          ui.nome AS created_by_nome
        FROM viveiro_movimentacoes m
        INNER JOIN viveiro_especies e ON e.id = m.especie_id
        INNER JOIN viveiro_lotes l ON l.id = m.lote_id
        LEFT JOIN usuarios_internos ui ON ui.id = m.created_by_interno_id
        WHERE ($1::int IS NULL OR m.especie_id = $1)
          AND ($2::int IS NULL OR m.lote_id = $2)
          AND ($3::text = '' OR m.tipo = $3)
      )
      SELECT
        *,
        COUNT(*) OVER()::int AS total_count
      FROM base
      ORDER BY created_at DESC, id DESC
      ${paginationSql};
    `,
    params
  );

  const items = result.rows.map((row) => ({
    ...row,
    quantidade: Number(row.quantidade),
    saldo_anterior: Number(row.saldo_anterior),
    saldo_posterior: Number(row.saldo_posterior),
  }));

  return buildPaginatedResult(items, pagination, result.rows[0]?.total_count || 0);
};

exports.createMovimentacaoAjuste = async (payload, user, req) => {
  const input = validateMovimentacaoPayload(payload);

  if (!['ajuste_positivo', 'ajuste_negativo'].includes(input.tipo)) {
    throw createValidationError('Tipo de movimentacao invalido para ajuste.', { field: 'tipo' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const lote = await ensureLoteExists(client, input.lote_id, { forUpdate: true });

    if (!lote) {
      throw createValidationError('Lote nao encontrado.', { field: 'lote_id' });
    }

    if (lote.status === 'encerrado') {
      throw createValidationError('Nao e possivel ajustar um lote encerrado.', { field: 'lote_id' });
    }

    const saldoAnterior = Number(lote.quantidade_disponivel);
    const saldoPosterior =
      input.tipo === 'ajuste_positivo'
        ? saldoAnterior + input.quantidade
        : saldoAnterior - input.quantidade;

    if (saldoPosterior < 0) {
      throw createValidationError('Ajuste negativo acima do estoque disponivel.', { field: 'quantidade' });
    }

    const nextStatus = computeLotStatus(lote.status, saldoPosterior);

    await client.query(
      `
        UPDATE viveiro_lotes
        SET
          quantidade_disponivel = $2,
          status = $3,
          updated_by_interno_id = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [lote.id, saldoPosterior, nextStatus, user?.id || null]
    );

    await insertMovimentacao(client, {
      lote_id: lote.id,
      especie_id: lote.especie_id,
      tipo: input.tipo,
      quantidade: input.quantidade,
      saldo_anterior: saldoAnterior,
      saldo_posterior: saldoPosterior,
      referencia_tipo: 'ajuste_manual',
      referencia_id: lote.id,
      observacoes: input.observacoes,
      created_by_interno_id: user?.id || null,
      dados: {
        lote_codigo: lote.codigo,
      },
    });

    await client.query('COMMIT');

    await auditService.log({
      ...getActor(user),
      acao: 'viveiro.movimentacao.ajuste',
      entidade: 'viveiro_movimentacoes',
      entidade_id: lote.id,
      dados: {
        lote_id: lote.id,
        tipo: input.tipo,
        quantidade: input.quantidade,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior,
      },
      req,
    });

    return findLoteById(db, lote.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
