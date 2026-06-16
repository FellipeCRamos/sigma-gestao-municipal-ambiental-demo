const logger = require('./logger');

function logControllerError(req, event, error, meta = {}) {
  logger.error(event, {
    request_id: req?.requestId || null,
    method: req?.method || null,
    path: req?.originalUrl || null,
    actor_interno_id: req?.usuarioInterno?.id || null,
    actor_externo_id: req?.usuarioExterno?.id || null,
    status_code: error?.statusCode || null,
    code: error?.code || null,
    message: error?.message || 'Erro nao identificado.',
    ...meta,
  });
}

module.exports = {
  logControllerError,
};
