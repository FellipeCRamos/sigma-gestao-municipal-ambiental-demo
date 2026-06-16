const auditService = require('../../services/auditService');
const {
  assertPositiveInteger,
  buildPaginatedResult,
  buildProtocol,
  computeApprovedStatus,
  computeLotStatus,
  computePostDeliveryStatus,
  createValidationError,
  db,
  ensureLoteExists,
  getActor,
  getReservaBase,
  getReservaItens,
  getSolicitacaoBase,
  getSolicitacaoDetalhe,
  getSolicitacaoItens,
  insertMovimentacao,
  normalizePagination,
} = require('./shared');
const {
  validateEntregaCancelamentoPayload,
  validateEntregaPayload,
} = require('./viveiroValidators');

function aggregateEntregaItens(itens) {
  return itens.reduce(
    (acc, item) => {
      const quantidade = Number(item.quantidade_entregue);
      const solicitacaoItemId = Number(item.solicitacao_item_id);
      const loteId = Number(item.lote_id);

      acc.quantidadePorSolicitacaoItem.set(
        solicitacaoItemId,
        (acc.quantidadePorSolicitacaoItem.get(solicitacaoItemId) || 0) + quantidade
      );

      acc.quantidadePorLote.set(
        loteId,
        (acc.quantidadePorLote.get(loteId) || 0) + quantidade
      );

      return acc;
    },
    {
      quantidadePorSolicitacaoItem: new Map(),
      quantidadePorLote: new Map(),
    }
  );
}

function computeReservaStatus(reservaItens) {
  if (reservaItens.some((item) => Number(item.quantidade_reservada) > 0)) {
    return 'ativa';
  }

  if (reservaItens.some((item) => Number(item.quantidade_atendida) > 0)) {
    return 'consumida';
  }

  return 'cancelada';
}

async function ensureReservaLegacyFallback(client, solicitacaoId, entregaItem, userId) {
  let reserva = await getReservaBase(client, solicitacaoId, { forUpdate: true });

  if (!reserva) {
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
      [
        solicitacaoId,
        'Reserva de contingencia criada no cancelamento de entrega legada.',
        userId || null,
      ]
    );

    reserva = insertReserva.rows[0];
    const protocolo = buildProtocol('VIV-RES', reserva.id, reserva.created_at);

    await client.query(
      `
        UPDATE viveiro_reservas
        SET protocolo = $2
        WHERE id = $1;
      `,
      [reserva.id, protocolo]
    );
  }

  const existing = await client.query(
    `
      SELECT *
      FROM viveiro_reserva_itens
      WHERE solicitacao_item_id = $1
      FOR UPDATE;
    `,
    [entregaItem.solicitacao_item_id]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await client.query(
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
      VALUES ($1, $2, $3, $4, 0, 0, $5)
      RETURNING *;
    `,
    [
      reserva.id,
      entregaItem.solicitacao_item_id,
      entregaItem.especie_id,
      entregaItem.lote_id,
      'Reserva legada criada para suportar cancelamento com estorno.',
    ]
  );

  return inserted.rows[0];
}

exports.listEntregas = async ({
  solicitacao_id = null,
  status = '',
  busca = '',
  page = null,
  page_size = null,
} = {}) => {
  const pagination = normalizePagination({ page, page_size }, { defaultPageSize: 10, maxPageSize: 50 });
  const search = busca ? `%${String(busca).trim().toLowerCase()}%` : '';
  const params = [solicitacao_id || null, status || '', search];
  let paginationSql = '';

  if (pagination.requested) {
    params.push(pagination.offset, pagination.limit);
    paginationSql = `OFFSET $4 LIMIT $5`;
  }

  const result = await db.query(
    `
      WITH base AS (
        SELECT
          e.*,
          s.protocolo AS solicitacao_protocolo,
          s.solicitante_nome,
          ui.nome AS registrado_por_nome,
          uc.nome AS cancelado_por_nome,
          COALESCE(SUM(i.quantidade_entregue), 0)::numeric AS quantidade_total
        FROM viveiro_entregas e
        INNER JOIN viveiro_solicitacoes s ON s.id = e.solicitacao_id
        LEFT JOIN usuarios_internos ui ON ui.id = e.created_by_interno_id
        LEFT JOIN usuarios_internos uc ON uc.id = e.cancelado_por_interno_id
        LEFT JOIN viveiro_entrega_itens i ON i.entrega_id = e.id
        WHERE ($1::int IS NULL OR e.solicitacao_id = $1)
          AND ($2::text = '' OR e.status = $2)
          AND (
            $3::text = ''
            OR LOWER(e.protocolo) LIKE $3
            OR LOWER(s.protocolo) LIKE $3
            OR LOWER(e.recebedor_nome) LIKE $3
            OR LOWER(s.solicitante_nome) LIKE $3
          )
        GROUP BY e.id, s.protocolo, s.solicitante_nome, ui.nome, uc.nome
      )
      SELECT
        *,
        COUNT(*) OVER()::int AS total_count
      FROM base
      ORDER BY data_entrega DESC, id DESC
      ${paginationSql};
    `,
    params
  );

  const items = result.rows.map((row) => ({
    ...row,
    quantidade_total: Number(row.quantidade_total),
  }));

  return buildPaginatedResult(items, pagination, result.rows[0]?.total_count || 0);
};

exports.getComprovanteEntrega = async (id) => {
  const entregaId = assertPositiveInteger(id, 'id');

  const entregaResult = await db.query(
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
        e.cancelado_em,
        e.motivo_cancelamento,
        s.id AS solicitacao_id,
        s.protocolo AS solicitacao_protocolo,
        s.solicitante_nome,
        s.solicitante_documento,
        s.solicitante_email,
        s.solicitante_telefone,
        s.tipo_solicitante,
        s.instituicao_nome,
        s.finalidade,
        s.local_plantio,
        s.status AS solicitacao_status,
        t.nome AS territorio_nome,
        ui.nome AS registrado_por_nome,
        uc.nome AS cancelado_por_nome
      FROM viveiro_entregas e
      INNER JOIN viveiro_solicitacoes s ON s.id = e.solicitacao_id
      LEFT JOIN territorios t ON t.id = s.territorio_id
      LEFT JOIN usuarios_internos ui ON ui.id = e.created_by_interno_id
      LEFT JOIN usuarios_internos uc ON uc.id = e.cancelado_por_interno_id
      WHERE e.id = $1;
    `,
    [entregaId]
  );

  const entrega = entregaResult.rows[0];

  if (!entrega) {
    return null;
  }

  const itensResult = await db.query(
    `
      SELECT
        ei.id,
        ei.solicitacao_item_id,
        ei.especie_id,
        ei.lote_id,
        ei.quantidade_entregue,
        ei.fator_arvometro_aplicado,
        ei.area_media_m2_aplicada,
        ei.area_estimada_m2,
        ei.observacoes,
        e.nome AS especie_nome,
        e.nome_cientifico,
        e.categoria,
        e.porte,
        e.unidade_medida,
        l.codigo AS lote_codigo,
        l.origem_lote,
        l.local_armazenamento,
        ri.id AS reserva_item_id,
        r.protocolo AS reserva_protocolo
      FROM viveiro_entrega_itens ei
      INNER JOIN viveiro_especies e ON e.id = ei.especie_id
      INNER JOIN viveiro_lotes l ON l.id = ei.lote_id
      LEFT JOIN viveiro_reserva_itens ri ON ri.id = ei.reserva_item_id
      LEFT JOIN viveiro_reservas r ON r.id = ri.reserva_id
      WHERE ei.entrega_id = $1
      ORDER BY ei.id;
    `,
    [entregaId]
  );

  const itens = itensResult.rows.map((item) => ({
    ...item,
    quantidade_entregue: Number(item.quantidade_entregue),
    fator_arvometro_aplicado: Number(item.fator_arvometro_aplicado),
    area_media_m2_aplicada: Number(item.area_media_m2_aplicada),
    area_estimada_m2: Number(item.area_estimada_m2),
  }));

  const quantidadeTotal = itens.reduce((sum, item) => sum + item.quantidade_entregue, 0);
  const areaEstimadaTotalM2 = itens.reduce((sum, item) => sum + item.area_estimada_m2, 0);
  const arvoresEquivalentes = itens.reduce(
    (sum, item) => sum + item.quantidade_entregue * item.fator_arvometro_aplicado,
    0
  );

  return {
    entrega: {
      id: entrega.id,
      protocolo: entrega.protocolo,
      status: entrega.status,
      data_entrega: entrega.data_entrega,
      recebedor_nome: entrega.recebedor_nome,
      recebedor_documento: entrega.recebedor_documento,
      observacoes: entrega.observacoes,
      registrado_por_nome: entrega.registrado_por_nome,
      cancelado_por_nome: entrega.cancelado_por_nome,
      cancelado_em: entrega.cancelado_em,
      motivo_cancelamento: entrega.motivo_cancelamento,
      created_at: entrega.created_at,
    },
    solicitacao: {
      id: entrega.solicitacao_id,
      protocolo: entrega.solicitacao_protocolo,
      status: entrega.solicitacao_status,
      solicitante_nome: entrega.solicitante_nome,
      solicitante_documento: entrega.solicitante_documento,
      solicitante_email: entrega.solicitante_email,
      solicitante_telefone: entrega.solicitante_telefone,
      tipo_solicitante: entrega.tipo_solicitante,
      instituicao_nome: entrega.instituicao_nome,
      finalidade: entrega.finalidade,
      local_plantio: entrega.local_plantio,
      territorio_nome: entrega.territorio_nome,
    },
    itens,
    totais: {
      quantidade_entregue: quantidadeTotal,
      area_estimada_m2: areaEstimadaTotalM2,
      arvores_equivalentes: arvoresEquivalentes,
    },
    guarda_administrativa: {
      tipo_documento: 'comprovante_administrativo_entrega_mudas',
      identificador_documental: entrega.protocolo,
      protocolo_entrega: entrega.protocolo,
      protocolo_solicitacao: entrega.solicitacao_protocolo,
      formato_atual: 'html_imprimivel',
      pdf_nativo_disponivel: false,
      hash_documental_disponivel: false,
      armazenamento_nativo_disponivel: false,
      procedimento_recomendado:
        'Conferir dados, imprimir o comprovante, colher ciencia/assinatura quando aplicavel, digitalizar e entranhar em processo administrativo ou eDocs conforme rotina definida pela SMAD.',
    },
    ciencia_administrativa:
      'Declaro, para fins administrativos internos da SMAD, ciencia do recebimento das mudas listadas neste comprovante. A estimativa de Arvometro e informacao tecnica prudente e nao constitui indicador ambiental certificado.',
  };
};

exports.registrarEntrega = async (payload, user, req) => {
  const input = validateEntregaPayload(payload);
  const solicitacaoId = assertPositiveInteger(input.solicitacao_id, 'solicitacao_id');
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const solicitacao = await getSolicitacaoBase(client, solicitacaoId, { forUpdate: true });

    if (!solicitacao) {
      throw createValidationError('Solicitacao nao encontrada.', { field: 'solicitacao_id' });
    }

    if (!['aprovada_total', 'aprovada_parcial'].includes(solicitacao.status)) {
      throw createValidationError('A entrega exige solicitacao previamente aprovada.');
    }

    const reserva = await getReservaBase(client, solicitacaoId, { forUpdate: true });

    if (!reserva || reserva.status !== 'ativa') {
      throw createValidationError('A entrega exige reserva ativa vinculada a solicitacao aprovada.');
    }

    const itensSolicitacao = await getSolicitacaoItens(client, solicitacaoId, { forUpdate: true });
    const itensMap = new Map(itensSolicitacao.map((item) => [Number(item.id), item]));
    const reservaItens = await getReservaItens(client, solicitacaoId, { forUpdate: true });
    const reservaItemMap = new Map(reservaItens.map((item) => [Number(item.solicitacao_item_id), item]));
    const agregados = aggregateEntregaItens(input.itens);

    for (const [solicitacaoItemId, quantidadeTotal] of agregados.quantidadePorSolicitacaoItem.entries()) {
      const solicitacaoItem = itensMap.get(solicitacaoItemId);
      const reservaItem = reservaItemMap.get(solicitacaoItemId);

      if (!solicitacaoItem) {
        throw createValidationError('Item da solicitacao nao encontrado para entrega.', {
          field: 'itens.solicitacao_item_id',
          solicitacao_item_id: solicitacaoItemId,
        });
      }

      if (!reservaItem) {
        throw createValidationError('O item da solicitacao ainda nao possui reserva formal de estoque.', {
          field: 'itens.solicitacao_item_id',
          solicitacao_item_id: solicitacaoItemId,
        });
      }

      const remainingApproved = Number(solicitacaoItem.quantidade_aprovada) - Number(solicitacaoItem.quantidade_entregue);
      if (remainingApproved <= 0) {
        throw createValidationError('O item selecionado ja foi totalmente entregue.', {
          field: 'itens.quantidade_entregue',
          solicitacao_item_id: solicitacaoItem.id,
        });
      }

      if (quantidadeTotal > remainingApproved) {
        throw createValidationError('Quantidade de entrega acima do saldo aprovado do item.', {
          field: 'itens.quantidade_entregue',
          solicitacao_item_id: solicitacaoItem.id,
        });
      }

      if (quantidadeTotal > Number(reservaItem.quantidade_reservada)) {
        throw createValidationError('Quantidade de entrega acima do saldo reservado do item.', {
          field: 'itens.quantidade_entregue',
          solicitacao_item_id: solicitacaoItem.id,
        });
      }
    }

    for (const item of input.itens) {
      const solicitacaoItemId = Number(item.solicitacao_item_id);
      const solicitacaoItem = itensMap.get(solicitacaoItemId);
      const reservaItem = reservaItemMap.get(solicitacaoItemId);
      const lote = await ensureLoteExists(client, item.lote_id, { forUpdate: true });

      if (!lote) {
        throw createValidationError('Lote nao encontrado para entrega.', {
          field: 'itens.lote_id',
          lote_id: item.lote_id,
        });
      }

      if (lote.status !== 'ativo') {
        throw createValidationError('Somente lotes ativos podem ser usados em entregas.', {
          field: 'itens.lote_id',
          lote_id: item.lote_id,
        });
      }

      if (Number(reservaItem.lote_id) !== Number(item.lote_id)) {
        throw createValidationError('A entrega deve respeitar o lote previamente reservado para o item.', {
          field: 'itens.lote_id',
          solicitacao_item_id: solicitacaoItemId,
        });
      }

      if (Number(lote.especie_id) !== Number(solicitacaoItem.especie_id)) {
        throw createValidationError('Lote informado nao corresponde a especie do item da solicitacao.', {
          field: 'itens.lote_id',
          lote_id: item.lote_id,
        });
      }
    }

    for (const [loteId, quantidadeTotal] of agregados.quantidadePorLote.entries()) {
      const lote = await ensureLoteExists(client, loteId, { forUpdate: true });

      if (Number(lote.quantidade_reservada) < quantidadeTotal) {
        throw createValidationError('Saldo reservado insuficiente para concluir a entrega no lote informado.', {
          field: 'itens.quantidade_entregue',
          lote_id: loteId,
        });
      }

      if (Number(lote.quantidade_disponivel) < quantidadeTotal) {
        throw createValidationError('Saida acima do estoque fisico disponivel do lote.', {
          field: 'itens.quantidade_entregue',
          lote_id: loteId,
        });
      }
    }

    const insertEntregaResult = await client.query(
      `
        INSERT INTO viveiro_entregas (
          protocolo,
          solicitacao_id,
          status,
          data_entrega,
          recebedor_nome,
          recebedor_documento,
          observacoes,
          created_by_interno_id
        )
        VALUES ('PENDENTE', $1, 'concluida', CURRENT_TIMESTAMP, $2, $3, $4, $5)
        RETURNING *;
      `,
      [
        solicitacaoId,
        input.recebedor_nome,
        input.recebedor_documento,
        input.observacoes,
        user?.id || null,
      ]
    );

    const entrega = insertEntregaResult.rows[0];
    const protocoloEntrega = buildProtocol('VIV-ENT', entrega.id, entrega.created_at);

    await client.query(
      `
        UPDATE viveiro_entregas
        SET protocolo = $2
        WHERE id = $1;
      `,
      [entrega.id, protocoloEntrega]
    );

    for (const item of input.itens) {
      const solicitacaoItemId = Number(item.solicitacao_item_id);
      const solicitacaoItem = itensMap.get(solicitacaoItemId);
      const reservaItem = reservaItemMap.get(solicitacaoItemId);
      const lote = await ensureLoteExists(client, item.lote_id, { forUpdate: true });
      const saldoAnterior = Number(lote.quantidade_disponivel);
      const saldoPosterior = saldoAnterior - Number(item.quantidade_entregue);
      const quantidadeReservadaAtual = Number(lote.quantidade_reservada);
      const quantidadeReservadaPosterior = Math.max(0, quantidadeReservadaAtual - Number(item.quantidade_entregue));
      const nextStatus = computeLotStatus(lote.status, saldoPosterior);
      const fatorArvometro = Number(solicitacaoItem.fator_arvometro);
      const areaMediaM2 = Number(solicitacaoItem.area_media_m2);
      const areaEstimada = Number(item.quantidade_entregue) * areaMediaM2;

      await client.query(
        `
          INSERT INTO viveiro_entrega_itens (
            entrega_id,
            solicitacao_item_id,
            especie_id,
            lote_id,
            reserva_item_id,
            quantidade_entregue,
            fator_arvometro_aplicado,
            area_media_m2_aplicada,
            area_estimada_m2,
            observacoes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        `,
        [
          entrega.id,
          solicitacaoItem.id,
          solicitacaoItem.especie_id,
          lote.id,
          reservaItem.id,
          item.quantidade_entregue,
          fatorArvometro,
          areaMediaM2,
          areaEstimada,
          item.observacoes,
        ]
      );

      await client.query(
        `
          UPDATE viveiro_solicitacao_itens
          SET
            quantidade_entregue = quantidade_entregue + $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [solicitacaoItem.id, item.quantidade_entregue]
      );

      await client.query(
        `
          UPDATE viveiro_reserva_itens
          SET
            quantidade_reservada = quantidade_reservada - $2,
            quantidade_atendida = quantidade_atendida + $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [reservaItem.id, item.quantidade_entregue]
      );

      await client.query(
        `
          UPDATE viveiro_lotes
          SET
            quantidade_disponivel = $2,
            quantidade_reservada = $3,
            status = $4,
            updated_by_interno_id = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [lote.id, saldoPosterior, quantidadeReservadaPosterior, nextStatus, user?.id || null]
      );

      await insertMovimentacao(client, {
        lote_id: lote.id,
        especie_id: lote.especie_id,
        tipo: 'saida_entrega',
        quantidade: item.quantidade_entregue,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior,
        referencia_tipo: 'entrega',
        referencia_id: entrega.id,
        observacoes: input.observacoes || item.observacoes || `Entrega ${protocoloEntrega}`,
        created_by_interno_id: user?.id || null,
        dados: {
          solicitacao_id: solicitacaoId,
          solicitacao_item_id: solicitacaoItem.id,
          lote_codigo: lote.codigo,
          reserva_item_id: reservaItem.id,
        },
      });
    }

    const itensAtualizados = await getSolicitacaoItens(client, solicitacaoId);
    const reservaItensAtualizados = await getReservaItens(client, solicitacaoId);
    const nextSolicitacaoStatus = computePostDeliveryStatus(itensAtualizados, solicitacao.status);
    const nextReservaStatus = computeReservaStatus(
      reservaItensAtualizados.map((item) => ({
        ...item,
        quantidade_reservada: Number(item.quantidade_reservada),
        quantidade_atendida: Number(item.quantidade_atendida),
      }))
    );

    await client.query(
      `
        UPDATE viveiro_solicitacoes
        SET
          status = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [solicitacaoId, nextSolicitacaoStatus]
    );

    await client.query(
      `
        UPDATE viveiro_reservas
        SET
          status = $2,
          updated_by_interno_id = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [reserva.id, nextReservaStatus, user?.id || null]
    );

    await client.query('COMMIT');

    const solicitacaoAfter = await getSolicitacaoDetalhe(db, solicitacaoId);

    await auditService.log({
      ...getActor(user),
      acao: 'viveiro.entrega.create',
      entidade: 'viveiro_entregas',
      entidade_id: entrega.id,
      dados: {
        protocolo: protocoloEntrega,
        solicitacao_id: solicitacaoId,
        itens: input.itens,
      },
      req,
    });

    await auditService.logChange({
      ...getActor(user),
      acao: 'viveiro.solicitacao.entrega',
      entidade: 'viveiro_solicitacoes',
      entidade_id: solicitacaoId,
      before: solicitacao,
      after: solicitacaoAfter,
      req,
    });

    return {
      entrega_id: entrega.id,
      protocolo: protocoloEntrega,
      solicitacao: solicitacaoAfter,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.cancelarEntrega = async (id, payload, user, req) => {
  const entregaId = assertPositiveInteger(id, 'id');
  const input = validateEntregaCancelamentoPayload(payload);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const entregaResult = await client.query(
      `
        SELECT *
        FROM viveiro_entregas
        WHERE id = $1
        FOR UPDATE;
      `,
      [entregaId]
    );

    const entrega = entregaResult.rows[0];

    if (!entrega) {
      await client.query('ROLLBACK');
      return null;
    }

    if (entrega.status !== 'concluida') {
      throw createValidationError('Somente entregas concluidas podem ser canceladas.');
    }

    const solicitacao = await getSolicitacaoBase(client, entrega.solicitacao_id, { forUpdate: true });
    const before = await getSolicitacaoDetalhe(client, entrega.solicitacao_id);

    const entregaItensResult = await client.query(
      `
        SELECT *
        FROM viveiro_entrega_itens
        WHERE entrega_id = $1
        ORDER BY id
        FOR UPDATE;
      `,
      [entregaId]
    );

    const entregaItens = entregaItensResult.rows;

    for (const entregaItem of entregaItens) {
      const lote = await ensureLoteExists(client, entregaItem.lote_id, { forUpdate: true });
      const saldoAnterior = Number(lote.quantidade_disponivel);
      const saldoPosterior = saldoAnterior + Number(entregaItem.quantidade_entregue);
      const reservaItem = entregaItem.reserva_item_id
        ? (
            await client.query(
              `
                SELECT *
                FROM viveiro_reserva_itens
                WHERE id = $1
                FOR UPDATE;
              `,
              [entregaItem.reserva_item_id]
            )
          ).rows[0]
        : await ensureReservaLegacyFallback(client, entrega.solicitacao_id, entregaItem, user?.id || null);

      await client.query(
        `
          UPDATE viveiro_lotes
          SET
            quantidade_disponivel = $2,
            quantidade_reservada = quantidade_reservada + $3,
            status = $4,
            updated_by_interno_id = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [
          lote.id,
          saldoPosterior,
          entregaItem.quantidade_entregue,
          computeLotStatus(lote.status, saldoPosterior),
          user?.id || null,
        ]
      );

      await client.query(
        `
          UPDATE viveiro_reserva_itens
          SET
            quantidade_reservada = quantidade_reservada + $2,
            quantidade_atendida = GREATEST(0, quantidade_atendida - $2),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [reservaItem.id, entregaItem.quantidade_entregue]
      );

      await client.query(
        `
          UPDATE viveiro_solicitacao_itens
          SET
            quantidade_entregue = GREATEST(0, quantidade_entregue - $2),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `,
        [entregaItem.solicitacao_item_id, entregaItem.quantidade_entregue]
      );

      await insertMovimentacao(client, {
        lote_id: lote.id,
        especie_id: lote.especie_id,
        tipo: 'estorno_entrega',
        quantidade: entregaItem.quantidade_entregue,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior,
        referencia_tipo: 'entrega_cancelada',
        referencia_id: entregaId,
        observacoes: input.motivo_cancelamento,
        created_by_interno_id: user?.id || null,
        dados: {
          solicitacao_id: entrega.solicitacao_id,
          solicitacao_item_id: entregaItem.solicitacao_item_id,
          lote_codigo: lote.codigo,
          reserva_item_id: reservaItem.id,
        },
      });
    }

    const itensAtualizados = await getSolicitacaoItens(client, entrega.solicitacao_id);
    const reservaAtual = await getReservaBase(client, entrega.solicitacao_id, { forUpdate: true });
    const reservaItensAtualizados = await getReservaItens(client, entrega.solicitacao_id, { forUpdate: true });

    await client.query(
      `
        UPDATE viveiro_entregas
        SET
          status = 'cancelada',
          cancelado_por_interno_id = $2,
          cancelado_em = CURRENT_TIMESTAMP,
          motivo_cancelamento = $3
        WHERE id = $1;
      `,
      [entregaId, user?.id || null, input.motivo_cancelamento]
    );

    await client.query(
      `
        UPDATE viveiro_solicitacoes
        SET
          status = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [entrega.solicitacao_id, computeApprovedStatus(itensAtualizados)]
    );

    if (reservaAtual) {
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
        [
          reservaAtual.id,
          computeReservaStatus(
            reservaItensAtualizados.map((item) => ({
              ...item,
              quantidade_reservada: Number(item.quantidade_reservada),
              quantidade_atendida: Number(item.quantidade_atendida),
            }))
          ),
          input.motivo_cancelamento,
          user?.id || null,
        ]
      );
    }

    await client.query('COMMIT');

    const after = await getSolicitacaoDetalhe(db, entrega.solicitacao_id);

    await auditService.logChange({
      ...getActor(user),
      acao: 'viveiro.entrega.cancelar',
      entidade: 'viveiro_entregas',
      entidade_id: entregaId,
      before: entrega,
      after: {
        ...entrega,
        status: 'cancelada',
        motivo_cancelamento: input.motivo_cancelamento,
      },
      dados: {
        solicitacao_id: entrega.solicitacao_id,
      },
      req,
    });

    await auditService.logChange({
      ...getActor(user),
      acao: 'viveiro.solicitacao.estorno_entrega',
      entidade: 'viveiro_solicitacoes',
      entidade_id: entrega.solicitacao_id,
      before,
      after,
      req,
    });

    return {
      entrega_id: entregaId,
      solicitacao: after,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
