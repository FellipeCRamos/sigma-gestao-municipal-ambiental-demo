const fiscalizacaoService = require('./fiscalizacao.service');
const { hasPermission, PERMISSIONS } = require('../../config/permissions');
const { logControllerError } = require('../../utils/controllerLogger');

function handleServiceError(res, error, fallbackMessage) {
  return res.status(error.statusCode || 500).json({
    success: false,
    error: error.statusCode ? error.message : fallbackMessage,
    details: error.details || undefined,
  });
}

function parseIntOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveIntOrThrow(value, fieldName = 'id') {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`Parametro invalido: ${fieldName}.`);
    error.statusCode = 400;
    error.details = { field: fieldName };
    throw error;
  }

  return parsed;
}

exports.listFiscalizacoes = async (req, res) => {
  try {
    const result = await fiscalizacaoService.listFiscalizacoes(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'fiscalizacao.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar fiscalizacoes ambientais.');
  }
};

exports.getFiscalizacao = async (req, res) => {
  try {
    const result = await fiscalizacaoService.getFiscalizacao(parsePositiveIntOrThrow(req.params.id));

    if (!result) {
      return res.status(404).json({ success: false, error: 'Fiscalizacao ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'fiscalizacao.detail.error', error, {
      fiscalizacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar fiscalizacao ambiental.');
  }
};

exports.convertDemand = async (req, res) => {
  try {
    const result = await fiscalizacaoService.convertDemand(
      parsePositiveIntOrThrow(req.params.demandaId, 'demanda_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'fiscalizacao.convert_demand.error', error, {
      demanda_id: parseIntOrNull(req.params.demandaId),
    });
    return handleServiceError(res, error, 'Erro interno ao converter demanda em fiscalizacao.');
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const result = await fiscalizacaoService.updateStatus(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Fiscalizacao ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'fiscalizacao.status_update.error', error, {
      fiscalizacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar status da fiscalizacao.');
  }
};

exports.assignResponsible = async (req, res) => {
  try {
    const result = await fiscalizacaoService.assignResponsible(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Fiscalizacao ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'fiscalizacao.responsavel_assign.error', error, {
      fiscalizacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atribuir responsavel da fiscalizacao.');
  }
};

exports.createMovement = async (req, res) => {
  try {
    const result = await fiscalizacaoService.createMovement(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Fiscalizacao ambiental nao encontrada.' });
    }

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'fiscalizacao.movimentacao_create.error', error, {
      fiscalizacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao registrar movimentacao da fiscalizacao.');
  }
};

exports.closePreliminarily = async (req, res) => {
  try {
    const result = await fiscalizacaoService.closePreliminarily(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Fiscalizacao ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'fiscalizacao.close_preliminar.error', error, {
      fiscalizacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao encerrar preliminarmente a fiscalizacao.');
  }
};

exports.listInheritedAnexos = async (req, res) => {
  try {
    const result = await fiscalizacaoService.listInheritedAnexos(parsePositiveIntOrThrow(req.params.id), {
      includeSensitive: hasPermission(req.usuarioInterno, PERMISSIONS.ANEXOS_VIEW_SENSITIVE),
    });

    if (!result) {
      return res.status(404).json({ success: false, error: 'Fiscalizacao ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'fiscalizacao.anexos.list.error', error, {
      fiscalizacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao listar anexos herdados da fiscalizacao.');
  }
};
