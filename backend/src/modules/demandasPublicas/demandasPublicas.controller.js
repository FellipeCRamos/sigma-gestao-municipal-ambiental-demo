const demandasPublicasService = require('./demandasPublicas.service');
const { logControllerError } = require('../../utils/controllerLogger');
const { hasPermission, PERMISSIONS } = require('../../config/permissions');

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

function canViewSensitiveDemandData(user) {
  return hasPermission(user, PERMISSIONS.DEMANDAS_PUBLICAS_VIEW_SENSITIVE);
}

exports.createPublicDemand = async (req, res) => {
  try {
    const result = await demandasPublicasService.createPublicDemand(req.body || {}, req);
    return res.status(201).json({
      success: true,
      data: result,
      message: `Comunicacao registrada com sucesso. Protocolo: ${result.protocolo}.`,
    });
  } catch (error) {
    logControllerError(req, 'demandas_publicas.public_create.error', error);
    return handleServiceError(res, error, 'Erro interno ao registrar comunicacao publica.');
  }
};

exports.listDemands = async (req, res) => {
  try {
    const result = await demandasPublicasService.listDemands(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'demandas_publicas.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar demandas publicas.');
  }
};

exports.getDemand = async (req, res) => {
  try {
    const result = await demandasPublicasService.getDemand(parsePositiveIntOrThrow(req.params.id), {
      includeSensitive: canViewSensitiveDemandData(req.usuarioInterno),
      user: req.usuarioInterno,
      req,
    });

    if (!result) {
      return res.status(404).json({ success: false, error: 'Demanda publica nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'demandas_publicas.detail.error', error, {
      demanda_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar demanda publica.');
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const includeSensitive = canViewSensitiveDemandData(req.usuarioInterno);
    const result = await demandasPublicasService.updateStatus(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req,
      { includeSensitive, user: req.usuarioInterno, req }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Demanda publica nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'demandas_publicas.status_update.error', error, {
      demanda_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar status da demanda publica.');
  }
};

exports.createMovement = async (req, res) => {
  try {
    const includeSensitive = canViewSensitiveDemandData(req.usuarioInterno);
    const result = await demandasPublicasService.createMovement(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req,
      { includeSensitive, user: req.usuarioInterno, req }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Demanda publica nao encontrada.' });
    }

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'demandas_publicas.movimentacao_create.error', error, {
      demanda_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao registrar movimentacao da demanda publica.');
  }
};

exports.assignResponsible = async (req, res) => {
  try {
    const includeSensitive = canViewSensitiveDemandData(req.usuarioInterno);
    const result = await demandasPublicasService.assignResponsible(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req,
      { includeSensitive, user: req.usuarioInterno, req }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Demanda publica nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'demandas_publicas.responsavel_assign.error', error, {
      demanda_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atribuir responsavel da demanda publica.');
  }
};

exports.closeDemand = async (req, res) => {
  try {
    const includeSensitive = canViewSensitiveDemandData(req.usuarioInterno);
    const result = await demandasPublicasService.closeDemand(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req,
      { includeSensitive, user: req.usuarioInterno, req }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Demanda publica nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'demandas_publicas.close.error', error, {
      demanda_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao encerrar demanda publica.');
  }
};
