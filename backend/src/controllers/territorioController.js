const territorioService = require('../services/territorioService');
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

exports.findAll = async (req, res) => {
  try {
    const result = await territorioService.findAll({
      incluir_inativos: req.query?.incluir_inativos === 'true',
      busca: normalizeString(req.query?.busca) || '',
      categoria: normalizeString(req.query?.categoria) || ''
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar territorios.');
  }
};

exports.findById = async (req, res) => {
  try {
    const result = await territorioService.findByIdAdmin(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Territorio nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.find.error', error, {
      territorio_id: Number(req.params.id) || null,
    });
    return handleServiceError(res, error, 'Erro interno ao buscar territorio.');
  }
};

exports.createTerritorio = async (req, res) => {
  try {
    const result = await territorioService.createTerritorio(req.body || {}, req.usuarioInterno, req);

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao criar territorio.');
  }
};

exports.updateTerritorio = async (req, res) => {
  try {
    const result = await territorioService.updateTerritorio(req.params.id, req.body || {}, req.usuarioInterno, req);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Territorio nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.update.error', error, {
      territorio_id: Number(req.params.id) || null,
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar territorio.');
  }
};

exports.updateTerritorioStatus = async (req, res) => {
  try {
    const result = await territorioService.updateTerritorioStatus(
      req.params.id,
      normalizeString(req.body?.status),
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Territorio nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.status.update.error', error, {
      territorio_id: Number(req.params.id) || null,
      status: normalizeString(req.body?.status) || null,
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar status do territorio.');
  }
};

exports.listAliases = async (req, res) => {
  try {
    const result = await territorioService.listAliases({
      territorio_id: req.params.id || req.query?.territorio_id || null,
      incluir_inativos: req.query?.incluir_inativos === 'true'
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.alias.list.error', error, {
      territorio_id: Number(req.params.id || req.query?.territorio_id) || null,
    });
    return handleServiceError(res, error, 'Erro interno ao listar aliases territoriais.');
  }
};

exports.createAlias = async (req, res) => {
  try {
    const result = await territorioService.createAlias(req.params.id, req.body || {}, req.usuarioInterno, req);

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.alias.create.error', error, {
      territorio_id: Number(req.params.id) || null,
    });
    return handleServiceError(res, error, 'Erro interno ao criar alias territorial.');
  }
};

exports.updateAlias = async (req, res) => {
  try {
    const result = await territorioService.updateAlias(req.params.aliasId, req.body || {}, req.usuarioInterno, req);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Alias territorial nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.alias.update.error', error, {
      alias_id: Number(req.params.aliasId) || null,
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar alias territorial.');
  }
};

exports.updateAliasStatus = async (req, res) => {
  try {
    const result = await territorioService.updateAliasStatus(
      req.params.aliasId,
      normalizeString(req.body?.status),
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Alias territorial nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.alias.status.update.error', error, {
      alias_id: Number(req.params.aliasId) || null,
      status: normalizeString(req.body?.status) || null,
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar status do alias territorial.');
  }
};

exports.getQualidade = async (req, res) => {
  try {
    const result = await territorioService.getQualidadeTerritorial();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.qualidade.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar qualidade territorial.');
  }
};

exports.getGestaoStats = async (req, res) => {
  try {
    const result = await territorioService.getGestaoStats();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.gestao.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar gestao territorial.');
  }
};

exports.listLegado = async (req, res) => {
  try {
    const result = await territorioService.listLegado({
      modulo: normalizeString(req.query?.modulo) || '',
      limit: req.query?.limit || 100
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'territorio.legado.list.error', error, {
      modulo: normalizeString(req.query?.modulo) || null,
    });
    return handleServiceError(res, error, 'Erro interno ao listar legado territorial.');
  }
};

exports.reviewLegado = async (req, res) => {
  try {
    const result = await territorioService.reviewLegado(
      {
        modulo: normalizeString(req.body?.modulo),
        registro_id: req.body?.registro_id,
        territorio_id: req.body?.territorio_id,
        alias_id: req.body?.alias_id,
        decisao: normalizeString(req.body?.decisao),
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
    logControllerError(req, 'territorio.legado.review.error', error, {
      modulo: normalizeString(req.body?.modulo) || null,
      registro_id: Number(req.body?.registro_id) || null,
    });
    return handleServiceError(res, error, 'Erro interno ao revisar legado territorial.');
  }
};
