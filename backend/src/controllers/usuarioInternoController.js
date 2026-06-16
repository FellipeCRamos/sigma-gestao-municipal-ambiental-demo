const usuarioInternoService = require('../services/usuarioInternoService');
const auditService = require('../services/auditService');
const passwordResetService = require('../services/passwordResetService');
const passwordResetDeliveryService = require('../services/passwordResetDeliveryService');
const logger = require('../utils/logger');

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

exports.login = async (req, res) => {
  try {
    const email = normalizeString(req.body?.email);
    const senha = normalizeString(req.body?.senha);

    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Informe email e senha.'
      });
    }

    const result = await usuarioInternoService.login({ email, senha });

    if (!result) {
      return res.status(401).json({
        success: false,
        error: 'Email ou senha invalidos.'
      });
    }

    await auditService.log({
      ator_tipo: 'interno',
      ator_id: result.user.id,
      acao: 'login',
      entidade: 'usuarios_internos',
      entidade_id: result.user.id,
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('usuario_interno.login.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao autenticar usuario.'
    });
  }
};

exports.me = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: req.usuarioInterno
  });
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const email = normalizeString(req.body?.email);

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Informe o email.'
      });
    }

    const resetRequest = await passwordResetService.requestReset({
      tipo: 'interno',
      email,
      req
    });

    if (resetRequest.created) {
      await passwordResetDeliveryService.sendPasswordResetInstructions({
        tipo: 'interno',
        email,
        token: resetRequest.token,
        req
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Se o email estiver cadastrado, as instrucoes de recuperacao serao enviadas.'
    });
  } catch (error) {
    logger.error('usuario_interno.password_reset_request.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao solicitar recuperacao de senha.'
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const token = normalizeString(req.body?.token);
    const novaSenha = normalizeString(req.body?.nova_senha || req.body?.senha);

    const result = await passwordResetService.resetPassword({
      tipo: 'interno',
      token,
      novaSenha,
      req
    });

    if (!result || result.tipo !== 'interno') {
      return res.status(400).json({
        success: false,
        error: 'Token invalido ou expirado.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Senha redefinida com sucesso.'
    });
  } catch (error) {
    logger.error('usuario_interno.password_reset.error', {
      request_id: req.requestId,
      code: error.code,
      message: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao redefinir senha.'
    });
  }
};
