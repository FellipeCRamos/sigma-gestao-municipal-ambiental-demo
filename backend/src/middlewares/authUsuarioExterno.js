const jwt = require('jsonwebtoken');
const usuarioExternoService = require('../services/usuarioExternoService');
const { JWT_SECRET } = require('../config/env');

module.exports = async function authUsuarioExterno(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const [, token] = authorization.split(' ');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token nao informado.'
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.role !== 'tutor') {
      return res.status(403).json({
        success: false,
        error: 'Token sem permissao de tutor.'
      });
    }

    const versionValid = await usuarioExternoService.isTokenVersionValid(
      payload.sub,
      payload.token_version || 0
    );

    if (!versionValid) {
      return res.status(401).json({
        success: false,
        error: 'Sessao expirada. Entre novamente.'
      });
    }

    const user = await usuarioExternoService.findById(payload.sub);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario nao encontrado.'
      });
    }

    req.usuarioExterno = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token invalido ou expirado.'
    });
  }
};
