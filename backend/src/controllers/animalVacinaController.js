const animalVacinaService = require('../services/animalVacinaService');
const { logControllerError } = require('../utils/controllerLogger');

const ALLOWED_ORIGENS = ['orgao_ambiental', 'tutor_declarado', 'campanha'];
const ALLOWED_STATUS = ['registrado', 'comprovado', 'pendente_comprovacao', 'vencido'];

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function validateId(value, label) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return { error: `${label} invalido.` };
  }

  return { id };
}

function isValidDate(value) {
  if (!value) return true;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function normalizePayload(body = {}, { partial = false } = {}) {
  const origem = normalizeString(body.origem_registro) || undefined;
  const status = normalizeString(body.status_registro) || undefined;
  const dataAplicacao = normalizeString(body.data_aplicacao) || null;
  const proximaDose = normalizeString(body.proxima_dose_em) || null;
  const vacinaNome = normalizeString(body.vacina_nome) || null;
  const data = {};
  const shouldSet = (key) => !partial || Object.prototype.hasOwnProperty.call(body, key);
  const setIfProvided = (key, value) => {
    if (shouldSet(key)) data[key] = value;
  };

  if (origem && !ALLOWED_ORIGENS.includes(origem)) {
    return { error: `Origem deve ser uma das opcoes: ${ALLOWED_ORIGENS.join(', ')}.` };
  }

  if (status && !ALLOWED_STATUS.includes(status)) {
    return { error: `Status deve ser uma das opcoes: ${ALLOWED_STATUS.join(', ')}.` };
  }

  if (!partial && !body.vacina_catalogo_id && !vacinaNome) {
    return { error: 'Selecione uma vacina do catalogo ou informe o nome da vacina.' };
  }

  if (!isValidDate(dataAplicacao)) {
    return { error: 'Data de aplicacao invalida.' };
  }

  if (!isValidDate(proximaDose)) {
    return { error: 'Data da proxima dose invalida.' };
  }

  if (dataAplicacao) {
    const applied = new Date(dataAplicacao);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (applied >= tomorrow) {
      return { error: 'Data de aplicacao nao pode ser futura.' };
    }
  }

  setIfProvided('vacina_catalogo_id', body.vacina_catalogo_id || null);
  setIfProvided('vacina_codigo', normalizeString(body.vacina_codigo) || null);
  setIfProvided('vacina_nome', vacinaNome);
  setIfProvided('vacina_nome_popular', normalizeString(body.vacina_nome_popular) || null);
  setIfProvided('especie', normalizeString(body.especie) || null);
  setIfProvided('dose', normalizeString(body.dose) || null);
  setIfProvided('data_aplicacao', dataAplicacao);
  setIfProvided('proxima_dose_em', proximaDose);
  setIfProvided('lote', normalizeString(body.lote) || null);
  setIfProvided('fabricante', normalizeString(body.fabricante) || null);
  setIfProvided('origem_registro', origem || (partial ? undefined : 'orgao_ambiental'));
  setIfProvided('status_registro', status || (partial ? undefined : 'registrado'));
  setIfProvided('fonte_lancamento', normalizeString(body.fonte_lancamento) || null);
  setIfProvided('campanha_id', body.campanha_id || null);
  setIfProvided('campanha_inscricao_id', body.campanha_inscricao_id || null);
  setIfProvided('documento_id', body.documento_id || null);
  setIfProvided('observacoes', normalizeString(body.observacoes) || null);

  return { data };
}

exports.findCatalogo = async (req, res) => {
  try {
    const especie = normalizeString(req.query?.especie) || null;
    const result = await animalVacinaService.findCatalogo({ especie });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal_vacina.catalogo.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar catalogo de vacinas.'
    });
  }
};

exports.findCarteiraByAnimal = async (req, res) => {
  try {
    const idValidation = validateId(req.params.id, 'Animal');

    if (idValidation.error) {
      return res.status(400).json({ success: false, error: idValidation.error });
    }

    const result = await animalVacinaService.findCarteiraByAnimal(idValidation.id, {
      includeCanceled: req.query?.incluir_canceladas === 'true'
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Animal nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal_vacina.carteira.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar carteira vacinal.'
    });
  }
};

exports.create = async (req, res) => {
  try {
    const idValidation = validateId(req.params.id, 'Animal');
    const validation = normalizePayload(req.body || {});

    if (idValidation.error) {
      return res.status(400).json({ success: false, error: idValidation.error });
    }

    if (validation.error) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await animalVacinaService.create(
      idValidation.id,
      validation.data,
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Animal nao encontrado.'
      });
    }

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal_vacina.create.error', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao criar registro vacinal.'
    });
  }
};

exports.update = async (req, res) => {
  try {
    const animalValidation = validateId(req.params.id, 'Animal');
    const vacinacaoValidation = validateId(req.params.vacinacaoId, 'Registro vacinal');
    const validation = normalizePayload(req.body || {}, { partial: true });

    if (animalValidation.error) {
      return res.status(400).json({ success: false, error: animalValidation.error });
    }

    if (vacinacaoValidation.error) {
      return res.status(400).json({ success: false, error: vacinacaoValidation.error });
    }

    if (validation.error) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await animalVacinaService.update(
      animalValidation.id,
      vacinacaoValidation.id,
      validation.data,
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Registro vacinal nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal_vacina.update.error', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao atualizar registro vacinal.'
    });
  }
};

exports.cancel = async (req, res) => {
  try {
    const animalValidation = validateId(req.params.id, 'Animal');
    const vacinacaoValidation = validateId(req.params.vacinacaoId, 'Registro vacinal');

    if (animalValidation.error) {
      return res.status(400).json({ success: false, error: animalValidation.error });
    }

    if (vacinacaoValidation.error) {
      return res.status(400).json({ success: false, error: vacinacaoValidation.error });
    }

    const result = await animalVacinaService.cancel(
      animalValidation.id,
      vacinacaoValidation.id,
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Registro vacinal nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal_vacina.cancel.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao cancelar registro vacinal.'
    });
  }
};

exports.findMinhaCarteira = async (req, res) => {
  try {
    const idValidation = validateId(req.params.id, 'Animal');

    if (idValidation.error) {
      return res.status(400).json({ success: false, error: idValidation.error });
    }

    const canAccess = await animalVacinaService.canUsuarioExternoAccessAnimal(
      req.usuarioExterno.id,
      idValidation.id
    );

    if (!canAccess) {
      return res.status(404).json({
        success: false,
        error: 'Animal nao encontrado para este tutor.'
      });
    }

    const result = await animalVacinaService.findCarteiraByAnimal(idValidation.id);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal_vacina.tutor_carteira.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar carteira vacinal.'
    });
  }
};
