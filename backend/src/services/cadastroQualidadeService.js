const db = require('../config/db');

function normalizeString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeForMatch(value) {
  const text = normalizeString(value);
  if (!text) return '';

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCpf(value) {
  const text = normalizeString(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  return digits || null;
}

function normalizeEmail(value) {
  const text = normalizeString(value);
  return text ? text.toLowerCase() : null;
}

function normalizePhone(value) {
  const text = normalizeString(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  return digits || null;
}

function normalizeMicrochip(value) {
  const text = normalizeString(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  return digits || null;
}

function isValidCpf(cpf) {
  const digits = normalizeCpf(cpf);
  return Boolean(digits && digits.length === 11 && !/^(\d)\1+$/.test(digits));
}

function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized));
}

function isValidMicrochip(microchip) {
  const normalized = normalizeMicrochip(microchip);
  return Boolean(normalized && normalized.length >= 10 && normalized.length <= 20);
}

function buildLevel(score) {
  if (score >= 80) return 'alto';
  if (score >= 50) return 'medio';
  return 'baixo';
}

function normalizeAlerts(alerts) {
  if (!Array.isArray(alerts)) return [];
  return alerts.filter(Boolean);
}

function hasBlockingAlert(alerts) {
  return normalizeAlerts(alerts).some((alert) => alert.severidade === 'bloqueio');
}

function createDuplicateError(entity, alerts) {
  const error = new Error(entity === 'tutor' ? 'Tutor duplicado.' : 'Animal duplicado.');
  error.statusCode = 409;
  error.code = entity === 'tutor' ? 'SIGBA_DUPLICATE_TUTOR' : 'SIGBA_DUPLICATE_ANIMAL';
  error.details = { duplicidade_alertas: normalizeAlerts(alerts) };
  return error;
}

function calculateTutorQuality(tutor, duplicateAlerts = []) {
  const pendencias = [];
  const criterios_atendidos = [];
  let score = 0;

  if (normalizeString(tutor.nome)) {
    score += 15;
    criterios_atendidos.push('Nome informado');
  } else {
    pendencias.push('Nome ausente');
  }

  if (isValidCpf(tutor.cpf || tutor.cpf_normalizado)) {
    score += 30;
    criterios_atendidos.push('Documento consistente');
  } else {
    pendencias.push('Documento ausente ou incompleto');
  }

  if (normalizePhone(tutor.telefone || tutor.telefone_normalizado)) {
    score += 15;
    criterios_atendidos.push('Telefone informado');
  } else {
    pendencias.push('Telefone ausente');
  }

  if (isValidEmail(tutor.email || tutor.email_normalizado)) {
    score += 15;
    criterios_atendidos.push('Email valido');
  } else {
    pendencias.push('Email ausente ou invalido');
  }

  if (normalizeString(tutor.endereco) || normalizeString(tutor.bairro)) {
    score += 15;
    criterios_atendidos.push('Endereco ou bairro informado');
  } else {
    pendencias.push('Endereco/bairro ausente');
  }

  if (tutor.usuario_externo_id) {
    score += 5;
    criterios_atendidos.push('Vinculo com usuario externo');
  }

  const alerts = normalizeAlerts(duplicateAlerts);
  if (alerts.length === 0) {
    score += 5;
    criterios_atendidos.push('Sem alerta de duplicidade');
  } else {
    pendencias.push('Possivel duplicidade exige revisao');
    if (hasBlockingAlert(alerts)) {
      score -= 20;
    } else {
      score -= 10;
    }
  }

  const safeScore = Math.max(0, Math.min(100, score));

  return {
    score: safeScore,
    nivel: buildLevel(safeScore),
    pendencias,
    criterios_atendidos
  };
}

function calculateAnimalQuality(animal, duplicateAlerts = []) {
  const pendencias = [];
  const criterios_atendidos = [];
  let score = 0;

  if (normalizeString(animal.nome)) {
    score += 10;
    criterios_atendidos.push('Nome informado');
  } else {
    pendencias.push('Nome ausente');
  }

  if (normalizeString(animal.especie)) {
    score += 15;
    criterios_atendidos.push('Especie informada');
  } else {
    pendencias.push('Especie ausente');
  }

  if (normalizeString(animal.sexo)) {
    score += 10;
    criterios_atendidos.push('Sexo informado');
  } else {
    pendencias.push('Sexo ausente ou ignorado');
  }

  if (animal.tutor_id) {
    score += 15;
    criterios_atendidos.push('Tutor vinculado');
  } else {
    pendencias.push('Sem tutor vinculado');
  }

  if (isValidMicrochip(animal.microchip || animal.microchip_normalizado)) {
    score += 25;
    criterios_atendidos.push('Microchip consistente');
  } else {
    pendencias.push('Sem microchip consistente');
  }

  if (normalizeString(animal.bairro) || normalizeString(animal.endereco_referencia)) {
    score += 10;
    criterios_atendidos.push('Localizacao minima informada');
  } else {
    pendencias.push('Bairro/localizacao ausente');
  }

  if (animal.vacinado || Number(animal.vacinas_normalizadas_count || 0) > 0) {
    score += 10;
    criterios_atendidos.push('Informacao vacinal presente');
  }

  const alerts = normalizeAlerts(duplicateAlerts);
  if (alerts.length === 0) {
    score += 5;
    criterios_atendidos.push('Sem alerta de duplicidade');
  } else {
    pendencias.push('Possivel duplicidade exige revisao');
    if (hasBlockingAlert(alerts)) {
      score -= 20;
    } else {
      score -= 10;
    }
  }

  const safeScore = Math.max(0, Math.min(100, score));

  return {
    score: safeScore,
    nivel: buildLevel(safeScore),
    pendencias,
    criterios_atendidos
  };
}

function applyTutorQuality(tutor) {
  if (!tutor) return tutor;

  if (tutor.status_cadastral === 'mesclado') {
    return {
      ...tutor,
      confiabilidade_score: 0,
      confiabilidade_nivel: 'baixo',
      confiabilidade_pendencias: ['Cadastro mesclado em outro tutor'],
      confiabilidade_criterios: [],
      duplicidade_alertas: []
    };
  }

  const alerts = normalizeAlerts(tutor.duplicidade_alertas);
  const quality = calculateTutorQuality(tutor, alerts);

  return {
    ...tutor,
    confiabilidade_score: quality.score,
    confiabilidade_nivel: quality.nivel,
    confiabilidade_pendencias: quality.pendencias,
    confiabilidade_criterios: quality.criterios_atendidos,
    duplicidade_alertas: alerts
  };
}

function applyAnimalQuality(animal) {
  if (!animal) return animal;

  if (animal.status_cadastral === 'mesclado') {
    return {
      ...animal,
      confiabilidade_score: 0,
      confiabilidade_nivel: 'baixo',
      confiabilidade_pendencias: ['Cadastro mesclado em outro animal'],
      confiabilidade_criterios: [],
      duplicidade_alertas: []
    };
  }

  const alerts = normalizeAlerts(animal.duplicidade_alertas);
  const quality = calculateAnimalQuality(animal, alerts);

  return {
    ...animal,
    confiabilidade_score: quality.score,
    confiabilidade_nivel: quality.nivel,
    confiabilidade_pendencias: quality.pendencias,
    confiabilidade_criterios: quality.criterios_atendidos,
    duplicidade_alertas: alerts
  };
}

function prepareTutorData(data) {
  const normalized = {
    ...data,
    nome: normalizeString(data.nome),
    cpf: normalizeCpf(data.cpf),
    telefone: normalizePhone(data.telefone),
    email: normalizeEmail(data.email),
    endereco: normalizeString(data.endereco),
    bairro: normalizeString(data.bairro)
  };

  normalized.cpf_normalizado = normalized.cpf;
  normalized.email_normalizado = normalized.email;
  normalized.telefone_normalizado = normalized.telefone;

  return normalized;
}

function prepareAnimalData(data) {
  const normalized = {
    ...data,
    microchip: normalizeMicrochip(data.microchip),
    bairro: normalizeString(data.bairro),
    endereco_referencia: normalizeString(data.endereco_referencia)
  };

  normalized.microchip_normalizado = normalized.microchip;

  return normalized;
}

async function findTutorDuplicateAlerts(data, excludeId = null) {
  const cpf = normalizeCpf(data.cpf || data.cpf_normalizado);
  const email = normalizeEmail(data.email || data.email_normalizado);
  const telefone = normalizePhone(data.telefone || data.telefone_normalizado);
  const nomeNormalizado = normalizeForMatch(data.nome);

  if (!cpf && !email && !telefone) {
    return [];
  }

  const result = await db.query(
    `
      SELECT
        id,
        nome,
        cpf,
        email,
        telefone,
        cpf_normalizado,
        email_normalizado,
        telefone_normalizado
      FROM tutores
      WHERE ($1::int IS NULL OR id <> $1::int)
        AND COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')
        AND (
          ($2::text IS NOT NULL AND COALESCE(cpf_normalizado, regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g')) = $2::text)
          OR ($3::text IS NOT NULL AND COALESCE(email_normalizado, lower(trim(COALESCE(email, '')))) = $3::text)
          OR ($4::text IS NOT NULL AND COALESCE(telefone_normalizado, regexp_replace(COALESCE(telefone, ''), '\\D', '', 'g')) = $4::text)
        )
      ORDER BY id DESC
      LIMIT 10;
    `,
    [excludeId, cpf, email, telefone]
  );

  const alerts = [];

  result.rows.forEach((row) => {
    const rowCpf = normalizeCpf(row.cpf_normalizado || row.cpf);
    const rowEmail = normalizeEmail(row.email_normalizado || row.email);
    const rowTelefone = normalizePhone(row.telefone_normalizado || row.telefone);
    const rowNome = normalizeForMatch(row.nome);

    if (cpf && rowCpf === cpf) {
      alerts.push({
        tipo: 'cpf',
        severidade: 'bloqueio',
        entidade: 'tutor',
        entidade_id: row.id,
        mensagem: `Documento ja vinculado ao tutor ${row.nome || row.id}.`
      });
      return;
    }

    if (email && rowEmail === email) {
      alerts.push({
        tipo: 'email',
        severidade: 'provavel',
        entidade: 'tutor',
        entidade_id: row.id,
        mensagem: `Email ja aparece no tutor ${row.nome || row.id}.`
      });
    }

    if (telefone && rowTelefone === telefone && nomeNormalizado && rowNome === nomeNormalizado) {
      alerts.push({
        tipo: 'telefone_nome',
        severidade: 'provavel',
        entidade: 'tutor',
        entidade_id: row.id,
        mensagem: `Telefone e nome coincidem com o tutor ${row.nome || row.id}.`
      });
      return;
    }

    if (telefone && rowTelefone === telefone) {
      alerts.push({
        tipo: 'telefone',
        severidade: 'possivel',
        entidade: 'tutor',
        entidade_id: row.id,
        mensagem: `Telefone ja aparece em outro tutor (${row.nome || row.id}).`
      });
    }
  });

  return alerts;
}

async function findAnimalDuplicateAlerts(data, excludeId = null) {
  const microchip = normalizeMicrochip(data.microchip || data.microchip_normalizado);
  const nome = normalizeForMatch(data.nome);
  const especie = normalizeString(data.especie);
  const sexo = normalizeString(data.sexo);
  const raca = normalizeForMatch(data.raca);
  const bairro = normalizeForMatch(data.bairro);
  const tutorId = data.tutor_id || null;
  const alerts = [];

  if (microchip) {
    const microchipResult = await db.query(
      `
        SELECT id, nome, microchip, microchip_normalizado
        FROM animais
        WHERE ($1::int IS NULL OR id <> $1::int)
          AND COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')
          AND COALESCE(microchip_normalizado, regexp_replace(COALESCE(microchip, ''), '\\D', '', 'g')) = $2::text
        ORDER BY id DESC
        LIMIT 5;
      `,
      [excludeId, microchip]
    );

    microchipResult.rows.forEach((row) => {
      alerts.push({
        tipo: 'microchip',
        severidade: 'bloqueio',
        entidade: 'animal',
        entidade_id: row.id,
        mensagem: `Microchip ja vinculado ao animal ${row.nome || row.id}.`
      });
    });
  }

  if (!nome || !especie) {
    return alerts;
  }

  const candidatesResult = await db.query(
    `
      SELECT id, nome, especie, sexo, raca, bairro, tutor_id
      FROM animais
      WHERE ($1::int IS NULL OR id <> $1::int)
        AND COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')
        AND especie = $2
        AND (
          ($3::int IS NOT NULL AND tutor_id = $3::int)
          OR lower(trim(nome)) = lower(trim($4::text))
          OR ($5::text IS NOT NULL AND lower(trim(COALESCE(bairro, ''))) = lower(trim($5::text)))
        )
      ORDER BY id DESC
      LIMIT 20;
    `,
    [excludeId, especie, tutorId, data.nome, data.bairro || null]
  );

  candidatesResult.rows.forEach((row) => {
    const sameName = normalizeForMatch(row.nome) === nome;
    const sameTutor = tutorId && Number(row.tutor_id) === Number(tutorId);
    const sameSexo = sexo && normalizeString(row.sexo) === sexo;
    const sameRaca = raca && normalizeForMatch(row.raca) === raca;
    const sameBairro = bairro && normalizeForMatch(row.bairro) === bairro;

    if (sameTutor && sameName && (!sexo || sameSexo) && (!raca || sameRaca)) {
      alerts.push({
        tipo: 'tutor_nome_especie',
        severidade: 'provavel',
        entidade: 'animal',
        entidade_id: row.id,
        mensagem: `Animal semelhante ja vinculado ao mesmo tutor (${row.nome || row.id}).`
      });
      return;
    }

    if (!tutorId && sameName && sameSexo && sameBairro) {
      alerts.push({
        tipo: 'nome_especie_sexo_bairro',
        severidade: 'possivel',
        entidade: 'animal',
        entidade_id: row.id,
        mensagem: `Animal semelhante sem tutor encontrado no mesmo bairro (${row.nome || row.id}).`
      });
    }
  });

  return alerts;
}

module.exports = {
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
  normalizeMicrochip,
  normalizeString,
  prepareTutorData,
  prepareAnimalData,
  calculateTutorQuality,
  calculateAnimalQuality,
  applyTutorQuality,
  applyAnimalQuality,
  findTutorDuplicateAlerts,
  findAnimalDuplicateAlerts,
  hasBlockingAlert,
  createDuplicateError
};
