const db = require('../config/db');
const auditService = require('./auditService');
const historicoService = require('./operacaoHistoricoService');
const notificacaoService = require('./operacaoNotificacaoService');
const workflowService = require('./operacaoWorkflowService');

const MS_PER_DAY = 86400000;

const ITEM_CONFIG = Object.freeze({
  campanha_inscricao: {
    table: 'campanha_inscricoes',
    idPrefix: '',
    historyType: 'campanha_inscricao',
    titleColumn: 'protocolo',
  },
  ocorrencia: {
    table: 'animal_ocorrencias',
    idPrefix: 'OC-',
    historyType: 'ocorrencia',
    titleColumn: 'titulo',
  },
});

const SLA_RULES = Object.freeze({
  campanha_inscricao: {
    em_analise: { dias: 2, regra: 'campanha_triagem_48h' },
    pendente_documentacao: { dias: 5, regra: 'campanha_pendencia_5d' },
    pre_selecionado: { dias: 3, regra: 'campanha_agendamento_3d' },
    agendado: { dias: 1, regra: 'campanha_atendimento_24h' },
    ausente: { dias: 3, regra: 'campanha_reagendamento_3d' },
  },
  ocorrencia: {
    aberta: { dias: 1, regra: 'ocorrencia_primeira_analise_24h' },
    em_analise: { dias: 3, regra: 'ocorrencia_analise_3d' },
    pendente_informacao: { dias: 5, regra: 'ocorrencia_pendencia_5d' },
    em_atendimento: { dias: 7, regra: 'ocorrencia_atendimento_7d' },
    encaminhada: { dias: 5, regra: 'ocorrencia_encaminhamento_5d' },
  },
});

function validationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getItemConfig(tipoItem) {
  const config = ITEM_CONFIG[tipoItem];

  if (!config) {
    throw validationError('Tipo de item operacional invalido.');
  }

  return config;
}

function daysSince(value) {
  if (!value) return 0;

  const startedAt = new Date(value).getTime();
  const now = Date.now();

  if (!Number.isFinite(startedAt)) return 0;

  return Math.max(0, Math.floor((now - startedAt) / MS_PER_DAY));
}

function addDays(value, days) {
  const base = value ? new Date(value) : new Date();
  return new Date(base.getTime() + (Number(days || 0) * MS_PER_DAY));
}

function getSlaRule(item) {
  const rule = SLA_RULES[item.tipo_item]?.[item.status];
  return rule || { dias: 7, regra: `${item.tipo_item}_padrao_7d` };
}

function buildSla(item) {
  const workflowFinalizado = item.workflow?.finalizado;

  if (workflowFinalizado) {
    return {
      regra: 'finalizado',
      dias: 0,
      prazo_limite: null,
      situacao: 'finalizado',
      dias_restantes: null,
      vencido: false,
    };
  }

  const rule = getSlaRule(item);
  const base = item.status_operacional_updated_at || item.updated_at || item.created_at;
  const prazoLimite = item.prazo_limite_operacional
    ? new Date(item.prazo_limite_operacional)
    : addDays(base, rule.dias);
  const now = new Date();
  const diffDays = Math.ceil((prazoLimite.getTime() - now.getTime()) / MS_PER_DAY);
  const situacao = diffDays < 0 ? 'vencido' : diffDays <= 1 ? 'atencao' : 'no_prazo';

  return {
    regra: item.sla_regra || rule.regra,
    dias: item.prazo_limite_operacional ? null : rule.dias,
    prazo_limite: prazoLimite.toISOString(),
    situacao,
    dias_restantes: diffDays,
    vencido: situacao === 'vencido',
  };
}

function getCriticidade(item, sla) {
  const dias = daysSince(item.status_operacional_updated_at || item.updated_at || item.created_at);

  if (sla.situacao === 'vencido') return 'alta';
  if (item.pendencia_aberta && dias >= 7) return 'alta';
  if (dias >= 14) return 'alta';
  if (sla.situacao === 'atencao') return 'media';
  if (dias >= 7) return 'media';
  return item.pendencia_aberta ? 'media' : 'baixa';
}

function applyFilters(rows, filters = {}) {
  return rows.filter((row) => {
    const matchesResponsavel =
      !filters.responsavel_id ||
      (filters.responsavel_id === 'sem_responsavel'
        ? !row.responsavel_interno_id
        : Number(row.responsavel_interno_id) === Number(filters.responsavel_id));

    return (
      (!filters.tipo || row.tipo_item === filters.tipo) &&
      (!filters.status || row.status === filters.status) &&
      (!filters.territorio_id || Number(row.territorio_id) === Number(filters.territorio_id)) &&
      (!filters.bairro || String(row.bairro || '').toLowerCase() === String(filters.bairro).toLowerCase()) &&
      (!filters.criticidade || row.criticidade === filters.criticidade) &&
      (!filters.fila || row.fila === filters.fila) &&
      (!filters.sla_situacao || row.sla_situacao === filters.sla_situacao) &&
      (!filters.pendencia || String(row.pendencia_aberta) === String(filters.pendencia)) &&
      matchesResponsavel
    );
  });
}

function withSlaAndCriticidade(base) {
  const sla = buildSla(base);

  return {
    ...base,
    sla,
    sla_situacao: sla.situacao,
    prazo_limite: sla.prazo_limite,
    criticidade: getCriticidade(base, sla),
    antiguidade_dias: daysSince(base.status_operacional_updated_at || base.updated_at || base.created_at),
  };
}

function mapCampanhaItem(row) {
  const workflow = workflowService.buildCampanhaWorkflow(row);
  const base = {
    tipo_item: 'campanha_inscricao',
    modulo: 'campanhas',
    id: row.id,
    identificador: row.protocolo,
    titulo: row.campanha_nome,
    status: row.status,
    status_label: workflow.status_label,
    fila: workflow.fila,
    workflow,
    proximo_passo: workflow.proximo_passo,
    transicoes_permitidas: workflow.transicoes_permitidas,
    opcoes_status: workflow.opcoes_status,
    pessoa_nome: row.usuario_nome,
    animal_nome: row.animal_nome,
    servico: row.servico_desejado,
    pendencia_aberta: Boolean(row.pendencia_aberta),
    pendencia_tipo: row.pendencia_tipo,
    pendencia_descricao: row.pendencia_descricao,
    responsavel_interno_id: row.responsavel_interno_id,
    responsavel_nome: row.responsavel_nome,
    prazo_limite_operacional: row.prazo_limite_operacional,
    sla_regra: row.sla_regra,
    observacao_operacional: row.observacao_operacional,
    agendamento_data: row.agendamento_data,
    territorio_id: row.territorio_id,
    territorio_nome: row.territorio_nome,
    bairro: row.territorio_nome || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status_operacional_updated_at: row.status_operacional_updated_at,
    origem: 'campanha',
  };

  return withSlaAndCriticidade(base);
}

function mapOcorrenciaItem(row) {
  const workflow = workflowService.buildOcorrenciaWorkflow(row);
  const base = {
    tipo_item: 'ocorrencia',
    modulo: 'ocorrencias',
    id: row.id,
    identificador: `OC-${row.id}`,
    titulo: row.titulo,
    status: row.status,
    status_label: workflow.status_label,
    fila: workflow.fila,
    workflow,
    proximo_passo: workflow.proximo_passo,
    transicoes_permitidas: workflow.transicoes_permitidas,
    opcoes_status: workflow.opcoes_status,
    pessoa_nome: row.contato_nome || row.usuario_nome,
    animal_nome: row.animal_nome,
    tipo_ocorrencia: row.tipo,
    pendencia_aberta: Boolean(row.pendencia_aberta),
    pendencia_tipo: row.pendencia_tipo,
    pendencia_descricao: row.pendencia_descricao,
    responsavel_interno_id: row.responsavel_interno_id,
    responsavel_nome: row.responsavel_nome,
    prazo_limite_operacional: row.prazo_limite_operacional,
    sla_regra: row.sla_regra,
    observacao_operacional: row.observacao_operacional,
    territorio_id: row.territorio_id,
    territorio_nome: row.territorio_nome,
    bairro: row.territorio_nome || row.bairro,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status_operacional_updated_at: row.status_operacional_updated_at,
    origem: 'ocorrencia',
  };

  return withSlaAndCriticidade(base);
}

async function maybeNotifySlaItems(items) {
  const notifiableItems = items.filter((item) => (
    item.responsavel_interno_id &&
    ['atencao', 'vencido'].includes(item.sla_situacao)
  ));

  await Promise.all(notifiableItems.map((item) => notificacaoService.createOncePerDay({
    usuario_interno_id: item.responsavel_interno_id,
    tipo: `sla_${item.sla_situacao}`,
    titulo: item.sla_situacao === 'vencido' ? 'Item operacional vencido' : 'Item operacional perto do prazo',
    mensagem: `${item.identificador} - ${item.titulo || item.status_label} esta ${item.sla_situacao === 'vencido' ? 'vencido' : 'em atencao'} na fila ${item.fila}.`,
    tipo_item: item.tipo_item,
    item_id: item.id,
    dados: {
      status: item.status,
      fila: item.fila,
      prazo_limite: item.prazo_limite,
      sla_situacao: item.sla_situacao,
    },
  })));
}

async function getItemForUpdate(client, tipoItem, itemId) {
  const config = getItemConfig(tipoItem);
  const result = await client.query(
    `
      SELECT *
      FROM ${config.table}
      WHERE id = $1
      FOR UPDATE;
    `,
    [itemId]
  );

  return result.rows[0] || null;
}

async function assertResponsavelExiste(client, responsavelId) {
  if (!responsavelId) return null;

  const result = await client.query(
    `
      SELECT id, nome, email
      FROM usuarios_internos
      WHERE id = $1
        AND status = 'ativo';
    `,
    [responsavelId]
  );

  if (!result.rows[0]) {
    throw validationError('Responsavel interno nao encontrado ou inativo.');
  }

  return result.rows[0];
}

function buildAssignmentNotification(item, tipoItem, responsavel) {
  const label = tipoItem === 'campanha_inscricao'
    ? item.protocolo || `Inscricao #${item.id}`
    : `Ocorrencia #${item.id}`;

  return {
    usuario_interno_id: responsavel.id,
    tipo: 'atribuicao_responsavel',
    titulo: 'Item atribuido a voce',
    mensagem: `${label} foi atribuido para seu acompanhamento operacional.`,
    tipo_item: tipoItem,
    item_id: item.id,
    dados: {
      status: item.status,
      responsavel_nome: responsavel.nome,
    },
  };
}

exports.getFilaOperacional = async (filters = {}) => {
  const [campanhasResult, ocorrenciasResult] = await Promise.all([
    db.query(`
      SELECT
        i.id,
        i.protocolo,
        i.status,
        i.servico_desejado,
        i.animal_nome,
        i.territorio_id,
        i.agendamento_data,
        i.pendencia_aberta,
        i.pendencia_tipo,
        i.pendencia_descricao,
        i.responsavel_interno_id,
        i.prazo_limite_operacional,
        i.sla_regra,
        i.observacao_operacional,
        i.status_operacional_updated_at,
        i.created_at,
        i.updated_at,
        c.nome AS campanha_nome,
        tr.nome AS territorio_nome,
        u.nome AS usuario_nome,
        r.nome AS responsavel_nome
      FROM campanha_inscricoes i
      JOIN campanhas c ON c.id = i.campanha_id
      LEFT JOIN territorios tr ON tr.id = i.territorio_id
      JOIN usuarios_externos u ON u.id = i.usuario_id
      LEFT JOIN usuarios_internos r ON r.id = i.responsavel_interno_id
      WHERE i.status IN (
        'em_analise',
        'pendente_documentacao',
        'pre_selecionado',
        'agendado',
        'ausente'
      )
      ORDER BY COALESCE(i.status_operacional_updated_at, i.updated_at, i.created_at) ASC, i.id ASC
      LIMIT 200;
    `),
    db.query(`
      SELECT
        o.id,
        o.tipo,
        o.status,
        o.titulo,
        COALESCE(tr.nome, o.bairro) AS bairro,
        o.territorio_id,
        tr.nome AS territorio_nome,
        o.contato_nome,
        o.pendencia_aberta,
        o.pendencia_tipo,
        o.pendencia_descricao,
        o.responsavel_interno_id,
        o.prazo_limite_operacional,
        o.sla_regra,
        o.observacao_operacional,
        o.status_operacional_updated_at,
        o.created_at,
        o.updated_at,
        a.nome AS animal_nome,
        u.nome AS usuario_nome,
        r.nome AS responsavel_nome
      FROM animal_ocorrencias o
      LEFT JOIN territorios tr ON tr.id = o.territorio_id
      LEFT JOIN animais a ON a.id = o.animal_id
      LEFT JOIN usuarios_externos u ON u.id = o.usuario_externo_id
      LEFT JOIN usuarios_internos r ON r.id = o.responsavel_interno_id
      WHERE o.status IN (
        'aberta',
        'em_analise',
        'pendente_informacao',
        'em_atendimento',
        'encaminhada'
      )
      ORDER BY COALESCE(o.status_operacional_updated_at, o.updated_at, o.created_at) ASC, o.id ASC
      LIMIT 200;
    `),
  ]);

  const rows = [
    ...campanhasResult.rows.map(mapCampanhaItem),
    ...ocorrenciasResult.rows.map(mapOcorrenciaItem),
  ].sort((a, b) => (
    (b.criticidade === 'alta') - (a.criticidade === 'alta') ||
    b.antiguidade_dias - a.antiguidade_dias ||
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  ));

  await maybeNotifySlaItems(rows);

  return applyFilters(rows, filters);
};

exports.getResumoOperacional = async () => {
  const [campanhasResult, ocorrenciasResult] = await Promise.all([
    db.query(`
      SELECT status, COUNT(*)::int AS total
      FROM campanha_inscricoes
      GROUP BY status;
    `),
    db.query(`
      SELECT status, COUNT(*)::int AS total
      FROM animal_ocorrencias
      GROUP BY status;
    `),
  ]);

  const campanhas = campanhasResult.rows.reduce((acc, row) => {
    acc[row.status] = row.total;
    return acc;
  }, {});
  const ocorrencias = ocorrenciasResult.rows.reduce((acc, row) => {
    acc[row.status] = row.total;
    return acc;
  }, {});
  const fila = await exports.getFilaOperacional();
  const porResponsavel = fila.reduce((acc, item) => {
    const key = item.responsavel_nome || 'Sem responsavel';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    campanhas: {
      por_status: campanhas,
      pendentes_triagem: campanhas.em_analise || 0,
      com_pendencia: campanhas.pendente_documentacao || 0,
      aptas_agendamento: campanhas.pre_selecionado || 0,
      agendadas: campanhas.agendado || 0,
      aguardando_reagendamento: campanhas.ausente || 0,
    },
    ocorrencias: {
      por_status: ocorrencias,
      recebidas: ocorrencias.aberta || 0,
      em_analise: ocorrencias.em_analise || 0,
      em_atendimento: ocorrencias.em_atendimento || 0,
      pendentes_informacao: ocorrencias.pendente_informacao || 0,
      encaminhadas: ocorrencias.encaminhada || 0,
    },
    fila: {
      total: fila.length,
      alta_criticidade: fila.filter((item) => item.criticidade === 'alta').length,
      pendencias_abertas: fila.filter((item) => item.pendencia_aberta).length,
      campanhas: fila.filter((item) => item.tipo_item === 'campanha_inscricao').length,
      ocorrencias: fila.filter((item) => item.tipo_item === 'ocorrencia').length,
      vencidos: fila.filter((item) => item.sla_situacao === 'vencido').length,
      em_atencao: fila.filter((item) => item.sla_situacao === 'atencao').length,
      sem_responsavel: fila.filter((item) => !item.responsavel_interno_id).length,
      por_responsavel: porResponsavel,
    },
    observacao:
      'Fila operacional calculada a partir de status governados por matriz; SLA inicial usa regras operacionais em codigo e prazo manual quando informado.',
  };
};

exports.listResponsaveis = async () => {
  const result = await db.query(`
    SELECT id, nome, email, perfil
    FROM usuarios_internos
    WHERE status = 'ativo'
    ORDER BY nome ASC, email ASC;
  `);

  return result.rows;
};

exports.assignResponsavel = async (tipoItem, itemId, data, actor, req = null) => {
  const config = getItemConfig(tipoItem);
  const responsavelId = data.responsavel_interno_id ? Number(data.responsavel_interno_id) : null;
  const client = await db.connect();
  let before = null;
  let updated = null;
  let responsavel = null;

  try {
    await client.query('BEGIN');

    before = await getItemForUpdate(client, tipoItem, itemId);

    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }

    responsavel = await assertResponsavelExiste(client, responsavelId);

    const result = await client.query(
      `
        UPDATE ${config.table}
        SET
          responsavel_interno_id = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
      `,
      [responsavelId, itemId]
    );

    updated = result.rows[0];

    await historicoService.logWithClient(client, {
      tipo_item: tipoItem,
      item_id: itemId,
      evento: responsavelId ? 'atribuicao_responsavel' : 'desatribuicao_responsavel',
      status_anterior: before.status,
      status_novo: updated.status,
      responsavel_anterior_id: before.responsavel_interno_id,
      responsavel_novo_id: updated.responsavel_interno_id,
      prazo_anterior: before.prazo_limite_operacional,
      prazo_novo: updated.prazo_limite_operacional,
      pendencia_aberta: updated.pendencia_aberta,
      observacao: data.observacao || null,
      dados: {
        responsavel_nome: responsavel?.nome || null,
      },
      created_by_interno_id: actor?.id || null,
    });

    if (responsavelId) {
      await notificacaoService.createWithClient(
        client,
        buildAssignmentNotification(updated, tipoItem, responsavel)
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor?.id,
    acao: 'atribuir_responsavel_operacional',
    entidade: config.table,
    entidade_id: itemId,
    before,
    after: updated,
    dados: {
      tipo_item: tipoItem,
      responsavel_anterior_id: before.responsavel_interno_id,
      responsavel_novo_id: updated.responsavel_interno_id,
      observacao: data.observacao || null,
    },
    req,
  });

  return updated;
};

exports.updatePrazo = async (tipoItem, itemId, data, actor, req = null) => {
  const config = getItemConfig(tipoItem);
  const prazo = data.prazo_limite_operacional ? new Date(data.prazo_limite_operacional) : null;

  if (prazo && !Number.isFinite(prazo.getTime())) {
    throw validationError('Prazo operacional invalido.');
  }

  const client = await db.connect();
  let before = null;
  let updated = null;

  try {
    await client.query('BEGIN');

    before = await getItemForUpdate(client, tipoItem, itemId);

    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }

    const result = await client.query(
      `
        UPDATE ${config.table}
        SET
          prazo_limite_operacional = $1,
          sla_regra = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *;
      `,
      [prazo ? prazo.toISOString() : null, prazo ? 'manual' : null, itemId]
    );

    updated = result.rows[0];

    await historicoService.logWithClient(client, {
      tipo_item: tipoItem,
      item_id: itemId,
      evento: prazo ? 'prazo_atualizado' : 'prazo_removido',
      status_anterior: before.status,
      status_novo: updated.status,
      responsavel_anterior_id: before.responsavel_interno_id,
      responsavel_novo_id: updated.responsavel_interno_id,
      prazo_anterior: before.prazo_limite_operacional,
      prazo_novo: updated.prazo_limite_operacional,
      pendencia_aberta: updated.pendencia_aberta,
      observacao: data.observacao || null,
      dados: {
        sla_regra: updated.sla_regra,
      },
      created_by_interno_id: actor?.id || null,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor?.id,
    acao: 'atualizar_prazo_operacional',
    entidade: config.table,
    entidade_id: itemId,
    before,
    after: updated,
    dados: {
      tipo_item: tipoItem,
      prazo_anterior: before.prazo_limite_operacional,
      prazo_novo: updated.prazo_limite_operacional,
      observacao: data.observacao || null,
    },
    req,
  });

  return updated;
};

exports.createObservacao = async (tipoItem, itemId, data, actor, req = null) => {
  const config = getItemConfig(tipoItem);
  const observacao = String(data.observacao || '').trim();

  if (!observacao || observacao.length < 3) {
    throw validationError('Informe uma observacao operacional com pelo menos 3 caracteres.');
  }

  const client = await db.connect();
  let before = null;
  let updated = null;

  try {
    await client.query('BEGIN');

    before = await getItemForUpdate(client, tipoItem, itemId);

    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }

    const result = await client.query(
      `
        UPDATE ${config.table}
        SET
          observacao_operacional = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
      `,
      [observacao, itemId]
    );

    updated = result.rows[0];

    await historicoService.logWithClient(client, {
      tipo_item: tipoItem,
      item_id: itemId,
      evento: 'observacao_operacional',
      status_anterior: before.status,
      status_novo: updated.status,
      responsavel_anterior_id: before.responsavel_interno_id,
      responsavel_novo_id: updated.responsavel_interno_id,
      prazo_anterior: before.prazo_limite_operacional,
      prazo_novo: updated.prazo_limite_operacional,
      pendencia_aberta: updated.pendencia_aberta,
      observacao,
      dados: {},
      created_by_interno_id: actor?.id || null,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor?.id,
    acao: 'registrar_observacao_operacional',
    entidade: config.table,
    entidade_id: itemId,
    before,
    after: updated,
    dados: {
      tipo_item: tipoItem,
      observacao,
    },
    req,
  });

  return updated;
};

exports.getHistorico = async (tipoItem, itemId) => {
  getItemConfig(tipoItem);
  return historicoService.findByItem(tipoItem, itemId);
};

exports.getMinhasNotificacoes = async (usuarioInternoId) => {
  return notificacaoService.findByUsuario(usuarioInternoId);
};
