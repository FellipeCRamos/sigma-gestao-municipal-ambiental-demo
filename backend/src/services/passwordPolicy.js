const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  'senha123',
  'admin123',
  'sigba123',
  'sigba1234',
  'password',
  'qwerty123'
]);

function validatePassword(senha) {
  const value = String(senha || '');

  if (value.length < 8) {
    return {
      valid: false,
      message: 'A senha deve ter pelo menos 8 caracteres.'
    };
  }

  if (value.length > 128) {
    return {
      valid: false,
      message: 'A senha deve ter no maximo 128 caracteres.'
    };
  }

  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return {
      valid: false,
      message: 'A senha deve combinar letras e numeros.'
    };
  }

  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return {
      valid: false,
      message: 'Escolha uma senha menos previsivel.'
    };
  }

  return { valid: true, message: '' };
}

function assertPasswordPolicy(senha) {
  const result = validatePassword(senha);

  if (!result.valid) {
    const error = new Error(result.message);
    error.code = 'PASSWORD_POLICY';
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  validatePassword,
  assertPasswordPolicy,
  PASSWORD_POLICY_MESSAGE: 'Use pelo menos 8 caracteres, combinando letras e numeros.',
};
