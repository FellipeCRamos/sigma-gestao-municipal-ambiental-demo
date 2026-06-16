const { hasPermission } = require('../config/permissions');

module.exports = function requirePermission(permission) {
  return function middleware(req, res, next) {
    if (!hasPermission(req.usuarioInterno, permission)) {
      return res.status(403).json({
        success: false,
        error: 'Usuario sem permissao para esta acao.'
      });
    }

    return next();
  };
};
