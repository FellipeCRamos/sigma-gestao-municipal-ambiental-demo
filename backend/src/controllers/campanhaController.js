const fs = require('fs');
const campanhaService = require('../services/campanhaService');
const workflowService = require('../services/operacaoWorkflowService');
const { logControllerError } = require('../utils/controllerLogger');

const ALLOWED_SERVICOS = ['castracao_microchipagem', 'vacinacao'];
const ALLOWED_ESPECIES = ['canino', 'felino'];
const ALLOWED_SEXOS = ['macho', 'femea'];
const ALLOWED_STATUS_INSCRICAO = workflowService.CAMPANHA_STATUS_OPTIONS;

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean);
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 'sim';
}

function normalizePositiveIntegerOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return undefined;
  return number;
}

function normalizeVacinacoesAplicadas(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];

  return value.map((item) => ({
    id: item?.id || null,
    vacina_catalogo_id: item?.vacina_catalogo_id || null,
    dose: normalizeString(item?.dose) || null,
    data_aplicacao: normalizeString(item?.data_aplicacao) || null,
    proxima_dose_em: normalizeString(item?.proxima_dose_em) || null,
    lote: normalizeString(item?.lote) || null,
    fabricante: normalizeString(item?.fabricante) || null,
    documento_id: item?.documento_id || null,
    observacoes: normalizeString(item?.observacoes) || null
  }));
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function validateId(value, label) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return { error: `${label} invalido.` };
  }

  return { id };
}

function validateInscricao(body) {
  const campanha_id = Number(body.campanha_id);
  const servico_desejado = normalizeString(body.servico_desejado);
  const animal_nome = normalizeString(body.animal_nome);
  const animal_especie = normalizeString(body.animal_especie);
  const animal_sexo = normalizeString(body.animal_sexo);
  const peso_kg = body.peso_kg ? Number(body.peso_kg) : null;
  const territorio_id = normalizePositiveIntegerOrNull(body.territorio_id);

  if (!Number.isInteger(campanha_id) || campanha_id <= 0) {
    return { error: 'Informe a campanha.' };
  }

  if (!servico_desejado || !ALLOWED_SERVICOS.includes(servico_desejado)) {
    return { error: 'Informe o servico desejado.' };
  }

  if (!animal_nome || animal_nome.length < 2) {
    return { error: 'Informe o nome do animal.' };
  }

  if (!animal_especie || !ALLOWED_ESPECIES.includes(animal_especie)) {
    return { error: 'Informe a especie do animal.' };
  }

  if (!animal_sexo || !ALLOWED_SEXOS.includes(animal_sexo)) {
    return { error: 'Informe o sexo do animal.' };
  }

  if (peso_kg !== null && (!Number.isFinite(peso_kg) || peso_kg <= 0)) {
    return { error: 'Informe um peso valido.' };
  }

  if (territorio_id === undefined) {
    return { error: 'Territorio invalido.' };
  }

  return {
    data: {
      campanha_id,
      servico_desejado,
      criterio_prioridade: normalizeString(body.criterio_prioridade) || null,
      prioridade_detalhes: normalizeString(body.prioridade_detalhes) || null,
      animal_nome,
      territorio_id,
      bairro: normalizeString(body.bairro) || null,
      animal_endereco: normalizeString(body.animal_endereco) || null,
      animal_especie,
      animal_raca: normalizeString(body.animal_raca) || null,
      animal_sexo,
      idade_aproximada: normalizeString(body.idade_aproximada) || null,
      peso_kg,
      condicoes_saude: normalizeArray(body.condicoes_saude),
      condicao_femea: normalizeString(body.condicao_femea) || null,
      cirurgia_anterior: normalizeBoolean(body.cirurgia_anterior),
      agressivo: normalizeBoolean(body.agressivo),
      microchip: normalizeString(body.microchip) || null,
      localizacao_perda: normalizeString(body.localizacao_perda) || null,
      carteira_vacinacao: normalizeString(body.carteira_vacinacao) || null,
      declaracoes: normalizeArray(body.declaracoes)
    }
  };
}

exports.findAll = async (req, res) => {
  try {
    const result = await campanhaService.findAll();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'campanha.list.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar campanhas.'
    });
  }
};

exports.createInscricao = async (req, res) => {
  try {
    const validation = validateInscricao(req.body || {});

    if (validation.error) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const campanha = await campanhaService.findById(validation.data.campanha_id);

    if (!campanha || campanha.status !== 'ativa') {
      return res.status(404).json({
        success: false,
        error: 'Campanha nao encontrada ou encerrada.'
      });
    }

    const result = await campanhaService.createInscricao(
      req.usuarioExterno.id,
      validation.data
    );

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'campanha.inscricao_create.error', error);

    if (error.code === 'SIGBA_TERRITORIO_INVALIDO') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar inscricao.'
    });
  }
};

exports.findMinhasInscricoes = async (req, res) => {
  try {
    const result = await campanhaService.findByUsuario(req.usuarioExterno.id);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'campanha.minhas_inscricoes.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar inscricoes.'
    });
  }
};

exports.findAllInscricoes = async (req, res) => {
  try {
    const result = await campanhaService.findAllInscricoes();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'campanha.inscricoes_list.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar inscricoes.'
    });
  }
};

exports.findAgenda = async (req, res) => {
  try {
    const result = await campanhaService.findAgenda();

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'campanha.agenda.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar agenda.'
    });
  }
};

exports.exportInscricoesCsv = async (req, res) => {
  try {
    const rows = await campanhaService.findRelatorioInscricoes();
    const columns = [
      ['protocolo', 'Protocolo'],
      ['campanha_nome', 'Campanha'],
      ['status', 'Status'],
      ['agendamento_data', 'Agendamento'],
      ['servico_desejado', 'Servico'],
      ['criterio_prioridade', 'Prioridade'],
      ['tutor_nome', 'Tutor'],
      ['tutor_cpf', 'Documento'],
      ['tutor_email', 'Email'],
      ['tutor_telefone', 'Telefone'],
      ['animal_nome', 'Animal'],
      ['animal_especie', 'Especie'],
      ['animal_sexo', 'Sexo'],
      ['animal_raca', 'Raca'],
      ['territorio_nome', 'Territorio'],
      ['peso_kg', 'Peso'],
      ['microchip', 'Microchip'],
      ['tutor_id', 'Tutor oficial ID'],
      ['animal_id', 'Animal oficial ID'],
      ['documentos_total', 'Documentos'],
      ['created_at', 'Criado em'],
      ['updated_at', 'Atualizado em']
    ];

    const csv = [
      columns.map(([, label]) => csvEscape(label)).join(';'),
      ...rows.map((row) => columns.map(([key]) => csvEscape(row[key])).join(';'))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sigba-campanha-inscricoes.csv"');

    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    logControllerError(req, 'campanha.export.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao exportar relatorio.'
    });
  }
};

exports.updateInscricaoStatus = async (req, res) => {
  try {
    const idValidation = validateId(req.params.id, 'Inscricao');
    const status = normalizeString(req.body?.status);
    const agendamento_data = normalizeString(req.body?.agendamento_data);
    const observacoes_tecnicas = normalizeString(req.body?.observacoes_tecnicas);
    const resultado_operacional = normalizeString(req.body?.resultado_operacional);
    const pendencia_tipo = normalizeString(req.body?.pendencia_tipo);
    const pendencia_descricao = normalizeString(req.body?.pendencia_descricao);
    const desfecho = normalizeString(req.body?.desfecho);
    const motivo_desfecho = normalizeString(req.body?.motivo_desfecho);
    const vacinacoes_aplicadas = normalizeVacinacoesAplicadas(req.body?.vacinacoes_aplicadas);

    if (idValidation.error) {
      return res.status(400).json({
        success: false,
        error: idValidation.error
      });
    }

    if (!status || !ALLOWED_STATUS_INSCRICAO.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Status deve ser um dos valores: ${ALLOWED_STATUS_INSCRICAO.join(', ')}.`
      });
    }

    const result = await campanhaService.updateInscricaoStatus(
      idValidation.id,
      {
        status,
        agendamento_data: agendamento_data || null,
        observacoes_tecnicas: observacoes_tecnicas || null,
        resultado_operacional: resultado_operacional || null,
        pendencia_tipo: pendencia_tipo || null,
        pendencia_descricao: pendencia_descricao || null,
        desfecho: desfecho || null,
        motivo_desfecho: motivo_desfecho || null,
        ...(vacinacoes_aplicadas !== undefined ? { vacinacoes_aplicadas } : {})
      },
      req.usuarioInterno,
      req
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Inscricao nao encontrada.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'campanha.inscricao_status.error', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao atualizar status.'
    });
  }
};

exports.uploadDocumento = async (req, res) => {
  try {
    const idValidation = validateId(req.params.id, 'Inscricao');

    if (idValidation.error) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});

      return res.status(400).json({
        success: false,
        error: idValidation.error
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Envie um arquivo no campo documento.'
      });
    }

    const result = await campanhaService.createDocumento(
      req.usuarioExterno.id,
      idValidation.id,
      normalizeString(req.body?.tipo) || 'documento',
      req.file,
      req
    );

    if (!result) {
      fs.unlink(req.file.path, () => {});

      return res.status(404).json({
        success: false,
        error: 'Inscricao nao encontrada para este tutor.'
      });
    }

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    logControllerError(req, 'campanha.documento_upload.error', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno ao enviar documento.'
    });
  }
};

exports.findMeusDocumentos = async (req, res) => {
  try {
    const idValidation = validateId(req.params.id, 'Inscricao');

    if (idValidation.error) {
      return res.status(400).json({
        success: false,
        error: idValidation.error
      });
    }

    const result = await campanhaService.findDocumentosByInscricaoForUsuario(
      req.usuarioExterno.id,
      idValidation.id
    );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'campanha.documentos_list.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar documentos.'
    });
  }
};

exports.downloadMeuDocumento = async (req, res) => {
  try {
    const idValidation = validateId(req.params.id, 'Documento');

    if (idValidation.error) {
      return res.status(400).json({
        success: false,
        error: idValidation.error
      });
    }

    const documento = await campanhaService.findDocumentoForUsuario(
      req.usuarioExterno.id,
      idValidation.id
    );

    if (!campanhaService.fileExists(documento)) {
      return res.status(404).json({
        success: false,
        error: 'Documento nao encontrado.'
      });
    }

    return res.download(documento.caminho_arquivo, documento.nome_original);
  } catch (error) {
    logControllerError(req, 'campanha.documento_tutor_download.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao baixar documento.'
    });
  }
};

exports.downloadDocumentoInterno = async (req, res) => {
  try {
    const idValidation = validateId(req.params.id, 'Documento');

    if (idValidation.error) {
      return res.status(400).json({
        success: false,
        error: idValidation.error
      });
    }

    const documento = await campanhaService.findDocumentoInterno(idValidation.id);

    if (!campanhaService.fileExists(documento)) {
      return res.status(404).json({
        success: false,
        error: 'Documento nao encontrado.'
      });
    }

    return res.download(documento.caminho_arquivo, documento.nome_original);
  } catch (error) {
    logControllerError(req, 'campanha.documento_interno_download.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao baixar documento.'
    });
  }
};

exports.findMinhasNotificacoes = async (req, res) => {
  try {
    const result = await campanhaService.findNotificacoesByUsuario(req.usuarioExterno.id);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'campanha.notificacoes_list.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar notificacoes.'
    });
  }
};

exports.markNotificacaoLida = async (req, res) => {
  try {
    const idValidation = validateId(req.params.id, 'Notificacao');

    if (idValidation.error) {
      return res.status(400).json({
        success: false,
        error: idValidation.error
      });
    }

    const result = await campanhaService.markNotificacaoLida(
      req.usuarioExterno.id,
      idValidation.id
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Notificacao nao encontrada.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logControllerError(req, 'campanha.notificacao_read.error', error);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar notificacao.'
    });
  }
};
