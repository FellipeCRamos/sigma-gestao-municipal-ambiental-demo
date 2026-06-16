// src/middlewares/validateTutor.js

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidCpf(cpf) {
  if (!cpf) return true;
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11;
}

function normalizePositiveIntegerOrNull(value) {
  if (value === undefined || value === null || value === '') return null;

  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return undefined;

  return number;
}

module.exports = function validateTutor(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Corpo da requisição inválido.'
    });
  }

  const nome = normalizeString(body.nome);
  const cpf = normalizeString(body.cpf);
  const telefone = normalizeString(body.telefone);
  const email = normalizeString(body.email);
  const endereco = normalizeString(body.endereco);
  const bairro = normalizeString(body.bairro);
  const territorio_id = normalizePositiveIntegerOrNull(body.territorio_id);

  if (!nome || nome.length < 2 || nome.length > 150) {
    return res.status(400).json({
      success: false,
      error: 'O campo nome é obrigatório e deve ter entre 2 e 150 caracteres.'
    });
  }

  if (cpf && !isValidCpf(cpf)) {
    return res.status(400).json({
      success: false,
      error: 'O campo cpf deve conter 11 dígitos.'
    });
  }

  if (telefone && telefone.length > 20) {
    return res.status(400).json({
      success: false,
      error: 'O campo telefone deve ter no máximo 20 caracteres.'
    });
  }

  if (email && !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: 'O campo email deve ter um formato válido.'
    });
  }

  if (email && email.length > 150) {
    return res.status(400).json({
      success: false,
      error: 'O campo email deve ter no máximo 150 caracteres.'
    });
  }

  if (endereco && endereco.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'O campo endereco deve ter no máximo 500 caracteres.'
    });
  }

  if (bairro && bairro.length > 120) {
    return res.status(400).json({
      success: false,
      error: 'O campo bairro deve ter no maximo 120 caracteres.'
    });
  }

  if (territorio_id === undefined) {
    return res.status(400).json({
      success: false,
      error: 'O campo territorio_id deve ser um inteiro positivo ou null.'
    });
  }

  req.body = {
    nome,
    cpf: cpf || null,
    telefone: telefone || null,
    email: email || null,
    endereco: endereco || null,
    bairro: bairro || null,
    territorio_id
  };

  next();
};
