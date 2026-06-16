// src/controllers/animalController.js
const animalService = require('../services/animalService');
const auditService = require('../services/auditService');
const animalEventoService = require('../services/animalEventoService');
const animalVacinaService = require('../services/animalVacinaService');
const { logControllerError } = require('../utils/controllerLogger');

const ALLOWED_EVENT_TYPES = [
  'vacina',
  'castracao',
  'microchipagem',
  'consulta',
  'ocorrencia',
  'adocao',
  'obito',
  'campanha',
  'observacao'
];

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

async function auditDuplicateBlock(req, error) {
  await auditService.log({
    ator_tipo: 'interno',
    ator_id: req.usuarioInterno?.id,
    acao: 'bloqueio_duplicidade_animal',
    entidade: 'animais',
    dados: error.details || {},
    req
  });
}

async function auditDuplicateWarning(req, result) {
  if (!Array.isArray(result?.duplicidade_alertas) || result.duplicidade_alertas.length === 0) {
    return;
  }

  await auditService.log({
    ator_tipo: 'interno',
    ator_id: req.usuarioInterno?.id,
    acao: 'alerta_duplicidade_animal',
    entidade: 'animais',
    entidade_id: result.id,
    dados: { duplicidade_alertas: result.duplicidade_alertas },
    req
  });
}

exports.create = async (req, res) => {
  try {
    let result = await animalService.create(req.body);
    await animalVacinaService.importLegacyVacinasForAnimal(result, req.usuarioInterno, req);
    result = await animalService.findById(result.id);
    await auditDuplicateWarning(req, result);

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: req.usuarioInterno?.id,
      acao: 'criar_animal',
      entidade: 'animais',
      entidade_id: result.id,
      before: null,
      after: result,
      dados: { nome: result.nome, especie: result.especie },
      req
    });

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal.create.error', error);

    if (error.code === 'SIGBA_DUPLICATE_ANIMAL') {
      await auditDuplicateBlock(req, error);

      return res.status(409).json({
        success: false,
        error: 'Possivel duplicidade forte de animal encontrada.',
        details: error.details
      });
    }

    if (error.code === 'SIGBA_TERRITORIO_INVALIDO') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Microchip já cadastrado.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar animal.'
    });
  }
};

exports.findAll = async (req, res) => {
  try {
    const result = await animalService.findAll();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal.list.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar animais.'
    });
  }
};

exports.findById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await animalService.findById(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Animal não encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal.find.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar animal.'
    });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const before = await animalService.findById(id);
    let result = await animalService.update(id, req.body);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Animal não encontrado.'
      });
    }

    await animalVacinaService.importLegacyVacinasForAnimal(result, req.usuarioInterno, req);
    await animalVacinaService.reconcileAnimalSummary(result.id);
    result = await animalService.findById(result.id);
    await auditDuplicateWarning(req, result);

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: req.usuarioInterno?.id,
      acao: 'atualizar_animal',
      entidade: 'animais',
      entidade_id: result.id,
      before,
      after: result,
      dados: { nome: result.nome, status: result.status },
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal.update.error', error);

    if (error.code === 'SIGBA_DUPLICATE_ANIMAL') {
      await auditDuplicateBlock(req, error);

      return res.status(409).json({
        success: false,
        error: 'Possivel duplicidade forte de animal encontrada.',
        details: error.details
      });
    }

    if (error.code === 'SIGBA_TERRITORIO_INVALIDO') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Microchip já cadastrado.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar animal.'
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const before = await animalService.findById(id);
    const result = await animalService.remove(id);

    if (!before || !result) {
      return res.status(404).json({
        success: false,
        error: 'Animal não encontrado.'
      });
    }

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: req.usuarioInterno?.id,
      acao: 'inativar_animal',
      entidade: 'animais',
      entidade_id: before.id,
      before,
      after: result,
      dados: { nome: result.nome, status_cadastral: result.status_cadastral },
      req
    });

    return res.status(200).json({
      success: true,
      message: 'Animal inativado com sucesso.',
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal.remove.error', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao inativar animal.'
    });
  }
};

exports.findTimeline = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Animal invalido.'
      });
    }

    const animal = await animalService.findById(id);

    if (!animal) {
      return res.status(404).json({
        success: false,
        error: 'Animal nao encontrado.'
      });
    }

    const result = await animalEventoService.findByAnimal(id);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal.timeline.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar linha do tempo.'
    });
  }
};

exports.createTimelineEvent = async (req, res) => {
  try {
    const animalId = Number(req.params.id);
    const tipo = normalizeString(req.body?.tipo);
    const titulo = normalizeString(req.body?.titulo);
    const descricao = normalizeString(req.body?.descricao);
    const data_evento = normalizeString(req.body?.data_evento);

    if (!Number.isInteger(animalId) || animalId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Animal invalido.'
      });
    }

    if (!tipo || !ALLOWED_EVENT_TYPES.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: `Tipo deve ser um dos valores: ${ALLOWED_EVENT_TYPES.join(', ')}.`
      });
    }

    if (!titulo || titulo.length < 3 || titulo.length > 160) {
      return res.status(400).json({
        success: false,
        error: 'Informe um titulo entre 3 e 160 caracteres.'
      });
    }

    if (descricao && descricao.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Descricao deve ter no maximo 2000 caracteres.'
      });
    }

    const animal = await animalService.findById(animalId);

    if (!animal) {
      return res.status(404).json({
        success: false,
        error: 'Animal nao encontrado.'
      });
    }

    const result = await animalEventoService.create(
      {
        animal_id: animalId,
        tutor_id: animal.tutor_id,
        tipo,
        titulo,
        descricao: descricao || null,
        data_evento: data_evento || null,
        dados: req.body?.dados || {}
      },
      req.usuarioInterno
    );

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'animal.timeline_create.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar evento.'
    });
  }
};
