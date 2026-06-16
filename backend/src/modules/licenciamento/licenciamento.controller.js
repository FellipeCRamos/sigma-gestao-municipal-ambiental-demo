const licenciamentoService = require('./licenciamento.service');
const enquadramentoService = require('./licenciamentoEnquadramento.service');
const governancaNormativaService = require('./licenciamentoGovernancaNormativa.service');
const fechamentoHomologacaoService = require('./licenciamentoFechamentoHomologacao.service');
const checklistAssistidoService = require('./licenciamentoChecklistAssistido.service');
const parametrizacaoConferenciaService = require('./licenciamentoParametrizacaoConferencia.service');
const assistenteService = require('./assistente/licenciamentoAssistenteService');
const preRequerimentoService = require('./preRequerimentos/licenciamentoPreRequerimentoService');
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

function createListHandler(entityKey, auditLabel) {
  return async (req, res) => {
    try {
      const result = await enquadramentoService.listEntity(entityKey, req.query || {});
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `licenciamento.${auditLabel}.list.error`, error);
      return handleServiceError(res, error, 'Erro interno ao listar parametrizacao do licenciamento.');
    }
  };
}

function createGetHandler(entityKey, auditLabel) {
  return async (req, res) => {
    try {
      const result = await enquadramentoService.getEntity(entityKey, parsePositiveIntOrThrow(req.params.id));
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `licenciamento.${auditLabel}.detail.error`, error, {
        id: parseIntOrNull(req.params.id),
      });
      return handleServiceError(res, error, 'Erro interno ao carregar parametrizacao do licenciamento.');
    }
  };
}

function createCreateHandler(entityKey, auditLabel) {
  return async (req, res) => {
    try {
      const result = await enquadramentoService.createEntity(entityKey, req.body || {}, req.usuarioInterno, req);
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `licenciamento.${auditLabel}.create.error`, error);
      return handleServiceError(res, error, 'Erro interno ao criar parametrizacao do licenciamento.');
    }
  };
}

function createUpdateHandler(entityKey, auditLabel) {
  return async (req, res) => {
    try {
      const result = await enquadramentoService.updateEntity(
        entityKey,
        parsePositiveIntOrThrow(req.params.id),
        req.body || {},
        req.usuarioInterno,
        req
      );

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `licenciamento.${auditLabel}.update.error`, error, {
        id: parseIntOrNull(req.params.id),
      });
      return handleServiceError(res, error, 'Erro interno ao atualizar parametrizacao do licenciamento.');
    }
  };
}

function createDeleteHandler(entityKey, auditLabel) {
  return async (req, res) => {
    try {
      const result = await enquadramentoService.deleteEntity(
        entityKey,
        parsePositiveIntOrThrow(req.params.id),
        req.usuarioInterno,
        req
      );

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logControllerError(req, `licenciamento.${auditLabel}.delete.error`, error, {
        id: parseIntOrNull(req.params.id),
      });
      return handleServiceError(res, error, 'Erro interno ao inativar parametrizacao do licenciamento.');
    }
  };
}

exports.getResumo = async (req, res) => {
  try {
    const result = await licenciamentoService.getResumo();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.resumo.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar resumo do licenciamento.');
  }
};

exports.listProcessos = async (req, res) => {
  try {
    const result = await licenciamentoService.listProcessos(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.processo.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar processos de licenciamento.');
  }
};

exports.createProcesso = async (req, res) => {
  try {
    const result = await licenciamentoService.createProcesso(req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.processo.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao criar processo de licenciamento.');
  }
};

exports.getProcesso = async (req, res) => {
  try {
    const result = await licenciamentoService.getProcesso(parsePositiveIntOrThrow(req.params.id));

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Processo de licenciamento nao encontrado.',
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.processo.detail.error', error, {
      processo_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar processo de licenciamento.');
  }
};

exports.updateProcesso = async (req, res) => {
  try {
    const result = await licenciamentoService.updateProcesso(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Processo de licenciamento nao encontrado.',
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.processo.update.error', error, {
      processo_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar processo de licenciamento.');
  }
};

exports.getHistorico = async (req, res) => {
  try {
    const result = await licenciamentoService.getHistorico(parsePositiveIntOrThrow(req.params.id));

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Processo de licenciamento nao encontrado.',
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.processo.historico.error', error, {
      processo_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar historico do processo.');
  }
};

exports.listAtividades = createListHandler('atividades', 'atividade');
exports.getAtividade = createGetHandler('atividades', 'atividade');
exports.createAtividade = createCreateHandler('atividades', 'atividade');
exports.updateAtividade = createUpdateHandler('atividades', 'atividade');
exports.deleteAtividade = createDeleteHandler('atividades', 'atividade');

exports.listTiposLicenca = createListHandler('tiposLicenca', 'tipo_licenca');
exports.createTipoLicenca = createCreateHandler('tiposLicenca', 'tipo_licenca');
exports.updateTipoLicenca = createUpdateHandler('tiposLicenca', 'tipo_licenca');
exports.deleteTipoLicenca = createDeleteHandler('tiposLicenca', 'tipo_licenca');

exports.listPotenciaisPoluidor = createListHandler('potenciaisPoluidor', 'potencial_poluidor');
exports.createPotencialPoluidor = createCreateHandler('potenciaisPoluidor', 'potencial_poluidor');
exports.updatePotencialPoluidor = createUpdateHandler('potenciaisPoluidor', 'potencial_poluidor');
exports.deletePotencialPoluidor = createDeleteHandler('potenciaisPoluidor', 'potencial_poluidor');

exports.listClasses = createListHandler('classes', 'classe');
exports.createClasse = createCreateHandler('classes', 'classe');
exports.updateClasse = createUpdateHandler('classes', 'classe');
exports.deleteClasse = createDeleteHandler('classes', 'classe');

exports.listRegrasEnquadramento = createListHandler('regrasEnquadramento', 'regra_enquadramento');
exports.getRegraEnquadramento = createGetHandler('regrasEnquadramento', 'regra_enquadramento');
exports.createRegraEnquadramento = createCreateHandler('regrasEnquadramento', 'regra_enquadramento');
exports.updateRegraEnquadramento = createUpdateHandler('regrasEnquadramento', 'regra_enquadramento');
exports.deleteRegraEnquadramento = createDeleteHandler('regrasEnquadramento', 'regra_enquadramento');

exports.listRegraParametros = createListHandler('regraParametros', 'regra_parametro');
exports.createRegraParametro = createCreateHandler('regraParametros', 'regra_parametro');
exports.updateRegraParametro = createUpdateHandler('regraParametros', 'regra_parametro');
exports.deleteRegraParametro = createDeleteHandler('regraParametros', 'regra_parametro');

exports.listDocumentosExigidos = createListHandler('documentosExigidos', 'documento_exigido');
exports.createDocumentoExigido = createCreateHandler('documentosExigidos', 'documento_exigido');
exports.updateDocumentoExigido = createUpdateHandler('documentosExigidos', 'documento_exigido');
exports.deleteDocumentoExigido = createDeleteHandler('documentosExigidos', 'documento_exigido');

exports.listRegrasTaxas = createListHandler('regrasTaxas', 'regra_taxa');
exports.createRegraTaxa = createCreateHandler('regrasTaxas', 'regra_taxa');
exports.updateRegraTaxa = createUpdateHandler('regrasTaxas', 'regra_taxa');
exports.deleteRegraTaxa = createDeleteHandler('regrasTaxas', 'regra_taxa');

exports.listVrte = createListHandler('vrte', 'vrte');
exports.createVrte = createCreateHandler('vrte', 'vrte');
exports.updateVrte = createUpdateHandler('vrte', 'vrte');
exports.deleteVrte = createDeleteHandler('vrte', 'vrte');

exports.listNormas = createListHandler('normas', 'norma');
exports.getNorma = createGetHandler('normas', 'norma');
exports.createNorma = createCreateHandler('normas', 'norma');
exports.updateNorma = createUpdateHandler('normas', 'norma');
exports.deleteNorma = createDeleteHandler('normas', 'norma');

exports.listSimulacoes = createListHandler('simulacoes', 'simulacao');

exports.getParametrizacaoStatus = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoStatus();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar status da parametrizacao do licenciamento.');
  }
};

exports.getParametrizacaoFase2D1Status = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoFase2D1Status();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d1.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar status da parametrizacao Fase 2D.1.');
  }
};

exports.getParametrizacaoFase2D2Status = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoFase2D2Status();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d2.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar status da parametrizacao Fase 2D.2.');
  }
};

exports.getParametrizacaoFase2D21Status = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoFase2D21Status();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d21.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar status da parametrizacao Fase 2D.2.1.');
  }
};

exports.getParametrizacaoFase2D3MapaDecretoStatus = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoFase2D3MapaDecretoStatus();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d3.mapa_decreto.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar mapa mestre do Decreto Fase 2D.3.');
  }
};

exports.getParametrizacaoFase2D4AGrupo19ConferenciaStatus = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoFase2D4AGrupo19ConferenciaStatus();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d4a.grupo19.conferencia.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar conferencia normativa do Grupo 19 Fase 2D.4-A.');
  }
};

exports.getParametrizacaoFase2D4BGrupo19Status = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoFase2D4BGrupo19Status();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d4b.grupo19.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar parametrizacao do Grupo 19 Fase 2D.4-B.');
  }
};

exports.getParametrizacaoFase2D5AMapaPosGrupo19Status = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoFase2D5AMapaPosGrupo19Status();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5a.mapa_pos_grupo19.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar mapa mestre pos-Grupo 19 Fase 2D.5-A.');
  }
};

exports.getParametrizacaoFase2D5BComplementacaoGruposStatus = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoFase2D5BComplementacaoGruposStatus();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5b.complementacao_grupos.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar complementacao controlada de grupos Fase 2D.5B.');
  }
};

exports.getParametrizacaoFase2D5CGrupo21ConferenciaStatus = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoFase2D5CGrupo21ConferenciaStatus();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c.grupo21.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar conferencia normativa do Grupo 21 Fase 2D.5C.');
  }
};

exports.getParametrizacaoFase2D5C1Grupo21ConferenciaVisualStatus = async (req, res) => {
  try {
    const result = await enquadramentoService.getParametrizacaoFase2D5C1Grupo21ConferenciaVisualStatus();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c1.grupo21.conferencia_visual.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar conferencia visual do Grupo 21 Fase 2D.5C.1.');
  }
};

exports.getParametrizacaoFase2D5C2Grupo21Bancada = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getBancadaGrupo21(req.usuarioInterno);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2.grupo21.bancada.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar bancada de conferencia do Grupo 21 Fase 2D.5C.2.');
  }
};

exports.getParametrizacaoFase2D5C2Grupo21BancadaCodigo = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getBancadaCodigo(req.params.codigo);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2.grupo21.codigo.error', error, {
      codigo: req.params.codigo,
    });
    return handleServiceError(res, error, 'Erro interno ao carregar codigo da bancada 2D.5C.2.');
  }
};

exports.patchParametrizacaoFase2D5C2Grupo21BancadaCodigo = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.salvarConferenciaCodigo(
      req.params.codigo,
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2.grupo21.codigo.patch.error', error, {
      codigo: req.params.codigo,
    });
    return handleServiceError(res, error, 'Erro interno ao salvar conferencia manual do Grupo 21.');
  }
};

exports.validarParametrizacaoFase2D5C2Grupo21BancadaCodigo = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.validarConferenciaCodigo(
      req.params.codigo,
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2.grupo21.codigo.validar.error', error, {
      codigo: req.params.codigo,
    });
    return handleServiceError(res, error, 'Erro interno ao validar conferencia manual do Grupo 21.');
  }
};

exports.getParametrizacaoFase2D5C2Grupo21BancadaCodigoHistorico = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getHistoricoCodigo(req.params.codigo);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2.grupo21.codigo.historico.error', error, {
      codigo: req.params.codigo,
    });
    return handleServiceError(res, error, 'Erro interno ao carregar historico da bancada 2D.5C.2.');
  }
};

exports.getParametrizacaoFase2D5C2AGrupo21PreviaSeed = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getPreviaSeedGrupo21();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2a.grupo21.previa_seed.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar previa de seed do Grupo 21 Fase 2D.5C.2-A.');
  }
};

exports.getParametrizacaoFase2D5C2BGrupo21ModeloJson = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getModeloJsonImportacaoGrupo21();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2b.grupo21.modelo_json.error', error);
    return handleServiceError(res, error, 'Erro interno ao gerar modelo de importacao do Grupo 21 Fase 2D.5C.2-B.');
  }
};

exports.validarParametrizacaoFase2D5C2BGrupo21Importacao = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.validarImportacaoGrupo21(req.body || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2b.grupo21.validar_importacao.error', error);
    return handleServiceError(res, error, 'Erro interno ao validar importacao do Grupo 21 Fase 2D.5C.2-B.');
  }
};

exports.aplicarParametrizacaoFase2D5C2BGrupo21Importacao = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.aplicarImportacaoGrupo21(
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2b.grupo21.aplicar_importacao.error', error);
    return handleServiceError(res, error, 'Erro interno ao aplicar importacao do Grupo 21 Fase 2D.5C.2-B.');
  }
};

exports.getParametrizacaoFase2D5C2BGrupo21HistoricoImportacoes = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getHistoricoImportacoesGrupo21();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2b.grupo21.historico_importacoes.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar historico de importacoes do Grupo 21 Fase 2D.5C.2-B.');
  }
};

exports.getParametrizacaoFase2D5C2CGrupo21PreparacaoMatrizReal = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getPreparacaoMatrizRealGrupo21();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2c.grupo21.preparacao_matriz_real.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar preparacao da matriz real do Grupo 21 Fase 2D.5C.2-C.');
  }
};

exports.getParametrizacaoFase2D5C2CGrupo21ModeloOficialReal = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getModeloOficialRealGrupo21();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2c.grupo21.modelo_oficial_real.error', error);
    return handleServiceError(res, error, 'Erro interno ao gerar modelo oficial real do Grupo 21 Fase 2D.5C.2-C.');
  }
};

exports.limparParametrizacaoFase2D5C2CGrupo21RascunhosHomologacao = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.limparRascunhosHomologacaoGrupo21(
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c2c.grupo21.limpar_rascunhos_homologacao.error', error);
    return handleServiceError(res, error, 'Erro interno ao limpar rascunhos de homologacao do Grupo 21 Fase 2D.5C.2-C.');
  }
};

exports.getParametrizacaoFase2D5C3AGrupo21ConferenciaComplementar = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getConferenciaComplementarGrupo21();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c3a.grupo21.conferencia_complementar.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar conferencia complementar do Grupo 21 Fase 2D.5C.3-A.');
  }
};

exports.aplicarParametrizacaoFase2D5C3AGrupo21Complementacao = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.aplicarComplementacaoGrupo21(
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c3a.grupo21.aplicar_complementacao.error', error);
    return handleServiceError(res, error, 'Erro interno ao aplicar complementacao do Grupo 21 Fase 2D.5C.3-A.');
  }
};

exports.getParametrizacaoFase2D5C3BGrupo21BloqueioNormativo = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getBloqueioNormativoGrupo21(req.usuarioInterno);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c3b.grupo21.bloqueio_normativo.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar bloqueio normativo do Grupo 21 Fase 2D.5C.3-B.');
  }
};

exports.registrarParametrizacaoFase2D5C3BGrupo21Bloqueio = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.registrarBloqueioNormativoGrupo21(
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c3b.grupo21.registrar_bloqueio.error', error);
    return handleServiceError(res, error, 'Erro interno ao registrar bloqueio normativo do Grupo 21 Fase 2D.5C.3-B.');
  }
};

exports.getParametrizacaoFase2D5C4Grupo21RevisaoNormativa = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getRevisaoNormativaControladaGrupo21(req.usuarioInterno);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c4.grupo21.revisao_normativa.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar revisao normativa do Grupo 21 Fase 2D.5C.4.');
  }
};

exports.getParametrizacaoFase2D5C4Grupo21PreviaSeed = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getPreviaSeedRevisaoNormativaGrupo21(req.usuarioInterno);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c4.grupo21.previa_seed.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar previa de seed revisada do Grupo 21 Fase 2D.5C.4.');
  }
};

exports.getParametrizacaoFase2D5C5Grupo21PreviaSeedControlado = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.getPreviaSeedControladoGrupo21(req.usuarioInterno);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c5.grupo21.previa_seed_controlado.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar previa de seed controlado do Grupo 21 Fase 2D.5C.5.');
  }
};

exports.aplicarParametrizacaoFase2D5C5Grupo21SeedControlado = async (req, res) => {
  try {
    const result = await parametrizacaoConferenciaService.aplicarSeedControladoGrupo21(
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.parametrizacao.fase2d5c5.grupo21.aplicar_seed_controlado.error', error);
    return handleServiceError(res, error, 'Erro interno ao aplicar seed controlado do Grupo 21 Fase 2D.5C.5.');
  }
};

exports.getGovernancaNormativaStatus = async (req, res) => {
  try {
    const result = await governancaNormativaService.getStatus();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.governanca_normativa.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar status da governanca normativa.');
  }
};

exports.listGovernancaNormas = async (req, res) => {
  try {
    const result = await governancaNormativaService.listNormas();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.governanca_normativa.normas.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar normas da governanca normativa.');
  }
};

exports.listGovernancaDivergencias = async (req, res) => {
  try {
    const result = await governancaNormativaService.listDivergencias();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.governanca_normativa.divergencias.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar divergencias normativas.');
  }
};

exports.listGovernancaTabelasTaxas = async (req, res) => {
  try {
    const result = await governancaNormativaService.listTabelasTaxas();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.governanca_normativa.tabelas_taxas.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar tabelas de taxas versionadas.');
  }
};

exports.listGovernancaMatrizes = async (req, res) => {
  try {
    const result = await governancaNormativaService.listMatrizes();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.governanca_normativa.matrizes.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar matrizes versionadas.');
  }
};

exports.listGovernancaHomologacao = async (req, res) => {
  try {
    const result = await governancaNormativaService.listHomologacao();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.governanca_normativa.homologacao.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar checklist de homologacao.');
  }
};

exports.updateGovernancaHomologacao = async (req, res) => {
  try {
    const result = await governancaNormativaService.updateHomologacaoItem(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.governanca_normativa.homologacao.update.error', error, {
      homologacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar item de homologacao.');
  }
};

exports.runGovernancaHomologacaoDiagnostico = async (req, res) => {
  try {
    const result = await governancaNormativaService.runHomologacaoDiagnostico(req.usuarioInterno, req);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.governanca_normativa.homologacao.diagnostico.error', error);
    return handleServiceError(res, error, 'Erro interno ao executar diagnostico de homologacao assistida.');
  }
};

exports.getGovernancaHomologacaoRelatorio = async (req, res) => {
  try {
    const result = await governancaNormativaService.getHomologacaoAssistidaRelatorio(req.usuarioInterno, req);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.governanca_normativa.homologacao.relatorio.error', error);
    return handleServiceError(res, error, 'Erro interno ao gerar relatorio de homologacao assistida.');
  }
};

exports.getHomologacaoFechamentoStatus = async (req, res) => {
  try {
    const result = await fechamentoHomologacaoService.getStatus();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.homologacao_fechamento.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar status do fechamento de homologacao.');
  }
};

exports.listHomologacaoFechamentoPendencias = async (req, res) => {
  try {
    const result = await fechamentoHomologacaoService.listPendencias();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.homologacao_fechamento.pendencias.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar pendencias do fechamento de homologacao.');
  }
};

exports.getHomologacaoFechamentoRoteiro = async (req, res) => {
  try {
    const result = await fechamentoHomologacaoService.getRoteiro();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.homologacao_fechamento.roteiro.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar roteiro do fechamento de homologacao.');
  }
};

exports.updateHomologacaoFechamentoChecklist = async (req, res) => {
  try {
    const result = await fechamentoHomologacaoService.updateChecklistItem(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.homologacao_fechamento.checklist.update.error', error, {
      homologacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar item do fechamento de homologacao.');
  }
};

exports.runHomologacaoFechamentoDiagnostico = async (req, res) => {
  try {
    const result = await fechamentoHomologacaoService.runDiagnosticoFinal(req.usuarioInterno, req);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.homologacao_fechamento.diagnostico.error', error);
    return handleServiceError(res, error, 'Erro interno ao executar diagnostico final de homologacao.');
  }
};

exports.getHomologacaoFechamentoRelatorio = async (req, res) => {
  try {
    const result = await fechamentoHomologacaoService.getRelatorio(req.usuarioInterno, req);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.homologacao_fechamento.relatorio.error', error);
    return handleServiceError(res, error, 'Erro interno ao gerar relatorio de fechamento de homologacao.');
  }
};

exports.registrarHomologacaoFechamentoLiberacaoFase2D = async (req, res) => {
  try {
    const result = await fechamentoHomologacaoService.registrarLiberacaoFase2D(req.body || {}, req.usuarioInterno, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.homologacao_fechamento.liberacao.error', error);
    return handleServiceError(res, error, 'Erro interno ao registrar liberacao tecnica da Fase 2D.');
  }
};

exports.getChecklistAssistidoStatus = async (req, res) => {
  try {
    const result = await checklistAssistidoService.calcularResumoChecklist();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.checklist_assistido.status.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar status do checklist assistido.');
  }
};

exports.listChecklistAssistidoItens = async (req, res) => {
  try {
    const result = await checklistAssistidoService.listarItensChecklistAssistido(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.checklist_assistido.itens.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar itens do checklist assistido.');
  }
};

exports.listChecklistAssistidoPendencias = async (req, res) => {
  try {
    const result = await checklistAssistidoService.listarPendenciasObrigatorias();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.checklist_assistido.pendencias.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar pendencias do checklist assistido.');
  }
};

exports.getChecklistAssistidoItem = async (req, res) => {
  try {
    const result = await checklistAssistidoService.obterItem(parsePositiveIntOrThrow(req.params.id));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.checklist_assistido.item.error', error, {
      homologacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar item do checklist assistido.');
  }
};

exports.getChecklistAssistidoSugestao = async (req, res) => {
  try {
    const result = await checklistAssistidoService.obterSugestaoItem(parsePositiveIntOrThrow(req.params.id));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.checklist_assistido.sugestao.error', error, {
      homologacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar sugestao do checklist assistido.');
  }
};

exports.updateChecklistAssistidoItem = async (req, res) => {
  try {
    const result = await checklistAssistidoService.atualizarItemChecklistAssistido(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.checklist_assistido.update.error', error, {
      homologacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar item do checklist assistido.');
  }
};

exports.runChecklistAssistidoDiagnostico = async (req, res) => {
  try {
    const result = await checklistAssistidoService.getDiagnosticoAssistido(req.usuarioInterno, req);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.checklist_assistido.diagnostico.error', error);
    return handleServiceError(res, error, 'Erro interno ao executar diagnostico do checklist assistido.');
  }
};

exports.applyChecklistAssistidoSugestao = async (req, res) => {
  try {
    const result = await checklistAssistidoService.aplicarObservacaoSugerida(
      parsePositiveIntOrThrow(req.params.id),
      req.usuarioInterno,
      req
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.checklist_assistido.aplicar_sugestao.error', error, {
      homologacao_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao aplicar observacao sugerida.');
  }
};

exports.getChecklistAssistidoRelatorioPendencias = async (req, res) => {
  try {
    const result = await checklistAssistidoService.gerarRelatorioPendencias(req.usuarioInterno, req);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.checklist_assistido.relatorio_pendencias.error', error);
    return handleServiceError(res, error, 'Erro interno ao gerar relatorio de pendencias do checklist assistido.');
  }
};

exports.runGovernancaSeedFase2C = async (req, res) => {
  try {
    const result = await governancaNormativaService.runSeedFase2C(req.usuarioInterno, req);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.governanca_normativa.seed_fase2c.error', error);
    return handleServiceError(res, error, 'Erro interno ao executar seed da Fase 2C.');
  }
};

exports.createNormaVinculo = async (req, res) => {
  try {
    const result = await enquadramentoService.createNormaVinculo(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno,
      req
    );

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.norma_vinculo.create.error', error, {
      norma_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao vincular norma do licenciamento.');
  }
};

exports.deleteNormaVinculo = async (req, res) => {
  try {
    const result = await enquadramentoService.deleteNormaVinculo(
      parsePositiveIntOrThrow(req.params.vinculoId, 'vinculoId'),
      req.usuarioInterno,
      req
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.norma_vinculo.delete.error', error, {
      vinculo_id: parseIntOrNull(req.params.vinculoId),
    });
    return handleServiceError(res, error, 'Erro interno ao inativar vinculo de norma do licenciamento.');
  }
};

exports.createPublicAssistenteAnalise = async (req, res) => {
  try {
    const result = await assistenteService.criarAnalisePublica(req.body || {}, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.publico.assistente.analise.create.error', error);
    return handleServiceError(res, error, 'Erro interno ao registrar pre-analise do assistente.');
  }
};

exports.listAssistenteAnalises = async (req, res) => {
  try {
    const result = await assistenteService.listarAnalises(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.assistente.analise.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar pre-analises do assistente.');
  }
};

exports.getAssistenteAnalise = async (req, res) => {
  try {
    const result = await assistenteService.obterAnalise(parsePositiveIntOrThrow(req.params.id));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.assistente.analise.detail.error', error, {
      analise_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar pre-analise do assistente.');
  }
};

exports.updateAssistenteAnaliseStatus = async (req, res) => {
  try {
    const result = await assistenteService.atualizarStatus(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.assistente.analise.status.error', error, {
      analise_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar status da pre-analise.');
  }
};

exports.validarAssistenteAnalise = async (req, res) => {
  try {
    const result = await assistenteService.registrarValidacao(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.assistente.analise.validacao.error', error, {
      analise_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao registrar validacao tecnica da pre-analise.');
  }
};

exports.listAssistenteAnaliseHistorico = async (req, res) => {
  try {
    const result = await assistenteService.listarHistorico(parsePositiveIntOrThrow(req.params.id));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.assistente.analise.historico.error', error, {
      analise_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao listar historico da pre-analise.');
  }
};

exports.converterAssistenteAnalisePreRequerimento = async (req, res) => {
  try {
    const result = await preRequerimentoService.converterAnaliseAssistente(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno
    );
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.assistente.analise.converter_pre_requerimento.error', error, {
      analise_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao converter pre-analise em pre-requerimento.');
  }
};

exports.listPreRequerimentos = async (req, res) => {
  try {
    const result = await preRequerimentoService.listarPreRequerimentos(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.pre_requerimento.list.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar pre-requerimentos ambientais.');
  }
};

exports.getPreRequerimento = async (req, res) => {
  try {
    const result = await preRequerimentoService.obterPreRequerimento(parsePositiveIntOrThrow(req.params.id));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.pre_requerimento.detail.error', error, {
      pre_requerimento_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao carregar pre-requerimento ambiental.');
  }
};

exports.updatePreRequerimentoStatus = async (req, res) => {
  try {
    const result = await preRequerimentoService.atualizarStatus(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.pre_requerimento.status.error', error, {
      pre_requerimento_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar status do pre-requerimento.');
  }
};

exports.updatePreRequerimentoMinuta = async (req, res) => {
  try {
    const result = await preRequerimentoService.atualizarMinuta(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.pre_requerimento.minuta.error', error, {
      pre_requerimento_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar minuta do pre-requerimento.');
  }
};

exports.updatePreRequerimentoDocumento = async (req, res) => {
  try {
    const result = await preRequerimentoService.atualizarDocumento(
      parsePositiveIntOrThrow(req.params.id),
      req.body || {},
      req.usuarioInterno
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.pre_requerimento.documento.error', error, {
      pre_requerimento_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao atualizar checklist documental do pre-requerimento.');
  }
};

exports.listPreRequerimentoHistorico = async (req, res) => {
  try {
    const result = await preRequerimentoService.listarHistorico(parsePositiveIntOrThrow(req.params.id));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.pre_requerimento.historico.error', error, {
      pre_requerimento_id: parseIntOrNull(req.params.id),
    });
    return handleServiceError(res, error, 'Erro interno ao listar historico do pre-requerimento.');
  }
};

exports.listPublicAtividades = async (req, res) => {
  try {
    const result = await enquadramentoService.listPublicActivities(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.publico.atividades.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar atividades licenciaveis.');
  }
};

exports.listPublicNormas = async (req, res) => {
  try {
    const result = await enquadramentoService.listPublicNormas(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.publico.normas.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar normas do licenciamento.');
  }
};

exports.listPublicLegislacaoLicenciamento = async (req, res) => {
  try {
    const result = await governancaNormativaService.listLegislacaoPublica();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.publico.legislacao.error', error);
    return handleServiceError(res, error, 'Erro interno ao listar legislacao ambiental municipal.');
  }
};

exports.getPublicLegislacaoLicenciamento = async (req, res) => {
  try {
    const result = await governancaNormativaService.getLegislacaoPublica(req.params.codigo);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.publico.legislacao.detail.error', error, {
      codigo: req.params.codigo,
    });
    return handleServiceError(res, error, 'Erro interno ao carregar legislacao ambiental municipal.');
  }
};

exports.listPublicAvisosNormativosLicenciamento = async (req, res) => {
  try {
    const result = await governancaNormativaService.listAvisosNormativosPublicos();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.publico.avisos_normativos.error', error);
    return handleServiceError(res, error, 'Erro interno ao carregar avisos normativos do licenciamento.');
  }
};

exports.simulatePublicEnquadramento = async (req, res) => {
  try {
    const result = await enquadramentoService.simulateEnquadramento(req.body || {}, req);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.publico.simulacao.error', error);
    return handleServiceError(res, error, 'Erro interno ao simular enquadramento ambiental.');
  }
};

exports.getPublicSimulacao = async (req, res) => {
  try {
    const result = await enquadramentoService.getPublicSimulation(req.params.protocolo);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logControllerError(req, 'licenciamento.publico.simulacao.detail.error', error);
    return handleServiceError(res, error, 'Erro interno ao consultar simulacao.');
  }
};
