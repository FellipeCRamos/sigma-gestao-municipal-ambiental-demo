const db = require('../config/db');
const auditService = require('./auditService');
const historicoOperacionalService = require('./operacaoHistoricoService');
const notificacaoOperacionalService = require('./operacaoNotificacaoService');
const workflowService = require('./operacaoWorkflowService');
const territorioService = require('./territorioService');

exports.create = async (data, actor) => {
  const territorialData = await territorioService.enrichTerritorioPayload(data);

  const result = await db.query(
    `
      INSERT INTO animal_ocorrencias (
        animal_id,
        usuario_externo_id,
        tipo,
        status,
        titulo,
        descricao,
        bairro,
        territorio_id,
        territorio_origem,
        endereco_referencia,
        latitude,
        longitude,
        contato_nome,
        contato_telefone,
        contato_email,
        created_by_interno_id
      )
      VALUES (
        $1, $2, $3, 'aberta', $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15
      )
      RETURNING *;
    `,
    [
      territorialData.animal_id || null,
      actor?.tipo === 'externo' ? actor.id : territorialData.usuario_externo_id || null,
      territorialData.tipo,
      territorialData.titulo,
      territorialData.descricao,
      territorialData.bairro || null,
      territorialData.territorio_id || null,
      territorialData.territorio_origem || 'nao_informado',
      territorialData.endereco_referencia || null,
      territorialData.latitude ?? null,
      territorialData.longitude ?? null,
      territorialData.contato_nome || null,
      territorialData.contato_telefone || null,
      territorialData.contato_email || null,
      actor?.tipo === 'interno' ? actor.id : null
    ]
  );

  const ocorrencia = result.rows[0];

  await auditService.log({
    ator_tipo: actor?.tipo || 'sistema',
    ator_id: actor?.id || null,
    acao: 'criar_ocorrencia_animal',
    entidade: 'animal_ocorrencias',
    entidade_id: ocorrencia.id,
    dados: {
      tipo: ocorrencia.tipo,
      status: ocorrencia.status,
      bairro: ocorrencia.bairro
    }
  });

  await historicoOperacionalService.log({
    tipo_item: 'ocorrencia',
    item_id: ocorrencia.id,
    evento: 'criacao_item',
    status_novo: ocorrencia.status,
    pendencia_aberta: false,
    observacao: 'Ocorrencia registrada no SIGBA.',
    dados: {
      tipo: ocorrencia.tipo,
      bairro: ocorrencia.bairro,
      ator_tipo: actor?.tipo || 'sistema',
      ator_id: actor?.id || null
    },
    created_by_interno_id: actor?.tipo === 'interno' ? actor.id : null
  });

  return ocorrencia;
};

exports.findAll = async () => {
  const result = await db.query(`
    SELECT
      o.*,
      tr.nome AS territorio_nome,
      tr.categoria AS territorio_categoria,
      a.nome AS animal_nome,
      a.especie AS animal_especie,
      u.nome AS usuario_nome,
      u.telefone AS usuario_telefone,
      u.email AS usuario_email,
      ui.nome AS responsavel_interno_nome
    FROM animal_ocorrencias o
    LEFT JOIN territorios tr ON tr.id = o.territorio_id
    LEFT JOIN animais a ON a.id = o.animal_id
    LEFT JOIN usuarios_externos u ON u.id = o.usuario_externo_id
    LEFT JOIN usuarios_internos ui ON ui.id = o.created_by_interno_id
    ORDER BY o.created_at DESC, o.id DESC;
  `);

  return result.rows.map((row) => ({
    ...row,
    workflow: workflowService.buildOcorrenciaWorkflow(row),
  }));
};

exports.findByUsuario = async (usuarioId) => {
  const result = await db.query(
    `
      SELECT
        o.*,
        tr.nome AS territorio_nome,
        tr.categoria AS territorio_categoria,
        a.nome AS animal_nome,
        a.especie AS animal_especie
      FROM animal_ocorrencias o
      LEFT JOIN territorios tr ON tr.id = o.territorio_id
      LEFT JOIN animais a ON a.id = o.animal_id
      WHERE o.usuario_externo_id = $1
      ORDER BY o.created_at DESC, o.id DESC;
    `,
    [usuarioId]
  );

  return result.rows;
};

exports.updateStatus = async (id, data, actor, req = null) => {
  const beforeResult = await db.query(
    `
      SELECT *
      FROM animal_ocorrencias
      WHERE id = $1;
    `,
    [id]
  );
  const before = beforeResult.rows[0] || null;

  if (!before) {
    return null;
  }

  const transition = workflowService.validateOcorrenciaTransition(before.status, data.status, data);
  const nextPendenciaAberta = data.status === workflowService.OCORRENCIA_STATUS.PENDENTE_INFORMACAO;
  const nextPendenciaTipo = nextPendenciaAberta ? data.pendencia_tipo || 'informacao' : null;
  const nextPendenciaDescricao = nextPendenciaAberta
    ? data.pendencia_descricao || data.resolucao || null
    : null;
  const nextIsFinal = workflowService.OCORRENCIA_FINAL_STATUS.includes(data.status);
  const nextDesfecho = nextIsFinal ? data.desfecho || data.status : null;
  const nextMotivoDesfecho = nextIsFinal
    ? data.motivo_desfecho || data.resolucao || null
    : null;
  const nextResponsavelId = before.responsavel_interno_id || actor?.id || null;

  const result = await db.query(
    `
      UPDATE animal_ocorrencias
      SET
        status = $1::varchar,
        resolucao = $2,
        pendencia_tipo = $3,
        pendencia_descricao = $4,
        pendencia_aberta = $5,
        desfecho = $6,
        motivo_desfecho = $7,
        responsavel_interno_id = $8,
        status_operacional_updated_at = CURRENT_TIMESTAMP,
        encerrada_em = CASE WHEN $1::varchar IN ('resolvida', 'cancelada', 'arquivada') THEN COALESCE(encerrada_em, CURRENT_TIMESTAMP) ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *;
    `,
    [
      data.status,
      data.resolucao || null,
      nextPendenciaTipo,
      nextPendenciaDescricao,
      nextPendenciaAberta,
      nextDesfecho,
      nextMotivoDesfecho,
      nextResponsavelId,
      id
    ]
  );

  const ocorrencia = result.rows[0];

  if (!ocorrencia) {
    return null;
  }

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor?.id,
    acao: 'atualizar_status_ocorrencia',
    entidade: 'animal_ocorrencias',
    entidade_id: ocorrencia.id,
    before,
    after: ocorrencia,
    dados: {
      status_anterior: before.status,
      status: ocorrencia.status,
      transicao_permitida: transition.allowed,
      resolucao: ocorrencia.resolucao,
      pendencia_aberta: ocorrencia.pendencia_aberta,
      pendencia_tipo: ocorrencia.pendencia_tipo,
      desfecho: ocorrencia.desfecho
    },
    req
  });

  await historicoOperacionalService.log({
    tipo_item: 'ocorrencia',
    item_id: ocorrencia.id,
    evento: before.status === ocorrencia.status ? 'atualizacao_operacional' : 'mudanca_status',
    status_anterior: before.status,
    status_novo: ocorrencia.status,
    responsavel_anterior_id: before.responsavel_interno_id,
    responsavel_novo_id: ocorrencia.responsavel_interno_id,
    prazo_anterior: before.prazo_limite_operacional,
    prazo_novo: ocorrencia.prazo_limite_operacional,
    pendencia_aberta: ocorrencia.pendencia_aberta,
    observacao: data.resolucao || data.pendencia_descricao || null,
    dados: {
      transicoes_permitidas: transition.allowed,
      desfecho: ocorrencia.desfecho,
      motivo_desfecho: ocorrencia.motivo_desfecho
    },
    created_by_interno_id: actor?.id || null
  });

  if (
    ocorrencia.responsavel_interno_id &&
    [
      workflowService.OCORRENCIA_STATUS.PENDENTE_INFORMACAO,
      workflowService.OCORRENCIA_STATUS.EM_ATENDIMENTO,
      workflowService.OCORRENCIA_STATUS.ENCAMINHADA
    ].includes(ocorrencia.status)
  ) {
    await notificacaoOperacionalService.create({
      usuario_interno_id: ocorrencia.responsavel_interno_id,
      tipo: `ocorrencia_${ocorrencia.status}`,
      titulo: 'Atualizacao operacional de ocorrencia',
      mensagem: `Ocorrencia #${ocorrencia.id} mudou para ${workflowService.OCORRENCIA_STATUS_LABELS[ocorrencia.status] || ocorrencia.status}.`,
      tipo_item: 'ocorrencia',
      item_id: ocorrencia.id,
      dados: {
        status: ocorrencia.status,
        pendencia_aberta: ocorrencia.pendencia_aberta
      }
    });
  }

  return {
    ...ocorrencia,
    workflow: workflowService.buildOcorrenciaWorkflow(ocorrencia),
  };
};

exports.getTerritorialSummary = async () => {
  const result = await db.query(`
    WITH bairros AS (
      SELECT
        COALESCE(ta.nome, tt.nome, NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), ''), 'Nao informado') AS bairro,
        COUNT(a.id)::int AS animais,
        COUNT(a.id) FILTER (WHERE a.castrado = true)::int AS castrados,
        COUNT(a.id) FILTER (WHERE a.vacinado = true)::int AS vacinados,
        COUNT(a.id) FILTER (WHERE a.microchip IS NOT NULL AND TRIM(a.microchip) <> '')::int AS microchipados
      FROM animais a
      LEFT JOIN tutores t ON t.id = a.tutor_id
      LEFT JOIN territorios ta ON ta.id = a.territorio_id
      LEFT JOIN territorios tt ON tt.id = t.territorio_id
      GROUP BY 1
    ),
    ocorrencias AS (
      SELECT
        COALESCE(tr.nome, NULLIF(TRIM(o.bairro), ''), 'Nao informado') AS bairro,
        COUNT(*)::int AS ocorrencias,
        COUNT(*) FILTER (WHERE status = 'aberta')::int AS ocorrencias_abertas
      FROM animal_ocorrencias o
      LEFT JOIN territorios tr ON tr.id = o.territorio_id
      GROUP BY 1
    )
    SELECT
      COALESCE(b.bairro, o.bairro) AS bairro,
      COALESCE(b.animais, 0)::int AS animais,
      COALESCE(b.castrados, 0)::int AS castrados,
      COALESCE(b.vacinados, 0)::int AS vacinados,
      COALESCE(b.microchipados, 0)::int AS microchipados,
      COALESCE(o.ocorrencias, 0)::int AS ocorrencias,
      COALESCE(o.ocorrencias_abertas, 0)::int AS ocorrencias_abertas
    FROM bairros b
    FULL OUTER JOIN ocorrencias o ON o.bairro = b.bairro
    ORDER BY ocorrencias_abertas DESC, animais DESC, bairro ASC;
  `);

  return result.rows;
};
