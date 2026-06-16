const anexosService = require('./anexos.service');
const { hasPermission, PERMISSIONS } = require('../../config/permissions');
const { logControllerError } = require('../../utils/controllerLogger');

function handleServiceError(res, error, fallbackMessage) {
  return res.status(error.statusCode || 500).json({
    success: false,
    error: error.statusCode ? error.message : fallbackMessage,
    details: error.details || undefined,
  });
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

function ensureCanAccessSensitive(req, anexo) {
  if (anexo?.sensivel && !hasPermission(req.usuarioInterno, PERMISSIONS.ANEXOS_VIEW_SENSITIVE)) {
    const error = new Error('Usuario sem permissao para acessar anexo sensivel.');
    error.statusCode = 403;
    throw error;
  }
}

exports.createAnexo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Envie um arquivo no campo arquivo.' });
    }

    const result = await anexosService.createAnexo(req.body || {}, req.file, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'anexos.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao enviar anexo.');
  }
};

exports.listAnexos = async (req, res) => {
  try {
    const result = await anexosService.listAnexos(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'anexos.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar anexos.');
  }
};

exports.getAnexo = async (req, res) => {
  try {
    const result = await anexosService.getAnexo(parsePositiveIntOrThrow(req.params.id));

    if (!result) {
      return res.status(404).json({ success: false, error: 'Anexo nao encontrado.' });
    }

    ensureCanAccessSensitive(req, result);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'anexos.detail.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar anexo.');
  }
};

exports.downloadAnexo = async (req, res) => {
  try {
    const anexo = await anexosService.getAnexoForDownload(
      parsePositiveIntOrThrow(req.params.id),
      req.usuarioInterno,
      req
    );

    if (!anexo || !anexosService.fileExists(anexo)) {
      return res.status(404).json({ success: false, error: 'Anexo nao encontrado.' });
    }

    ensureCanAccessSensitive(req, anexo);
    return res.download(anexo.caminho_armazenamento, anexo.nome_original);
  } catch (error) {
    logControllerError(req, 'anexos.download.error', error);
    return handleServiceError(res, error, 'Erro interno ao baixar anexo.');
  }
};

exports.removeAnexo = async (req, res) => {
  try {
    const result = await anexosService.removeAnexo(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Anexo nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'anexos.remove.error', error);
    return handleServiceError(res, error, 'Erro interno ao remover anexo.');
  }
};

exports.createDemandAnexo = async (req, res) => {
  try {
    const demandaId = parsePositiveIntOrThrow(req.params.id, 'demanda_id');

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Envie um arquivo no campo arquivo.' });
    }

    const result = await anexosService.createAnexo(
      req.body || {},
      req.file,
      req.usuarioInterno,
      req,
      {
        modulo_origem: 'demandas_publicas',
        entidade_tipo: 'demanda_publica',
        entidade_id: demandaId,
      }
    );

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'demandas_publicas.anexos.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao enviar anexo da demanda publica.');
  }
};

exports.listDemandAnexos = async (req, res) => {
  try {
    const result = await anexosService.listDemandAnexos(parsePositiveIntOrThrow(req.params.id, 'demanda_id'));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'demandas_publicas.anexos.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar anexos da demanda publica.');
  }
};

exports.downloadDemandAnexo = async (req, res) => {
  try {
    const demandaId = parsePositiveIntOrThrow(req.params.id, 'demanda_id');
    const anexoId = parsePositiveIntOrThrow(req.params.anexoId, 'anexo_id');
    const anexo = await anexosService.getAnexoForDownload(anexoId, req.usuarioInterno, req, {
      modulo_origem: 'demandas_publicas',
      entidade_tipo: 'demanda_publica',
      entidade_id: demandaId,
    });

    if (!anexo || !anexosService.fileExists(anexo)) {
      return res.status(404).json({ success: false, error: 'Anexo nao encontrado.' });
    }

    ensureCanAccessSensitive(req, anexo);
    return res.download(anexo.caminho_armazenamento, anexo.nome_original);
  } catch (error) {
    logControllerError(req, 'demandas_publicas.anexos.download.error', error);
    return handleServiceError(res, error, 'Erro interno ao baixar anexo da demanda publica.');
  }
};

exports.removeDemandAnexo = async (req, res) => {
  try {
    const demandaId = parsePositiveIntOrThrow(req.params.id, 'demanda_id');
    const anexoId = parsePositiveIntOrThrow(req.params.anexoId, 'anexo_id');
    const result = await anexosService.removeAnexo(
      anexoId,
      req.body || {},
      req.usuarioInterno,
      req,
      {
        modulo_origem: 'demandas_publicas',
        entidade_tipo: 'demanda_publica',
        entidade_id: demandaId,
      }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Anexo nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'demandas_publicas.anexos.remove.error', error);
    return handleServiceError(res, error, 'Erro interno ao remover anexo da demanda publica.');
  }
};
