const db = require('./db');
const usuarioInternoService = require('../services/usuarioInternoService');
const logger = require('../utils/logger');
const { IS_PRODUCTION } = require('./env');

async function seedAdmin() {
  const nome = process.env.ADMIN_NOME || 'Administrador SIGBA';
  const email = process.env.ADMIN_EMAIL || '';
  const senha = process.env.ADMIN_SENHA || '';

  if (!email || !senha) {
    throw new Error('ADMIN_EMAIL e ADMIN_SENHA sao obrigatorios para seed:admin em producao.');
  }

  const created = await usuarioInternoService.ensureAdmin({ nome, email, senha });

  if (created) {
    logger.warn('seed_admin.created', {
      email,
      message: 'Senha inicial configurada. Altere antes de uso institucional.'
    });
  } else {
    logger.info('seed_admin.exists', { email });
  }
}

if (require.main === module) {
  seedAdmin()
    .catch((error) => {
      logger.error('seed_admin.error', { message: error.message });
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.end();
    });
}

module.exports = seedAdmin;
