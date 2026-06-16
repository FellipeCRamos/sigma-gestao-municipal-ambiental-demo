const assistenteRepository = require('../assistente/licenciamentoAssistenteRepository');
const repository = require('./licenciamentoPreRequerimentoRepository');
const {
  validateConversionPayload,
  validateDocumentoUpdate,
  validateListFilters,
  validateMinutaUpdate,
  validateStatusUpdate,
} = require('./licenciamentoPreRequerimentoValidation');

function buildError(message, statusCode = 400, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function notFoundError() {
  return buildError('Pre-requerimento ambiental nao encontrado.', 404);
}

function normalizeDocumentName(item, index) {
  if (typeof item === 'string') {
    return {
      codigo: `doc_${String(index + 1).padStart(3, '0')}`,
      nome: item,
      descricao: item,
      obrigatorio: true,
      status: 'pendente',
      observacao: '',
      atualizadoEm: new Date().toISOString(),
      usuarioResponsavel: null,
      arquivoId: null,
    };
  }

  const nome = item?.nome || item?.nomeDocumento || item?.titulo || item?.label || `Documento ${index + 1}`;
  return {
    codigo: item?.codigo || item?.codigoDocumento || `doc_${String(index + 1).padStart(3, '0')}`,
    nome,
    descricao: item?.descricao || nome,
    obrigatorio: item?.obrigatorio !== false,
    status: item?.status || 'pendente',
    observacao: item?.observacao || '',
    atualizadoEm: item?.atualizadoEm || new Date().toISOString(),
    usuarioResponsavel: item?.usuarioResponsavel || null,
    arquivoId: item?.arquivoId || null,
  };
}

function buildChecklist(analise) {
  return (analise.checklistDocumental || []).map(normalizeDocumentName);
}

function formatAnswer(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value === true) return 'sim';
  if (value === false) return 'nao';
  if (value === null || value === undefined || value === '') return 'nao informado';
  return String(value);
}

function buildSidDigital(analise, codigoPreRequerimento = null) {
  const perguntasRespostas = Object.entries(analise.respostasFormulario || {}).map(([pergunta, resposta]) => ({
    pergunta,
    resposta,
    respostaFormatada: formatAnswer(resposta),
  }));

  return {
    titulo: 'SID DIGITAL - SOLICITACAO DE INFORMACOES DA ATIVIDADE',
    codigoPreRequerimento,
    interessado: analise.nomeInteressado || analise.emailInteressado || 'Nao informado',
    atividade: analise.atividadeProvavel,
    descricaoOriginal: analise.descricaoOriginal,
    perguntasRespostas,
    pendencias: analise.pendencias || [],
    checklistDocumental: analise.checklistDocumental || [],
    dataGeracao: new Date().toISOString(),
    aviso: 'Este SID digital organiza informacoes declaradas para instrucao preliminar e nao constitui licenca, dispensa, autorizacao, certidao ou ato administrativo autorizativo.',
  };
}

function buildMinutaDespacho(analise) {
  const base = [
    'Considerando a pre-analise registrada por meio do Assistente Inteligente de Enquadramento Ambiental, referente a pretensao de exercicio de atividade ambiental informada pelo interessado;',
    '',
    'Considerando as informacoes declaradas no SID digital, especialmente quanto a caracterizacao da atividade, localizacao, tipo de imovel, possiveis interferencias ambientais, geracao de residuos, uso de recursos hidricos, intervencao em APP, supressao vegetal, condicoes de armazenamento e demais elementos declarados;',
    '',
    'Encaminha-se o presente pre-requerimento para conferencia documental e analise tecnica do Departamento de Licenciamento Ambiental, devendo ser verificadas as pendencias apontadas no checklist documental e, quando aplicavel, solicitada complementacao ao interessado ou manifestacao de outros setores competentes.',
  ];

  if (analise.slugAtividade === 'reciclagem_ferro_velho_sucata') {
    base.push(
      '',
      'No caso declarado, a atividade possui indicios de armazenamento temporario, triagem e comercializacao de materiais reciclaveis/sucata, devendo ser verificados os materiais recebidos, as condicoes de armazenamento, piso, cobertura, eventual presenca de residuo perigoso e a necessidade de manifestacao urbanistica, quando aplicavel.'
    );
  }

  base.push(
    '',
    'Ressalta-se que a presente pre-analise e o respectivo pre-requerimento nao constituem licenca ambiental, dispensa, anuencia, autorizacao, certidao ou qualquer ato administrativo autorizativo, ficando o prosseguimento condicionado a validacao tecnica e administrativa da SMAD.'
  );

  return base.join('\n');
}

function buildPreRequerimentoPayload(analise, validated, usuario) {
  const checklist = buildChecklist(analise);

  return {
    analiseAssistenteId: analise.id,
    interessadoNome: analise.nomeInteressado,
    interessadoEmail: analise.emailInteressado,
    interessadoTelefone: analise.telefoneInteressado,
    tipoPessoa: analise.tipoPessoa,
    tipoImovel: analise.tipoImovel,
    atividadeEnquadrada: analise.atividadeProvavel,
    slugAtividade: analise.slugAtividade,
    grupoAtividade: analise.grupoAtividade,
    descricaoOriginal: analise.descricaoOriginal,
    resumoCidadao: analise.resumoCidadao,
    resumoTecnico: analise.resumoTecnico,
    nivelAtencao: analise.nivelAtencao,
    recomendacaoTramitacao: analise.recomendacaoTramitacao,
    sidDigital: buildSidDigital(analise),
    checklistDocumental: checklist,
    pendencias: analise.pendencias || [],
    documentos: checklist,
    minutaDespacho: buildMinutaDespacho(analise),
    status: validated.statusInicial,
    criadoPor: usuario?.id || null,
    observacoesInternas: validated.observacaoConversao,
  };
}

async function converterAnaliseAssistente(analiseId, payload, usuario) {
  const validated = validateConversionPayload(payload);

  return repository.withTransaction(async (client) => {
    const analise = await assistenteRepository.getAnaliseByIdForUpdate(client, analiseId);
    if (!analise) {
      throw buildError('Analise do assistente nao encontrada.', 404);
    }
    if (analise.status === 'arquivado') {
      throw buildError('Analise arquivada nao pode ser convertida em pre-requerimento.', 400);
    }

    const existing = await repository.findByAnaliseId(client, analiseId);
    if (existing) {
      throw buildError('Analise do assistente ja possui pre-requerimento vinculado.', 409, {
        preRequerimentoId: existing.id,
        codigoPreRequerimento: existing.codigoPreRequerimento,
      });
    }

    const created = await repository.createPreRequerimento(
      client,
      buildPreRequerimentoPayload(analise, validated, usuario)
    );
    const sidDigital = {
      ...created.sidDigital,
      codigoPreRequerimento: created.codigoPreRequerimento,
    };
    const updated = await repository.updateDocumentos(client, created.id, created.documentos, created.checklistDocumental);
    updated.sidDigital = sidDigital;

    await client.query(
      'UPDATE licenciamento_pre_requerimentos SET sid_digital = $2::jsonb WHERE id = $1;',
      [created.id, JSON.stringify(sidDigital)]
    );

    await repository.addHistorico(client, {
      preRequerimentoId: created.id,
      acao: 'criacao_por_conversao_assistente',
      statusAnterior: null,
      statusNovo: created.status,
      observacao: validated.observacaoConversao,
      usuarioId: usuario?.id || null,
      metadados: {
        analiseAssistenteId: analise.id,
        codigoAnaliseAssistente: analise.codigoPreliminar,
        usuarioNome: usuario?.nome || null,
      },
    });

    const updatedAnalise = await assistenteRepository.updateStatus(client, analise.id, 'convertido_em_requerimento');
    await assistenteRepository.addHistorico(client, {
      analiseId: analise.id,
      acao: 'conversao_pre_requerimento',
      statusAnterior: analise.status,
      statusNovo: updatedAnalise.status,
      observacao: `Convertida em pre-requerimento ${created.codigoPreRequerimento}. ${validated.observacaoConversao}`,
      usuarioId: usuario?.id || null,
      metadados: {
        preRequerimentoId: created.id,
        codigoPreRequerimento: created.codigoPreRequerimento,
        usuarioNome: usuario?.nome || null,
      },
    });

    return {
      id: created.id,
      codigoPreRequerimento: created.codigoPreRequerimento,
      status: created.status,
    };
  });
}

async function listarPreRequerimentos(query = {}) {
  return repository.listPreRequerimentos(validateListFilters(query));
}

async function obterPreRequerimento(id) {
  const result = await repository.getPreRequerimentoById(id);
  if (!result) throw notFoundError();
  return result;
}

async function atualizarStatus(id, payload, usuario) {
  const validated = validateStatusUpdate(payload);
  return repository.withTransaction(async (client) => {
    const current = await repository.getPreRequerimentoByIdForUpdate(client, id);
    if (!current) throw notFoundError();
    const updated = await repository.updateStatus(client, id, validated.status);
    await repository.addHistorico(client, {
      preRequerimentoId: id,
      acao: 'atualizacao_status',
      statusAnterior: current.status,
      statusNovo: updated.status,
      observacao: validated.observacao,
      usuarioId: usuario?.id || null,
      metadados: { usuarioNome: usuario?.nome || null },
    });
    return updated;
  });
}

async function atualizarMinuta(id, payload, usuario) {
  const validated = validateMinutaUpdate(payload);
  return repository.withTransaction(async (client) => {
    const current = await repository.getPreRequerimentoByIdForUpdate(client, id);
    if (!current) throw notFoundError();
    const updated = await repository.updateMinuta(client, id, validated.minutaDespacho);
    await repository.addHistorico(client, {
      preRequerimentoId: id,
      acao: 'atualizacao_minuta_despacho',
      statusAnterior: current.status,
      statusNovo: updated.status,
      observacao: validated.observacao || 'Minuta de despacho atualizada.',
      usuarioId: usuario?.id || null,
      metadados: { usuarioNome: usuario?.nome || null },
    });
    return updated;
  });
}

async function atualizarDocumento(id, payload, usuario) {
  const validated = validateDocumentoUpdate(payload);
  return repository.withTransaction(async (client) => {
    const current = await repository.getPreRequerimentoByIdForUpdate(client, id);
    if (!current) throw notFoundError();

    const documentos = Array.isArray(current.documentos) ? current.documentos : [];
    const index = documentos.findIndex((item) => item.codigo === validated.codigo);
    if (index < 0) {
      throw buildError('Documento nao encontrado no checklist documental.', 404, { codigo: validated.codigo });
    }

    const updatedAt = new Date().toISOString();
    const nextDocumentos = documentos.map((item, itemIndex) => (itemIndex === index ? {
      ...item,
      status: validated.status,
      observacao: validated.observacao || item.observacao || '',
      arquivoId: validated.arquivoId || item.arquivoId || null,
      atualizadoEm: updatedAt,
      usuarioResponsavel: usuario?.nome || null,
    } : item));
    const nextChecklist = nextDocumentos;

    const updated = await repository.updateDocumentos(client, id, nextDocumentos, nextChecklist);
    await repository.addHistorico(client, {
      preRequerimentoId: id,
      acao: 'atualizacao_documento',
      statusAnterior: current.status,
      statusNovo: updated.status,
      observacao: `Documento ${validated.codigo} atualizado para ${validated.status}. ${validated.observacao || ''}`.trim(),
      usuarioId: usuario?.id || null,
      metadados: {
        codigoDocumento: validated.codigo,
        statusDocumento: validated.status,
        usuarioNome: usuario?.nome || null,
      },
    });
    return updated;
  });
}

async function listarHistorico(id) {
  const exists = await repository.getPreRequerimentoById(id);
  if (!exists) throw notFoundError();
  return repository.listHistorico(id);
}

module.exports = {
  converterAnaliseAssistente,
  listarPreRequerimentos,
  obterPreRequerimento,
  atualizarStatus,
  atualizarMinuta,
  atualizarDocumento,
  listarHistorico,
};
