const geoambientalService = require('./geoambiental.service');
const { logControllerError } = require('../../utils/controllerLogger');

function parseId(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error('Parametro id invalido.');
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function handleError(req, res, error, event, fallbackMessage) {
  logControllerError(req, event, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    error: error.statusCode ? error.message : fallbackMessage,
    details: error.details || undefined,
  });
}

exports.listLocalizacoes = async (req, res) => {
  try {
    const data = await geoambientalService.listLocalizacoes(req.query || {});
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(req, res, error, 'geo.localizacoes.list.error', 'Erro interno ao listar localizacoes geoambientais.');
  }
};

exports.getLocalizacao = async (req, res) => {
  try {
    const data = await geoambientalService.getLocalizacao(parseId(req.params.id), {
      user: req.usuarioInterno,
      req,
    });

    if (!data) {
      return res.status(404).json({ success: false, error: 'Localizacao geoambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(req, res, error, 'geo.localizacoes.detail.error', 'Erro interno ao carregar localizacao geoambiental.');
  }
};

exports.createLocalizacao = async (req, res) => {
  try {
    const data = await geoambientalService.createLocalizacao(req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(req, res, error, 'geo.localizacoes.create.error', 'Erro interno ao criar localizacao geoambiental.');
  }
};

exports.updateLocalizacao = async (req, res) => {
  try {
    const data = await geoambientalService.updateLocalizacao(
      parseId(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!data) {
      return res.status(404).json({ success: false, error: 'Localizacao geoambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(req, res, error, 'geo.localizacoes.update.error', 'Erro interno ao atualizar localizacao geoambiental.');
  }
};

exports.createVinculo = async (req, res) => {
  try {
    const data = await geoambientalService.createVinculo(
      parseId(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!data) {
      return res.status(404).json({ success: false, error: 'Localizacao geoambiental nao encontrada.' });
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(req, res, error, 'geo.vinculos.create.error', 'Erro interno ao criar vinculo geoambiental.');
  }
};

exports.listVinculos = async (req, res) => {
  try {
    const data = await geoambientalService.listVinculos(parseId(req.params.id));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(req, res, error, 'geo.vinculos.list.error', 'Erro interno ao listar vinculos geoambientais.');
  }
};

exports.listCamadas = async (req, res) => {
  try {
    const data = await geoambientalService.listCamadas();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(req, res, error, 'geo.camadas.list.error', 'Erro interno ao listar camadas geoambientais.');
  }
};

exports.simularIntersecoes = async (req, res) => {
  try {
    const data = await geoambientalService.simularIntersecoes(req.body || {}, req.usuarioInterno, req);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(req, res, error, 'geo.intersecoes.simular.error', 'Erro interno ao simular intersecoes geoambientais.');
  }
};
