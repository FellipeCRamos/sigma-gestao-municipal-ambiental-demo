const ALLOWED_ESPECIES = ['canino', 'felino'];
const ALLOWED_SEXOS = ['macho', 'femea', 'ignorado'];
const ALLOWED_PORTES = ['pequeno', 'medio', 'grande'];
const ALLOWED_STATUS = [
  'ativo',
  'acompanhamento',
  'tratamento',
  'disponivel_adocao',
  'adotado',
  'inativo'
];
const ALLOWED_GRUPOS_VACINACAO = [
  'nao_vacinado',
  'vacinacao_incompleta',
  'vacinacao_essencial_ok'
];

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function isValidDate(dateString) {
  if (!dateString) return true;

  const date = new Date(dateString);
  return !Number.isNaN(date.getTime());
}

function isBoolean(value) {
  return typeof value === 'boolean';
}

function isPositiveIntegerOrNull(value) {
  return value === null || (Number.isInteger(value) && value > 0);
}

function normalizePositiveIntegerOrNull(value) {
  if (value === undefined || value === null || value === '') return null;

  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return undefined;

  return number;
}

function normalizePositiveNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;

  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return undefined;

  return number;
}

function normalizeCoordinateOrNull(value) {
  if (value === undefined || value === null || value === '') return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;

  return number;
}

function normalizeJsonArray(value, fallback = []) {
  if (value === undefined || value === null) return fallback;
  if (!Array.isArray(value)) return undefined;
  return value;
}

module.exports = function validateAnimal(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Corpo da requisicao invalido.'
    });
  }

  const nome = normalizeString(body.nome);
  const especie = normalizeString(body.especie);
  const raca = normalizeString(body.raca);
  const raca_outros = normalizeString(body.raca_outros);
  const sexo = normalizeString(body.sexo);
  const porte = normalizeString(body.porte);
  const peso_kg = normalizePositiveNumberOrNull(body.peso_kg);
  const cor = normalizeString(body.cor);
  const data_nascimento = body.data_nascimento;
  const status = normalizeString(body.status);
  const microchip = normalizeString(body.microchip);
  const castrado = body.castrado;
  const castracao_pendente = body.castracao_pendente;
  const vacinado = body.vacinado;
  const vacinas = normalizeJsonArray(body.vacinas);
  const grupo_vacinacao = normalizeString(body.grupo_vacinacao);
  const alerta_vacinal = normalizeJsonArray(body.alerta_vacinal);
  const tutor_id = body.tutor_id;
  const territorio_id = normalizePositiveIntegerOrNull(body.territorio_id);
  const observacoes = normalizeString(body.observacoes);
  const bairro = normalizeString(body.bairro);
  const endereco_referencia = normalizeString(body.endereco_referencia);
  const latitude = normalizeCoordinateOrNull(body.latitude);
  const longitude = normalizeCoordinateOrNull(body.longitude);

  if (!nome || nome.length < 2 || nome.length > 150) {
    return res.status(400).json({
      success: false,
      error: 'O campo nome e obrigatorio e deve ter entre 2 e 150 caracteres.'
    });
  }

  if (!especie || !ALLOWED_ESPECIES.includes(especie)) {
    return res.status(400).json({
      success: false,
      error: `O campo especie e obrigatorio e deve ser um dos valores: ${ALLOWED_ESPECIES.join(', ')}.`
    });
  }

  if (!status || !ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `O campo status e obrigatorio e deve ser um dos valores: ${ALLOWED_STATUS.join(', ')}.`
    });
  }

  if (raca && raca.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'O campo raca deve ter no maximo 100 caracteres.'
    });
  }

  if (raca_outros && raca_outros.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'O campo raca_outros deve ter no maximo 100 caracteres.'
    });
  }

  if (sexo && !ALLOWED_SEXOS.includes(sexo)) {
    return res.status(400).json({
      success: false,
      error: `O campo sexo deve ser um dos valores: ${ALLOWED_SEXOS.join(', ')}.`
    });
  }

  if (porte && !ALLOWED_PORTES.includes(porte)) {
    return res.status(400).json({
      success: false,
      error: `O campo porte deve ser um dos valores: ${ALLOWED_PORTES.join(', ')}.`
    });
  }

  if (peso_kg === undefined) {
    return res.status(400).json({
      success: false,
      error: 'O campo peso_kg deve ser um numero maior que zero.'
    });
  }

  if (cor && cor.length > 50) {
    return res.status(400).json({
      success: false,
      error: 'O campo cor deve ter no maximo 50 caracteres.'
    });
  }

  if (!isValidDate(data_nascimento)) {
    return res.status(400).json({
      success: false,
      error: 'O campo data_nascimento deve ser uma data valida.'
    });
  }

  if (microchip) {
    const microchipLimpo = microchip.replace(/\D/g, '');

    if (microchipLimpo.length < 10 || microchipLimpo.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'O campo microchip deve conter entre 10 e 20 digitos.'
      });
    }
  }

  if (castrado !== undefined && !isBoolean(castrado)) {
    return res.status(400).json({
      success: false,
      error: 'O campo castrado deve ser booleano (true ou false).'
    });
  }

  if (castracao_pendente !== undefined && !isBoolean(castracao_pendente)) {
    return res.status(400).json({
      success: false,
      error: 'O campo castracao_pendente deve ser booleano (true ou false).'
    });
  }

  if (vacinado !== undefined && !isBoolean(vacinado)) {
    return res.status(400).json({
      success: false,
      error: 'O campo vacinado deve ser booleano (true ou false).'
    });
  }

  if (vacinas === undefined) {
    return res.status(400).json({
      success: false,
      error: 'O campo vacinas deve ser uma lista.'
    });
  }

  if (grupo_vacinacao && !ALLOWED_GRUPOS_VACINACAO.includes(grupo_vacinacao)) {
    return res.status(400).json({
      success: false,
      error: `O campo grupo_vacinacao deve ser um dos valores: ${ALLOWED_GRUPOS_VACINACAO.join(', ')}.`
    });
  }

  if (alerta_vacinal === undefined) {
    return res.status(400).json({
      success: false,
      error: 'O campo alerta_vacinal deve ser uma lista.'
    });
  }

  if (tutor_id !== undefined && !isPositiveIntegerOrNull(tutor_id)) {
    return res.status(400).json({
      success: false,
      error: 'O campo tutor_id deve ser um inteiro positivo ou null.'
    });
  }

  if (territorio_id === undefined) {
    return res.status(400).json({
      success: false,
      error: 'O campo territorio_id deve ser um inteiro positivo ou null.'
    });
  }

  if (observacoes && observacoes.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'O campo observacoes deve ter no maximo 1000 caracteres.'
    });
  }

  if (bairro && bairro.length > 120) {
    return res.status(400).json({
      success: false,
      error: 'O campo bairro deve ter no maximo 120 caracteres.'
    });
  }

  if (endereco_referencia && endereco_referencia.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'O campo endereco_referencia deve ter no maximo 500 caracteres.'
    });
  }

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Latitude e longitude devem ser numeros validos.'
    });
  }

  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    return res.status(400).json({
      success: false,
      error: 'Latitude deve estar entre -90 e 90.'
    });
  }

  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    return res.status(400).json({
      success: false,
      error: 'Longitude deve estar entre -180 e 180.'
    });
  }

  const normalizedCastrado = castrado ?? false;
  const normalizedVacinado = vacinado ?? false;

  req.body = {
    nome,
    especie,
    raca: raca || null,
    raca_outros: raca_outros || null,
    sexo: sexo || null,
    porte: porte || null,
    peso_kg,
    cor: cor || null,
    data_nascimento: data_nascimento || null,
    status,
    microchip: microchip || null,
    castrado: normalizedCastrado,
    castracao_pendente: normalizedCastrado ? false : castracao_pendente ?? false,
    vacinado: normalizedVacinado,
    vacinas: normalizedVacinado ? vacinas : [],
    grupo_vacinacao:
      grupo_vacinacao || (normalizedVacinado ? 'vacinacao_incompleta' : 'nao_vacinado'),
    alerta_vacinal,
    tutor_id: tutor_id ?? null,
    territorio_id,
    observacoes: observacoes || null,
    bairro: bairro || null,
    endereco_referencia: endereco_referencia || null,
    latitude,
    longitude
  };

  next();
};
