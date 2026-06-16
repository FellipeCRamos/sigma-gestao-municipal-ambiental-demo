const viveiroPublicService = require('./viveiroPublicService');
const { logControllerError } = require('../../utils/controllerLogger');

function handleServiceError(res, error, fallbackMessage) {
  return res.status(error.statusCode || 500).json({
    success: false,
    error: error.statusCode ? error.message : fallbackMessage,
    details: error.details || undefined,
  });
}

exports.getPublicStatus = async (req, res) => {
  try {
    const result = await viveiroPublicService.getPublicStatus();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.public.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao consultar status publico do Viveiro.');
  }
};

exports.listPublicEspecies = async (req, res) => {
  try {
    const result = await viveiroPublicService.listPublicEspecies();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.public.especies.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar especies publicas do Viveiro.');
  }
};

exports.createPublicSolicitacao = async (req, res) => {
  try {
    const result = await viveiroPublicService.createPublicSolicitacao(req.body || {}, req);
    return res.status(201).json({
      success: true,
      data: result,
      message: result.mensagem,
    });
  } catch (error) {
    logControllerError(req, 'viveiro.public.solicitacao.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao receber solicitacao publica de mudas.');
  }
};
