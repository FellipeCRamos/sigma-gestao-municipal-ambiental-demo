const dashboardService = require('../services/dashboardService');
const biTerritorialService = require('../services/biTerritorialService');
const { logControllerError } = require('../utils/controllerLogger');

exports.getSummary = async (req, res) => {
  try {
    const result = await dashboardService.getSummary();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'dashboard.summary.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar dashboard.'
    });
  }
};

exports.getGerencialDashboard = async (req, res) => {
  try {
    const result = await dashboardService.getGerencialDashboard();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'dashboard.gerencial.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar dashboard gerencial.'
    });
  }
};

exports.getVacinacaoDashboard = async (req, res) => {
  try {
    const result = await dashboardService.getVacinacaoDashboard();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'dashboard.vacinacao.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar painel vacinal.'
    });
  }
};

exports.getQualidadeCadastralDashboard = async (req, res) => {
  try {
    const result = await dashboardService.getQualidadeCadastralDashboard();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'dashboard.qualidade.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar painel de qualidade cadastral.'
    });
  }
};

exports.getBiTerritorialDashboard = async (req, res) => {
  try {
    const result = await biTerritorialService.getBiTerritorialInterno();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'dashboard.bi_territorial.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar BI territorial.'
    });
  }
};
