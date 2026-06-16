const tutorService = require('../services/tutorService');
const auditService = require('../services/auditService');
const { logControllerError } = require('../utils/controllerLogger');

async function auditDuplicateBlock(req, error, entidade) {
  await auditService.log({
    ator_tipo: 'interno',
    ator_id: req.usuarioInterno?.id,
    acao: `bloqueio_duplicidade_${entidade}`,
    entidade: entidade === 'tutor' ? 'tutores' : 'animais',
    dados: error.details || {},
    req
  });
}

async function auditDuplicateWarning(req, result, entidade) {
  if (!Array.isArray(result?.duplicidade_alertas) || result.duplicidade_alertas.length === 0) {
    return;
  }

  await auditService.log({
    ator_tipo: 'interno',
    ator_id: req.usuarioInterno?.id,
    acao: `alerta_duplicidade_${entidade}`,
    entidade: entidade === 'tutor' ? 'tutores' : 'animais',
    entidade_id: result.id,
    dados: { duplicidade_alertas: result.duplicidade_alertas },
    req
  });
}

exports.create = async (req, res) => {
  try {
    const result = await tutorService.create(req.body);
    await auditDuplicateWarning(req, result, 'tutor');

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: req.usuarioInterno?.id,
      acao: 'criar_tutor',
      entidade: 'tutores',
      entidade_id: result.id,
      before: null,
      after: result,
      dados: { nome: result.nome, cpf: result.cpf },
      req
    });

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'tutor.create.error', error);

    if (error.code === 'SIGBA_DUPLICATE_TUTOR') {
      await auditDuplicateBlock(req, error, 'tutor');

      return res.status(409).json({
        success: false,
        error: 'Possivel duplicidade forte de tutor encontrada.',
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
        error: 'Documento ja cadastrado.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar tutor.'
    });
  }
};

exports.findAll = async (req, res) => {
  try {
    const result = await tutorService.findAll();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'tutor.list.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar tutores.'
    });
  }
};

exports.findById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await tutorService.findById(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Tutor nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'tutor.find.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar tutor.'
    });
  }
};

exports.findWithAnimalsById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await tutorService.findWithAnimalsById(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Tutor nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'tutor.find_with_animals.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar tutor com animais.'
    });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const before = await tutorService.findById(id);
    const result = await tutorService.update(id, req.body);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Tutor nao encontrado.'
      });
    }
    await auditDuplicateWarning(req, result, 'tutor');

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: req.usuarioInterno?.id,
      acao: 'atualizar_tutor',
      entidade: 'tutores',
      entidade_id: result.id,
      before,
      after: result,
      dados: { nome: result.nome, cpf: result.cpf },
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'tutor.update.error', error);

    if (error.code === 'SIGBA_DUPLICATE_TUTOR') {
      await auditDuplicateBlock(req, error, 'tutor');

      return res.status(409).json({
        success: false,
        error: 'Possivel duplicidade forte de tutor encontrada.',
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
        error: 'Documento ja cadastrado.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar tutor.'
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const before = await tutorService.findById(id);
    const result = await tutorService.remove(id);

    if (!before || !result) {
      return res.status(404).json({
        success: false,
        error: 'Tutor nao encontrado.'
      });
    }

    await auditService.logChange({
      ator_tipo: 'interno',
      ator_id: req.usuarioInterno?.id,
      acao: 'inativar_tutor',
      entidade: 'tutores',
      entidade_id: before.id,
      before,
      after: result,
      dados: { nome: result.nome, cpf: result.cpf, status_cadastral: result.status_cadastral },
      req
    });

    return res.status(200).json({
      success: true,
      message: 'Tutor inativado com sucesso.',
      data: result
    });
  } catch (error) {
    logControllerError(req, 'tutor.remove.error', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao inativar tutor.'
    });
  }
};
