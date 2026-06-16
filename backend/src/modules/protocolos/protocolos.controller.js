const protocolosService = require('./protocolos.service');
const { logControllerError } = require('../../utils/controllerLogger');

exports.searchProtocolos = async (req, res) => {
  try {
    const data = await protocolosService.searchProtocolos(req.query || {});
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logControllerError(req, 'protocolos.search.error', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao consultar protocolos.',
    });
  }
};

exports.getProtocolDetail = async (req, res) => {
  try {
    const data = await protocolosService.getProtocolDetail(req.params.protocolo);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Protocolo nao encontrado.' });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    logControllerError(req, 'protocolos.detail.error', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar protocolo.',
    });
  }
};
