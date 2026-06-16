const { db, auditService, qualidadeService, toJsonb, createServiceError } = require('./shared');
const caseService = require('./cadastroSaneamentoCaseService');

async function refreshTutorQuality(tutorId) {
  const result = await db.query('SELECT * FROM tutores WHERE id = $1;', [tutorId]);
  const tutor = result.rows[0];

  if (!tutor || tutor.status_cadastral === 'mesclado') {
    return tutor || null;
  }

  const alerts = await qualidadeService.findTutorDuplicateAlerts(tutor, tutor.id);
  const quality = qualidadeService.calculateTutorQuality(tutor, alerts);

  const update = await db.query(
    `
      UPDATE tutores
      SET
        duplicidade_alertas = $1::jsonb,
        confiabilidade_score = $2,
        confiabilidade_nivel = $3,
        confiabilidade_pendencias = $4::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `,
    [
      toJsonb(alerts, []),
      quality.score,
      quality.nivel,
      toJsonb(quality.pendencias, []),
      tutorId
    ]
  );

  return qualidadeService.applyTutorQuality(update.rows[0]);
}

function detectTutorMergeConflicts(principal, incorporado) {
  const conflicts = [];

  if (
    principal.cpf_normalizado &&
    incorporado.cpf_normalizado &&
    principal.cpf_normalizado !== incorporado.cpf_normalizado
  ) {
    conflicts.push({
      campo: 'cpf',
      severidade: 'bloqueio',
      mensagem: 'Documentos normalizados divergentes.'
    });
  }

  if (
    principal.usuario_externo_id &&
    incorporado.usuario_externo_id &&
    Number(principal.usuario_externo_id) !== Number(incorporado.usuario_externo_id)
  ) {
    conflicts.push({
      campo: 'usuario_externo_id',
      severidade: 'bloqueio',
      mensagem: 'Tutores vinculados a usuarios externos diferentes.'
    });
  }

  ['email', 'telefone', 'endereco', 'bairro'].forEach((field) => {
    if (principal[field] && incorporado[field] && principal[field] !== incorporado[field]) {
      conflicts.push({
        campo: field,
        severidade: 'informativo',
        mensagem: `Campo ${field} divergente; valor do tutor principal sera preservado.`
      });
    }
  });

  return conflicts;
}

function mergeValue(principalValue, incorporadoValue) {
  return principalValue || incorporadoValue || null;
}

exports.mergeTutor = async (caseId, data, actor, req = null) => {
  const principalId = Number(data.principal_id);
  const incorporadoId = Number(data.incorporado_id);
  const observacao = qualidadeService.normalizeString(data.observacao);

  if (!Number.isInteger(principalId) || !Number.isInteger(incorporadoId) || principalId <= 0 || incorporadoId <= 0) {
    throw createServiceError(400, 'SIGBA_INVALID_MERGE_PAYLOAD', 'Informe tutor principal e tutor incorporado validos.');
  }

  if (principalId === incorporadoId) {
    throw createServiceError(400, 'SIGBA_INVALID_MERGE_PAYLOAD', 'Tutor principal e tutor incorporado devem ser diferentes.');
  }

  if (!observacao || observacao.length < 10) {
    throw createServiceError(400, 'SIGBA_MERGE_REASON_REQUIRED', 'Informe uma justificativa de merge com pelo menos 10 caracteres.');
  }

  const client = await db.connect();
  let mergeId = null;
  let beforeAudit = null;
  let afterAudit = null;
  let referenciasReapontadas = {};
  let conflicts = [];

  try {
    await client.query('BEGIN');

    const caseResult = await client.query(
      `
        SELECT *
        FROM cadastro_saneamento_casos
        WHERE id = $1
        FOR UPDATE;
      `,
      [caseId]
    );
    const caso = caseResult.rows[0];

    if (!caso) {
      throw createServiceError(404, 'SIGBA_CASE_NOT_FOUND', 'Caso de saneamento nao encontrado.');
    }

    if (caso.entidade !== 'tutor') {
      throw createServiceError(400, 'SIGBA_UNSUPPORTED_MERGE', 'Merge transacional nesta subfase esta habilitado apenas para tutores.');
    }

    if (caso.status === 'mesclado') {
      throw createServiceError(409, 'SIGBA_CASE_ALREADY_MERGED', 'Caso ja foi mesclado.');
    }

    const caseIds = new Set([Number(caso.entidade_id), Number(caso.entidade_relacionada_id || 0)]);

    if (!caseIds.has(principalId) || !caseIds.has(incorporadoId)) {
      throw createServiceError(400, 'SIGBA_MERGE_OUTSIDE_CASE', 'Os tutores informados nao pertencem ao caso de saneamento.');
    }

    const tutorsResult = await client.query(
      `
        SELECT *
        FROM tutores
        WHERE id IN ($1, $2)
        FOR UPDATE;
      `,
      [principalId, incorporadoId]
    );

    if (tutorsResult.rows.length !== 2) {
      throw createServiceError(404, 'SIGBA_TUTOR_NOT_FOUND', 'Tutor principal ou incorporado nao encontrado.');
    }

    const principal = tutorsResult.rows.find((row) => Number(row.id) === principalId);
    const incorporado = tutorsResult.rows.find((row) => Number(row.id) === incorporadoId);

    if (principal.status_cadastral === 'mesclado' || incorporado.status_cadastral === 'mesclado') {
      throw createServiceError(409, 'SIGBA_TUTOR_ALREADY_MERGED', 'Um dos tutores ja esta mesclado.');
    }

    conflicts = detectTutorMergeConflicts(principal, incorporado);
    const blockingConflicts = conflicts.filter((conflict) => conflict.severidade === 'bloqueio');

    if (blockingConflicts.length > 0) {
      throw createServiceError(409, 'SIGBA_TUTOR_MERGE_BLOCKED', 'Merge bloqueado por conflito estrutural.', {
        conflitos: blockingConflicts
      });
    }

    beforeAudit = {
      caso,
      principal,
      incorporado
    };

    const merged = {
      nome: principal.nome,
      cpf: mergeValue(principal.cpf, incorporado.cpf),
      cpf_normalizado: mergeValue(principal.cpf_normalizado, incorporado.cpf_normalizado),
      telefone: mergeValue(principal.telefone, incorporado.telefone),
      telefone_normalizado: mergeValue(principal.telefone_normalizado, incorporado.telefone_normalizado),
      email: mergeValue(principal.email, incorporado.email),
      email_normalizado: mergeValue(principal.email_normalizado, incorporado.email_normalizado),
      endereco: mergeValue(principal.endereco, incorporado.endereco),
      bairro: mergeValue(principal.bairro, incorporado.bairro),
      usuario_externo_id: mergeValue(principal.usuario_externo_id, incorporado.usuario_externo_id)
    };

    await client.query(
      `
        UPDATE tutores
        SET
          cpf = NULL,
          cpf_normalizado = NULL,
          usuario_externo_id = NULL,
          status_cadastral = 'mesclado',
          merged_into_id = $1,
          mesclado_em = CURRENT_TIMESTAMP,
          mesclado_por = $2,
          motivo_inativacao = $3,
          duplicidade_alertas = '[]'::jsonb,
          confiabilidade_score = 0,
          confiabilidade_nivel = 'baixo',
          confiabilidade_pendencias = $4::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5;
      `,
      [
        principalId,
        actor?.id || null,
        observacao,
        toJsonb(['Cadastro mesclado em outro tutor'], []),
        incorporadoId
      ]
    );

    const principalAfterResult = await client.query(
      `
        UPDATE tutores
        SET
          nome = $1,
          cpf = $2,
          telefone = $3,
          email = $4,
          endereco = $5,
          bairro = $6,
          cpf_normalizado = $7,
          email_normalizado = $8,
          telefone_normalizado = $9,
          usuario_externo_id = $10,
          status_cadastral = 'ativo',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING *;
      `,
      [
        merged.nome,
        merged.cpf,
        merged.telefone,
        merged.email,
        merged.endereco,
        merged.bairro,
        merged.cpf_normalizado,
        merged.email_normalizado,
        merged.telefone_normalizado,
        merged.usuario_externo_id,
        principalId
      ]
    );

    const updateAnimais = await client.query(
      `
        UPDATE animais
        SET tutor_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE tutor_id = $2;
      `,
      [principalId, incorporadoId]
    );

    const updateEventos = await client.query(
      `
        UPDATE animal_eventos
        SET tutor_id = $1
        WHERE tutor_id = $2;
      `,
      [principalId, incorporadoId]
    );

    const updateInscricoes = await client.query(
      `
        UPDATE campanha_inscricoes
        SET tutor_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE tutor_id = $2;
      `,
      [principalId, incorporadoId]
    );

    referenciasReapontadas = {
      animais: updateAnimais.rowCount,
      animal_eventos: updateEventos.rowCount,
      campanha_inscricoes: updateInscricoes.rowCount
    };

    const incorporadoAfterResult = await client.query(
      `
        SELECT *
        FROM tutores
        WHERE id = $1;
      `,
      [incorporadoId]
    );

    const mergeResult = await client.query(
      `
        INSERT INTO cadastro_merges (
          entidade,
          principal_id,
          incorporado_id,
          caso_id,
          motivo,
          conflitos,
          campos_preservados,
          referencias_reapontadas,
          registro_principal_antes,
          registro_incorporado_antes,
          registro_principal_depois,
          registro_incorporado_depois,
          created_by_interno_id
        )
        VALUES (
          'tutor', $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb,
          $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12
        )
        RETURNING *;
      `,
      [
        principalId,
        incorporadoId,
        caseId,
        observacao,
        toJsonb(conflicts, []),
        toJsonb(merged, {}),
        toJsonb(referenciasReapontadas, {}),
        toJsonb(principal, {}),
        toJsonb(incorporado, {}),
        toJsonb(principalAfterResult.rows[0], {}),
        toJsonb(incorporadoAfterResult.rows[0], {}),
        actor?.id || null
      ]
    );

    mergeId = mergeResult.rows[0].id;

    await client.query(
      `
        UPDATE cadastro_saneamento_casos
        SET
          status = 'mesclado',
          responsavel_interno_id = $1,
          decisao = 'merge_tutor',
          observacao = $2,
          merge_id = $3,
          resolved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4;
      `,
      [actor?.id || null, observacao, mergeId, caseId]
    );

    const caseAfterResult = await client.query(
      `
        SELECT *
        FROM cadastro_saneamento_casos
        WHERE id = $1;
      `,
      [caseId]
    );

    afterAudit = {
      caso: caseAfterResult.rows[0],
      principal: principalAfterResult.rows[0],
      incorporado: incorporadoAfterResult.rows[0],
      merge_id: mergeId
    };

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const principalAtualizado = await refreshTutorQuality(principalId);
  const casoAtualizado = await caseService.findCaseById(caseId);

  await auditService.logChange({
    ator_tipo: 'interno',
    ator_id: actor?.id,
    acao: 'merge_tutor',
    entidade: 'tutores',
    entidade_id: principalId,
    before: beforeAudit,
    after: {
      ...afterAudit,
      principal_recalculado: principalAtualizado
    },
    dados: {
      merge_id: mergeId,
      tutor_principal_id: principalId,
      tutor_incorporado_id: incorporadoId,
      referencias_reapontadas: referenciasReapontadas,
      conflitos: conflicts,
      observacao
    },
    req
  });

  return {
    merge_id: mergeId,
    caso: casoAtualizado,
    tutor_principal: principalAtualizado,
    referencias_reapontadas: referenciasReapontadas,
    conflitos: conflicts
  };
};


