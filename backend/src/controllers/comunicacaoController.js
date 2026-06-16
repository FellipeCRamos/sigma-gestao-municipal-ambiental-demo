const comunicacaoService = require('../services/comunicacaoService');
const { logControllerError } = require('../utils/controllerLogger');

exports.getResumo = async (req, res) => {
  try {
    const result = await comunicacaoService.getResumo(req.query || {});

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logControllerError(req, 'comunicacao.resumo.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar resumo de comunicação.',
    });
  }
};

exports.listEntregas = async (req, res) => {
  try {
    const result = await comunicacaoService.listEntregas(req.query || {});

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logControllerError(req, 'comunicacao.entregas.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar entregas de comunicação.',
    });
  }
};

exports.getEventos = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        eventos: comunicacaoService.getEventosNotificaveis(),
        canais: comunicacaoService.CHANNEL_DEFINITIONS,
        status_entrega: comunicacaoService.DELIVERY_STATUS_DEFINITIONS,
        meta: {
          tipo: 'eventos_notificaveis_4a',
          observacao: 'Catálogo operacional da Fase 4A. Eventos adiados não devem ser ativados sem nova decisão institucional.',
        },
      },
    });
  } catch (error) {
    logControllerError(req, 'comunicacao.eventos.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar eventos notificáveis.',
    });
  }
};
