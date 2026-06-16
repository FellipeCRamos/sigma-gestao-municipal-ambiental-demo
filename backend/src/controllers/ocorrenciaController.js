const ocorrenciaService = require('../services/ocorrenciaService');
const workflowService = require('../services/operacaoWorkflowService');
const { logControllerError } = require('../utils/controllerLogger');

const ALLOWED_TYPES = ['perda', 'encontro', 'adocao', 'obito', 'zoonose', 'maus_tratos', 'outros'];
const ALLOWED_STATUS = workflowService.OCORRENCIA_STATUS_OPTIONS;

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function normalizeCoordinate(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return number;
}

function normalizePositiveIntegerOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return undefined;
  return number;
}

function validatePayload(body) {
  const tipo = normalizeString(body.tipo);
  const titulo = normalizeString(body.titulo);
  const descricao = normalizeString(body.descricao);
  const bairro = normalizeString(body.bairro);
  const endereco_referencia = normalizeString(body.endereco_referencia);
  const latitude = normalizeCoordinate(body.latitude);
  const longitude = normalizeCoordinate(body.longitude);
  const animal_id = body.animal_id ? Number(body.animal_id) : null;
  const territorio_id = normalizePositiveIntegerOrNull(body.territorio_id);

  if (!tipo || !ALLOWED_TYPES.includes(tipo)) {
    return { error: `Tipo deve ser um dos valores: ${ALLOWED_TYPES.join(', ')}.` };
  }

  if (!titulo || titulo.length < 3 || titulo.length > 160) {
    return { error: 'Informe um titulo entre 3 e 160 caracteres.' };
  }

  if (!descricao || descricao.length < 5 || descricao.length > 2000) {
    return { error: 'Informe uma descricao entre 5 e 2000 caracteres.' };
  }

  if (bairro && bairro.length > 120) {
    return { error: 'Bairro deve ter no maximo 120 caracteres.' };
  }

  if (endereco_referencia && endereco_referencia.length > 500) {
    return { error: 'Endereco de referencia deve ter no maximo 500 caracteres.' };
  }

  if (latitude === undefined || longitude === undefined) {
    return { error: 'Latitude e longitude devem ser numeros validos.' };
  }

  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    return { error: 'Latitude deve estar entre -90 e 90.' };
  }

  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    return { error: 'Longitude deve estar entre -180 e 180.' };
  }

  if (animal_id !== null && (!Number.isInteger(animal_id) || animal_id <= 0)) {
    return { error: 'Animal invalido.' };
  }

  if (territorio_id === undefined) {
    return { error: 'Territorio invalido.' };
  }

  return {
    data: {
      animal_id,
      territorio_id,
      tipo,
      titulo,
      descricao,
      bairro: bairro || null,
      endereco_referencia: endereco_referencia || null,
      latitude,
      longitude,
      contato_nome: normalizeString(body.contato_nome) || null,
      contato_telefone: normalizeString(body.contato_telefone) || null,
      contato_email: normalizeString(body.contato_email) || null
    }
  };
}

exports.createByTutor = async (req, res) => {
  try {
    const validation = validatePayload(req.body || {});

    if (validation.error) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await ocorrenciaService.create(validation.data, {
      tipo: 'externo',
      id: req.usuarioExterno.id
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'ocorrencia.create_tutor.error', error);

    if (error.code === 'SIGBA_TERRITORIO_INVALIDO') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar ocorrencia.'
    });
  }
};

exports.createByInterno = async (req, res) => {
  try {
    const validation = validatePayload(req.body || {});

    if (validation.error) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await ocorrenciaService.create(validation.data, {
      tipo: 'interno',
      id: req.usuarioInterno.id
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'ocorrencia.create_interno.error', error);

    if (error.code === 'SIGBA_TERRITORIO_INVALIDO') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar ocorrencia.'
    });
  }
};

exports.findAll = async (req, res) => {
  try {
    const result = await ocorrenciaService.findAll();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'ocorrencia.list.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar ocorrencias.'
    });
  }
};

exports.findMinhas = async (req, res) => {
  try {
    const result = await ocorrenciaService.findByUsuario(req.usuarioExterno.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'ocorrencia.list_minha.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar ocorrencias.'
    });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = normalizeString(req.body?.status);
    const resolucao = normalizeString(req.body?.resolucao);
    const pendencia_tipo = normalizeString(req.body?.pendencia_tipo);
    const pendencia_descricao = normalizeString(req.body?.pendencia_descricao);
    const desfecho = normalizeString(req.body?.desfecho);
    const motivo_desfecho = normalizeString(req.body?.motivo_desfecho);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Ocorrencia invalida.' });
    }

    if (!status || !ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Status deve ser um dos valores: ${ALLOWED_STATUS.join(', ')}.`
      });
    }

    const result = await ocorrenciaService.updateStatus(
      id,
      {
        status,
        resolucao: resolucao || null,
        pendencia_tipo: pendencia_tipo || null,
        pendencia_descricao: pendencia_descricao || null,
        desfecho: desfecho || null,
        motivo_desfecho: motivo_desfecho || null,
      },
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Ocorrencia nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'ocorrencia.update_status.error', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao atualizar ocorrencia.'
    });
  }
};
