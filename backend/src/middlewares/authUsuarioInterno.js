const jwt = require('jsonwebtoken');
const usuarioInternoService = require('../services/usuarioInternoService');
const { JWT_SECRET } = require('../config/env');

module.exports = async function authUsuarioInterno(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const [, token] = authorization.split(' ');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token interno nao informado.'
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.role !== 'interno') {
      return res.status(403).json({
        success: false,
        error: 'Token sem permissao interna.'
      });
    }

    const versionValid = await usuarioInternoService.isTokenVersionValid(
      payload.sub,
      payload.token_version || 0
    );

    if (!versionValid) {
      return res.status(401).json({
        success: false,
        error: 'Sessao expirada. Entre novamente.'
      });
    }

    const user = await usuarioInternoService.findById(payload.sub);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario interno nao encontrado.'
      });
    }

    req.usuarioInterno = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token interno invalido ou expirado.'
    });
  }
};
