const operacaoService = require('../services/operacaoService');
const { logControllerError } = require('../utils/controllerLogger');

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

exports.getFilaOperacional = async (req, res) => {
  try {
    const result = await operacaoService.getFilaOperacional({
      tipo: normalizeString(req.query?.tipo) || null,
      status: normalizeString(req.query?.status) || null,
      criticidade: normalizeString(req.query?.criticidade) || null,
      fila: normalizeString(req.query?.fila) || null,
      responsavel_id: normalizeString(req.query?.responsavel_id) || null,
      sla_situacao: normalizeString(req.query?.sla_situacao) || null,
      pendencia: normalizeString(req.query?.pendencia) || null,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logControllerError(req, 'operacao.fila.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar fila operacional.',
    });
  }
};

exports.listResponsaveis = async (req, res) => {
  try {
    const result = await operacaoService.listResponsaveis();

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logControllerError(req, 'operacao.responsaveis.list.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar responsaveis.',
    });
  }
};

exports.assignResponsavel = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Item operacional invalido.' });
    }

    const responsavelId = req.body?.responsavel_interno_id
      ? Number(req.body.responsavel_interno_id)
      : null;

    if (req.body?.responsavel_interno_id && (!Number.isInteger(responsavelId) || responsavelId <= 0)) {
      return res.status(400).json({ success: false, error: 'Responsavel invalido.' });
    }

    const result = await operacaoService.assignResponsavel(
      normalizeString(req.params.tipo),
      id,
      {
        responsavel_interno_id: responsavelId,
        observacao: normalizeString(req.body?.observacao) || null,
      },
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Item operacional nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'operacao.responsavel.assign.error', error, {
      item_tipo: normalizeString(req.params.tipo),
      item_id: Number(req.params.id) || null,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao atribuir responsavel.',
    });
  }
};

exports.updatePrazo = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Item operacional invalido.' });
    }

    const result = await operacaoService.updatePrazo(
      normalizeString(req.params.tipo),
      id,
      {
        prazo_limite_operacional: normalizeString(req.body?.prazo_limite_operacional) || null,
        observacao: normalizeString(req.body?.observacao) || null,
      },
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Item operacional nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'operacao.prazo.update.error', error, {
      item_tipo: normalizeString(req.params.tipo),
      item_id: Number(req.params.id) || null,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao atualizar prazo.',
    });
  }
};

exports.createObservacao = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Item operacional invalido.' });
    }

    const result = await operacaoService.createObservacao(
      normalizeString(req.params.tipo),
      id,
      {
        observacao: normalizeString(req.body?.observacao) || null,
      },
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Item operacional nao encontrado.' });
    }

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'operacao.observacao.create.error', error, {
      item_tipo: normalizeString(req.params.tipo),
      item_id: Number(req.params.id) || null,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao registrar observacao.',
    });
  }
};

exports.getHistorico = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Item operacional invalido.' });
    }

    const result = await operacaoService.getHistorico(normalizeString(req.params.tipo), id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logControllerError(req, 'operacao.historico.error', error, {
      item_tipo: normalizeString(req.params.tipo),
      item_id: Number(req.params.id) || null,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao carregar historico.',
    });
  }
};

exports.getMinhasNotificacoes = async (req, res) => {
  try {
    const result = await operacaoService.getMinhasNotificacoes(req.usuarioInterno.id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logControllerError(req, 'operacao.notificacoes.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar notificacoes operacionais.',
    });
  }
};

exports.getResumoOperacional = async (req, res) => {
  try {
    const result = await operacaoService.getResumoOperacional();

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logControllerError(req, 'operacao.resumo.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar resumo operacional.',
    });
  }
};
