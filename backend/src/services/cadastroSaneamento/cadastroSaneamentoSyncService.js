const { db, toJsonb, getRelatedKey, mapCriticidade, mapScoreIndicio } = require('./shared');

async function upsertCase(client, payload) {
  await client.query(
    `
      INSERT INTO cadastro_saneamento_casos (
        tipo,
        entidade,
        entidade_id,
        entidade_relacionada_id,
        entidade_relacionada_key,
        motivos,
        criticidade,
        score_indicio,
        status,
        dados_snapshot
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'pendente', $9::jsonb)
      ON CONFLICT (tipo, entidade, entidade_id, entidade_relacionada_key)
      DO UPDATE
      SET
        motivos = EXCLUDED.motivos,
        criticidade = EXCLUDED.criticidade,
        score_indicio = EXCLUDED.score_indicio,
        dados_snapshot = EXCLUDED.dados_snapshot,
        updated_at = CURRENT_TIMESTAMP
      WHERE cadastro_saneamento_casos.status IN ('pendente', 'em_revisao', 'revisar_depois', 'aprovado_para_merge');
    `,
    [
      payload.tipo,
      payload.entidade,
      payload.entidade_id,
      payload.entidade_relacionada_id || null,
      getRelatedKey(payload.entidade_relacionada_id),
      toJsonb(payload.motivos, []),
      payload.criticidade || 'media',
      payload.score_indicio || 30,
      toJsonb(payload.dados_snapshot, {})
    ]
  );
}

async function syncDuplicateCases(client) {
  const tutoresResult = await client.query(`
    SELECT id, nome, cpf, email, telefone, confiabilidade_score, confiabilidade_nivel, duplicidade_alertas
    FROM tutores
    WHERE COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')
      AND jsonb_array_length(
        CASE
          WHEN jsonb_typeof(duplicidade_alertas) = 'array' THEN duplicidade_alertas
          ELSE '[]'::jsonb
        END
      ) > 0;
  `);

  for (const tutor of tutoresResult.rows) {
    const alerts = Array.isArray(tutor.duplicidade_alertas) ? tutor.duplicidade_alertas : [];
    const groupedByRelated = new Map();

    alerts.forEach((alert) => {
      const relatedId = Number(alert.entidade_id || 0);
      const key = getRelatedKey(relatedId);
      const list = groupedByRelated.get(key) || [];
      list.push(alert);
      groupedByRelated.set(key, list);
    });

    for (const [relatedKey, groupedAlerts] of groupedByRelated.entries()) {
      await upsertCase(client, {
        tipo: 'duplicidade_tutor',
        entidade: 'tutor',
        entidade_id: tutor.id,
        entidade_relacionada_id: relatedKey || null,
        motivos: groupedAlerts,
        criticidade: mapCriticidade(groupedAlerts),
        score_indicio: mapScoreIndicio(groupedAlerts),
        dados_snapshot: { tutor }
      });
    }
  }

  const animaisResult = await client.query(`
    SELECT id, nome, especie, sexo, raca, tutor_id, microchip, bairro, confiabilidade_score, confiabilidade_nivel, duplicidade_alertas
    FROM animais
    WHERE COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')
      AND jsonb_array_length(
        CASE
          WHEN jsonb_typeof(duplicidade_alertas) = 'array' THEN duplicidade_alertas
          ELSE '[]'::jsonb
        END
      ) > 0;
  `);

  for (const animal of animaisResult.rows) {
    const alerts = Array.isArray(animal.duplicidade_alertas) ? animal.duplicidade_alertas : [];
    const groupedByRelated = new Map();

    alerts.forEach((alert) => {
      const relatedId = Number(alert.entidade_id || 0);
      const key = getRelatedKey(relatedId);
      const list = groupedByRelated.get(key) || [];
      list.push(alert);
      groupedByRelated.set(key, list);
    });

    for (const [relatedKey, groupedAlerts] of groupedByRelated.entries()) {
      await upsertCase(client, {
        tipo: 'duplicidade_animal',
        entidade: 'animal',
        entidade_id: animal.id,
        entidade_relacionada_id: relatedKey || null,
        motivos: groupedAlerts,
        criticidade: mapCriticidade(groupedAlerts),
        score_indicio: mapScoreIndicio(groupedAlerts),
        dados_snapshot: { animal }
      });
    }
  }
}

async function syncLowQualityCases(client) {
  const lowTutors = await client.query(`
    SELECT id, nome, cpf, email, telefone, confiabilidade_score, confiabilidade_nivel, confiabilidade_pendencias
    FROM tutores
    WHERE COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')
      AND confiabilidade_nivel = 'baixo';
  `);

  for (const tutor of lowTutors.rows) {
    await upsertCase(client, {
      tipo: 'baixa_confiabilidade_tutor',
      entidade: 'tutor',
      entidade_id: tutor.id,
      entidade_relacionada_id: null,
      motivos: tutor.confiabilidade_pendencias || [],
      criticidade: 'media',
      score_indicio: Math.max(0, 50 - Number(tutor.confiabilidade_score || 0)),
      dados_snapshot: { tutor }
    });
  }

  const lowAnimals = await client.query(`
    SELECT id, nome, especie, microchip, tutor_id, confiabilidade_score, confiabilidade_nivel, confiabilidade_pendencias
    FROM animais
    WHERE COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')
      AND confiabilidade_nivel = 'baixo';
  `);

  for (const animal of lowAnimals.rows) {
    await upsertCase(client, {
      tipo: 'baixa_confiabilidade_animal',
      entidade: 'animal',
      entidade_id: animal.id,
      entidade_relacionada_id: null,
      motivos: animal.confiabilidade_pendencias || [],
      criticidade: 'media',
      score_indicio: Math.max(0, 50 - Number(animal.confiabilidade_score || 0)),
      dados_snapshot: { animal }
    });
  }
}

async function syncStrongLegacyCases(client) {
  const tutorDuplicates = await client.query(`
    WITH duplicados AS (
      SELECT cpf_normalizado
      FROM tutores
      WHERE cpf_normalizado IS NOT NULL
        AND COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')
      GROUP BY cpf_normalizado
      HAVING COUNT(*) > 1
    )
    SELECT t.id, t.nome, t.cpf, t.cpf_normalizado
    FROM tutores t
    JOIN duplicados d ON d.cpf_normalizado = t.cpf_normalizado
    ORDER BY t.cpf_normalizado, t.id;
  `);

  const tutorsByCpf = new Map();
  tutorDuplicates.rows.forEach((row) => {
    const group = tutorsByCpf.get(row.cpf_normalizado) || [];
    group.push(row);
    tutorsByCpf.set(row.cpf_normalizado, group);
  });

  for (const group of tutorsByCpf.values()) {
    const [base, ...others] = group;
    for (const related of others) {
      await upsertCase(client, {
        tipo: 'conflito_forte_legado_tutor',
        entidade: 'tutor',
        entidade_id: related.id,
        entidade_relacionada_id: base.id,
        motivos: [{ tipo: 'cpf_normalizado', severidade: 'bloqueio', mensagem: 'Documento normalizado duplicado em dado legado.' }],
        criticidade: 'critica',
        score_indicio: 100,
        dados_snapshot: { base, related }
      });
    }
  }

  const animalDuplicates = await client.query(`
    WITH duplicados AS (
      SELECT microchip_normalizado
      FROM animais
      WHERE microchip_normalizado IS NOT NULL
        AND COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')
      GROUP BY microchip_normalizado
      HAVING COUNT(*) > 1
    )
    SELECT id, nome, microchip, microchip_normalizado
    FROM animais
    WHERE microchip_normalizado IN (SELECT microchip_normalizado FROM duplicados)
    ORDER BY microchip_normalizado, id;
  `);

  const animalsByMicrochip = new Map();
  animalDuplicates.rows.forEach((row) => {
    const group = animalsByMicrochip.get(row.microchip_normalizado) || [];
    group.push(row);
    animalsByMicrochip.set(row.microchip_normalizado, group);
  });

  for (const group of animalsByMicrochip.values()) {
    const [base, ...others] = group;
    for (const related of others) {
      await upsertCase(client, {
        tipo: 'conflito_forte_legado_animal',
        entidade: 'animal',
        entidade_id: related.id,
        entidade_relacionada_id: base.id,
        motivos: [{ tipo: 'microchip_normalizado', severidade: 'bloqueio', mensagem: 'Microchip normalizado duplicado em dado legado.' }],
        criticidade: 'critica',
        score_indicio: 100,
        dados_snapshot: { base, related }
      });
    }
  }
}

async function syncCases() {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await syncDuplicateCases(client);
    await syncLowQualityCases(client);
    await syncStrongLegacyCases(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


module.exports = {
  upsertCase,
  syncDuplicateCases,
  syncLowQualityCases,
  syncStrongLegacyCases,
  syncCases,
};
