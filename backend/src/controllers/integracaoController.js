const integracaoService = require('../services/integracaoService');
const logger = require('../utils/logger');

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function hasScope(parceiro, scope) {
  const escopos = Array.isArray(parceiro?.escopos) ? parceiro.escopos : [];
  return escopos.includes(scope);
}

async function withPartner(req, res, scope, handler) {
  const token = req.headers['x-sigba-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const parceiro = await integracaoService.authenticate(token);

  if (!parceiro) {
    await integracaoService.logRequest({
      parceiroId: null,
      endpoint: req.originalUrl,
      metodo: req.method,
      statusCode: 401
    });

    return res.status(401).json({
      success: false,
      error: 'API key de parceiro invalida.'
    });
  }

  if (!hasScope(parceiro, scope)) {
    await integracaoService.logRequest({
      parceiroId: parceiro.id,
      endpoint: req.originalUrl,
      metodo: req.method,
      statusCode: 403
    });

    return res.status(403).json({
      success: false,
      error: 'Parceiro sem escopo para este recurso.'
    });
  }

  res.on('finish', () => {
    integracaoService.logRequest({
      parceiroId: parceiro.id,
      endpoint: req.originalUrl,
      metodo: req.method,
      statusCode: res.statusCode
    }).catch((error) => logger.error('integracao.log_request.error', {
      request_id: req.requestId,
      message: error.message
    }));
  });

  return handler(parceiro);
}

exports.createParceiro = async (req, res) => {
  try {
    const nome = normalizeString(req.body?.nome);
    const descricao = normalizeString(req.body?.descricao);
    const escopos = Array.isArray(req.body?.escopos) ? req.body.escopos : undefined;
    const expires_at = normalizeString(req.body?.expires_at) || null;

    if (!nome || nome.length < 3 || nome.length > 160) {
      return res.status(400).json({
        success: false,
        error: 'Informe o nome do parceiro com 3 a 160 caracteres.'
      });
    }

    if (expires_at && Number.isNaN(new Date(expires_at).getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Data de expiracao invalida.'
      });
    }

    const result = await integracaoService.createParceiro(
      { nome, descricao, escopos, expires_at },
      req.usuarioInterno,
      req
    );

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('integracao.parceiro.create.error', {
      request_id: req.requestId,
      message: error.message
    });
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar parceiro.'
    });
  }
};

exports.findParceiros = async (req, res) => {
  try {
    const result = await integracaoService.findParceiros();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('integracao.parceiro.list.error', {
      request_id: req.requestId,
      message: error.message
    });
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar parceiros.'
    });
  }
};

exports.revokeParceiro = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Parceiro invalido.'
      });
    }

    const result = await integracaoService.revokeParceiro(id, req.usuarioInterno, req);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro nao encontrado.'
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('integracao.parceiro.revoke.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao revogar parceiro.'
    });
  }
};

exports.rotateParceiro = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Parceiro invalido.'
      });
    }

    const result = await integracaoService.rotateParceiro(id, req.usuarioInterno, req);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro ativo nao encontrado para rotacao.'
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('integracao.parceiro.rotate.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao rotacionar parceiro.'
    });
  }
};

exports.getIndicadores = async (req, res) => {
  return withPartner(req, res, 'indicadores', async () => {
    const result = await integracaoService.getIndicadoresParceiro();
    return res.status(200).json({ success: true, data: result });
  });
};

exports.getAnimal = async (req, res) => {
  return withPartner(req, res, 'animais_publicos', async () => {
    const result = await integracaoService.getAnimalParceiro(String(req.params.publicId || '').trim());

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Animal nao encontrado.'
      });
    }

    return res.status(200).json({ success: true, data: result });
  });
};
