const repository = require('./licenciamentoAssistenteRepository');
const {
  validateCreateAnalise,
  validateListFilters,
  validateStatusUpdate,
  validateValidacao,
} = require('./licenciamentoAssistenteValidation');

function notFoundError() {
  const error = new Error('Pre-analise do assistente nao encontrada.');
  error.statusCode = 404;
  return error;
}

async function criarAnalisePublica(payload, req = null) {
  const validated = validateCreateAnalise(payload);

  return repository.withTransaction(async (client) => {
    const analise = await repository.createAnalise(client, validated);
    await repository.addHistorico(client, {
      analiseId: analise.id,
      acao: 'criacao_publica',
      statusAnterior: null,
      statusNovo: analise.status,
      observacao: 'Pre-analise registrada pelo assistente publico para validacao tecnica da SMAD.',
      metadados: {
        origem: 'publico',
        ip: req?.ip || null,
        userAgent: req?.headers?.['user-agent'] || null,
        versaoMotor: analise.versaoMotor,
      },
    });

    return {
      id: analise.id,
      codigoPreliminar: analise.codigoPreliminar,
      status: analise.status,
      criadoEm: analise.criadoEm,
    };
  });
}

async function listarAnalises(query = {}) {
  return repository.listAnalises(validateListFilters(query));
}

async function obterAnalise(id) {
  const analise = await repository.getAnaliseById(id);
  if (!analise) throw notFoundError();
  return analise;
}

async function atualizarStatus(id, payload, usuario) {
  const validated = validateStatusUpdate(payload);

  return repository.withTransaction(async (client) => {
    const current = await repository.getAnaliseByIdForUpdate(client, id);
    if (!current) throw notFoundError();

    const updated = await repository.updateStatus(client, id, validated.status);
    await repository.addHistorico(client, {
      analiseId: id,
      acao: 'atualizacao_status',
      statusAnterior: current.status,
      statusNovo: updated.status,
      observacao: validated.observacao,
      usuarioId: usuario?.id || null,
      metadados: {
        usuarioNome: usuario?.nome || null,
      },
    });
    return updated;
  });
}

async function registrarValidacao(id, payload, usuario) {
  const validated = validateValidacao(payload);

  return repository.withTransaction(async (client) => {
    const current = await repository.getAnaliseByIdForUpdate(client, id);
    if (!current) throw notFoundError();

    const updated = await repository.updateValidacao(client, id, validated, usuario);
    await repository.addHistorico(client, {
      analiseId: id,
      acao: 'validacao_tecnica',
      statusAnterior: current.status,
      statusNovo: updated.status,
      decisao: validated.decisaoValidacao,
      observacao: validated.observacaoValidacao,
      usuarioId: usuario?.id || null,
      metadados: {
        usuarioNome: usuario?.nome || null,
      },
    });
    return updated;
  });
}

async function listarHistorico(id) {
  const analise = await repository.getAnaliseById(id);
  if (!analise) throw notFoundError();
  return repository.listHistorico(id);
}

module.exports = {
  criarAnalisePublica,
  listarAnalises,
  obterAnalise,
  atualizarStatus,
  registrarValidacao,
  listarHistorico,
};
