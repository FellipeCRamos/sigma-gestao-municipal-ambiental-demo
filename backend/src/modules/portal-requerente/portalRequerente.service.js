const crypto = require('crypto');

const db = require('../../config/db');
const auditService = require('../../services/auditService');
const usuarioExternoService = require('../../services/usuarioExternoService');
const anuenciaService = require('../anuencia/anuencia.service');

const STATUS_REQUERENTE = new Set(['ATIVO', 'INATIVO', 'BLOQUEADO', 'PENDENTE_VALIDACAO']);
const TIPOS_PESSOA = new Set(['FISICA', 'JURIDICA', 'ORGAO_PUBLICO', 'NAO_INFORMADO']);
const TIPOS_USUARIO = new Set(['REQUERENTE', 'REPRESENTANTE_LEGAL', 'RESPONSAVEL_TECNICO', 'PROCURADOR', 'CONSULTA_AUTORIZADA']);
const TIPOS_SOLICITACAO = new Set([
  'ANUENCIA_AMBIENTAL',
  'LICENCIAMENTO_AMBIENTAL',
  'COMPLEMENTACAO_DOCUMENTAL',
  'RECURSO_MANIFESTACAO',
  'OUTRA_SOLICITACAO',
]);
const STATUS_PRE_PROTOCOLO = new Set([
  'RASCUNHO',
  'ENVIADO',
  'RECEBIDO_PENDENTE_TRIAGEM',
  'EM_TRIAGEM_SMAD',
  'DEVOLVIDO_PARA_COMPLEMENTACAO',
  'COMPLEMENTADO',
  'ACEITO_GEROU_PROCESSO_INTERNO',
  'RECUSADO_FUNDAMENTADO',
  'CANCELADO_PELO_REQUERENTE',
  'ARQUIVADO',
]);
const TIPOS_DOCUMENTO = new Set([
  'REQUERIMENTO',
  'DOCUMENTO_PESSOAL',
  'CNPJ',
  'COMPROVANTE_ENDERECO',
  'PROCURACAO',
  'RESPONSABILIDADE_TECNICA',
  'PLANTA_MAPA',
  'MEMORIAL_DESCRITIVO',
  'OUTRO',
]);
const TERMOS_OBRIGATORIOS = Object.freeze(['TERMO_USO', 'POLITICA_PRIVACIDADE', 'CIENCIA_LGPD', 'RESPONSABILIDADE_INFORMACOES']);
const EXTENSOES_BLOQUEADAS = new Set(['exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'dll', 'ps1', 'sh', 'js', 'jar']);
const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/geo+json',
  'application/vnd.google-earth.kml+xml',
]);

function serviceError(message, statusCode = 400, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function cleanText(value, max = 1000) {
  if (value === undefined || value === null) return null;
  return String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) || null;
}

function normalizeEnum(value, fallback) {
  const cleaned = cleanText(value, 120);
  return cleaned ? cleaned.toUpperCase() : fallback;
}

function onlyDigits(value) {
  const cleaned = String(value || '').replace(/\D/g, '');
  return cleaned || null;
}

function requireId(value, fieldName = 'id') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw serviceError(`Parametro invalido: ${fieldName}.`, 400, { field: fieldName });
  }
  return parsed;
}

function getInternalUserId(user) {
  return user?.id || null;
}

function getExternalUserId(user) {
  return user?.id || null;
}

function buildCodigo(prefix = 'SIGMA-PRP') {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function maskDocument(value) {
  const digits = onlyDigits(value);
  if (!digits) return null;
  if (digits.length <= 4) return '***';
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
}

function moduloDestinoFor(tipoSolicitacao, explicit) {
  const modulo = normalizeEnum(explicit);
  if (modulo) return modulo;
  if (tipoSolicitacao === 'ANUENCIA_AMBIENTAL') return 'ANUENCIA';
  if (tipoSolicitacao === 'LICENCIAMENTO_AMBIENTAL') return 'LICENCIAMENTO';
  return 'SIGMA';
}

function publicRequerente(row, { internal = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    tipo_pessoa: row.tipo_pessoa,
    nome_razao_social: row.nome_razao_social,
    cpf_cnpj: internal ? row.cpf_cnpj : undefined,
    documento_mascarado: maskDocument(row.cpf_cnpj),
    email_principal: row.email_principal,
    telefone: row.telefone,
    endereco_resumido: row.endereco_resumido,
    municipio: row.municipio,
    uf: row.uf,
    representante_legal: internal ? row.representante_legal : undefined,
    observacoes_internas: internal ? row.observacoes_internas : undefined,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicPortalUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    requerente_id: row.requerente_id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    tipo_usuario: row.tipo_usuario,
    status: row.status,
    ultimo_acesso_em: row.ultimo_acesso_em,
  };
}

function publicPreProtocolo(row, { internal = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    requerente_id: row.requerente_id,
    usuario_id: row.usuario_id,
    tipo_solicitacao: row.tipo_solicitacao,
    modulo_destino: row.modulo_destino,
    finalidade: row.finalidade,
    descricao: row.descricao,
    status: row.status,
    numero_processo_gerado: row.numero_processo_gerado,
    numero_protocolo_gerado: row.numero_protocolo_gerado,
    anuencia_id: row.anuencia_id,
    licenciamento_id: row.licenciamento_id,
    geo_localizacao_id: row.geo_localizacao_id,
    distrito: row.distrito,
    bairro_localidade: row.bairro_localidade,
    observacoes_internas: internal ? row.observacoes_internas : undefined,
    triado_por: internal ? row.triado_por : undefined,
    triado_em: row.triado_em,
    created_at: row.created_at,
    updated_at: row.updated_at,
    requerente_nome: row.requerente_nome,
    usuario_nome: row.usuario_nome,
  };
}

function validateRequerente(payload = {}, { partial = false } = {}) {
  const tipo = normalizeEnum(payload.tipo_pessoa, partial ? undefined : 'NAO_INFORMADO');
  const status = normalizeEnum(payload.status, partial ? undefined : 'PENDENTE_VALIDACAO');
  const nome = cleanText(payload.nome_razao_social, 180);

  if (!partial && !nome) throw serviceError('Nome/razao social do requerente e obrigatorio.', 400, { field: 'nome_razao_social' });
  if (tipo !== undefined && !TIPOS_PESSOA.has(tipo)) throw serviceError('Tipo de pessoa invalido.', 400, { field: 'tipo_pessoa' });
  if (status !== undefined && !STATUS_REQUERENTE.has(status)) throw serviceError('Status do requerente invalido.', 400, { field: 'status' });

  return {
    tipo_pessoa: tipo,
    nome_razao_social: nome,
    cpf_cnpj: onlyDigits(payload.cpf_cnpj),
    email_principal: cleanText(payload.email_principal, 180)?.toLowerCase() || null,
    telefone: cleanText(payload.telefone, 80),
    endereco_resumido: cleanText(payload.endereco_resumido, 2000),
    municipio: cleanText(payload.municipio, 120),
    uf: cleanText(payload.uf, 2)?.toUpperCase() || null,
    representante_legal: cleanText(payload.representante_legal, 180),
    observacoes_internas: cleanText(payload.observacoes_internas, 3000),
    status,
  };
}

function validatePortalUser(payload = {}, requerente) {
  const nome = cleanText(payload.nome || requerente?.nome_razao_social, 180);
  const email = cleanText(payload.email || requerente?.email_principal, 180)?.toLowerCase() || null;
  const tipo = normalizeEnum(payload.tipo_usuario, 'REQUERENTE');
  const status = normalizeEnum(payload.status, 'ATIVO');

  if (!nome) throw serviceError('Nome do usuario do portal e obrigatorio.', 400, { field: 'usuario.nome' });
  if (!email) throw serviceError('Email do usuario do portal e obrigatorio.', 400, { field: 'usuario.email' });
  if (!TIPOS_USUARIO.has(tipo)) throw serviceError('Tipo de usuario do portal invalido.', 400, { field: 'usuario.tipo_usuario' });
  if (!STATUS_REQUERENTE.has(status)) throw serviceError('Status do usuario do portal invalido.', 400, { field: 'usuario.status' });

  return {
    nome,
    email,
    telefone: cleanText(payload.telefone || requerente?.telefone, 80),
    tipo_usuario: tipo,
    status,
    senha: payload.senha || 'PortalRequerente2026',
  };
}

function validatePreProtocolo(payload = {}, { partial = false } = {}) {
  const tipo = normalizeEnum(payload.tipo_solicitacao, partial ? undefined : 'ANUENCIA_AMBIENTAL');
  const status = normalizeEnum(payload.status, partial ? undefined : 'RASCUNHO');
  const finalidade = cleanText(payload.finalidade, 240);

  if (tipo !== undefined && !TIPOS_SOLICITACAO.has(tipo)) throw serviceError('Tipo de solicitacao invalido.', 400, { field: 'tipo_solicitacao' });
  if (status !== undefined && !STATUS_PRE_PROTOCOLO.has(status)) throw serviceError('Status do pre-protocolo invalido.', 400, { field: 'status' });
  if (!partial && !finalidade) throw serviceError('Finalidade e obrigatoria.', 400, { field: 'finalidade' });

  return {
    tipo_solicitacao: tipo,
    modulo_destino: moduloDestinoFor(tipo, payload.modulo_destino),
    finalidade,
    descricao: cleanText(payload.descricao, 5000),
    status,
    geo_localizacao_id: payload.geo_localizacao_id ? requireId(payload.geo_localizacao_id, 'geo_localizacao_id') : null,
    distrito: cleanText(payload.distrito, 120),
    bairro_localidade: cleanText(payload.bairro_localidade, 140),
    observacoes_internas: cleanText(payload.observacoes_internas, 3000),
  };
}

async function logPortal({ acao, requerenteId = null, portalUserId = null, preProtocoloId = null, atorTipo, atorId = null, dados = {}, req }) {
  const context = auditService.getContext(req);
  await db.query(
    `
      INSERT INTO portal_requerente_auditoria (
        requerente_id, usuario_id, pre_protocolo_id, acao, ator_tipo, ator_id, dados, ip, user_agent
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9);
    `,
    [
      requerenteId,
      portalUserId,
      preProtocoloId,
      acao,
      atorTipo,
      atorId,
      JSON.stringify(dados),
      context.ip,
      context.user_agent,
    ]
  );

  await auditService.log({
    ator_tipo: atorTipo,
    ator_id: atorId,
    acao,
    entidade: preProtocoloId ? 'portal_pre_protocolos' : 'portal_requerentes',
    entidade_id: preProtocoloId || requerenteId || null,
    dados,
    req,
  });
}

async function addHistorico({ preProtocoloId, tipoEvento, descricao, statusAnterior = null, statusNovo = null, atorTipo, atorId = null, dados = {} }) {
  await db.query(
    `
      INSERT INTO portal_pre_protocolo_historico (
        pre_protocolo_id, tipo_evento, descricao, status_anterior, status_novo, ator_tipo, ator_id, dados
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb);
    `,
    [preProtocoloId, tipoEvento, descricao, statusAnterior, statusNovo, atorTipo, atorId, JSON.stringify(dados)]
  );
}

async function resolvePortalUser(usuarioExterno, req) {
  const result = await db.query(
    `
      SELECT u.*, r.nome_razao_social AS requerente_nome, r.status AS requerente_status,
             r.tipo_pessoa, r.cpf_cnpj, r.email_principal, r.telefone AS requerente_telefone,
             r.endereco_resumido, r.municipio, r.uf
      FROM portal_requerente_usuarios u
      JOIN portal_requerentes r ON r.id = u.requerente_id
      WHERE u.usuario_externo_id = $1
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT 1;
    `,
    [getExternalUserId(usuarioExterno)]
  );
  const row = result.rows[0];
  if (!row) throw serviceError('Usuario externo sem vinculo ativo ao Portal do Requerente.', 403);
  if (row.status !== 'ATIVO' || row.requerente_status !== 'ATIVO') {
    throw serviceError('Acesso ao Portal do Requerente indisponivel para este cadastro.', 403);
  }

  await db.query('UPDATE portal_requerente_usuarios SET ultimo_acesso_em = CURRENT_TIMESTAMP WHERE id = $1;', [row.id]);
  await logPortal({
    acao: 'portal_requerente.acesso',
    requerenteId: row.requerente_id,
    portalUserId: row.id,
    atorTipo: 'usuario_externo',
    atorId: row.id,
    dados: { usuario_externo_id: getExternalUserId(usuarioExterno) },
    req,
  });
  return row;
}

async function findUsuarioExternoByEmail(email) {
  const result = await db.query('SELECT * FROM usuarios_externos WHERE email = $1 LIMIT 1;', [email.toLowerCase()]);
  return result.rows[0] || null;
}

async function ensureUsuarioExterno(portalUser, requerente) {
  const existing = await findUsuarioExternoByEmail(portalUser.email);
  if (existing) return existing;
  const cpf = onlyDigits(requerente.cpf_cnpj);
  const registered = await usuarioExternoService.register({
    nome: portalUser.nome,
    cpf: cpf && cpf.length <= 11 ? cpf : null,
    email: portalUser.email,
    telefone: portalUser.telefone,
    endereco: requerente.endereco_resumido,
    senha: portalUser.senha,
    aceite_governanca_origem: 'portal_requerente_homologacao',
  });
  return registered.user;
}

async function listRequerentes(filters = {}) {
  const values = [];
  const where = [];
  if (filters.status) {
    values.push(normalizeEnum(filters.status));
    where.push(`status = $${values.length}`);
  }
  if (filters.busca) {
    values.push(`%${cleanText(filters.busca, 140).toUpperCase()}%`);
    where.push(`(UPPER(nome_razao_social) LIKE $${values.length} OR UPPER(COALESCE(email_principal, '')) LIKE $${values.length})`);
  }
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  values.push(limit);
  const result = await db.query(
    `
      SELECT *
      FROM portal_requerentes
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT $${values.length};
    `,
    values
  );
  return result.rows.map((row) => publicRequerente(row, { internal: true }));
}

async function getRequerente(id) {
  const requerenteId = requireId(id);
  const result = await db.query('SELECT * FROM portal_requerentes WHERE id = $1;', [requerenteId]);
  const usuarios = await db.query('SELECT * FROM portal_requerente_usuarios WHERE requerente_id = $1 ORDER BY created_at DESC;', [requerenteId]);
  const requerente = publicRequerente(result.rows[0], { internal: true });
  if (!requerente) return null;
  return { ...requerente, usuarios: usuarios.rows.map(publicPortalUser) };
}

async function createRequerente(payload = {}, user, req) {
  const data = validateRequerente(payload);
  const result = await db.query(
    `
      INSERT INTO portal_requerentes (
        tipo_pessoa, nome_razao_social, cpf_cnpj, email_principal, telefone, endereco_resumido,
        municipio, uf, representante_legal, observacoes_internas, status, criado_por, atualizado_por
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
      RETURNING *;
    `,
    [
      data.tipo_pessoa,
      data.nome_razao_social,
      data.cpf_cnpj,
      data.email_principal,
      data.telefone,
      data.endereco_resumido,
      data.municipio,
      data.uf,
      data.representante_legal,
      data.observacoes_internas,
      data.status,
      getInternalUserId(user),
    ]
  );
  const requerente = result.rows[0];
  const portalUser = validatePortalUser(payload.usuario || {}, requerente);
  const usuarioExterno = await ensureUsuarioExterno(portalUser, requerente);
  const usuarioResult = await db.query(
    `
      INSERT INTO portal_requerente_usuarios (
        requerente_id, usuario_externo_id, nome, email, telefone, tipo_usuario, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `,
    [
      requerente.id,
      usuarioExterno.id,
      portalUser.nome,
      portalUser.email,
      portalUser.telefone,
      portalUser.tipo_usuario,
      portalUser.status,
    ]
  );
  await logPortal({
    acao: 'portal_requerente.admin.requerente.create',
    requerenteId: requerente.id,
    portalUserId: usuarioResult.rows[0].id,
    atorTipo: 'usuario_interno',
    atorId: getInternalUserId(user),
    dados: { usuario_portal_id: usuarioResult.rows[0].id },
    req,
  });
  return { ...publicRequerente(requerente, { internal: true }), usuarios: [publicPortalUser(usuarioResult.rows[0])] };
}

async function updateRequerente(id, payload = {}, user, req) {
  const requerenteId = requireId(id);
  const before = await db.query('SELECT * FROM portal_requerentes WHERE id = $1;', [requerenteId]);
  if (!before.rows[0]) return null;
  const data = validateRequerente(payload, { partial: true });
  const allowed = Object.entries(data).filter(([key, value]) => Object.prototype.hasOwnProperty.call(payload, key) && value !== undefined);
  if (!allowed.length) throw serviceError('Nenhum campo valido informado para atualizacao.', 400);
  const values = [];
  const sets = [];
  allowed.forEach(([key, value]) => {
    values.push(value);
    sets.push(`${key} = $${values.length}`);
  });
  values.push(getInternalUserId(user));
  sets.push(`atualizado_por = $${values.length}`);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(requerenteId);
  const result = await db.query(`UPDATE portal_requerentes SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *;`, values);
  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: getInternalUserId(user),
    acao: 'portal_requerente.admin.requerente.update',
    entidade: 'portal_requerentes',
    entidade_id: requerenteId,
    before: before.rows[0],
    after: result.rows[0],
    req,
  });
  await logPortal({
    acao: 'portal_requerente.admin.requerente.update',
    requerenteId,
    atorTipo: 'usuario_interno',
    atorId: getInternalUserId(user),
    dados: { campos: allowed.map(([key]) => key) },
    req,
  });
  return publicRequerente(result.rows[0], { internal: true });
}

async function getMe(usuarioExterno, req) {
  const portalUser = await resolvePortalUser(usuarioExterno, req);
  return {
    requerente: publicRequerente({
      id: portalUser.requerente_id,
      tipo_pessoa: portalUser.tipo_pessoa,
      nome_razao_social: portalUser.requerente_nome,
      cpf_cnpj: portalUser.cpf_cnpj,
      email_principal: portalUser.email_principal,
      telefone: portalUser.requerente_telefone,
      endereco_resumido: portalUser.endereco_resumido,
      municipio: portalUser.municipio,
      uf: portalUser.uf,
      status: portalUser.requerente_status,
    }),
    usuario: publicPortalUser(portalUser),
  };
}

async function getTermos(usuarioExterno, req) {
  const portalUser = await resolvePortalUser(usuarioExterno, req);
  const result = await db.query(
    `
      SELECT DISTINCT ON (tipo_termo) tipo_termo, versao_termo, aceito_em
      FROM portal_termos_aceite
      WHERE usuario_id = $1 AND requerente_id = $2
      ORDER BY tipo_termo, aceito_em DESC;
    `,
    [portalUser.id, portalUser.requerente_id]
  );
  const aceites = Object.fromEntries(result.rows.map((row) => [row.tipo_termo, row]));
  return {
    obrigatorios: TERMOS_OBRIGATORIOS.map((tipo) => ({
      tipo_termo: tipo,
      versao_termo: '4C-2026-05',
      aceito: Boolean(aceites[tipo]),
      aceito_em: aceites[tipo]?.aceito_em || null,
    })),
  };
}

async function hasAllRequiredTerms(portalUserId, requerenteId) {
  const result = await db.query(
    `
      SELECT tipo_termo
      FROM portal_termos_aceite
      WHERE usuario_id = $1 AND requerente_id = $2
      GROUP BY tipo_termo;
    `,
    [portalUserId, requerenteId]
  );
  const accepted = new Set(result.rows.map((row) => row.tipo_termo));
  return TERMOS_OBRIGATORIOS.every((tipo) => accepted.has(tipo));
}

async function aceitarTermos(usuarioExterno, payload = {}, req) {
  const portalUser = await resolvePortalUser(usuarioExterno, req);
  const tipos = Array.isArray(payload.tipos) ? payload.tipos : [payload.tipo_termo || 'TERMO_USO'];
  const versao = cleanText(payload.versao_termo, 40) || '4C-2026-05';
  const validTipos = tipos.map((tipo) => normalizeEnum(tipo)).filter(Boolean);
  if (!validTipos.length) throw serviceError('Tipo de termo obrigatorio.', 400);
  validTipos.forEach((tipo) => {
    if (!TERMOS_OBRIGATORIOS.includes(tipo)) throw serviceError('Tipo de termo invalido.', 400, { tipo_termo: tipo });
  });
  const context = auditService.getContext(req);
  const rows = [];
  for (const tipo of validTipos) {
    const result = await db.query(
      `
        INSERT INTO portal_termos_aceite (usuario_id, requerente_id, tipo_termo, versao_termo, ip, user_agent)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *;
      `,
      [portalUser.id, portalUser.requerente_id, tipo, versao, context.ip, context.user_agent]
    );
    rows.push(result.rows[0]);
    await logPortal({
      acao: 'portal_requerente.termo.aceite',
      requerenteId: portalUser.requerente_id,
      portalUserId: portalUser.id,
      atorTipo: 'usuario_externo',
      atorId: portalUser.id,
      dados: { tipo_termo: tipo, versao_termo: versao },
      req,
    });
  }
  return rows;
}

async function listMeuRequerimentos(usuarioExterno, filters = {}, req) {
  const portalUser = await resolvePortalUser(usuarioExterno, req);
  const values = [portalUser.requerente_id];
  const where = ['p.requerente_id = $1'];
  if (filters.status) {
    values.push(normalizeEnum(filters.status));
    where.push(`p.status = $${values.length}`);
  }
  if (filters.tipo_solicitacao) {
    values.push(normalizeEnum(filters.tipo_solicitacao));
    where.push(`p.tipo_solicitacao = $${values.length}`);
  }
  const result = await db.query(
    `
      SELECT p.*, r.nome_razao_social AS requerente_nome, u.nome AS usuario_nome
      FROM portal_pre_protocolos p
      JOIN portal_requerentes r ON r.id = p.requerente_id
      JOIN portal_requerente_usuarios u ON u.id = p.usuario_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.updated_at DESC, p.id DESC
      LIMIT 100;
    `,
    values
  );
  return result.rows.map(publicPreProtocolo);
}

async function getPreProtocoloById(id, { requerenteId = null, internal = false } = {}) {
  const values = [requireId(id)];
  const where = ['p.id = $1'];
  if (requerenteId) {
    values.push(requerenteId);
    where.push(`p.requerente_id = $${values.length}`);
  }
  const result = await db.query(
    `
      SELECT p.*, r.nome_razao_social AS requerente_nome, r.cpf_cnpj, r.email_principal,
             u.nome AS usuario_nome, u.email AS usuario_email
      FROM portal_pre_protocolos p
      JOIN portal_requerentes r ON r.id = p.requerente_id
      JOIN portal_requerente_usuarios u ON u.id = p.usuario_id
      WHERE ${where.join(' AND ')};
    `,
    values
  );
  const pre = publicPreProtocolo(result.rows[0], { internal });
  if (!pre) return null;
  const documentos = await listDocumentosPre(pre.id, { internal });
  const pendencias = await listPendenciasPre(pre.id);
  const historico = await getHistoricoPre(pre.id);
  return {
    ...pre,
    requerente_documento_mascarado: maskDocument(result.rows[0].cpf_cnpj),
    requerente_email: internal ? result.rows[0].email_principal : undefined,
    usuario_email: internal ? result.rows[0].usuario_email : undefined,
    documentos,
    pendencias,
    historico,
  };
}

async function getMeuRequerimento(usuarioExterno, id, req) {
  const portalUser = await resolvePortalUser(usuarioExterno, req);
  const pre = await getPreProtocoloById(id, { requerenteId: portalUser.requerente_id });
  if (!pre) throw serviceError('Requerimento nao encontrado para este requerente.', 404);
  await logPortal({
    acao: 'portal_requerente.pre_protocolo.consulta',
    requerenteId: portalUser.requerente_id,
    portalUserId: portalUser.id,
    preProtocoloId: pre.id,
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
    req,
  });
  return pre;
}

async function createMeuRequerimento(usuarioExterno, payload = {}, req) {
  const portalUser = await resolvePortalUser(usuarioExterno, req);
  const data = validatePreProtocolo(payload);
  const codigo = buildCodigo();
  const result = await db.query(
    `
      INSERT INTO portal_pre_protocolos (
        codigo, requerente_id, usuario_id, tipo_solicitacao, modulo_destino, finalidade,
        descricao, status, geo_localizacao_id, distrito, bairro_localidade, criado_por_externo
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'RASCUNHO',$8,$9,$10,$3)
      RETURNING *;
    `,
    [
      codigo,
      portalUser.requerente_id,
      portalUser.id,
      data.tipo_solicitacao,
      data.modulo_destino,
      data.finalidade,
      data.descricao,
      data.geo_localizacao_id,
      data.distrito,
      data.bairro_localidade,
    ]
  );
  const pre = result.rows[0];
  await addHistorico({
    preProtocoloId: pre.id,
    tipoEvento: 'portal_pre_protocolo.create',
    descricao: 'Rascunho de pre-protocolo criado pelo requerente.',
    statusNovo: 'RASCUNHO',
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
    dados: { codigo },
  });
  await logPortal({
    acao: 'portal_requerente.pre_protocolo.create',
    requerenteId: portalUser.requerente_id,
    portalUserId: portalUser.id,
    preProtocoloId: pre.id,
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
    dados: { codigo },
    req,
  });
  return publicPreProtocolo(pre);
}

async function updateMeuRequerimento(usuarioExterno, id, payload = {}, req) {
  const portalUser = await resolvePortalUser(usuarioExterno, req);
  const before = await getPreProtocoloById(id, { requerenteId: portalUser.requerente_id });
  if (!before) throw serviceError('Requerimento nao encontrado para este requerente.', 404);
  if (!['RASCUNHO', 'DEVOLVIDO_PARA_COMPLEMENTACAO'].includes(before.status)) {
    throw serviceError('Requerente nao pode alterar protocolo apos envio, salvo quando devolvido para complementacao.', 409);
  }
  const data = validatePreProtocolo(payload, { partial: true });
  const allowed = Object.entries(data).filter(([key, value]) => Object.prototype.hasOwnProperty.call(payload, key) && value !== undefined);
  if (!allowed.length) throw serviceError('Nenhum campo valido informado para atualizacao.', 400);
  const values = [];
  const sets = [];
  allowed.forEach(([key, value]) => {
    values.push(value);
    sets.push(`${key} = $${values.length}`);
  });
  const nextStatus = before.status === 'DEVOLVIDO_PARA_COMPLEMENTACAO' ? 'COMPLEMENTADO' : before.status;
  values.push(nextStatus);
  sets.push(`status = $${values.length}`);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(requireId(id));
  values.push(portalUser.requerente_id);
  const result = await db.query(
    `UPDATE portal_pre_protocolos SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND requerente_id = $${values.length} RETURNING *;`,
    values
  );
  const updated = result.rows[0];
  await addHistorico({
    preProtocoloId: updated.id,
    tipoEvento: 'portal_pre_protocolo.update',
    descricao: 'Pre-protocolo atualizado pelo requerente.',
    statusAnterior: before.status,
    statusNovo: updated.status,
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
    dados: { campos: allowed.map(([key]) => key) },
  });
  await logPortal({
    acao: 'portal_requerente.pre_protocolo.update',
    requerenteId: portalUser.requerente_id,
    portalUserId: portalUser.id,
    preProtocoloId: updated.id,
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
    dados: { campos: allowed.map(([key]) => key) },
    req,
  });
  return publicPreProtocolo(updated);
}

async function enviarMeuRequerimento(usuarioExterno, id, req) {
  const portalUser = await resolvePortalUser(usuarioExterno, req);
  if (!(await hasAllRequiredTerms(portalUser.id, portalUser.requerente_id))) {
    throw serviceError('Aceite dos termos obrigatorios pendente.', 403);
  }
  const before = await getPreProtocoloById(id, { requerenteId: portalUser.requerente_id });
  if (!before) throw serviceError('Requerimento nao encontrado para este requerente.', 404);
  if (!['RASCUNHO', 'DEVOLVIDO_PARA_COMPLEMENTACAO', 'COMPLEMENTADO'].includes(before.status)) {
    throw serviceError('Somente rascunhos ou protocolos devolvidos podem ser enviados pelo requerente.', 409);
  }
  const result = await db.query(
    `
      UPDATE portal_pre_protocolos
      SET status = 'RECEBIDO_PENDENTE_TRIAGEM', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND requerente_id = $2
      RETURNING *;
    `,
    [before.id, portalUser.requerente_id]
  );
  const updated = result.rows[0];
  await addHistorico({
    preProtocoloId: updated.id,
    tipoEvento: 'portal_pre_protocolo.enviar',
    descricao: 'Pre-protocolo enviado para triagem da SMAD.',
    statusAnterior: before.status,
    statusNovo: updated.status,
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
  });
  await logPortal({
    acao: 'portal_requerente.pre_protocolo.enviar',
    requerenteId: portalUser.requerente_id,
    portalUserId: portalUser.id,
    preProtocoloId: updated.id,
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
    req,
  });
  return publicPreProtocolo(updated);
}

function validateDocumento(payload = {}) {
  const tipo = normalizeEnum(payload.tipo_documento, 'OUTRO');
  const nome = cleanText(payload.nome_original || payload.nome_arquivo || payload.referencia_documental, 220);
  const mime = cleanText(payload.mime_type, 120);
  if (!TIPOS_DOCUMENTO.has(tipo)) throw serviceError('Tipo documental invalido.', 400, { field: 'tipo_documento' });
  if (!nome) throw serviceError('Nome do documento e obrigatorio.', 400, { field: 'nome_original' });
  const ext = nome.includes('.') ? nome.split('.').pop().toLowerCase() : '';
  if (EXTENSOES_BLOQUEADAS.has(ext)) throw serviceError('Tipo de arquivo nao permitido para o Portal do Requerente.', 400);
  if (mime && !MIME_PERMITIDOS.has(mime)) throw serviceError('MIME type nao permitido para o Portal do Requerente.', 400, { field: 'mime_type' });
  const referencia = cleanText(payload.referencia_documental || nome, 220);
  const content = cleanText(payload.conteudo_texto || payload.conteudo_base64 || referencia, 10000) || '';
  const hash = crypto.createHash('sha256').update(`${tipo}|${nome}|${referencia}|${content}`).digest('hex');
  const tamanho = Number.isInteger(Number(payload.tamanho_bytes)) ? Number(payload.tamanho_bytes) : Buffer.byteLength(content, 'utf8');
  const sensibilidade = normalizeEnum(payload.sensibilidade_lgpd, 'POTENCIALMENTE_SENSIVEL');
  if (!['NAO_SENSIVEL', 'POTENCIALMENTE_SENSIVEL', 'SENSIVEL'].includes(sensibilidade)) {
    throw serviceError('Sensibilidade LGPD invalida.', 400);
  }
  return { tipo, nome, referencia, mime, hash, tamanho, sensibilidade };
}

async function addDocumentoMeuRequerimento(usuarioExterno, id, payload = {}, req) {
  const portalUser = await resolvePortalUser(usuarioExterno, req);
  const pre = await getPreProtocoloById(id, { requerenteId: portalUser.requerente_id });
  if (!pre) throw serviceError('Requerimento nao encontrado para este requerente.', 404);
  if (['ACEITO_GEROU_PROCESSO_INTERNO', 'RECUSADO_FUNDAMENTADO', 'ARQUIVADO', 'CANCELADO_PELO_REQUERENTE'].includes(pre.status)) {
    throw serviceError('Nao e permitido anexar documento neste status.', 409);
  }
  const documento = validateDocumento(payload);
  const result = await db.query(
    `
      INSERT INTO portal_pre_protocolo_documentos (
        pre_protocolo_id, tipo_documento, nome_original, referencia_documental, hash_sha256,
        mime_type, tamanho_bytes, sensibilidade_lgpd, enviado_por_usuario_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *;
    `,
    [pre.id, documento.tipo, documento.nome, documento.referencia, documento.hash, documento.mime, documento.tamanho, documento.sensibilidade, portalUser.id]
  );
  await addHistorico({
    preProtocoloId: pre.id,
    tipoEvento: 'portal_pre_protocolo.documento.create',
    descricao: 'Documento anexado ao pre-protocolo.',
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
    dados: { documento_id: result.rows[0].id, tipo_documento: documento.tipo },
  });
  await logPortal({
    acao: 'portal_requerente.documento.upload',
    requerenteId: portalUser.requerente_id,
    portalUserId: portalUser.id,
    preProtocoloId: pre.id,
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
    dados: { documento_id: result.rows[0].id, tipo_documento: documento.tipo },
    req,
  });
  return result.rows[0];
}

async function listDocumentosPre(preProtocoloId, { internal = false } = {}) {
  const result = await db.query(
    `
      SELECT *
      FROM portal_pre_protocolo_documentos
      WHERE pre_protocolo_id = $1
      ORDER BY created_at DESC, id DESC;
    `,
    [requireId(preProtocoloId, 'pre_protocolo_id')]
  );
  return result.rows.map((row) => ({
    id: row.id,
    pre_protocolo_id: row.pre_protocolo_id,
    tipo_documento: row.tipo_documento,
    nome_original: row.nome_original,
    referencia_documental: row.referencia_documental,
    hash_sha256: internal ? row.hash_sha256 : `${row.hash_sha256.slice(0, 12)}...`,
    mime_type: row.mime_type,
    tamanho_bytes: row.tamanho_bytes,
    sensibilidade_lgpd: row.sensibilidade_lgpd,
    status: row.status,
    created_at: row.created_at,
  }));
}

async function listMeusDocumentos(usuarioExterno, id, req) {
  const pre = await getMeuRequerimento(usuarioExterno, id, req);
  return pre.documentos;
}

async function listPendenciasPre(preProtocoloId) {
  const result = await db.query(
    `
      SELECT *
      FROM portal_pre_protocolo_pendencias
      WHERE pre_protocolo_id = $1
      ORDER BY created_at DESC, id DESC;
    `,
    [requireId(preProtocoloId, 'pre_protocolo_id')]
  );
  return result.rows;
}

async function listMinhasPendencias(usuarioExterno, id, req) {
  const pre = await getMeuRequerimento(usuarioExterno, id, req);
  return pre.pendencias;
}

async function responderPendencia(usuarioExterno, id, pendenciaId, payload = {}, req) {
  const portalUser = await resolvePortalUser(usuarioExterno, req);
  const pre = await getPreProtocoloById(id, { requerenteId: portalUser.requerente_id });
  if (!pre) throw serviceError('Requerimento nao encontrado para este requerente.', 404);
  const resposta = cleanText(payload.resposta, 5000);
  if (!resposta) throw serviceError('Resposta da pendencia e obrigatoria.', 400);
  const pendencia = await db.query(
    'SELECT * FROM portal_pre_protocolo_pendencias WHERE id = $1 AND pre_protocolo_id = $2;',
    [requireId(pendenciaId, 'pendenciaId'), pre.id]
  );
  if (!pendencia.rows[0]) throw serviceError('Pendencia nao encontrada.', 404);
  if (pendencia.rows[0].status !== 'ABERTA') throw serviceError('Pendencia nao esta aberta para resposta.', 409);
  const result = await db.query(
    `
      INSERT INTO portal_pre_protocolo_respostas (pre_protocolo_id, pendencia_id, usuario_id, resposta, documento_id)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *;
    `,
    [pre.id, pendencia.rows[0].id, portalUser.id, resposta, payload.documento_id ? requireId(payload.documento_id, 'documento_id') : null]
  );
  await db.query(
    `
      UPDATE portal_pre_protocolo_pendencias
      SET status = 'RESPONDIDA', resposta = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `,
    [resposta, pendencia.rows[0].id]
  );
  await db.query(
    "UPDATE portal_pre_protocolos SET status = 'COMPLEMENTADO', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
    [pre.id]
  );
  await addHistorico({
    preProtocoloId: pre.id,
    tipoEvento: 'portal_pre_protocolo.pendencia.resposta',
    descricao: 'Pendencia respondida pelo requerente.',
    statusAnterior: pre.status,
    statusNovo: 'COMPLEMENTADO',
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
    dados: { pendencia_id: pendencia.rows[0].id, resposta_id: result.rows[0].id },
  });
  await logPortal({
    acao: 'portal_requerente.pendencia.resposta',
    requerenteId: portalUser.requerente_id,
    portalUserId: portalUser.id,
    preProtocoloId: pre.id,
    atorTipo: 'usuario_externo',
    atorId: portalUser.id,
    dados: { pendencia_id: pendencia.rows[0].id, resposta_id: result.rows[0].id },
    req,
  });
  return result.rows[0];
}

async function getHistoricoPre(preProtocoloId) {
  const result = await db.query(
    `
      SELECT *
      FROM portal_pre_protocolo_historico
      WHERE pre_protocolo_id = $1
      ORDER BY created_at DESC, id DESC;
    `,
    [requireId(preProtocoloId, 'pre_protocolo_id')]
  );
  return result.rows;
}

async function getMeuHistorico(usuarioExterno, id, req) {
  const pre = await getMeuRequerimento(usuarioExterno, id, req);
  return pre.historico;
}

async function listPreProtocolos(filters = {}) {
  const values = [];
  const where = [];
  if (filters.status) {
    values.push(normalizeEnum(filters.status));
    where.push(`p.status = $${values.length}`);
  }
  if (filters.tipo_solicitacao) {
    values.push(normalizeEnum(filters.tipo_solicitacao));
    where.push(`p.tipo_solicitacao = $${values.length}`);
  }
  if (filters.modulo_destino) {
    values.push(normalizeEnum(filters.modulo_destino));
    where.push(`p.modulo_destino = $${values.length}`);
  }
  if (filters.distrito) {
    values.push(`%${cleanText(filters.distrito, 120).toUpperCase()}%`);
    where.push(`UPPER(COALESCE(p.distrito, '')) LIKE $${values.length}`);
  }
  if (filters.requerente) {
    values.push(`%${cleanText(filters.requerente, 160).toUpperCase()}%`);
    where.push(`UPPER(r.nome_razao_social) LIKE $${values.length}`);
  }
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 200);
  values.push(limit);
  const result = await db.query(
    `
      SELECT p.*, r.nome_razao_social AS requerente_nome, u.nome AS usuario_nome
      FROM portal_pre_protocolos p
      JOIN portal_requerentes r ON r.id = p.requerente_id
      JOIN portal_requerente_usuarios u ON u.id = p.usuario_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.updated_at DESC, p.id DESC
      LIMIT $${values.length};
    `,
    values
  );
  return result.rows.map((row) => publicPreProtocolo(row, { internal: true }));
}

async function getPreProtocoloAdmin(id) {
  return getPreProtocoloById(id, { internal: true });
}

async function updatePreStatus(id, status, { descricao, dados = {} }, user, req) {
  const pre = await getPreProtocoloById(id, { internal: true });
  if (!pre) return null;
  const result = await db.query(
    `
      UPDATE portal_pre_protocolos
      SET status = $1, triado_por = $2, triado_em = CURRENT_TIMESTAMP, observacoes_internas = COALESCE($3, observacoes_internas),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *;
    `,
    [status, getInternalUserId(user), cleanText(dados.observacoes_internas, 3000), pre.id]
  );
  const updated = result.rows[0];
  await addHistorico({
    preProtocoloId: pre.id,
    tipoEvento: dados.evento || `portal_pre_protocolo.${status.toLowerCase()}`,
    descricao,
    statusAnterior: pre.status,
    statusNovo: status,
    atorTipo: 'usuario_interno',
    atorId: getInternalUserId(user),
    dados,
  });
  await logPortal({
    acao: dados.evento || `portal_requerente.admin.${status.toLowerCase()}`,
    requerenteId: pre.requerente_id,
    portalUserId: pre.usuario_id,
    preProtocoloId: pre.id,
    atorTipo: 'usuario_interno',
    atorId: getInternalUserId(user),
    dados,
    req,
  });
  return publicPreProtocolo(updated, { internal: true });
}

async function triarPreProtocolo(id, payload = {}, user, req) {
  const pre = await getPreProtocoloById(id, { internal: true });
  if (!pre) return null;
  if (!['RECEBIDO_PENDENTE_TRIAGEM', 'COMPLEMENTADO', 'DEVOLVIDO_PARA_COMPLEMENTACAO'].includes(pre.status)) {
    throw serviceError('Pre-protocolo nao esta em status disponivel para triagem.', 409);
  }
  return updatePreStatus(id, 'EM_TRIAGEM_SMAD', {
    descricao: 'Pre-protocolo colocado em triagem interna pela SMAD.',
    dados: { evento: 'portal_pre_protocolo.triagem', observacoes_internas: payload.observacoes_internas },
  }, user, req);
}

async function devolverPreProtocolo(id, payload = {}, user, req) {
  const pre = await getPreProtocoloById(id, { internal: true });
  if (!pre) return null;
  const descricaoPendencia = cleanText(payload.descricao || payload.motivo, 3000);
  if (!descricaoPendencia) throw serviceError('Descricao da pendencia/devolucao e obrigatoria.', 400);
  const pendencia = await db.query(
    `
      INSERT INTO portal_pre_protocolo_pendencias (pre_protocolo_id, descricao, prazo_resposta, criada_por)
      VALUES ($1,$2,$3,$4)
      RETURNING *;
    `,
    [pre.id, descricaoPendencia, payload.prazo_resposta || null, getInternalUserId(user)]
  );
  const updated = await updatePreStatus(id, 'DEVOLVIDO_PARA_COMPLEMENTACAO', {
    descricao: 'Pre-protocolo devolvido para complementacao pelo requerente.',
    dados: { evento: 'portal_pre_protocolo.devolucao', pendencia_id: pendencia.rows[0].id, observacoes_internas: payload.observacoes_internas },
  }, user, req);
  return { ...updated, pendencia: pendencia.rows[0] };
}

async function recusarPreProtocolo(id, payload = {}, user, req) {
  const fundamento = cleanText(payload.fundamentacao || payload.motivo, 5000);
  if (!fundamento) throw serviceError('Fundamentacao da recusa e obrigatoria.', 400);
  return updatePreStatus(id, 'RECUSADO_FUNDAMENTADO', {
    descricao: 'Pre-protocolo recusado fundamentadamente pela SMAD.',
    dados: { evento: 'portal_pre_protocolo.recusa', fundamentacao: fundamento, observacoes_internas: fundamento },
  }, user, req);
}

async function aceitarPreProtocolo(id, payload = {}, user, req) {
  const pre = await getPreProtocoloById(id, { internal: true });
  if (!pre) return null;
  if (pre.tipo_solicitacao !== 'ANUENCIA_AMBIENTAL') {
    throw serviceError('Fluxo completo nesta sprint esta habilitado apenas para ANUENCIA_AMBIENTAL.', 400);
  }
  if (!['RECEBIDO_PENDENTE_TRIAGEM', 'EM_TRIAGEM_SMAD', 'COMPLEMENTADO'].includes(pre.status)) {
    throw serviceError('Pre-protocolo nao esta disponivel para aceite interno.', 409);
  }
  const requerente = await db.query('SELECT * FROM portal_requerentes WHERE id = $1;', [pre.requerente_id]);
  const documentos = await listDocumentosPre(pre.id, { internal: true });
  const numeroProcesso = cleanText(payload.numero_processo_gerado, 100) || `PROC-${pre.codigo}`;
  const numeroProtocolo = cleanText(payload.numero_protocolo_gerado, 100) || `PROTO-${pre.codigo}`;
  const anuencia = await anuenciaService.createAnuencia({
    numero_processo: numeroProcesso,
    numero_protocolo: numeroProtocolo,
    tipo_anuencia: payload.tipo_anuencia || 'ANUENCIA_LOCALIZACAO',
    finalidade: pre.finalidade,
    descricao_solicitacao: pre.descricao || 'Solicitacao originada em pre-protocolo do Portal do Requerente.',
    status: 'PROTOCOLADA',
    prioridade: payload.prioridade || 'NORMAL',
    geo_localizacao_id: pre.geo_localizacao_id,
    justificativa_ausencia_geo: pre.geo_localizacao_id ? null : 'Localizacao geoambiental nao informada no pre-protocolo externo; pendente de conferencia tecnica interna.',
    distrito: pre.distrito,
    bairro_localidade: pre.bairro_localidade,
    observacoes_internas: `Origem PORTAL_REQUERENTE - pre-protocolo ${pre.codigo}.`,
  }, user, req);

  await anuenciaService.addInteressado(anuencia.id, {
    nome_razao_social: requerente.rows[0].nome_razao_social,
    tipo_pessoa: requerente.rows[0].tipo_pessoa,
    documento_mascarado: maskDocument(requerente.rows[0].cpf_cnpj),
    telefone: requerente.rows[0].telefone,
    email: requerente.rows[0].email_principal,
    endereco_correspondencia: requerente.rows[0].endereco_resumido,
    representante_legal: requerente.rows[0].representante_legal,
    observacoes: `Interessado originado no Portal do Requerente - ${pre.codigo}.`,
  }, user, req);

  for (const documento of documentos) {
    await anuenciaService.addDocumento(anuencia.id, {
      tipo_documento: documento.tipo_documento,
      referencia_documental: documento.referencia_documental || documento.nome_original,
      descricao: `Documento recebido via Portal do Requerente (${pre.codigo}). Hash controlado: ${documento.hash_sha256}`,
    }, user, req);
  }

  const result = await db.query(
    `
      UPDATE portal_pre_protocolos
      SET status = 'ACEITO_GEROU_PROCESSO_INTERNO',
          numero_processo_gerado = $1,
          numero_protocolo_gerado = $2,
          anuencia_id = $3,
          triado_por = $4,
          triado_em = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `,
    [numeroProcesso, numeroProtocolo, anuencia.id, getInternalUserId(user), pre.id]
  );

  await db.query(
    `
      INSERT INTO portal_requerente_vinculos (
        requerente_id, usuario_id, modulo_origem, entidade_origem_tipo, entidade_origem_id,
        numero_processo, numero_protocolo, tipo_vinculo
      )
      VALUES ($1,$2,'ANUENCIA','anuencia_ambiental',$3,$4,$5,'ORIGEM_PORTAL_REQUERENTE');
    `,
    [pre.requerente_id, pre.usuario_id, anuencia.id, numeroProcesso, numeroProtocolo]
  );

  await addHistorico({
    preProtocoloId: pre.id,
    tipoEvento: 'portal_pre_protocolo.aceite',
    descricao: 'Pre-protocolo aceito e convertido em registro interno de anuencia ambiental.',
    statusAnterior: pre.status,
    statusNovo: 'ACEITO_GEROU_PROCESSO_INTERNO',
    atorTipo: 'usuario_interno',
    atorId: getInternalUserId(user),
    dados: { anuencia_id: anuencia.id, anuencia_codigo: anuencia.codigo },
  });
  await logPortal({
    acao: 'portal_requerente.admin.aceitar',
    requerenteId: pre.requerente_id,
    portalUserId: pre.usuario_id,
    preProtocoloId: pre.id,
    atorTipo: 'usuario_interno',
    atorId: getInternalUserId(user),
    dados: { anuencia_id: anuencia.id, anuencia_codigo: anuencia.codigo },
    req,
  });
  return {
    pre_protocolo: publicPreProtocolo(result.rows[0], { internal: true }),
    anuencia,
  };
}

async function getDashboardResumo() {
  const totalRequerentes = await db.query('SELECT COUNT(*)::int AS total FROM portal_requerentes;');
  const totalPre = await db.query('SELECT COUNT(*)::int AS total FROM portal_pre_protocolos;');
  const byStatus = await db.query('SELECT status, COUNT(*)::int AS total FROM portal_pre_protocolos GROUP BY status ORDER BY status;');
  const byTipo = await db.query('SELECT tipo_solicitacao, COUNT(*)::int AS total FROM portal_pre_protocolos GROUP BY tipo_solicitacao ORDER BY tipo_solicitacao;');
  const byDistrito = await db.query("SELECT COALESCE(distrito, 'Nao informado') AS distrito, COUNT(*)::int AS total FROM portal_pre_protocolos GROUP BY COALESCE(distrito, 'Nao informado') ORDER BY total DESC;");
  const ultimos = await db.query(
    `
      SELECT p.id, p.codigo, p.status, p.tipo_solicitacao, p.created_at, p.updated_at,
             r.nome_razao_social AS requerente_nome
      FROM portal_pre_protocolos p
      JOIN portal_requerentes r ON r.id = p.requerente_id
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 10;
    `
  );
  const counts = Object.fromEntries(byStatus.rows.map((row) => [row.status, row.total]));
  return {
    total_requerentes: totalRequerentes.rows[0].total,
    total_pre_protocolos: totalPre.rows[0].total,
    pre_protocolos_enviados: counts.ENVIADO || 0,
    pendentes_triagem: counts.RECEBIDO_PENDENTE_TRIAGEM || 0,
    devolvidos_complementacao: counts.DEVOLVIDO_PARA_COMPLEMENTACAO || 0,
    complementados: counts.COMPLEMENTADO || 0,
    aceitos: counts.ACEITO_GEROU_PROCESSO_INTERNO || 0,
    recusados: counts.RECUSADO_FUNDAMENTADO || 0,
    por_tipo_solicitacao: byTipo.rows,
    por_distrito: byDistrito.rows,
    por_status: byStatus.rows,
    ultimos_envios: ultimos.rows,
  };
}

module.exports = {
  TERMOS_OBRIGATORIOS,
  listRequerentes,
  getRequerente,
  createRequerente,
  updateRequerente,
  getMe,
  getTermos,
  aceitarTermos,
  listMeuRequerimentos,
  getMeuRequerimento,
  createMeuRequerimento,
  updateMeuRequerimento,
  enviarMeuRequerimento,
  addDocumentoMeuRequerimento,
  listMeusDocumentos,
  listMinhasPendencias,
  responderPendencia,
  getMeuHistorico,
  listPreProtocolos,
  getPreProtocoloAdmin,
  triarPreProtocolo,
  devolverPreProtocolo,
  aceitarPreProtocolo,
  recusarPreProtocolo,
  getDashboardResumo,
};
