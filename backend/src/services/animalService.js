const db = require('../config/db');
const qualidadeService = require('./cadastroQualidadeService');
const territorioService = require('./territorioService');

const ACTIVE_TUTOR_FILTER = "COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')";
const ACTIVE_ANIMAL_FILTER = "COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')";
const ACTIVE_ANIMAL_FILTER_A = "COALESCE(a.status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')";

function toJsonb(value, fallback = []) {
  return JSON.stringify(value ?? fallback);
}

function createServiceError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function ensurePublicIdentity(animal) {
  if (!animal?.id) {
    return animal;
  }

  const publicId = animal.public_id || `SIGMA-ANIMAL-${animal.id}`;

  const result = await db.query(
    `
      UPDATE animais
      SET
        public_id = COALESCE(NULLIF(TRIM(public_id), ''), $1),
        qr_token = COALESCE(NULLIF(TRIM(qr_token), ''), $1)
      WHERE id = $2
      RETURNING *;
    `,
    [publicId, animal.id]
  );

  return result.rows[0] || animal;
}

exports.tutorExists = async (tutorId) => {
  if (tutorId === null || tutorId === undefined) {
    return true;
  }

  const query = `
    SELECT id
    FROM tutores
    WHERE id = $1;
  `;

  const result = await db.query(
    `
      SELECT id
      FROM tutores
      WHERE id = $1
        AND ${ACTIVE_TUTOR_FILTER};
    `,
    [tutorId]
  );
  return result.rows.length > 0;
};

exports.create = async (data) => {
  const normalized = await territorioService.enrichTerritorioPayload(
    qualidadeService.prepareAnimalData(data)
  );
  const duplicateAlerts = await qualidadeService.findAnimalDuplicateAlerts(normalized);

  if (qualidadeService.hasBlockingAlert(duplicateAlerts)) {
    throw qualidadeService.createDuplicateError('animal', duplicateAlerts);
  }

  const quality = qualidadeService.calculateAnimalQuality(normalized, duplicateAlerts);

  const {
    nome,
    especie,
    raca = null,
    raca_outros = null,
    sexo = null,
    porte = null,
    peso_kg = null,
    cor = null,
    data_nascimento = null,
    status,
    microchip = null,
    microchip_normalizado = null,
    castrado = false,
    castracao_pendente = false,
    vacinado = false,
    vacinas = [],
    grupo_vacinacao = 'nao_vacinado',
    alerta_vacinal = [],
    tutor_id = null,
    observacoes = null,
    bairro = null,
    territorio_id = null,
    territorio_origem = 'nao_informado',
    endereco_referencia = null,
    latitude = null,
    longitude = null
  } = normalized;

  const query = `
    INSERT INTO animais (
      nome,
      especie,
      raca,
      raca_outros,
      sexo,
      porte,
      peso_kg,
      cor,
      data_nascimento,
      status,
      microchip,
      microchip_normalizado,
      castrado,
      castracao_pendente,
      vacinado,
      vacinas,
      grupo_vacinacao,
      alerta_vacinal,
      tutor_id,
      observacoes,
      bairro,
      territorio_id,
      territorio_origem,
      endereco_referencia,
      latitude,
      longitude,
      confiabilidade_score,
      confiabilidade_nivel,
      confiabilidade_pendencias,
      duplicidade_alertas
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16::jsonb, $17, $18::jsonb, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29::jsonb, $30::jsonb
    )
    RETURNING *;
  `;

  const values = [
    nome,
    especie,
    raca,
    raca_outros,
    sexo,
    porte,
    peso_kg,
    cor,
    data_nascimento,
    status,
    microchip,
    microchip_normalizado,
    castrado,
    castracao_pendente,
    vacinado,
    toJsonb(vacinas),
    grupo_vacinacao,
    toJsonb(alerta_vacinal),
    tutor_id,
    observacoes,
    bairro,
    territorio_id,
    territorio_origem,
    endereco_referencia,
    latitude,
    longitude,
    quality.score,
    quality.nivel,
    toJsonb(quality.pendencias),
    toJsonb(duplicateAlerts)
  ];

  const result = await db.query(query, values);
  const withPublicIdentity = await ensurePublicIdentity(result.rows[0]);
  return qualidadeService.applyAnimalQuality(withPublicIdentity);
};

exports.findAll = async () => {
  const query = `
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
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', av.id,
            'vacina_catalogo_id', av.vacina_catalogo_id,
            'vacina_codigo', av.vacina_codigo,
            'vacina_nome', av.vacina_nome,
            'vacina_nome_popular', av.vacina_nome_popular,
            'data_aplicacao', av.data_aplicacao,
            'proxima_dose_em', av.proxima_dose_em,
            'origem_registro', av.origem_registro,
            'status_registro', av.status_registro
          )
          ORDER BY av.data_aplicacao DESC NULLS LAST, av.id DESC
        )
        FROM animal_vacinacoes av
        WHERE av.animal_id = a.id
          AND av.status_registro <> 'cancelado'
      ), '[]'::json) AS vacinas_normalizadas,
      COALESCE((
        SELECT COUNT(*)::int
        FROM animal_vacinacoes av
        WHERE av.animal_id = a.id
          AND av.status_registro <> 'cancelado'
      ), 0) AS vacinas_normalizadas_count,
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
      a.public_id,
      a.perfil_publico_ativo,
      a.qr_token,
      a.status_cadastral,
      a.merged_into_id,
      a.confiabilidade_score,
      a.confiabilidade_nivel,
      a.confiabilidade_pendencias,
      a.duplicidade_alertas,
      a.created_at,
      a.updated_at,
      t.nome AS tutor_nome,
      t.cpf AS tutor_cpf,
      t.telefone AS tutor_telefone,
      t.email AS tutor_email
    FROM animais a
    LEFT JOIN tutores t ON t.id = a.tutor_id
    LEFT JOIN territorios tr ON tr.id = a.territorio_id
    WHERE ${ACTIVE_ANIMAL_FILTER_A}
    ORDER BY a.id DESC;
  `;

  const result = await db.query(query);
  return result.rows.map(qualidadeService.applyAnimalQuality);
};

exports.findById = async (id) => {
  const query = `
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
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', av.id,
            'vacina_catalogo_id', av.vacina_catalogo_id,
            'vacina_codigo', av.vacina_codigo,
            'vacina_nome', av.vacina_nome,
            'vacina_nome_popular', av.vacina_nome_popular,
            'data_aplicacao', av.data_aplicacao,
            'proxima_dose_em', av.proxima_dose_em,
            'origem_registro', av.origem_registro,
            'status_registro', av.status_registro
          )
          ORDER BY av.data_aplicacao DESC NULLS LAST, av.id DESC
        )
        FROM animal_vacinacoes av
        WHERE av.animal_id = a.id
          AND av.status_registro <> 'cancelado'
      ), '[]'::json) AS vacinas_normalizadas,
      COALESCE((
        SELECT COUNT(*)::int
        FROM animal_vacinacoes av
        WHERE av.animal_id = a.id
          AND av.status_registro <> 'cancelado'
      ), 0) AS vacinas_normalizadas_count,
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
      a.public_id,
      a.perfil_publico_ativo,
      a.qr_token,
      a.status_cadastral,
      a.merged_into_id,
      a.confiabilidade_score,
      a.confiabilidade_nivel,
      a.confiabilidade_pendencias,
      a.duplicidade_alertas,
      a.created_at,
      a.updated_at,
      t.nome AS tutor_nome,
      t.cpf AS tutor_cpf,
      t.telefone AS tutor_telefone,
      t.email AS tutor_email
    FROM animais a
    LEFT JOIN tutores t ON t.id = a.tutor_id
    LEFT JOIN territorios tr ON tr.id = a.territorio_id
    WHERE a.id = $1;
  `;

  const result = await db.query(query, [id]);
  return qualidadeService.applyAnimalQuality(result.rows[0]);
};

exports.update = async (id, data) => {
  const normalized = await territorioService.enrichTerritorioPayload(
    qualidadeService.prepareAnimalData(data)
  );
  const duplicateAlerts = await qualidadeService.findAnimalDuplicateAlerts(normalized, id);

  if (qualidadeService.hasBlockingAlert(duplicateAlerts)) {
    throw qualidadeService.createDuplicateError('animal', duplicateAlerts);
  }

  const quality = qualidadeService.calculateAnimalQuality(normalized, duplicateAlerts);

  const {
    nome,
    especie,
    raca = null,
    raca_outros = null,
    sexo = null,
    porte = null,
    peso_kg = null,
    cor = null,
    data_nascimento = null,
    status,
    microchip = null,
    microchip_normalizado = null,
    castrado = false,
    castracao_pendente = false,
    vacinado = false,
    vacinas = [],
    grupo_vacinacao = 'nao_vacinado',
    alerta_vacinal = [],
    tutor_id = null,
    observacoes = null,
    bairro = null,
    territorio_id = null,
    territorio_origem = 'nao_informado',
    endereco_referencia = null,
    latitude = null,
    longitude = null
  } = normalized;

  const query = `
    UPDATE animais
    SET
      nome = $1,
      especie = $2,
      raca = $3,
      raca_outros = $4,
      sexo = $5,
      porte = $6,
      peso_kg = $7,
      cor = $8,
      data_nascimento = $9,
      status = $10,
      microchip = $11,
      microchip_normalizado = $12,
      castrado = $13,
      castracao_pendente = $14,
      vacinado = $15,
      vacinas = $16::jsonb,
      grupo_vacinacao = $17,
      alerta_vacinal = $18::jsonb,
      tutor_id = $19,
      observacoes = $20,
      bairro = $21,
      territorio_id = $22,
      territorio_origem = $23,
      endereco_referencia = $24,
      latitude = $25,
      longitude = $26,
      confiabilidade_score = $27,
      confiabilidade_nivel = $28,
      confiabilidade_pendencias = $29::jsonb,
      duplicidade_alertas = $30::jsonb,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $31
    RETURNING *;
  `;

  const values = [
    nome,
    especie,
    raca,
    raca_outros,
    sexo,
    porte,
    peso_kg,
    cor,
    data_nascimento,
    status,
    microchip,
    microchip_normalizado,
    castrado,
    castracao_pendente,
    vacinado,
    toJsonb(vacinas),
    grupo_vacinacao,
    toJsonb(alerta_vacinal),
    tutor_id,
    observacoes,
    bairro,
    territorio_id,
    territorio_origem,
    endereco_referencia,
    latitude,
    longitude,
    quality.score,
    quality.nivel,
    toJsonb(quality.pendencias),
    toJsonb(duplicateAlerts),
    id
  ];

  const result = await db.query(query, values);
  return qualidadeService.applyAnimalQuality(result.rows[0]);
};

exports.remove = async (id) => {
  const beforeResult = await db.query(
    `
      SELECT *
      FROM animais
      WHERE id = $1;
    `,
    [id]
  );
  const before = beforeResult.rows[0];

  if (!before) {
    return null;
  }

  if (['mesclado', 'inativo'].includes(before.status_cadastral || 'ativo')) {
    throw createServiceError(409, 'SIGBA_ANIMAL_INACTIVE', 'Animal ja esta inativo ou mesclado.');
  }

  const result = await db.query(
    `
      UPDATE animais
      SET
        status = 'inativo',
        status_cadastral = 'inativo',
        perfil_publico_ativo = false,
        motivo_inativacao = COALESCE(NULLIF(motivo_inativacao, ''), 'Cadastro inativado administrativamente para preservar historico institucional.'),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `,
    [id]
  );

  return qualidadeService.applyAnimalQuality(result.rows[0]);
};
