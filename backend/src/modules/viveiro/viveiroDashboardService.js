const { db } = require('./shared');

exports.getDashboard = async () => {
  const [totaisResult, statusResult, estoqueResult, movimentosResult, arvometroResult] = await Promise.all([
    db.query(
      `
        WITH estoque AS (
          SELECT
            COALESCE(SUM(quantidade_disponivel - quantidade_reservada) FILTER (WHERE status IN ('ativo', 'esgotado')), 0)::numeric AS mudas_disponiveis,
            COALESCE(SUM(quantidade_reservada) FILTER (WHERE status IN ('ativo', 'esgotado')), 0)::numeric AS mudas_reservadas
          FROM viveiro_lotes
        )
        SELECT
          (SELECT COUNT(*)::int FROM viveiro_especies WHERE status = 'ativo') AS especies_ativas,
          (SELECT COUNT(*)::int FROM viveiro_lotes WHERE status IN ('ativo', 'esgotado')) AS lotes_ativos,
          (SELECT mudas_disponiveis FROM estoque) AS mudas_disponiveis,
          (SELECT mudas_reservadas FROM estoque) AS mudas_reservadas,
          (SELECT COUNT(*)::int FROM viveiro_solicitacoes WHERE status = 'pendente') AS solicitacoes_pendentes,
          (SELECT COUNT(*)::int FROM viveiro_solicitacoes WHERE status IN ('aprovada_total', 'aprovada_parcial')) AS solicitacoes_aprovadas,
          (SELECT COUNT(*)::int FROM viveiro_entregas WHERE status = 'concluida') AS entregas_concluidas;
      `
    ),
    db.query(
      `
        SELECT status, COUNT(*)::int AS total
        FROM viveiro_solicitacoes
        GROUP BY status
        ORDER BY status;
      `
    ),
    db.query(
      `
        SELECT
          e.id,
          e.nome,
          e.unidade_medida,
          e.estoque_minimo_alerta,
          COALESCE(SUM(l.quantidade_disponivel) FILTER (WHERE l.status IN ('ativo', 'esgotado')), 0)::numeric AS estoque_fisico,
          COALESCE(SUM(l.quantidade_reservada) FILTER (WHERE l.status IN ('ativo', 'esgotado')), 0)::numeric AS estoque_reservado
        FROM viveiro_especies e
        LEFT JOIN viveiro_lotes l ON l.especie_id = e.id
        WHERE e.status = 'ativo'
        GROUP BY e.id
        ORDER BY (COALESCE(SUM(l.quantidade_disponivel) FILTER (WHERE l.status IN ('ativo', 'esgotado')), 0)
          - COALESCE(SUM(l.quantidade_reservada) FILTER (WHERE l.status IN ('ativo', 'esgotado')), 0)) ASC, LOWER(e.nome)
        LIMIT 10;
      `
    ),
    db.query(
      `
        SELECT
          m.id,
          m.tipo,
          m.quantidade,
          m.saldo_posterior,
          m.created_at,
          e.nome AS especie_nome,
          l.codigo AS lote_codigo
        FROM viveiro_movimentacoes m
        INNER JOIN viveiro_especies e ON e.id = m.especie_id
        INNER JOIN viveiro_lotes l ON l.id = m.lote_id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 8;
      `
    ),
    db.query(
      `
        SELECT
          COALESCE(SUM(ei.quantidade_entregue), 0)::numeric AS mudas_entregues,
          COALESCE(SUM(ei.quantidade_entregue * ei.fator_arvometro_aplicado), 0)::numeric AS arvores_equivalentes,
          COALESCE(SUM(ei.area_estimada_m2), 0)::numeric AS area_estimada_m2
        FROM viveiro_entregas e
        INNER JOIN viveiro_entrega_itens ei ON ei.entrega_id = e.id
        WHERE e.status = 'concluida';
      `
    ),
  ]);

  const totais = totaisResult.rows[0];
  const arvometro = arvometroResult.rows[0];

  return {
    totais: {
      especies_ativas: Number(totais.especies_ativas || 0),
      lotes_ativos: Number(totais.lotes_ativos || 0),
      mudas_disponiveis: Number(totais.mudas_disponiveis || 0),
      mudas_reservadas: Number(totais.mudas_reservadas || 0),
      solicitacoes_pendentes: Number(totais.solicitacoes_pendentes || 0),
      solicitacoes_aprovadas: Number(totais.solicitacoes_aprovadas || 0),
      entregas_concluidas: Number(totais.entregas_concluidas || 0),
    },
    solicitacoes_por_status: statusResult.rows,
    estoque_critico: estoqueResult.rows.map((row) => ({
      ...row,
      estoque_fisico: Number(row.estoque_fisico),
      estoque_reservado: Number(row.estoque_reservado),
      estoque_disponivel: Math.max(0, Number(row.estoque_fisico) - Number(row.estoque_reservado)),
      estoque_minimo_alerta: Number(row.estoque_minimo_alerta),
      abaixo_do_minimo: Math.max(0, Number(row.estoque_fisico) - Number(row.estoque_reservado)) <= Number(row.estoque_minimo_alerta),
    })),
    movimentacoes_recentes: movimentosResult.rows.map((row) => ({
      ...row,
      quantidade: Number(row.quantidade),
      saldo_posterior: Number(row.saldo_posterior),
    })),
    arvometro: {
      mudas_entregues: Number(arvometro.mudas_entregues || 0),
      arvores_equivalentes: Number(arvometro.arvores_equivalentes || 0),
      area_estimada_m2: Number(arvometro.area_estimada_m2 || 0),
      metodologia:
        'Estimativa tecnica prudente baseada apenas em entregas concluidas, aplicando fator de arvometro e area media por especie cadastrada.',
    },
  };
};
