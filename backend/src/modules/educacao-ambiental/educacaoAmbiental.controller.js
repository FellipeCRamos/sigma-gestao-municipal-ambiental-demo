const educacaoService = require('./educacaoAmbiental.service');
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

function createAdminListHandler(entityKey, label) {
  return async (req, res) => {
    try {
      const result = await educacaoService.listEntity(entityKey, req.query || {});
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `educacao_ambiental.${label}.list.error`, error);
      return handleServiceError(res, error, 'Erro interno ao listar modulo de educacao ambiental.');
    }
  };
}

function createAdminGetHandler(entityKey, label) {
  return async (req, res) => {
    try {
      const result = await educacaoService.getEntity(entityKey, req.params.id);

      if (!result) {
        return res.status(404).json({ success: false, error: 'Registro nao encontrado.' });
      }

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `educacao_ambiental.${label}.detail.error`, error, {
        id: parseIntOrNull(req.params.id),
      });
      return handleServiceError(res, error, 'Erro interno ao carregar registro de educacao ambiental.');
    }
  };
}

function createAdminCreateHandler(entityKey, label) {
  return async (req, res) => {
    try {
      const result = await educacaoService.createEntity(entityKey, req.body || {}, req.usuarioInterno, req);
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `educacao_ambiental.${label}.create.error`, error);
      return handleServiceError(res, error, 'Erro interno ao criar registro de educacao ambiental.');
    }
  };
}

function createAdminUpdateHandler(entityKey, label) {
  return async (req, res) => {
    try {
      const result = await educacaoService.updateEntity(
        entityKey,
        req.params.id,
        req.body || {},
        req.usuarioInterno,
        req
      );

      if (!result) {
        return res.status(404).json({ success: false, error: 'Registro nao encontrado.' });
      }

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `educacao_ambiental.${label}.update.error`, error, {
        id: parseIntOrNull(req.params.id),
      });
      return handleServiceError(res, error, 'Erro interno ao atualizar registro de educacao ambiental.');
    }
  };
}

function createAdminStatusHandler(entityKey, label) {
  return async (req, res) => {
    try {
      const result = await educacaoService.updateEntityStatus(
        entityKey,
        req.params.id,
        req.body || {},
        req.usuarioInterno,
        req
      );

      if (!result) {
        return res.status(404).json({ success: false, error: 'Registro nao encontrado.' });
      }

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `educacao_ambiental.${label}.status.error`, error, {
        id: parseIntOrNull(req.params.id),
      });
      return handleServiceError(res, error, 'Erro interno ao atualizar status do registro.');
    }
  };
}

function createAdminArchiveHandler(entityKey, label) {
  return async (req, res) => {
    try {
      const result = await educacaoService.archiveEntity(entityKey, req.params.id, req.usuarioInterno, req);

      if (!result) {
        return res.status(404).json({ success: false, error: 'Registro nao encontrado.' });
      }

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `educacao_ambiental.${label}.archive.error`, error, {
        id: parseIntOrNull(req.params.id),
      });
      return handleServiceError(res, error, 'Erro interno ao arquivar registro de educacao ambiental.');
    }
  };
}

function createPublicListHandler(entityKey, label) {
  return async (req, res) => {
    try {
      const result = await educacaoService.listEntity(entityKey, req.query || {}, { publicOnly: true });
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `educacao_ambiental.public.${label}.list.error`, error);
      return handleServiceError(res, error, 'Erro interno ao consultar portal de educacao ambiental.');
    }
  };
}

exports.getAdminDashboard = async (req, res) => {
  try {
    const result = await educacaoService.getDashboard();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.dashboard.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar dashboard de educacao ambiental.');
  }
};

exports.getCuradoriaDashboard = async (req, res) => {
  try {
    const result = await educacaoService.getCuradoriaDashboard();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.dashboard.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar dashboard de curadoria.');
  }
};

exports.listCuradoriaPendencias = async (req, res) => {
  try {
    const result = await educacaoService.listCuradoriaPendencias(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.pendencias.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar pendencias de curadoria.');
  }
};

exports.listCuradoriaFontes = async (req, res) => {
  try {
    const result = await educacaoService.listFontes(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.fontes.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar fontes de curadoria.');
  }
};

exports.createCuradoriaFonte = async (req, res) => {
  try {
    const result = await educacaoService.createFonte(req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.fontes.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao criar fonte de curadoria.');
  }
};

exports.updateCuradoriaFonte = async (req, res) => {
  try {
    const result = await educacaoService.updateFonte(req.params.id, req.body || {}, req.usuarioInterno, req);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Fonte nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.fontes.update.error', error, {
      fonte_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar fonte de curadoria.');
  }
};

exports.updateCuradoriaFonteStatus = async (req, res) => {
  try {
    const result = await educacaoService.updateFonteStatus(req.params.id, req.body || {}, req.usuarioInterno, req);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Fonte nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.fontes.status.error', error, {
      fonte_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar status da fonte.');
  }
};

exports.listCuradoriaReferencias = async (req, res) => {
  try {
    const result = await educacaoService.listReferencias(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.referencias.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar referencias de curadoria.');
  }
};

exports.createCuradoriaReferencia = async (req, res) => {
  try {
    const result = await educacaoService.createReferencia(req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.referencias.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao criar referencia de curadoria.');
  }
};

exports.updateCuradoriaReferencia = async (req, res) => {
  try {
    const result = await educacaoService.updateReferencia(req.params.id, req.body || {}, req.usuarioInterno, req);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Referencia nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.referencias.update.error', error, {
      referencia_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar referencia de curadoria.');
  }
};

exports.archiveCuradoriaReferencia = async (req, res) => {
  try {
    const result = await educacaoService.archiveReferencia(req.params.id, req.usuarioInterno, req);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Referencia nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.referencias.archive.error', error, {
      referencia_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao arquivar referencia de curadoria.');
  }
};

exports.updateConteudoStatusCuradoria = async (req, res) => {
  try {
    const result = await educacaoService.updateConteudoStatusCuradoria(
      req.params.id,
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Conteudo nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.conteudo.status.error', error, {
      conteudo_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar status de curadoria.');
  }
};

exports.validarConteudoTecnicamente = async (req, res) => {
  try {
    const result = await educacaoService.validarConteudoTecnicamente(
      req.params.id,
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Conteudo nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.conteudo.validacao_tecnica.error', error, {
      conteudo_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao validar tecnicamente conteudo.');
  }
};

exports.validarConteudoJuridicamente = async (req, res) => {
  try {
    const result = await educacaoService.validarConteudoJuridicamente(
      req.params.id,
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Conteudo nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.conteudo.validacao_juridica.error', error, {
      conteudo_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao validar juridicamente conteudo.');
  }
};

exports.setConteudoAptoIa = async (req, res) => {
  try {
    const result = await educacaoService.setConteudoAptoIa(req.params.id, req.body || {}, req.usuarioInterno, req);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Conteudo nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.conteudo.apto_ia.error', error, {
      conteudo_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao marcar conteudo apto para IA.');
  }
};

exports.setConteudoAptoPortal = async (req, res) => {
  try {
    const result = await educacaoService.setConteudoAptoPortal(req.params.id, req.body || {}, req.usuarioInterno, req);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Conteudo nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.conteudo.apto_portal.error', error, {
      conteudo_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao marcar conteudo apto para portal.');
  }
};

exports.getBaseConhecimentoValidada = async (req, res) => {
  try {
    const result = await educacaoService.listBaseConhecimentoValidada();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.curadoria.base_validada.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar base de conhecimento validada.');
  }
};

exports.listCategorias = async (req, res) => {
  try {
    const result = await educacaoService.listCategories();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.categorias.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar categorias de educacao ambiental.');
  }
};

exports.createAula = async (req, res) => {
  try {
    const result = await educacaoService.createAula(req.params.id, req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.trilhas.aula.create.error', error, {
      trilha_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao criar aula da trilha.');
  }
};

exports.updateAula = async (req, res) => {
  try {
    const result = await educacaoService.updateAula(
      req.params.id,
      req.params.aulaId,
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Aula nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.trilhas.aula.update.error', error, {
      trilha_id: parseIntOrNull(req.params.id),
      aula_id: parseIntOrNull(req.params.aulaId),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar aula da trilha.');
  }
};

exports.getPublicHome = async (req, res) => {
  try {
    const result = await educacaoService.getPublicHome();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.public.home.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar Educacao Ambiental Demonstrativa.');
  }
};

exports.getPublicConteudoBySlug = async (req, res) => {
  try {
    const result = await educacaoService.getPublicConteudoBySlug(req.params.slug);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Conteudo publicado nao encontrado.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.public.conteudo.detail.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar conteudo educativo.');
  }
};

exports.getPublicTrilha = async (req, res) => {
  try {
    const result = await educacaoService.getEntity('trilhas', req.params.id, { publicOnly: true });

    if (!result) {
      return res.status(404).json({ success: false, error: 'Trilha publicada nao encontrada.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'educacao_ambiental.public.trilha.detail.error', error, {
      trilha_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar trilha educativa.');
  }
};

exports.listConteudos = createAdminListHandler('conteudos', 'conteudos');
exports.getConteudo = createAdminGetHandler('conteudos', 'conteudo');
exports.createConteudo = createAdminCreateHandler('conteudos', 'conteudo');
exports.updateConteudo = createAdminUpdateHandler('conteudos', 'conteudo');
exports.updateConteudoStatus = createAdminStatusHandler('conteudos', 'conteudo');
exports.archiveConteudo = createAdminArchiveHandler('conteudos', 'conteudo');

exports.listNormas = createAdminListHandler('normas', 'normas');
exports.getNorma = createAdminGetHandler('normas', 'norma');
exports.createNorma = createAdminCreateHandler('normas', 'norma');
exports.updateNorma = createAdminUpdateHandler('normas', 'norma');
exports.updateNormaStatus = createAdminStatusHandler('normas', 'norma');

exports.listAgenda = createAdminListHandler('agenda', 'agenda');
exports.getAgenda = createAdminGetHandler('agenda', 'agenda');
exports.createAgenda = createAdminCreateHandler('agenda', 'agenda');
exports.updateAgenda = createAdminUpdateHandler('agenda', 'agenda');
exports.updateAgendaStatus = createAdminStatusHandler('agenda', 'agenda');

exports.listMateriais = createAdminListHandler('materiais', 'materiais');
exports.getMaterial = createAdminGetHandler('materiais', 'material');
exports.createMaterial = createAdminCreateHandler('materiais', 'material');
exports.updateMaterial = createAdminUpdateHandler('materiais', 'material');
exports.updateMaterialStatus = createAdminStatusHandler('materiais', 'material');

exports.listTrilhas = createAdminListHandler('trilhas', 'trilhas');
exports.getTrilha = createAdminGetHandler('trilhas', 'trilha');
exports.createTrilha = createAdminCreateHandler('trilhas', 'trilha');
exports.updateTrilha = createAdminUpdateHandler('trilhas', 'trilha');
exports.updateTrilhaStatus = createAdminStatusHandler('trilhas', 'trilha');

exports.listEspecies = createAdminListHandler('especies', 'especies');
exports.getEspecie = createAdminGetHandler('especies', 'especie');
exports.createEspecie = createAdminCreateHandler('especies', 'especie');
exports.updateEspecie = createAdminUpdateHandler('especies', 'especie');
exports.updateEspecieStatus = createAdminStatusHandler('especies', 'especie');

exports.listAreas = createAdminListHandler('areas', 'areas');
exports.getArea = createAdminGetHandler('areas', 'area');
exports.createArea = createAdminCreateHandler('areas', 'area');
exports.updateArea = createAdminUpdateHandler('areas', 'area');
exports.updateAreaStatus = createAdminStatusHandler('areas', 'area');

exports.listProgramas = createAdminListHandler('programas', 'programas');
exports.getPrograma = createAdminGetHandler('programas', 'programa');
exports.createPrograma = createAdminCreateHandler('programas', 'programa');
exports.updatePrograma = createAdminUpdateHandler('programas', 'programa');
exports.updateProgramaStatus = createAdminStatusHandler('programas', 'programa');

exports.listMetas = createAdminListHandler('metas', 'metas');
exports.getMeta = createAdminGetHandler('metas', 'meta');
exports.createMeta = createAdminCreateHandler('metas', 'meta');
exports.updateMeta = createAdminUpdateHandler('metas', 'meta');
exports.updateMetaStatus = createAdminStatusHandler('metas', 'meta');

exports.listFaq = createAdminListHandler('faq', 'faq');
exports.getFaq = createAdminGetHandler('faq', 'faq');
exports.createFaq = createAdminCreateHandler('faq', 'faq');
exports.updateFaq = createAdminUpdateHandler('faq', 'faq');
exports.updateFaqStatus = createAdminStatusHandler('faq', 'faq');

exports.listPublicConteudos = createPublicListHandler('conteudos', 'conteudos');
exports.listPublicNormas = createPublicListHandler('normas', 'normas');
exports.listPublicAgenda = createPublicListHandler('agenda', 'agenda');
exports.listPublicMateriais = createPublicListHandler('materiais', 'materiais');
exports.listPublicTrilhas = createPublicListHandler('trilhas', 'trilhas');
exports.listPublicEspecies = createPublicListHandler('especies', 'especies');
exports.listPublicAreas = createPublicListHandler('areas', 'areas');
exports.listPublicProgramas = createPublicListHandler('programas', 'programas');
exports.listPublicFaq = createPublicListHandler('faq', 'faq');
