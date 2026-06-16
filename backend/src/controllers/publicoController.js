const publicoService = require('../services/publicoService');
const territorioService = require('../services/territorioService');
const { logControllerError } = require('../utils/controllerLogger');

exports.getIndicadores = async (req, res) => {
  try {
    const result = await publicoService.getIndicadoresPublicos();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'publico.indicadores.error', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar indicadores publicos.'
    });
  }
};

exports.getAnimal = async (req, res) => {
  try {
    const publicId = String(req.params.publicId || '').trim();
    const result = await publicoService.getAnimalPublico(publicId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Animal nao encontrado para consulta publica.'
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'publico.animal.error', error, {
      public_id: String(req.params.publicId || '').trim() || null,
    });
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao consultar animal.'
    });
  }
};

exports.getGovernanca = async (req, res) => {
  try {
    const result = await publicoService.getGovernancaPublica();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'publico.governanca.error', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar governanca publica.'
    });
  }
};

exports.getTermoUso = async (req, res) => {
  try {
    const result = await publicoService.getTermoUso();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'publico.termo_uso.error', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar termo de uso.'
    });
  }
};

exports.getPoliticaPrivacidade = async (req, res) => {
  try {
    const result = await publicoService.getPoliticaPrivacidade();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'publico.politica_privacidade.error', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar politica de privacidade.'
    });
  }
};

exports.getTerritorios = async (req, res) => {
  try {
    const result = await territorioService.findAll();
    const data = result.map((territorio) => ({
      id: territorio.id,
      nome: territorio.nome,
      categoria: territorio.categoria
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    logControllerError(req, 'publico.territorios.error', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar territorios.'
    });
  }
};
