module.exports = function requirePerfilInterno(perfisPermitidos) {
  return function middleware(req, res, next) {
    const perfil = req.usuarioInterno?.perfil;

    if (!perfil || !perfisPermitidos.includes(perfil)) {
      return res.status(403).json({
        success: false,
        error: 'Usuario sem permissao para esta operacao.'
      });
    }

    return next();
  };
};
