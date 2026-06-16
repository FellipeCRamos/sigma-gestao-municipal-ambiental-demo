const vistoriasService = require('./vistorias.service');
const anexosService = require('../anexos/anexos.service');
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

function ensureCanAccessSensitive(req, anexo) {
  if (anexo?.sensivel && !hasPermission(req.usuarioInterno, PERMISSIONS.ANEXOS_VIEW_SENSITIVE)) {
    const error = new Error('Usuario sem permissao para acessar anexo sensivel.');
    error.statusCode = 403;
    throw error;
  }
}

exports.listVistorias = async (req, res) => {
  try {
    const result = await vistoriasService.listVistorias(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar vistorias ambientais.');
  }
};

exports.listVistoriasByFiscalizacao = async (req, res) => {
  try {
    const result = await vistoriasService.listVistoriasByFiscalizacao(
      parsePositiveIntOrThrow(req.params.id, 'fiscalizacao_id')
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Fiscalizacao ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.by_fiscalizacao.error', error, {
      fiscalizacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao listar vistorias da fiscalizacao.');
  }
};

exports.getVistoria = async (req, res) => {
  try {
    const result = await vistoriasService.getVistoria(parsePositiveIntOrThrow(req.params.id, 'vistoria_id'));

    if (!result) {
      return res.status(404).json({ success: false, error: 'Vistoria ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.detail.error', error, {
      vistoria_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar vistoria ambiental.');
  }
};

exports.createVistoria = async (req, res) => {
  try {
    const result = await vistoriasService.createVistoria(
      parsePositiveIntOrThrow(req.params.id, 'fiscalizacao_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.create.error', error, {
      fiscalizacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao criar vistoria ambiental.');
  }
};

exports.updateVistoriaStatus = async (req, res) => {
  try {
    const result = await vistoriasService.updateVistoriaStatus(
      parsePositiveIntOrThrow(req.params.id, 'vistoria_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Vistoria ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.status_update.error', error, {
      vistoria_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar status da vistoria.');
  }
};

exports.assignVistoriaResponsible = async (req, res) => {
  try {
    const result = await vistoriasService.assignVistoriaResponsible(
      parsePositiveIntOrThrow(req.params.id, 'vistoria_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Vistoria ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.responsavel_assign.error', error, {
      vistoria_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atribuir responsavel da vistoria.');
  }
};

exports.createVistoriaMovement = async (req, res) => {
  try {
    const result = await vistoriasService.createVistoriaMovement(
      parsePositiveIntOrThrow(req.params.id, 'vistoria_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Vistoria ambiental nao encontrada.' });
    }

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.movimentacao_create.error', error, {
      vistoria_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao registrar movimentacao da vistoria.');
  }
};

exports.registerVistoriaRealizacao = async (req, res) => {
  try {
    const result = await vistoriasService.registerVistoriaRealizacao(
      parsePositiveIntOrThrow(req.params.id, 'vistoria_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Vistoria ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.realizacao.error', error, {
      vistoria_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao registrar realizacao da vistoria.');
  }
};

exports.cancelVistoria = async (req, res) => {
  try {
    const result = await vistoriasService.cancelVistoria(
      parsePositiveIntOrThrow(req.params.id, 'vistoria_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Vistoria ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.cancel.error', error, {
      vistoria_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao cancelar vistoria.');
  }
};

exports.listVistoriaAnexos = async (req, res) => {
  try {
    const result = await vistoriasService.listVistoriaAnexos(parsePositiveIntOrThrow(req.params.id, 'vistoria_id'), {
      includeSensitive: hasPermission(req.usuarioInterno, PERMISSIONS.ANEXOS_VIEW_SENSITIVE),
    });

    if (!result) {
      return res.status(404).json({ success: false, error: 'Vistoria ambiental nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.anexos.list.error', error, {
      vistoria_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao listar anexos da vistoria.');
  }
};

exports.createVistoriaAnexo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Envie um arquivo no campo arquivo.' });
    }

    const result = await vistoriasService.createVistoriaAnexo(
      parsePositiveIntOrThrow(req.params.id, 'vistoria_id'),
      req.body || {},
      req.file,
      req.usuarioInterno,
      req
    );

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'vistorias.anexos.create.error', error, {
      vistoria_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao enviar anexo da vistoria.');
  }
};

exports.downloadVistoriaAnexo = async (req, res) => {
  try {
    const anexo = await vistoriasService.getVistoriaAnexoForDownload(
      parsePositiveIntOrThrow(req.params.id, 'vistoria_id'),
      parsePositiveIntOrThrow(req.params.anexoId, 'anexo_id'),
      req.usuarioInterno,
      req
    );

    if (!anexo || !anexosService.fileExists(anexo)) {
      return res.status(404).json({ success: false, error: 'Anexo nao encontrado.' });
    }

    ensureCanAccessSensitive(req, anexo);
    return res.download(anexo.caminho_armazenamento, anexo.nome_original);
  } catch (error) {
    logControllerError(req, 'vistorias.anexos.download.error', error, {
      vistoria_id: parseIntOrNull(req.params.id),
      anexo_id: parseIntOrNull(req.params.anexoId),
    });
    return handleServiceError(res, error, 'Erro interno ao baixar anexo da vistoria.');
  }
};

exports.listRelatorios = async (req, res) => {
  try {
    const result = await vistoriasService.listRelatorios(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'relatorios_preliminares.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar relatorios preliminares.');
  }
};

exports.getRelatorio = async (req, res) => {
  try {
    const result = await vistoriasService.getRelatorio(parsePositiveIntOrThrow(req.params.id, 'relatorio_id'));

    if (!result) {
      return res.status(404).json({ success: false, error: 'Relatorio preliminar nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'relatorios_preliminares.detail.error', error, {
      relatorio_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar relatorio preliminar.');
  }
};

exports.createRelatorio = async (req, res) => {
  try {
    const result = await vistoriasService.createRelatorio(
      parsePositiveIntOrThrow(req.params.id, 'vistoria_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'relatorios_preliminares.create.error', error, {
      vistoria_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao criar relatorio preliminar.');
  }
};

exports.updateRelatorio = async (req, res) => {
  try {
    const result = await vistoriasService.updateRelatorio(
      parsePositiveIntOrThrow(req.params.id, 'relatorio_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Relatorio preliminar nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'relatorios_preliminares.update.error', error, {
      relatorio_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar relatorio preliminar.');
  }
};

exports.updateRelatorioStatus = async (req, res) => {
  try {
    const result = await vistoriasService.updateRelatorioStatus(
      parsePositiveIntOrThrow(req.params.id, 'relatorio_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Relatorio preliminar nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'relatorios_preliminares.status_update.error', error, {
      relatorio_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar status do relatorio preliminar.');
  }
};

exports.createRelatorioMovement = async (req, res) => {
  try {
    const result = await vistoriasService.createRelatorioMovement(
      parsePositiveIntOrThrow(req.params.id, 'relatorio_id'),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Relatorio preliminar nao encontrado.' });
    }

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'relatorios_preliminares.movimentacao_create.error', error, {
      relatorio_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao registrar movimentacao do relatorio preliminar.');
  }
};
