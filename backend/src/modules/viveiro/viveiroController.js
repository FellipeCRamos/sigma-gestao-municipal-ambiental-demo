const viveiroService = require('./viveiroService');
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

exports.getDashboard = async (req, res) => {
  try {
    const result = await viveiroService.getDashboard();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.dashboard.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar dashboard do viveiro.');
  }
};

exports.listEspecies = async (req, res) => {
  try {
    const result = await viveiroService.listEspecies({
      incluir_inativas: req.query?.incluir_inativas === 'true',
      busca: req.query?.busca || '',
      page: parseIntOrNull(req.query?.page),
      page_size: parseIntOrNull(req.query?.page_size),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.especie.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar especies do viveiro.');
  }
};

exports.createEspecie = async (req, res) => {
  try {
    const result = await viveiroService.createEspecie(req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.especie.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao criar especie do viveiro.');
  }
};

exports.updateEspecie = async (req, res) => {
  try {
    const result = await viveiroService.updateEspecie(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Especie do viveiro nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.especie.update.error', error, {
      especie_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar especie do viveiro.');
  }
};

exports.listLotes = async (req, res) => {
  try {
    const result = await viveiroService.listLotes({
      especie_id: parseIntOrNull(req.query?.especie_id),
      status: req.query?.status || '',
      busca: req.query?.busca || '',
      page: parseIntOrNull(req.query?.page),
      page_size: parseIntOrNull(req.query?.page_size),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.lote.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar lotes do viveiro.');
  }
};

exports.createLote = async (req, res) => {
  try {
    const result = await viveiroService.createLote(req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.lote.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao criar lote do viveiro.');
  }
};

exports.updateLote = async (req, res) => {
  try {
    const result = await viveiroService.updateLote(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Lote do viveiro nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.lote.update.error', error, {
      lote_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar lote do viveiro.');
  }
};

exports.getEstoqueConsolidado = async (req, res) => {
  try {
    const result = await viveiroService.getEstoqueConsolidado();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.estoque.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar estoque do viveiro.');
  }
};

exports.listMovimentacoes = async (req, res) => {
  try {
    const result = await viveiroService.listMovimentacoes({
      especie_id: parseIntOrNull(req.query?.especie_id),
      lote_id: parseIntOrNull(req.query?.lote_id),
      tipo: req.query?.tipo || '',
      page: parseIntOrNull(req.query?.page),
      page_size: parseIntOrNull(req.query?.page_size),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.movimentacao.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar movimentacoes do viveiro.');
  }
};

exports.createMovimentacaoAjuste = async (req, res) => {
  try {
    const result = await viveiroService.createMovimentacaoAjuste(req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.movimentacao.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao registrar ajuste de estoque.');
  }
};

exports.listSolicitacoes = async (req, res) => {
  try {
    const result = await viveiroService.listSolicitacoes({
      status: req.query?.status || '',
      busca: req.query?.busca || '',
      page: parseIntOrNull(req.query?.page),
      page_size: parseIntOrNull(req.query?.page_size),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.solicitacao.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar solicitacoes do viveiro.');
  }
};

exports.getSolicitacaoDetalhe = async (req, res) => {
  try {
    const result = await viveiroService.getSolicitacaoDetalhe(parsePositiveIntOrThrow(req.params.id));

    if (!result) {
      return res.status(404).json({ success: false, error: 'Solicitacao do viveiro nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.solicitacao.find.error', error, {
      solicitacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar solicitacao do viveiro.');
  }
};

exports.createSolicitacao = async (req, res) => {
  try {
    const result = await viveiroService.createSolicitacao(req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.solicitacao.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao criar solicitacao do viveiro.');
  }
};

exports.analisarSolicitacao = async (req, res) => {
  try {
    const result = await viveiroService.analisarSolicitacao(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Solicitacao do viveiro nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.solicitacao.analisar.error', error, {
      solicitacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao analisar solicitacao do viveiro.');
  }
};

exports.listEntregas = async (req, res) => {
  try {
    const result = await viveiroService.listEntregas({
      solicitacao_id: parseIntOrNull(req.query?.solicitacao_id),
      status: req.query?.status || '',
      busca: req.query?.busca || '',
      page: parseIntOrNull(req.query?.page),
      page_size: parseIntOrNull(req.query?.page_size),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.entrega.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar entregas do viveiro.');
  }
};

exports.getComprovanteEntrega = async (req, res) => {
  try {
    const result = await viveiroService.getComprovanteEntrega(parsePositiveIntOrThrow(req.params.id));

    if (!result) {
      return res.status(404).json({ success: false, error: 'Entrega do viveiro nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.entrega.comprovante.error', error, {
      entrega_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar comprovante da entrega do viveiro.');
  }
};

exports.registrarEntrega = async (req, res) => {
  try {
    const result = await viveiroService.registrarEntrega(req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.entrega.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao registrar entrega do viveiro.');
  }
};

exports.cancelarEntrega = async (req, res) => {
  try {
    const result = await viveiroService.cancelarEntrega(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Entrega do viveiro nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'viveiro.entrega.cancel.error', error, {
      entrega_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao cancelar entrega do viveiro.');
  }
};
