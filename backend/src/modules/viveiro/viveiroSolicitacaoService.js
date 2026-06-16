const auditService = require('../../services/auditService');
const {
  assertPositiveInteger,
  buildPaginatedResult,
  buildProtocol,
  computeApprovedStatus,
  createValidationError,
  db,
  ensureEspecieExists,
  ensureLoteExists,
  ensureTerritorioExists,
  getActor,
  getReservaBase,
  getReservaItens,
  getSolicitacaoBase,
  getSolicitacaoDetalhe,
  getSolicitacaoItens,
  normalizePagination,
} = require('./shared');
const {
  validateAnalisePayload,
  validateSolicitacaoPayload,
} = require('./viveiroValidators');

async function upsertReserva(client, solicitacao, user, input, itensAtuais) {
  const aprovacoesMap = new Map(input.itens.map((item) => [Number(item.solicitacao_item_id), Number(item.quantidade_aprovada)]));
  const reservasMap = new Map(input.reservas.map((item) => [Number(item.solicitacao_item_id), item]));
  const reservaAtual = await getReservaBase(client, solicitacao.id, { forUpdate: true });
  const reservaItensAtuais = await getReservaItens(client, solicitacao.id, { forUpdate: true });
  const reservaItemMap = new Map(reservaItensAtuais.map((item) => [Number(item.solicitacao_item_id), item]));
  const reservaAtualPorLote = new Map();

  for (const reservaItem of reservaItensAtuais) {
    const loteId = Number(reservaItem.lote_id);
    reservaAtualPorLote.set(
      loteId,
      (reservaAtualPorLote.get(loteId) || 0) + Number(reservaItem.quantidade_reservada || 0)
    );
  }

  const requestedPorLote = new Map();

  for (const item of itensAtuais) {
    const approved = aprovacoesMap.has(Number(item.id))
      ? aprovacoesMap.get(Number(item.id))
      : 0;
    const delivered = Number(item.quantidade_entregue || 0);
    const pendingToReserve = Math.max(0, approved - delivered);
    const reservaInput = reservasMap.get(Number(item.id));
    const reservaAtualItem = reservaItemMap.get(Number(item.id));

    if (pendingToReserve > 0) {
      if (!reservaInput) {
        throw createValidationError('Informe a reserva de lote para cada item aprovado.', {
          field: 'reservas',
          solicitacao_item_id: item.id,
        });
      }

      if (Number(reservaInput.quantidade_reservada) !== pendingToReserve) {
        throw createValidationError('A quantidade reservada deve corresponder ao saldo aprovado pendente de entrega.', {
          field: 'reservas.quantidade_reservada',
          solicitacao_item_id: item.id,
        });
      }

      const lote = await ensureLoteExists(client, reservaInput.lote_id, { forUpdate: true });

      if (!lote) {
        throw createValidationError('Lote informado para reserva nao encontrado.', {
          field: 'reservas.lote_id',
          solicitacao_item_id: item.id,
        });
      }

      if (lote.status !== 'ativo') {
        throw createValidationError('Somente lotes ativos podem receber reserva.', {
          field: 'reservas.lote_id',
          lote_id: reservaInput.lote_id,
        });
      }

      if (Number(lote.especie_id) !== Number(item.especie_id)) {
        throw createValidationError('O lote reservado deve ser da mesma especie do item aprovado.', {
          field: 'reservas.lote_id',
          solicitacao_item_id: item.id,
        });
      }

      if (reservaAtualItem && Number(reservaAtualItem.quantidade_atendida || 0) > 0 && Number(reservaAtualItem.lote_id) !== Number(reservaInput.lote_id)) {
        throw createValidationError('Nao e possivel trocar o lote reservado depois de iniciar entregas para o item.', {
          field: 'reservas.lote_id',
          solicitacao_item_id: item.id,
        });
      }

      requestedPorLote.set(
        Number(reservaInput.lote_id),
        (requestedPorLote.get(Number(reservaInput.lote_id)) || 0) + pendingToReserve
      );
    } else if (reservaInput && Number(reservaInput.quantidade_reservada || 0) > 0) {
      throw createValidationError('Nao informe reserva para item sem saldo pendente aprovado.', {
        field: 'reservas.quantidade_reservada',
        solicitacao_item_id: item.id,
      });
    }
  }

  for (const reservaInput of input.reservas) {
    if (!itensAtuais.find((item) => Number(item.id) === Number(reservaInput.solicitacao_item_id))) {
      throw createValidationError('Reserva informada para item inexistente na solicitacao.', {
        field: 'reservas.solicitacao_item_id',
        solicitacao_item_id: reservaInput.solicitacao_item_id,
      });
    }
  }

  for (const [loteId, requestedQty] of requestedPorLote.entries()) {
    const lote = await ensureLoteExists(client, loteId, { forUpdate: true });
    const currentReservationSameSolicitacao = reservaAtualPorLote.get(loteId) || 0;
    const saldoLivreParaNovaReserva = Number(lote.quantidade_disponivel) - Number(lote.quantidade_reservada) + currentReservationSameSolicitacao;

    if (requestedQty > saldoLivreParaNovaReserva) {
      throw createValidationError('Saldo insuficiente para reservar o lote informado.', {
        field: 'reservas.quantidade_reservada',
        lote_id: loteId,
      });
    }
  }

  const hasPendingReserve = [...requestedPorLote.values()].some((value) => value > 0);

  let reservaId = reservaAtual?.id || null;

  if (!reservaId && !hasPendingReserve) {
    return;
  }

  if (!reservaId) {
    const insertReserva = await client.query(
      `
        INSERT INTO viveiro_reservas (
          protocolo,
          solicitacao_id,
          status,
          observacoes,
          created_by_interno_id,
          updated_by_interno_id
        )
        VALUES ('PENDENTE', $1, 'ativa', $2, $3, $3)
        RETURNING *;
      `,
      [solicitacao.id, input.observacao_analise, user?.id || null]
    );

    reservaId = insertReserva.rows[0].id;
    const protocolo = buildProtocol('VIV-RES', reservaId, insertReserva.rows[0].created_at);

    await client.query(
      `
        UPDATE viveiro_reservas
        SET protocolo = $2
        WHERE id = $1;
      `,
      [reservaId, protocolo]
    );
  }

  for (const item of itensAtuais) {
    const approved = aprovacoesMap.has(Number(item.id))
      ? aprovacoesMap.get(Number(item.id))
      : 0;
    const delivered = Number(item.quantidade_entregue || 0);
    const pendingToReserve = Math.max(0, approved - delivered);
    const reservaInput = reservasMap.get(Number(item.id));
    const reservaAtualItem = reservaItemMap.get(Number(item.id));
    const oldReservedQty = Number(reservaAtualItem?.quantidade_reservada || 0);
    const oldLoteId = reservaAtualItem ? Number(reservaAtualItem.lote_id) : null;

    if (oldLoteId && oldReservedQty > 0) {
      const loteAnterior = await ensureLoteExists(client, oldLoteId, { forUpdate: true });
      await client.query(
        `
          UPDATE viveiro_lotes
          SET
            quantidade_reservada = GREATEST(0, quantidade_reservada - $2),
            updated_by_interno_id = $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [loteAnterior.id, oldReservedQty, user?.id || null]
      );
    }

    if (pendingToReserve > 0) {
      const loteId = Number(reservaInput.lote_id);

      await client.query(
        `
          UPDATE viveiro_lotes
          SET
            quantidade_reservada = quantidade_reservada + $2,
            updated_by_interno_id = $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [loteId, pendingToReserve, user?.id || null]
      );

      if (reservaAtualItem) {
        await client.query(
          `
            UPDATE viveiro_reserva_itens
            SET
              lote_id = $2,
              quantidade_reservada = $3,
              observacoes = $4,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1;
          `,
          [
            reservaAtualItem.id,
            loteId,
            pendingToReserve,
            reservaInput.observacoes,
          ]
        );
      } else {
        await client.query(
          `
            INSERT INTO viveiro_reserva_itens (
              reserva_id,
              solicitacao_item_id,
              especie_id,
              lote_id,
              quantidade_reservada,
              quantidade_atendida,
              observacoes
            )
            VALUES ($1, $2, $3, $4, $5, 0, $6);
          `,
          [
            reservaId,
            item.id,
            item.especie_id,
            loteId,
            pendingToReserve,
            reservaInput.observacoes,
          ]
        );
      }
    } else if (reservaAtualItem) {
      await client.query(
        `
          UPDATE viveiro_reserva_itens
          SET
            quantidade_reservada = 0,
            observacoes = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [reservaAtualItem.id]
      );
    }
  }

  const reservaItensAtualizados = await getReservaItens(client, solicitacao.id);
  const reservaStatus = reservaItensAtualizados.some((item) => Number(item.quantidade_reservada) > 0)
    ? 'ativa'
    : reservaItensAtualizados.some((item) => Number(item.quantidade_atendida) > 0)
      ? 'consumida'
      : 'cancelada';

  await client.query(
    `
      UPDATE viveiro_reservas
      SET
        status = $2,
        observacoes = $3,
        updated_by_interno_id = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `,
    [reservaId, reservaStatus, input.observacao_analise, user?.id || null]
  );
}

exports.listSolicitacoes = async ({ status = '', busca = '', page = null, page_size = null } = {}) => {
  const pagination = normalizePagination({ page, page_size }, { defaultPageSize: 10, maxPageSize: 50 });
  const search = busca ? `%${busca.toLowerCase()}%` : '';
  const params = [status || '', search];
  let paginationSql = '';

  if (pagination.requested) {
    params.push(pagination.offset, pagination.limit);
    paginationSql = `OFFSET $3 LIMIT $4`;
  }

  const result = await db.query(
    `
      WITH base AS (
        SELECT
          s.id,
          s.protocolo,
          s.solicitante_nome,
          s.tipo_solicitante,
          s.instituicao_nome,
          s.origem_solicitacao,
          s.ciencia_solicitante,
          s.status,
          s.finalidade,
          s.created_at,
          t.nome AS territorio_nome,
          COUNT(i.id)::int AS total_itens,
          COALESCE(SUM(i.quantidade_solicitada), 0)::numeric AS quantidade_solicitada_total,
          COALESCE(SUM(i.quantidade_aprovada), 0)::numeric AS quantidade_aprovada_total,
          COALESCE(SUM(i.quantidade_entregue), 0)::numeric AS quantidade_entregue_total,
          COALESCE(SUM(ri.quantidade_reservada), 0)::numeric AS quantidade_reservada_total
        FROM viveiro_solicitacoes s
        LEFT JOIN territorios t ON t.id = s.territorio_id
        LEFT JOIN viveiro_solicitacao_itens i ON i.solicitacao_id = s.id
        LEFT JOIN viveiro_reserva_itens ri ON ri.solicitacao_item_id = i.id
        WHERE ($1::text = '' OR s.status = $1)
          AND (
            $2::text = ''
            OR LOWER(s.protocolo) LIKE $2
            OR LOWER(s.solicitante_nome) LIKE $2
            OR LOWER(COALESCE(s.instituicao_nome, '')) LIKE $2
          )
        GROUP BY s.id, t.nome
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
    quantidade_solicitada_total: Number(row.quantidade_solicitada_total),
    quantidade_aprovada_total: Number(row.quantidade_aprovada_total),
    quantidade_entregue_total: Number(row.quantidade_entregue_total),
    quantidade_reservada_total: Number(row.quantidade_reservada_total),
  }));

  return buildPaginatedResult(items, pagination, result.rows[0]?.total_count || 0);
};

exports.getSolicitacaoDetalhe = async (id) => {
  const solicitacaoId = assertPositiveInteger(id, 'id');
  return getSolicitacaoDetalhe(db, solicitacaoId);
};

exports.createSolicitacao = async (payload, user, req) => {
  const input = validateSolicitacaoPayload(payload);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    if (input.territorio_id) {
      const territorio = await ensureTerritorioExists(client, input.territorio_id);

      if (!territorio) {
        throw createValidationError('Territorio informado nao encontrado.', {
          field: 'territorio_id',
        });
      }
    }

    for (const item of input.itens) {
      const especie = await ensureEspecieExists(client, item.especie_id, { activeOnly: true });
      if (!especie) {
        throw createValidationError('Especie ativa informada na solicitacao nao encontrada.', {
          field: 'itens.especie_id',
          especie_id: item.especie_id,
        });
      }
    }

    const insertResult = await client.query(
      `
        INSERT INTO viveiro_solicitacoes (
          protocolo,
          solicitante_nome,
          solicitante_documento,
          solicitante_email,
          solicitante_telefone,
          tipo_solicitante,
          instituicao_nome,
          finalidade,
          local_plantio,
          territorio_id,
          status,
          observacoes,
          created_by_interno_id
        )
        VALUES ('PENDENTE', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendente', $10, $11)
        RETURNING *;
      `,
      [
        input.solicitante_nome,
        input.solicitante_documento,
        input.solicitante_email,
        input.solicitante_telefone,
        input.tipo_solicitante,
        input.instituicao_nome,
        input.finalidade,
        input.local_plantio,
        input.territorio_id,
        input.observacoes,
        user?.id || null,
      ]
    );

    const solicitacao = insertResult.rows[0];
    const protocolo = buildProtocol('VIV-SOL', solicitacao.id, solicitacao.created_at);

    await client.query(
      `
        UPDATE viveiro_solicitacoes
        SET protocolo = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [solicitacao.id, protocolo]
    );

    for (const item of input.itens) {
      await client.query(
        `
          INSERT INTO viveiro_solicitacao_itens (
            solicitacao_id,
            especie_id,
            quantidade_solicitada,
            observacoes
          )
          VALUES ($1, $2, $3, $4);
        `,
        [solicitacao.id, item.especie_id, item.quantidade_solicitada, item.observacoes]
      );
    }

    await client.query('COMMIT');

    const created = await getSolicitacaoDetalhe(db, solicitacao.id);

    await auditService.logChange({
      ...getActor(user),
      acao: 'viveiro.solicitacao.create',
      entidade: 'viveiro_solicitacoes',
      entidade_id: solicitacao.id,
      before: null,
      after: created,
      req,
    });

    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.analisarSolicitacao = async (id, payload, user, req) => {
  const solicitacaoId = assertPositiveInteger(id, 'id');
  const input = validateAnalisePayload(payload);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const before = await getSolicitacaoDetalhe(client, solicitacaoId);

    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }

    if (!['pendente', 'aprovada_total', 'aprovada_parcial'].includes(before.status)) {
      throw createValidationError('Somente solicitacoes pendentes ou aprovadas podem ser analisadas.');
    }

    const itensAtuais = await getSolicitacaoItens(client, solicitacaoId, { forUpdate: true });
    const itensMap = new Map(itensAtuais.map((item) => [Number(item.id), item]));

    for (const item of input.itens) {
      const current = itensMap.get(Number(item.solicitacao_item_id));

      if (!current) {
        throw createValidationError('Item da solicitacao nao encontrado na analise.', {
          field: 'itens.solicitacao_item_id',
          solicitacao_item_id: item.solicitacao_item_id,
        });
      }

      if (Number(item.quantidade_aprovada) > Number(current.quantidade_solicitada)) {
        throw createValidationError('Quantidade aprovada nao pode superar a quantidade solicitada.', {
          field: 'itens.quantidade_aprovada',
          solicitacao_item_id: item.solicitacao_item_id,
        });
      }
    }

    const aprovacoesMap = new Map(input.itens.map((item) => [Number(item.solicitacao_item_id), Number(item.quantidade_aprovada)]));

    for (const item of itensAtuais) {
      const quantidadeAprovada = aprovacoesMap.has(Number(item.id))
        ? aprovacoesMap.get(Number(item.id))
        : 0;

      if (Number(item.quantidade_entregue) > quantidadeAprovada) {
        throw createValidationError('Nao e possivel aprovar quantidade inferior ao que ja foi entregue.', {
          field: 'itens.quantidade_aprovada',
          solicitacao_item_id: item.id,
        });
      }

      await client.query(
        `
          UPDATE viveiro_solicitacao_itens
          SET
            quantidade_aprovada = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [item.id, quantidadeAprovada]
      );
    }

    const itensAtualizados = await getSolicitacaoItens(client, solicitacaoId);
    const nextStatus = computeApprovedStatus(itensAtualizados);

    await upsertReserva(client, before, user, input, itensAtualizados);

    await client.query(
      `
        UPDATE viveiro_solicitacoes
        SET
          status = $2,
          observacao_analise = $3,
          analisado_por_interno_id = $4,
          analisado_em = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [solicitacaoId, nextStatus, input.observacao_analise, user?.id || null]
    );

    await client.query('COMMIT');

    const after = await getSolicitacaoDetalhe(db, solicitacaoId);

    await auditService.logChange({
      ...getActor(user),
      acao: 'viveiro.solicitacao.analisar',
      entidade: 'viveiro_solicitacoes',
      entidade_id: solicitacaoId,
      before,
      after,
      req,
    });

    return after;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
