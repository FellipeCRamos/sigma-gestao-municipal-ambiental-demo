const {
  db,
  auditService,
  animalVacinaService,
  historicoOperacionalService,
  notificacaoOperacionalService,
  workflowService,
  territorioService,
  webPushService,
  logger,
  toJsonb,
  generateProtocolo,
  buildStatusNotification,
  getNotificationMetadata,
  createNotification,
  ensureTutorFromInscricao,
  ensureAnimalFromInscricao,
} = require('./shared');

exports.updateInscricaoStatus = async (id, data, actor, req = null) => {
  const client = await db.connect();
  let updated = null;
  let auditPayload = null;
  let beforeAudit = null;
  let createdNotification = null;
  const hasVacinacoesAplicadas = Object.prototype.hasOwnProperty.call(data, 'vacinacoes_aplicadas');

  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      `
        SELECT *
        FROM campanha_inscricoes
        WHERE id = $1
        FOR UPDATE;
      `,
      [id]
    );

    const current = currentResult.rows[0];
    beforeAudit = current;

    if (!current) {
      await client.query('ROLLBACK');
      return null;
    }

    const transition = workflowService.validateCampanhaTransition(current.status, data.status, {
      ...data,
      agendamento_data: data.agendamento_data || current.agendamento_data || null,
    });
    const nextPendenciaAberta = data.status === workflowService.CAMPANHA_STATUS.PENDENTE_DOCUMENTACAO;
    const nextPendenciaTipo = nextPendenciaAberta
      ? data.pendencia_tipo || 'informacao_documento'
      : null;
    const nextPendenciaDescricao = nextPendenciaAberta
      ? data.pendencia_descricao || data.observacoes_tecnicas || null
      : null;
    const nextIsFinal = workflowService.CAMPANHA_FINAL_STATUS.includes(data.status);
    const nextDesfecho = nextIsFinal ? data.desfecho || data.status : null;
    const nextMotivoDesfecho = nextIsFinal
      ? data.motivo_desfecho || data.resultado_operacional || data.observacoes_tecnicas || null
      : null;
    const nextResponsavelId = current.responsavel_interno_id || actor.id;

    if (hasVacinacoesAplicadas && current.servico_desejado === 'vacinacao' && data.status === 'atendido') {
      await animalVacinaService.validateCampanhaAtendimentoPayload(
        data.vacinacoes_aplicadas,
        data.agendamento_data || current.agendamento_data
      );
    }

    const result = await client.query(
      `
        UPDATE campanha_inscricoes
        SET
          status = $1,
          agendamento_data = $2,
          observacoes_tecnicas = $3,
          resultado_operacional = $4,
          pendencia_tipo = $5,
          pendencia_descricao = $6,
          pendencia_aberta = $7,
          desfecho = $8,
          motivo_desfecho = $9,
          responsavel_interno_id = $10,
          status_operacional_updated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING *;
      `,
      [
        data.status,
        data.agendamento_data || null,
        data.observacoes_tecnicas || null,
        data.resultado_operacional || null,
        nextPendenciaTipo,
        nextPendenciaDescricao,
        nextPendenciaAberta,
        nextDesfecho,
        nextMotivoDesfecho,
        nextResponsavelId,
        id
      ]
    );

    updated = result.rows[0];

    if (updated.status === 'atendido') {
      const tutorId = await ensureTutorFromInscricao(client, updated);
      const animalId = await ensureAnimalFromInscricao(client, updated, tutorId);

      const linkedResult = await client.query(
        `
          UPDATE campanha_inscricoes
          SET
            tutor_id = $1,
            animal_id = $2,
            atendimento_confirmado_em = COALESCE(atendimento_confirmado_em, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *;
        `,
        [tutorId, animalId, updated.id]
      );

      updated = linkedResult.rows[0];

      if (current.status !== 'atendido') {
        await client.query(
          `
            INSERT INTO animal_eventos (
              animal_id,
              tutor_id,
              campanha_inscricao_id,
              tipo,
              titulo,
              descricao,
              data_evento,
              dados,
              created_by_interno_id
            )
            VALUES (
              $1, $2, $3, 'campanha', 'Atendimento de campanha',
              $4, CURRENT_TIMESTAMP, $5::jsonb, $6
            );
          `,
          [
            updated.animal_id,
            updated.tutor_id,
            updated.id,
            data.resultado_operacional || 'Atendimento confirmado pela SMAD.',
            JSON.stringify({
              status: updated.status,
              servico_desejado: updated.servico_desejado,
              campanha_id: updated.campanha_id,
              protocolo: updated.protocolo
            }),
            actor.id
          ]
        );
      }
    }

    const notification = buildStatusNotification(updated);
    const notificationMetadata = getNotificationMetadata(updated);
    createdNotification = await createNotification(client, updated.usuario_id, {
      ...notification,
      ...notificationMetadata,
      ref_tipo: 'campanha_inscricoes',
      ref_id: updated.id
    });
    await webPushService.queueNotificationWithClient(client, createdNotification, {
      categoria: notificationMetadata.metadata.categoria_preferencia,
      essencial: notificationMetadata.metadata.comunicacao_essencial
    });

    await historicoOperacionalService.logWithClient(client, {
      tipo_item: 'campanha_inscricao',
      item_id: updated.id,
      evento: current.status === updated.status ? 'atualizacao_operacional' : 'mudanca_status',
      status_anterior: current.status,
      status_novo: updated.status,
      responsavel_anterior_id: current.responsavel_interno_id,
      responsavel_novo_id: updated.responsavel_interno_id,
      prazo_anterior: current.prazo_limite_operacional,
      prazo_novo: updated.prazo_limite_operacional,
      pendencia_aberta: updated.pendencia_aberta,
      observacao: data.observacoes_tecnicas || data.resultado_operacional || data.pendencia_descricao || null,
      dados: {
        transicoes_permitidas: transition.allowed,
        agendamento_data: updated.agendamento_data,
        desfecho: updated.desfecho,
        motivo_desfecho: updated.motivo_desfecho
      },
      created_by_interno_id: actor.id
    });

    if (
      updated.responsavel_interno_id &&
      [workflowService.CAMPANHA_STATUS.PENDENTE_DOCUMENTACAO, workflowService.CAMPANHA_STATUS.AGENDADO, workflowService.CAMPANHA_STATUS.AUSENTE].includes(updated.status)
    ) {
      await notificacaoOperacionalService.createWithClient(client, {
        usuario_interno_id: updated.responsavel_interno_id,
        tipo: `campanha_${updated.status}`,
        titulo: 'Atualizacao operacional de campanha',
        mensagem: `${updated.protocolo} mudou para ${workflowService.CAMPANHA_STATUS_LABELS[updated.status] || updated.status}.`,
        tipo_item: 'campanha_inscricao',
        item_id: updated.id,
        dados: {
          status: updated.status,
          protocolo: updated.protocolo,
          pendencia_aberta: updated.pendencia_aberta
        }
      });
    }

    auditPayload = {
      status_anterior: current.status,
      status_novo: updated.status,
      transicao_permitida: transition.allowed,
      agendamento_data: updated.agendamento_data,
      pendencia_aberta: updated.pendencia_aberta,
      pendencia_tipo: updated.pendencia_tipo,
      desfecho: updated.desfecho,
      observacoes_tecnicas: updated.observacoes_tecnicas,
      resultado_operacional: updated.resultado_operacional,
      tutor_id: updated.tutor_id,
      animal_id: updated.animal_id,
      vacinacoes_aplicadas_total:
        hasVacinacoesAplicadas && Array.isArray(data.vacinacoes_aplicadas)
          ? data.vacinacoes_aplicadas.length
          : undefined
    };

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor.id,
    acao: 'atualizar_status_inscricao',
    entidade: 'campanha_inscricoes',
    entidade_id: updated.id,
    before: beforeAudit,
    after: updated,
    dados: auditPayload,
    req
  });

  if (createdNotification) {
    try {
      await webPushService.deliverPending({ notificacaoId: createdNotification.id, limit: 20 });
    } catch (error) {
    logger.error('campanha.notificacao.web_push.error', {
      inscricao_id: createdNotification.ref_id || null,
      notificacao_id: createdNotification.id,
      message: error.message,
      code: error.code || null,
    });
      await auditService.log({
        ator_tipo: 'sistema',
        acao: 'falha_entregar_web_push',
        entidade: 'notificacoes',
        entidade_id: createdNotification.id,
        dados: {
          erro: error.message
        },
        req
      });
    }
  }

  if (
    updated.status === 'atendido' &&
    updated.servico_desejado === 'vacinacao' &&
    updated.animal_id
  ) {
    if (hasVacinacoesAplicadas) {
      await animalVacinaService.syncFromCampanhaAtendimento(
        updated,
        data.vacinacoes_aplicadas,
        actor,
        req
      );
    } else {
      try {
        await animalVacinaService.createFromCampanhaAtendida(updated, actor, req);
      } catch (error) {
    logger.error('campanha.vacinacao_automatica.error', {
      inscricao_id: updated.id,
      campanha_id: updated.campanha_id,
      animal_id: updated.animal_id,
      message: error.message,
      code: error.code || null,
    });
        await auditService.log({
          ator_tipo: 'interno',
          ator_id: actor.id,
          acao: 'falha_criar_registro_vacinal_campanha',
          entidade: 'campanha_inscricoes',
          entidade_id: updated.id,
          dados: {
            animal_id: updated.animal_id,
            campanha_id: updated.campanha_id,
            erro: error.message
          },
          req
        });
      }
    }
  }

  return {
    ...updated,
    workflow: workflowService.buildCampanhaWorkflow(updated),
  };
};

