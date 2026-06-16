const cadastroSaneamentoService = require('../services/cadastroSaneamentoService');
const { logControllerError } = require('../utils/controllerLogger');

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function handleServiceError(res, error, fallbackMessage) {
  return res.status(error.statusCode || 500).json({
    success: false,
    error: error.statusCode ? error.message : fallbackMessage,
    details: error.details || undefined
  });
}

exports.listCases = async (req, res) => {
  try {
    const result = await cadastroSaneamentoService.listCases({
      status: normalizeString(req.query.status) || '',
      entidade: normalizeString(req.query.entidade) || '',
      tipo: normalizeString(req.query.tipo) || ''
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'saneamento.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar casos de saneamento.');
  }
};

exports.findCaseById = async (req, res) => {
  try {
    const result = await cadastroSaneamentoService.findCaseById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Caso de saneamento nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'saneamento.find.error', error);
    return handleServiceError(res, error, 'Erro interno ao buscar caso de saneamento.');
  }
};

exports.reviewCase = async (req, res) => {
  try {
    const result = await cadastroSaneamentoService.reviewCase(
      req.params.id,
      {
        status: normalizeString(req.body?.status),
        decisao: normalizeString(req.body?.decisao),
        observacao: normalizeString(req.body?.observacao)
      },
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Caso de saneamento nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'saneamento.review.error', error);
    return handleServiceError(res, error, 'Erro interno ao revisar caso de saneamento.');
  }
};

exports.mergeTutor = async (req, res) => {
  try {
    const result = await cadastroSaneamentoService.mergeTutor(
      req.params.id,
      {
        principal_id: req.body?.principal_id,
        incorporado_id: req.body?.incorporado_id,
        observacao: normalizeString(req.body?.observacao)
      },
      req.usuarioInterno,
      req
    );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'saneamento.merge_tutor.error', error);
    return handleServiceError(res, error, 'Erro interno ao mesclar tutores.');
  }
};

exports.getStats = async (req, res) => {
  try {
    const result = await cadastroSaneamentoService.getStats();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'saneamento.stats.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar estatisticas de saneamento.');
  }
};
