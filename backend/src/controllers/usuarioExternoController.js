const usuarioExternoService = require('../services/usuarioExternoService');
const passwordResetService = require('../services/passwordResetService');
const passwordResetDeliveryService = require('../services/passwordResetDeliveryService');
const campanhaService = require('../services/campanhaService');
const ocorrenciaService = require('../services/ocorrenciaService');
const animalVacinaService = require('../services/animalVacinaService');
const operacaoHistoricoService = require('../services/operacaoHistoricoService');
const auditService = require('../services/auditService');
const logger = require('../utils/logger');
const { PASSWORD_POLICY_MESSAGE } = require('../services/passwordPolicy');
const { TERMOS_USO, POLITICA_PRIVACIDADE } = require('../config/governance');

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidCpf(cpf) {
  if (!cpf) return true;
  return cpf.replace(/\D/g, '').length === 11;
}

function isOcorrenciaAtiva(status) {
  return !['resolvida', 'concluida', 'cancelada', 'arquivada'].includes(status);
}

function groupDocumentosByInscricao(inscricoes) {
  return Object.fromEntries(
    inscricoes.map((inscricao) => [
      inscricao.id,
      Array.isArray(inscricao.documentos) ? inscricao.documentos : []
    ])
  );
}

function buildDocumentosMobile(inscricoes) {
  return inscricoes
    .flatMap((inscricao) => {
      const documentos = Array.isArray(inscricao.documentos) ? inscricao.documentos : [];

      return documentos.map((documento) => ({
        ...documento,
        contexto_tipo: 'campanha_inscricao',
        contexto_id: inscricao.id,
        inscricao_id: inscricao.id,
        protocolo: inscricao.protocolo,
        campanha_id: inscricao.campanha_id,
        campanha_nome: inscricao.campanha_nome,
        animal_id: inscricao.animal_id,
        animal_nome: inscricao.animal_nome,
        status_inscricao: inscricao.status
      }));
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function filterCarteiraRegistros(registros = [], query = {}) {
  const status = normalizeString(query.status_registro || query.status);
  const origem = normalizeString(query.origem_registro || query.origem);
  const vacina = normalizeString(query.vacina)?.toLowerCase();
  const dataInicio = toDateOnly(query.data_inicio);
  const dataFim = toDateOnly(query.data_fim);

  return registros.filter((registro) => {
    if (status && registro.status_registro !== status) return false;
    if (origem && registro.origem_registro !== origem) return false;

    if (vacina) {
      const text = [
        registro.vacina_nome_popular,
        registro.vacina_nome,
        registro.vacina_codigo,
        registro.catalogo_codigo
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!text.includes(vacina)) return false;
    }

    const dataAplicacao = toDateOnly(registro.data_aplicacao);

    if (dataInicio && (!dataAplicacao || dataAplicacao < dataInicio)) return false;
    if (dataFim && (!dataAplicacao || dataAplicacao > dataFim)) return false;

    return true;
  });
}

function buildInscricaoProximoPasso(inscricao) {
  if (inscricao.pendencia_aberta) {
    return 'Verifique a pendencia indicada e acompanhe as orientacoes da SMAD.';
  }

  if (inscricao.status === 'em_analise') {
    return 'Aguarde a triagem tecnica da SMAD.';
  }

  if (inscricao.status === 'pre_selecionado') {
    return 'Aguarde o agendamento ou nova comunicacao da SMAD.';
  }

  if (inscricao.status === 'agendado') {
    return 'Confira a data de agendamento e compareca conforme orientacao recebida.';
  }

  if (inscricao.status === 'atendido') {
    return 'Atendimento registrado. Consulte a carteira e documentos relacionados.';
  }

  if (['indeferido', 'ausente', 'cancelada', 'encerrada'].includes(inscricao.status)) {
    return 'Fluxo encerrado ou sem atendimento ativo. Consulte o desfecho informado.';
  }

  return 'Acompanhe as atualizacoes da SMAD pelo portal.';
}

function buildOcorrenciaProximoPasso(ocorrencia) {
  if (ocorrencia.pendencia_aberta) {
    return 'Ha pendencia de informacao. Aguarde contato ou complemente os dados quando solicitado.';
  }

  if (['aberta', 'recebida'].includes(ocorrencia.status)) {
    return 'Ocorrencia recebida. Aguarde analise da SMAD.';
  }

  if (['em_analise', 'em_atendimento'].includes(ocorrencia.status)) {
    return 'Ocorrencia em acompanhamento pela SMAD.';
  }

  if (OCORRENCIA_STATUS_FINAL.has(ocorrencia.status)) {
    return 'Ocorrencia encerrada. Consulte o desfecho registrado.';
  }

  return 'Acompanhe novas atualizacoes pelo portal.';
}

const OCORRENCIA_STATUS_FINAL = new Set(['resolvida', 'concluida', 'cancelada', 'arquivada']);

function buildInscricaoMarcos(inscricao) {
  const marcos = [
    {
      tipo: 'criacao',
      titulo: 'Inscricao enviada',
      descricao: 'Solicitacao recebida pela Plataforma SIGMA.',
      data: inscricao.created_at
    }
  ];

  if (inscricao.pendencia_aberta) {
    marcos.push({
      tipo: 'pendencia',
      titulo: 'Pendencia aberta',
      descricao: inscricao.pendencia_descricao || 'A SMAD solicitou informacao complementar.',
      data: inscricao.status_operacional_updated_at || inscricao.updated_at
    });
  }

  if (inscricao.agendamento_data) {
    marcos.push({
      tipo: 'agendamento',
      titulo: 'Atendimento agendado',
      descricao: 'Compareca conforme a data informada.',
      data: inscricao.agendamento_data
    });
  }

  if (inscricao.desfecho || ['atendido', 'indeferido', 'ausente', 'cancelada', 'encerrada'].includes(inscricao.status)) {
    marcos.push({
      tipo: 'desfecho',
      titulo: 'Desfecho registrado',
      descricao: inscricao.motivo_desfecho || inscricao.resultado_operacional || inscricao.desfecho || inscricao.status,
      data: inscricao.atendimento_confirmado_em || inscricao.updated_at
    });
  }

  return marcos.filter((marco) => Boolean(marco.data || marco.descricao));
}

function buildOcorrenciaMarcos(ocorrencia) {
  const marcos = [
    {
      tipo: 'criacao',
      titulo: 'Ocorrencia registrada',
      descricao: 'Registro recebido pela Plataforma SIGMA.',
      data: ocorrencia.created_at
    }
  ];

  if (ocorrencia.pendencia_aberta) {
    marcos.push({
      tipo: 'pendencia',
      titulo: 'Pendencia aberta',
      descricao: ocorrencia.pendencia_descricao || 'A SMAD solicitou informacao complementar.',
      data: ocorrencia.status_operacional_updated_at || ocorrencia.updated_at
    });
  }

  if (ocorrencia.desfecho || OCORRENCIA_STATUS_FINAL.has(ocorrencia.status)) {
    marcos.push({
      tipo: 'desfecho',
      titulo: 'Desfecho registrado',
      descricao: ocorrencia.motivo_desfecho || ocorrencia.resolucao || ocorrencia.desfecho || ocorrencia.status,
      data: ocorrencia.encerrada_em || ocorrencia.updated_at
    });
  }

  return marcos.filter((marco) => Boolean(marco.data || marco.descricao));
}

function sanitizeHistoricoOperacional(rows) {
  return rows.map((row) => ({
    id: row.id,
    evento: row.evento,
    status_anterior: row.status_anterior,
    status_novo: row.status_novo,
    pendencia_aberta: row.pendencia_aberta,
    created_at: row.created_at
  }));
}

function buildAnimaisMobile(inscricoes, carteirasPorAnimal) {
  const animais = new Map();

  inscricoes.forEach((inscricao) => {
    if (!inscricao.animal_id) return;

    const carteira = carteirasPorAnimal[inscricao.animal_id];
    const animal = carteira?.animal || {};
    const current = animais.get(inscricao.animal_id) || {
      id: inscricao.animal_id,
      nome: animal.nome || inscricao.animal_nome,
      especie: animal.especie || inscricao.animal_especie,
      raca: animal.raca || inscricao.animal_raca,
      sexo: animal.sexo || inscricao.animal_sexo,
      status: animal.status || null,
      microchip: animal.microchip || inscricao.microchip,
      public_id: animal.public_id || null,
      perfil_publico_ativo: animal.perfil_publico_ativo || false,
      territorio_nome: animal.territorio_nome || inscricao.territorio_nome || null,
      bairro: animal.bairro || inscricao.bairro || null,
      carteira_resumo: carteira?.resumo || null,
      inscricoes_relacionadas: 0
    };

    current.inscricoes_relacionadas += 1;
    animais.set(inscricao.animal_id, current);
  });

  return [...animais.values()].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
}

async function loadMobileData(usuarioId, req) {
  const [inscricoes, notificacoes, ocorrencias] = await Promise.all([
    campanhaService.findByUsuario(usuarioId),
    campanhaService.findNotificacoesByUsuario(usuarioId),
    ocorrenciaService.findByUsuario(usuarioId)
  ]);
  const animalIds = [
    ...new Set(inscricoes.map((inscricao) => inscricao.animal_id).filter(Boolean))
  ];
  const carteirasEntries = await Promise.all(
    animalIds.map(async (animalId) => {
      try {
        const carteira = await animalVacinaService.findCarteiraByAnimal(animalId);
        return [animalId, carteira];
      } catch (error) {
        logger.warn('usuario_externo.mobile.carteira_error', {
          request_id: req.requestId,
          animal_id: animalId,
          message: error.message
        });
        return [animalId, null];
      }
    })
  );
  const carteirasPorAnimal = Object.fromEntries(carteirasEntries);

  return {
    inscricoes,
    documentosPorInscricao: groupDocumentosByInscricao(inscricoes),
    documentos: buildDocumentosMobile(inscricoes),
    carteirasPorAnimal,
    animais: buildAnimaisMobile(inscricoes, carteirasPorAnimal),
    notificacoes,
    ocorrencias
  };
}

function validateRegister(body) {
  const nome = normalizeString(body.nome);
  const cpf = normalizeString(body.cpf);
  const email = normalizeString(body.email);
  const telefone = normalizeString(body.telefone);
  const endereco = normalizeString(body.endereco);
  const senha = normalizeString(body.senha);
  const aceiteGovernanca = body.aceite_governanca === true || body.aceite_termos === true;

  if (!nome || nome.length < 2 || nome.length > 150) {
    return { error: 'Informe o nome completo.' };
  }

  if (!email || !isValidEmail(email)) {
    return { error: 'Informe um email valido.' };
  }

  if (!senha) {
    return { error: PASSWORD_POLICY_MESSAGE };
  }

  if (cpf && !isValidCpf(cpf)) {
    return { error: 'Documento deve conter 11 digitos.' };
  }

  if (!aceiteGovernanca) {
    return { error: 'Confirme ciencia e aceite do termo de uso e da politica de privacidade.' };
  }

  return {
    data: {
      nome,
      cpf: cpf || null,
      email,
      telefone: telefone || null,
      endereco: endereco || null,
      senha,
      termo_uso_versao: TERMOS_USO.versao,
      politica_privacidade_versao: POLITICA_PRIVACIDADE.versao,
      aceite_governanca_origem: 'portal_tutor'
    }
  };
}

exports.register = async (req, res) => {
  try {
    const validation = validateRegister(req.body || {});

    if (validation.error) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const result = await usuarioExternoService.register(validation.data);

    await auditService.log({
      ator_tipo: 'externo',
      ator_id: result.user.id,
      acao: 'registrar_usuario_externo',
      entidade: 'usuarios_externos',
      entidade_id: result.user.id,
      dados: {
        email: result.user.email,
        termo_uso_versao: result.user.termo_uso_versao,
        politica_privacidade_versao: result.user.politica_privacidade_versao
      },
      req
    });

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('usuario_externo.register.error', {
      request_id: req.requestId,
      code: error.code,
      message: error.message
    });

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Email ou Documento ja cadastrado.'
      });
    }

    if (error.code === 'PASSWORD_POLICY') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao cadastrar usuario.'
    });
  }
};

exports.login = async (req, res) => {
  try {
    const email = normalizeString(req.body?.email);
    const senha = normalizeString(req.body?.senha);

    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Informe email e senha.'
      });
    }

    const result = await usuarioExternoService.login({ email, senha });

    if (!result) {
      return res.status(401).json({
        success: false,
        error: 'Email ou senha invalidos.'
      });
    }

    await auditService.log({
      ator_tipo: 'externo',
      ator_id: result.user.id,
      acao: 'login',
      entidade: 'usuarios_externos',
      entidade_id: result.user.id,
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('usuario_externo.login.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao autenticar usuario.'
    });
  }
};

exports.me = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: req.usuarioExterno
  });
};

exports.mobileResumo = async (req, res) => {
  try {
    const usuarioId = req.usuarioExterno.id;
    const data = await loadMobileData(usuarioId, req);

    return res.status(200).json({
      success: true,
      data: {
        usuario: req.usuarioExterno,
        animais: data.animais,
        inscricoes: data.inscricoes,
        documentos: data.documentos,
        documentos_por_inscricao: data.documentosPorInscricao,
        carteiras_por_animal: data.carteirasPorAnimal,
        notificacoes: data.notificacoes,
        ocorrencias: data.ocorrencias,
        resumo: {
          inscricoes_total: data.inscricoes.length,
          animais_vinculados: data.animais.length,
          documentos_total: data.documentos.length,
          notificacoes_nao_lidas: data.notificacoes.filter((notificacao) => notificacao.status !== 'lida').length,
          ocorrencias_ativas: data.ocorrencias.filter((ocorrencia) => isOcorrenciaAtiva(ocorrencia.status)).length,
          atualizado_em: new Date().toISOString()
        },
        meta: {
          api: 'portal_tutor_mobile',
          versao: '6D',
          contratos: {
            resumo: '/usuarios-externos/me/mobile',
            detalhe_animal: '/usuarios-externos/me/mobile/animais/:id',
            detalhe_inscricao: '/usuarios-externos/me/mobile/inscricoes/:id',
            detalhe_ocorrencia: '/usuarios-externos/me/mobile/ocorrencias/:id',
            documentos: '/usuarios-externos/me/mobile/documentos',
            carteira_detalhada: '/usuarios-externos/me/mobile/animais/:id/carteira',
            notificacoes: '/usuarios-externos/me/mobile/notificacoes',
            preferencias: '/usuarios-externos/me/mobile/preferencias',
            web_push_subscriptions: '/usuarios-externos/me/mobile/web-push/subscriptions'
          },
          observacao: 'Resumo agregado para listagem mobile. Detalhes ficam em rotas autenticadas por recurso.'
        }
      }
    });
  } catch (error) {
    logger.error('usuario_externo.mobile_resumo.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar resumo do portal.'
    });
  }
};

exports.mobileNotificacoes = async (req, res) => {
  try {
    const status = normalizeString(req.query?.status);
    const limit = Number(req.query?.limit) || 100;
    const notificacoes = await campanhaService.findNotificacoesByUsuario(req.usuarioExterno.id, {
      status,
      limit
    });

    return res.status(200).json({
      success: true,
      data: {
        notificacoes,
        resumo: {
          total: notificacoes.length,
          nao_lidas: notificacoes.filter((notificacao) => notificacao.status !== 'lida').length,
          requer_acao: notificacoes.filter((notificacao) => notificacao.requer_acao && notificacao.status !== 'lida').length,
          alta_prioridade: notificacoes.filter((notificacao) => notificacao.prioridade === 'alta').length
        },
        filtros_aplicados: {
          status: status || null,
          limit: Math.max(1, Math.min(limit, 200))
        },
        meta: {
          tipo: 'notificacoes_mobile',
          versao: '6D',
          observacao: 'Centro autenticado de notificacoes do tutor, com status de leitura, prioridade e contexto.'
        }
      }
    });
  } catch (error) {
    logger.error('usuario_externo.mobile_notificacoes.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar notificacoes.'
    });
  }
};

exports.markTodasNotificacoesLidas = async (req, res) => {
  try {
    const result = await campanhaService.markTodasNotificacoesLidas(req.usuarioExterno.id);

    await auditService.log({
      ator_tipo: 'externo',
      ator_id: req.usuarioExterno.id,
      acao: 'marcar_todas_notificacoes_lidas',
      entidade: 'notificacoes',
      dados: {
        atualizadas: result.atualizadas
      },
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('usuario_externo.notificacoes.mark_all.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar notificacoes.'
    });
  }
};

exports.sendWebPushTeste = async (req, res) => {
  try {
    const result = await campanhaService.createMobileTestNotification(req.usuarioExterno.id, req);

    return res.status(201).json({
      success: true,
      data: {
        ...result,
        meta: {
          tipo: 'teste_web_push',
          versao: '6D',
          observacao: 'Cria uma notificacao de teste no portal e tenta entregar Web Push quando o canal estiver habilitado e autorizado.'
        }
      }
    });
  } catch (error) {
    logger.error('usuario_externo.web_push.test.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao testar Web Push.'
    });
  }
};

exports.mobileAnimalDetalhe = async (req, res) => {
  try {
    const usuarioId = req.usuarioExterno.id;
    const animalId = Number(req.params.id);
    const canAccess = await animalVacinaService.canUsuarioExternoAccessAnimal(usuarioId, animalId);

    if (!canAccess) {
      return res.status(404).json({
        success: false,
        error: 'Animal nao encontrado para este tutor.'
      });
    }

    const [carteira, data] = await Promise.all([
      animalVacinaService.findCarteiraByAnimal(animalId),
      loadMobileData(usuarioId, req)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        animal: carteira?.animal || null,
        carteira,
        inscricoes_relacionadas: data.inscricoes.filter((inscricao) => Number(inscricao.animal_id) === animalId),
        ocorrencias_relacionadas: data.ocorrencias.filter((ocorrencia) => Number(ocorrencia.animal_id) === animalId),
        meta: {
          tipo: 'animal_detalhe',
          versao: '6D',
          observacao: 'Dados autenticados do proprio tutor. O identificador publico nao inclui segredo de QR.'
        }
      }
    });
  } catch (error) {
    logger.error('usuario_externo.mobile_animal_detalhe.error', {
      request_id: req.requestId,
      animal_id: req.params.id,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar animal.'
    });
  }
};

exports.mobileDocumentos = async (req, res) => {
  try {
    const usuarioId = req.usuarioExterno.id;
    const data = await loadMobileData(usuarioId, req);

    return res.status(200).json({
      success: true,
      data: {
        documentos: data.documentos,
        resumo: {
          total: data.documentos.length,
          campanhas_relacionadas: new Set(data.documentos.map((documento) => documento.campanha_id).filter(Boolean)).size,
          animais_relacionados: new Set(data.documentos.map((documento) => documento.animal_id).filter(Boolean)).size
        },
        meta: {
          tipo: 'documentos_tutor',
          versao: '6D',
          observacao: 'Lista autenticada de documentos vinculados aos fluxos do proprio tutor.'
        }
      }
    });
  } catch (error) {
    logger.error('usuario_externo.mobile_documentos.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar documentos.'
    });
  }
};

exports.mobileAnimalCarteiraDetalhada = async (req, res) => {
  try {
    const usuarioId = req.usuarioExterno.id;
    const animalId = Number(req.params.id);
    const canAccess = await animalVacinaService.canUsuarioExternoAccessAnimal(usuarioId, animalId);

    if (!canAccess) {
      return res.status(404).json({
        success: false,
        error: 'Animal nao encontrado para este tutor.'
      });
    }

    const carteira = await animalVacinaService.findCarteiraByAnimal(animalId);
    const registros = filterCarteiraRegistros(carteira?.registros || [], req.query || {});

    return res.status(200).json({
      success: true,
      data: {
        animal: carteira?.animal || null,
        resumo: animalVacinaService.buildResumo(carteira?.animal || { id: animalId }, registros, carteira?.catalogo || []),
        filtros_aplicados: {
          vacina: normalizeString(req.query?.vacina) || null,
          origem: normalizeString(req.query?.origem_registro || req.query?.origem) || null,
          status: normalizeString(req.query?.status_registro || req.query?.status) || null,
          data_inicio: toDateOnly(req.query?.data_inicio),
          data_fim: toDateOnly(req.query?.data_fim)
        },
        registros,
        catalogo: carteira?.catalogo || [],
        legado: carteira?.legado || {},
        documentos_disponiveis: carteira?.documentos_disponiveis || [],
        meta: {
          tipo: 'carteira_vacinal_detalhada',
          versao: '6D',
          observacao: 'Carteira autenticada do proprio tutor. Cobertura representa registros da base do módulo de Bem-estar Animal da Plataforma SIGMA, com origem/status explicitados.'
        }
      }
    });
  } catch (error) {
    logger.error('usuario_externo.mobile_carteira_detalhada.error', {
      request_id: req.requestId,
      animal_id: req.params.id,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar carteira vacinal.'
    });
  }
};

exports.mobileInscricaoDetalhe = async (req, res) => {
  try {
    const usuarioId = req.usuarioExterno.id;
    const inscricaoId = Number(req.params.id);
    const data = await loadMobileData(usuarioId, req);
    const inscricao = data.inscricoes.find((item) => Number(item.id) === inscricaoId);

    if (!inscricao) {
      return res.status(404).json({
        success: false,
        error: 'Inscricao nao encontrada para este tutor.'
      });
    }

    const historico = await operacaoHistoricoService.findByItem('campanha_inscricao', inscricaoId);

    return res.status(200).json({
      success: true,
      data: {
        inscricao,
        documentos: data.documentosPorInscricao[inscricao.id] || [],
        carteira: inscricao.animal_id ? data.carteirasPorAnimal[inscricao.animal_id] || null : null,
        marcos: buildInscricaoMarcos(inscricao),
        historico_operacional: sanitizeHistoricoOperacional(historico),
        proximo_passo: buildInscricaoProximoPasso(inscricao),
        meta: {
          tipo: 'inscricao_detalhe',
          versao: '6D',
          observacao: 'Historico exposto em formato resumido para o tutor, sem dados administrativos internos.'
        }
      }
    });
  } catch (error) {
    logger.error('usuario_externo.mobile_inscricao_detalhe.error', {
      request_id: req.requestId,
      inscricao_id: req.params.id,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar inscricao.'
    });
  }
};

exports.mobileOcorrenciaDetalhe = async (req, res) => {
  try {
    const usuarioId = req.usuarioExterno.id;
    const ocorrenciaId = Number(req.params.id);
    const data = await loadMobileData(usuarioId, req);
    const ocorrencia = data.ocorrencias.find((item) => Number(item.id) === ocorrenciaId);

    if (!ocorrencia) {
      return res.status(404).json({
        success: false,
        error: 'Ocorrencia nao encontrada para este tutor.'
      });
    }

    const historico = await operacaoHistoricoService.findByItem('ocorrencia', ocorrenciaId);

    return res.status(200).json({
      success: true,
      data: {
        ocorrencia,
        marcos: buildOcorrenciaMarcos(ocorrencia),
        historico_operacional: sanitizeHistoricoOperacional(historico),
        proximo_passo: buildOcorrenciaProximoPasso(ocorrencia),
        meta: {
          tipo: 'ocorrencia_detalhe',
          versao: '6D',
          observacao: 'Detalhe autenticado da ocorrencia registrada pelo proprio tutor.'
        }
      }
    });
  } catch (error) {
    logger.error('usuario_externo.mobile_ocorrencia_detalhe.error', {
      request_id: req.requestId,
      ocorrencia_id: req.params.id,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar ocorrencia.'
    });
  }
};

exports.getMobilePreferencias = async (req, res) => {
  try {
    const data = await usuarioExternoService.getCommunicationPreferences(req.usuarioExterno.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Usuario externo nao encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        meta: {
          tipo: 'preferencias_comunicacao',
          versao: '6D',
          observacao: 'Comunicacoes operacionais essenciais permanecem ativas. Web Push exige opt-in do tutor e configuracao VAPID ativa.'
        }
      }
    });
  } catch (error) {
    logger.error('usuario_externo.preferencias.get.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao carregar preferencias.'
    });
  }
};

exports.updateMobilePreferencias = async (req, res) => {
  try {
    const usuarioId = req.usuarioExterno.id;
    const before = await usuarioExternoService.getCommunicationPreferences(usuarioId);
    const after = await usuarioExternoService.updateCommunicationPreferences(usuarioId, req.body?.preferencias || req.body || {});

    if (!after) {
      return res.status(404).json({
        success: false,
        error: 'Usuario externo nao encontrado.'
      });
    }

    await auditService.logChange({
      ator_tipo: 'externo',
      ator_id: usuarioId,
      acao: 'atualizar_preferencias_comunicacao',
      entidade: 'usuarios_externos',
      entidade_id: usuarioId,
      before: before?.preferencias,
      after: after.preferencias,
      dados: {
        canais: Object.keys(after.preferencias || {}).filter((key) => key !== 'operacional_essencial')
      },
      req
    });

    return res.status(200).json({
      success: true,
      data: after
    });
  } catch (error) {
    logger.error('usuario_externo.preferencias.update.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar preferencias.'
    });
  }
};

exports.registerWebPushSubscription = async (req, res) => {
  try {
    const assinatura = await usuarioExternoService.savePushSubscription({
      usuarioId: req.usuarioExterno.id,
      subscription: req.body?.subscription || req.body,
      userAgent: req.headers['user-agent']
    });

    await auditService.log({
      ator_tipo: 'externo',
      ator_id: req.usuarioExterno.id,
      acao: 'registrar_web_push_subscription',
      entidade: 'usuario_externo_push_subscriptions',
      entidade_id: assinatura.id,
      dados: {
        endpoint_hash: assinatura.endpoint_hash,
        status: assinatura.status
      },
      req
    });

    return res.status(201).json({
      success: true,
      data: {
        assinatura,
        meta: {
          tipo: 'web_push_subscription',
          versao: '6D',
          observacao: 'Assinatura registrada por opt-in. Entrega Web Push ocorre quando o ambiente possui VAPID ativo e preferencia habilitada.'
        }
      }
    });
  } catch (error) {
    logger.warn('usuario_externo.web_push.register.warn', {
      request_id: req.requestId,
      status_code: error.statusCode || 500,
      message: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao registrar Web Push.'
    });
  }
};

exports.revokeWebPushSubscription = async (req, res) => {
  try {
    const result = await usuarioExternoService.revokePushSubscription({
      usuarioId: req.usuarioExterno.id,
      endpoint: normalizeString(req.body?.endpoint)
    });

    await auditService.log({
      ator_tipo: 'externo',
      ator_id: req.usuarioExterno.id,
      acao: 'revogar_web_push_subscription',
      entidade: 'usuario_externo_push_subscriptions',
      dados: {
        revogadas: result.revogadas,
        endpoint_hashes: result.assinaturas.map((assinatura) => assinatura.endpoint_hash)
      },
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('usuario_externo.web_push.revoke.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao remover assinatura Web Push.'
    });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const email = normalizeString(req.body?.email);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Informe um email valido.'
      });
    }

    const resetRequest = await passwordResetService.requestReset({
      tipo: 'externo',
      email,
      req
    });

    if (resetRequest.created) {
      await passwordResetDeliveryService.sendPasswordResetInstructions({
        tipo: 'externo',
        email,
        token: resetRequest.token,
        req
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Se o email estiver cadastrado, as instrucoes de recuperacao serao enviadas.'
    });
  } catch (error) {
    logger.error('usuario_externo.password_reset_request.error', {
      request_id: req.requestId,
      message: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao solicitar recuperacao de senha.'
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const token = normalizeString(req.body?.token);
    const novaSenha = normalizeString(req.body?.nova_senha || req.body?.senha);

    const result = await passwordResetService.resetPassword({
      tipo: 'externo',
      token,
      novaSenha,
      req
    });

    if (!result || result.tipo !== 'externo') {
      return res.status(400).json({
        success: false,
        error: 'Token invalido ou expirado.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Senha redefinida com sucesso.'
    });
  } catch (error) {
    logger.error('usuario_externo.password_reset.error', {
      request_id: req.requestId,
      code: error.code,
      message: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Erro interno ao redefinir senha.'
    });
  }
};
