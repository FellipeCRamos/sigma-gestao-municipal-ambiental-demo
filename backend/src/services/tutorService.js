const db = require('../config/db');
const qualidadeService = require('./cadastroQualidadeService');
const territorioService = require('./territorioService');

const ACTIVE_TUTOR_FILTER = "COALESCE(t.status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')";
const ACTIVE_ANIMAL_FILTER = "COALESCE(a.status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')";

function toJsonb(value, fallback = []) {
  return JSON.stringify(value ?? fallback);
}

function createServiceError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

exports.create = async (data) => {
  const normalized = await territorioService.enrichTerritorioPayload(
    qualidadeService.prepareTutorData(data)
  );
  const duplicateAlerts = await qualidadeService.findTutorDuplicateAlerts(normalized);

  if (qualidadeService.hasBlockingAlert(duplicateAlerts)) {
    throw qualidadeService.createDuplicateError('tutor', duplicateAlerts);
  }

  const quality = qualidadeService.calculateTutorQuality(normalized, duplicateAlerts);

  const query = `
    INSERT INTO tutores (
      nome,
      cpf,
      telefone,
      email,
      endereco,
      bairro,
      territorio_id,
      territorio_origem,
      cpf_normalizado,
      email_normalizado,
      telefone_normalizado,
      confiabilidade_score,
      confiabilidade_nivel,
      confiabilidade_pendencias,
      duplicidade_alertas
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb)
    RETURNING *;
  `;

  const values = [
    normalized.nome,
    normalized.cpf,
    normalized.telefone,
    normalized.email,
    normalized.endereco,
    normalized.bairro,
    normalized.territorio_id,
    normalized.territorio_origem,
    normalized.cpf_normalizado,
    normalized.email_normalizado,
    normalized.telefone_normalizado,
    quality.score,
    quality.nivel,
    toJsonb(quality.pendencias),
    toJsonb(duplicateAlerts)
  ];

  const result = await db.query(query, values);

  return qualidadeService.applyTutorQuality(result.rows[0]);
};

exports.findAll = async () => {
  const query = `
    SELECT
      t.*,
      tr.nome AS territorio_nome,
      tr.categoria AS territorio_categoria
    FROM tutores t
    LEFT JOIN territorios tr ON tr.id = t.territorio_id
    WHERE ${ACTIVE_TUTOR_FILTER}
    ORDER BY t.id DESC;
  `;

  const result = await db.query(query);
  return result.rows.map(qualidadeService.applyTutorQuality);
};

exports.findById = async (id) => {
  const query = `
    SELECT
      t.*,
      tr.nome AS territorio_nome,
      tr.categoria AS territorio_categoria
    FROM tutores t
    LEFT JOIN territorios tr ON tr.id = t.territorio_id
    WHERE t.id = $1;
  `;

  const result = await db.query(query, [id]);
  return qualidadeService.applyTutorQuality(result.rows[0]);
};

exports.findWithAnimalsById = async (id) => {
  const tutorQuery = `
    SELECT
      t.*,
      tr.nome AS territorio_nome,
      tr.categoria AS territorio_categoria
    FROM tutores t
    LEFT JOIN territorios tr ON tr.id = t.territorio_id
    WHERE t.id = $1;
  `;

  const tutorResult = await db.query(tutorQuery, [id]);
  const tutor = tutorResult.rows[0];

  if (!tutor) {
    return null;
  }

  const animalsQuery = `
    SELECT
      a.id,
      a.nome,
      a.especie,
      a.raca,
      a.raca_outros,
      a.sexo,
      a.porte,
      a.peso_kg,
      a.cor,
      a.data_nascimento,
      a.status,
      a.microchip,
      a.microchip_normalizado,
      a.castrado,
      a.castracao_pendente,
      a.vacinado,
      a.vacinas,
      a.grupo_vacinacao,
      a.alerta_vacinal,
      a.tutor_id,
      a.observacoes,
      a.bairro,
      a.territorio_id,
      a.territorio_origem,
      tr.nome AS territorio_nome,
      tr.categoria AS territorio_categoria,
      a.endereco_referencia,
      a.latitude,
      a.longitude,
      a.confiabilidade_score,
      a.confiabilidade_nivel,
      a.confiabilidade_pendencias,
      a.duplicidade_alertas,
      a.created_at,
      a.updated_at,
      COALESCE((
        SELECT COUNT(*)::int
        FROM animal_vacinacoes av
        WHERE av.animal_id = a.id
          AND av.status_registro <> 'cancelado'
      ), 0) AS vacinas_normalizadas_count
    FROM animais a
    LEFT JOIN territorios tr ON tr.id = a.territorio_id
    WHERE a.tutor_id = $1
      AND ${ACTIVE_ANIMAL_FILTER}
    ORDER BY a.id DESC;
  `;

  const animalsResult = await db.query(animalsQuery, [id]);

  return {
    ...qualidadeService.applyTutorQuality(tutor),
    animais: animalsResult.rows.map(qualidadeService.applyAnimalQuality)
  };
};

exports.update = async (id, data) => {
  const normalized = await territorioService.enrichTerritorioPayload(
    qualidadeService.prepareTutorData(data)
  );
  const duplicateAlerts = await qualidadeService.findTutorDuplicateAlerts(normalized, id);

  if (qualidadeService.hasBlockingAlert(duplicateAlerts)) {
    throw qualidadeService.createDuplicateError('tutor', duplicateAlerts);
  }

  const quality = qualidadeService.calculateTutorQuality(normalized, duplicateAlerts);

  const query = `
    UPDATE tutores
    SET
      nome = $1,
      cpf = $2,
      telefone = $3,
      email = $4,
      endereco = $5,
      bairro = $6,
      territorio_id = $7,
      territorio_origem = $8,
      cpf_normalizado = $9,
      email_normalizado = $10,
      telefone_normalizado = $11,
      confiabilidade_score = $12,
      confiabilidade_nivel = $13,
      confiabilidade_pendencias = $14::jsonb,
      duplicidade_alertas = $15::jsonb,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $16
    RETURNING *;
  `;

  const values = [
    normalized.nome,
    normalized.cpf,
    normalized.telefone,
    normalized.email,
    normalized.endereco,
    normalized.bairro,
    normalized.territorio_id,
    normalized.territorio_origem,
    normalized.cpf_normalizado,
    normalized.email_normalizado,
    normalized.telefone_normalizado,
    quality.score,
    quality.nivel,
    toJsonb(quality.pendencias),
    toJsonb(duplicateAlerts),
    id
  ];

  const result = await db.query(query, values);

  return qualidadeService.applyTutorQuality(result.rows[0]);
};

exports.remove = async (id) => {
  const beforeResult = await db.query(
    `
      SELECT *
      FROM tutores
      WHERE id = $1;
    `,
    [id]
  );
  const before = beforeResult.rows[0];

  if (!before) {
    return null;
  }

  if (['mesclado', 'inativo'].includes(before.status_cadastral || 'ativo')) {
    throw createServiceError(409, 'SIGBA_TUTOR_INACTIVE', 'Tutor ja esta inativo ou mesclado.');
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        UPDATE animais
        SET
          tutor_id = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE tutor_id = $1;
      `,
      [id]
    );

    const result = await client.query(
      `
        UPDATE tutores
        SET
          status_cadastral = 'inativo',
          motivo_inativacao = COALESCE(NULLIF(motivo_inativacao, ''), 'Cadastro inativado administrativamente para preservar historico institucional.'),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `,
      [id]
    );

    await client.query('COMMIT');
    return qualidadeService.applyTutorQuality(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
