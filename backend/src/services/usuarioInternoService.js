const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, JWT_INTERNO_EXPIRES_IN } = require('../config/env');
const { assertPasswordPolicy } = require('./passwordPolicy');
const { getPermissionsForPerfil } = require('../config/permissions');

function sanitizeUser(user) {
  if (!user) return null;
  const { senha_hash, ...safeUser } = user;
  return {
    ...safeUser,
    permissoes: getPermissionsForPerfil(safeUser.perfil)
  };
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: 'interno',
      perfil: user.perfil,
      email: user.email,
      token_version: user.token_version || 0
    },
    JWT_SECRET,
    { expiresIn: JWT_INTERNO_EXPIRES_IN }
  );
}

exports.login = async ({ email, senha }) => {
  const result = await db.query(
    `
      SELECT *
      FROM usuarios_internos
      WHERE email = $1
        AND status = 'ativo';
    `,
    [email.toLowerCase()]
  );

  const user = result.rows[0];

  if (!user) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(senha, user.senha_hash);

  if (!passwordMatches) {
    return null;
  }

  const safeUser = sanitizeUser(user);

  return {
    user: safeUser,
    token: createToken(safeUser)
  };
};

exports.findById = async (id) => {
  const result = await db.query(
    `
      SELECT *
      FROM usuarios_internos
      WHERE id = $1
        AND status = 'ativo';
    `,
    [id]
  );

  return sanitizeUser(result.rows[0]);
};

exports.isTokenVersionValid = async (id, tokenVersion = 0) => {
  const result = await db.query(
    `
      SELECT token_version
      FROM usuarios_internos
      WHERE id = $1
        AND status = 'ativo';
    `,
    [id]
  );

  const current = result.rows[0];
  return Boolean(current && Number(current.token_version || 0) === Number(tokenVersion || 0));
};

exports.ensureAdmin = async ({ nome, email, senha }) => {
  assertPasswordPolicy(senha);

  const existing = await db.query(
    `
      SELECT id
      FROM usuarios_internos
      WHERE email = $1;
    `,
    [email.toLowerCase()]
  );

  if (existing.rows[0]) {
    return false;
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  await db.query(
    `
      INSERT INTO usuarios_internos (
        nome,
        email,
        senha_hash,
        perfil,
        status
      )
      VALUES ($1, $2, $3, 'admin', 'ativo');
    `,
    [nome, email.toLowerCase(), senhaHash]
  );

  return true;
};
