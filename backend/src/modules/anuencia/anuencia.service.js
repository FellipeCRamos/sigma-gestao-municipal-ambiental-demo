const db = require('../../config/db');
const auditService = require('../../services/auditService');

const TIPOS = new Set([
  'ANUENCIA_LOCALIZACAO',
  'ANUENCIA_OBRA_INTERVENCAO',
  'ANUENCIA_INFRAESTRUTURA',
  'ANUENCIA_SANEAMENTO',
  'ANUENCIA_DRENAGEM',
  'ANUENCIA_ORGAO_EXTERNO',
  'ANUENCIA_USO_AREA',
  'ANUENCIA_REGULARIZACAO',
  'ANUENCIA_OUTRA',
]);

const STATUS = new Set([
  'RASCUNHO',
  'PROTOCOLADA',
  'EM_TRIAGEM',
  'AGUARDANDO_COMPLEMENTACAO',
  'EM_ANALISE_TECNICA',
  'MINUTA_EM_ELABORACAO',
  'AGUARDANDO_DECISAO',
  'DEFERIDA',
  'DEFERIDA_COM_CONDICIONANTES',
  'INDEFERIDA',
  'ARQUIVADA',
  'CANCELADA',
  'SUBSTITUIDA',
]);

const PRIORIDADES = new Set(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']);

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

function requireId(value, fieldName = 'id') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw serviceError(`Parametro invalido: ${fieldName}.`, 400, { field: fieldName });
  }
  return parsed;
}

function getUserId(user) {
  return user?.id || null;
}

function buildCodigo(prefix = 'SIGMA-ANU') {
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

async function audit({ anuenciaId, acao, descricao, user, req, dados = {}, statusAnterior = null, statusNovo = null }) {
  if (anuenciaId) {
    await db.query(
      `
        INSERT INTO anuencia_historico (
          anuencia_id, tipo_evento, descricao, status_anterior, status_novo, usuario_id, dados
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb);
      `,
      [anuenciaId, acao, descricao, statusAnterior, statusNovo, getUserId(user), JSON.stringify(dados)]
    );
  }

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: getUserId(user),
    acao,
    entidade: 'anuencias_ambientais',
    entidade_id: anuenciaId || null,
    dados,
    req,
  });
}

function publicAnuencia(row) {
  if (!row) return null;
  return {
    ...row,
    geo_localizacao: row.geo_codigo
      ? {
          id: row.geo_localizacao_id,
          codigo: row.geo_codigo,
          titulo: row.geo_titulo,
          tipo_geometria: row.geo_tipo_geometria,
          latitude: row.geo_latitude === null ? null : Number(row.geo_latitude),
          longitude: row.geo_longitude === null ? null : Number(row.geo_longitude),
          sensibilidade_lgpd: row.geo_sensibilidade_lgpd,
        }
      : null,
    geo_codigo: undefined,
    geo_titulo: undefined,
    geo_tipo_geometria: undefined,
    geo_latitude: undefined,
    geo_longitude: undefined,
    geo_sensibilidade_lgpd: undefined,
  };
}

function validateAnuencia(payload = {}, { partial = false } = {}) {
  const tipo = normalizeEnum(payload.tipo_anuencia, partial ? undefined : 'ANUENCIA_LOCALIZACAO');
  const status = normalizeEnum(payload.status, partial ? undefined : 'RASCUNHO');
  const prioridade = normalizeEnum(payload.prioridade, partial ? undefined : 'NORMAL');
  const zona = normalizeEnum(payload.zona_urbana_rural);

  if (tipo !== undefined && !TIPOS.has(tipo)) throw serviceError('Tipo de anuencia invalido.', 400, { field: 'tipo_anuencia' });
  if (status !== undefined && !STATUS.has(status)) throw serviceError('Status de anuencia invalido.', 400, { field: 'status' });
  if (prioridade !== undefined && !PRIORIDADES.has(prioridade)) throw serviceError('Prioridade invalida.', 400, { field: 'prioridade' });
  if (!partial && !cleanText(payload.finalidade, 220)) throw serviceError('Finalidade e obrigatoria.', 400, { field: 'finalidade' });

  return {
    numero_processo: cleanText(payload.numero_processo, 100),
    numero_protocolo: cleanText(payload.numero_protocolo, 100),
    tipo_anuencia: tipo,
    finalidade: cleanText(payload.finalidade, 220),
    descricao_solicitacao: cleanText(payload.descricao_solicitacao, 5000),
    status,
    prioridade,
    geo_localizacao_id: payload.geo_localizacao_id ? requireId(payload.geo_localizacao_id, 'geo_localizacao_id') : null,
    justificativa_ausencia_geo: cleanText(payload.justificativa_ausencia_geo, 2000),
    distrito: cleanText(payload.distrito, 120),
    bairro_localidade: cleanText(payload.bairro_localidade, 140),
    zona_urbana_rural: zona,
    resumo_geoambiental: cleanText(payload.resumo_geoambiental, 4000),
    fundamentacao_preliminar: cleanText(payload.fundamentacao_preliminar, 4000),
    observacoes_internas: cleanText(payload.observacoes_internas, 4000),
  };
}

async function getGeoResumo(id) {
  if (!id) return null;
  const result = await db.query('SELECT * FROM geo_localizacoes WHERE id = $1;', [id]);
  const geo = result.rows[0];
  if (!geo) throw serviceError('Localizacao geoambiental nao encontrada.', 404);
  return [
    geo.codigo,
    geo.titulo,
    geo.tipo_geometria,
    geo.distrito,
    geo.bairro_localidade,
    'Analise geoambiental preliminar/interna; nao substitui avaliacao tecnica.',
  ].filter(Boolean).join(' - ');
}

async function listAnuencias(filters = {}) {
  const values = [];
  const where = [];
  if (filters.status) {
    values.push(normalizeEnum(filters.status));
    where.push(`a.status = $${values.length}`);
  }
  if (filters.tipo_anuencia) {
    values.push(normalizeEnum(filters.tipo_anuencia));
    where.push(`a.tipo_anuencia = $${values.length}`);
  }
  if (filters.distrito) {
    values.push(`%${cleanText(filters.distrito, 120).toUpperCase()}%`);
    where.push(`UPPER(a.distrito) LIKE $${values.length}`);
  }
  if (filters.processo) {
    values.push(`%${cleanText(filters.processo, 100).toUpperCase()}%`);
    where.push(`UPPER(a.numero_processo) LIKE $${values.length}`);
  }
  if (filters.protocolo) {
    values.push(`%${cleanText(filters.protocolo, 100).toUpperCase()}%`);
    where.push(`UPPER(a.numero_protocolo) LIKE $${values.length}`);
  }
  if (filters.interessado) {
    values.push(`%${cleanText(filters.interessado, 180).toUpperCase()}%`);
    where.push(`EXISTS (SELECT 1 FROM anuencia_interessados i WHERE i.anuencia_id = a.id AND UPPER(i.nome_razao_social) LIKE $${values.length})`);
  }
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  values.push(limit);
  const result = await db.query(
    `
      SELECT a.*, gl.codigo AS geo_codigo, gl.titulo AS geo_titulo, gl.tipo_geometria AS geo_tipo_geometria,
             gl.latitude AS geo_latitude, gl.longitude AS geo_longitude, gl.sensibilidade_lgpd AS geo_sensibilidade_lgpd
      FROM anuencias_ambientais a
      LEFT JOIN geo_localizacoes gl ON gl.id = a.geo_localizacao_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${values.length};
    `,
    values
  );
  return result.rows.map(publicAnuencia);
}

async function getAnuencia(id) {
  const result = await db.query(
    `
      SELECT a.*, gl.codigo AS geo_codigo, gl.titulo AS geo_titulo, gl.tipo_geometria AS geo_tipo_geometria,
             gl.latitude AS geo_latitude, gl.longitude AS geo_longitude, gl.sensibilidade_lgpd AS geo_sensibilidade_lgpd
      FROM anuencias_ambientais a
      LEFT JOIN geo_localizacoes gl ON gl.id = a.geo_localizacao_id
      WHERE a.id = $1;
    `,
    [requireId(id)]
  );
  return publicAnuencia(result.rows[0]);
}

async function createAnuencia(payload = {}, user, req) {
  const data = validateAnuencia(payload);
  const codigo = buildCodigo();
  const resumoGeo = data.geo_localizacao_id ? await getGeoResumo(data.geo_localizacao_id) : data.resumo_geoambiental;
  const result = await db.query(
    `
      INSERT INTO anuencias_ambientais (
        codigo, numero_processo, numero_protocolo, tipo_anuencia, finalidade,
        descricao_solicitacao, status, prioridade, geo_localizacao_id, justificativa_ausencia_geo,
        distrito, bairro_localidade, zona_urbana_rural, resumo_geoambiental,
        fundamentacao_preliminar, observacoes_internas, criado_por, atualizado_por
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
      RETURNING *;
    `,
    [
      codigo,
      data.numero_processo,
      data.numero_protocolo,
      data.tipo_anuencia,
      data.finalidade,
      data.descricao_solicitacao,
      data.status,
      data.prioridade,
      data.geo_localizacao_id,
      data.justificativa_ausencia_geo,
      data.distrito,
      data.bairro_localidade,
      data.zona_urbana_rural,
      resumoGeo,
      data.fundamentacao_preliminar,
      data.observacoes_internas,
      getUserId(user),
    ]
  );
  const created = result.rows[0];
  await audit({ anuenciaId: created.id, acao: 'anuencia.create', descricao: 'Anuencia ambiental criada.', user, req, dados: { codigo } });
  if (created.geo_localizacao_id) {
    await createGeoVinculo(created, user, req);
  }
  return getAnuencia(created.id);
}

async function createGeoVinculo(anuencia, user, req) {
  const exists = await db.query(
    `
      SELECT id FROM geo_vinculos
      WHERE geo_localizacao_id = $1
        AND modulo_origem = 'anuencia'
        AND entidade_origem_tipo = 'anuencia_ambiental'
        AND entidade_origem_id = $2;
    `,
    [anuencia.geo_localizacao_id, anuencia.id]
  );
  if (exists.rows[0]) return;
  await db.query(
    `
      INSERT INTO geo_vinculos (
        geo_localizacao_id, modulo_origem, entidade_origem_tipo, entidade_origem_id,
        processo_numero, protocolo_numero, finalidade_vinculo
      )
      VALUES ($1, 'anuencia', 'anuencia_ambiental', $2, $3, $4, $5);
    `,
    [anuencia.geo_localizacao_id, anuencia.id, anuencia.numero_processo, anuencia.numero_protocolo, 'Vinculo geoambiental de anuencia ambiental municipal.']
  );
  await audit({ anuenciaId: anuencia.id, acao: 'anuencia.geo.vinculo', descricao: 'Localizacao geoambiental vinculada.', user, req, dados: { geo_localizacao_id: anuencia.geo_localizacao_id } });
}

async function updateAnuencia(id, payload = {}, user, req) {
  const anuenciaId = requireId(id);
  const before = await getAnuencia(anuenciaId);
  if (!before) return null;
  const data = validateAnuencia(payload, { partial: true });
  if (data.geo_localizacao_id) data.resumo_geoambiental = await getGeoResumo(data.geo_localizacao_id);
  const allowed = Object.entries(data).filter(([key, value]) => Object.prototype.hasOwnProperty.call(payload, key) && value !== undefined);
  if (!allowed.length) throw serviceError('Nenhum campo valido informado para atualizacao.', 400);
  const values = [];
  const sets = [];
  allowed.forEach(([key, value]) => {
    values.push(value);
    sets.push(`${key} = $${values.length}`);
  });
  values.push(getUserId(user));
  sets.push(`atualizado_por = $${values.length}`);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(anuenciaId);
  const result = await db.query(`UPDATE anuencias_ambientais SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *;`, values);
  const updated = result.rows[0];
  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: getUserId(user),
    acao: 'anuencia.update',
    entidade: 'anuencias_ambientais',
    entidade_id: anuenciaId,
    before,
    after: updated,
    req,
  });
  await audit({
    anuenciaId,
    acao: before.status !== updated.status ? 'anuencia.status.update' : 'anuencia.update',
    descricao: before.status !== updated.status ? 'Status da anuencia alterado.' : 'Anuencia ambiental atualizada.',
    user,
    req,
    statusAnterior: before.status,
    statusNovo: updated.status,
  });
  if (updated.geo_localizacao_id) await createGeoVinculo(updated, user, req);
  return getAnuencia(anuenciaId);
}

async function addInteressado(id, payload = {}, user, req) {
  const anuenciaId = requireId(id);
  if (!(await getAnuencia(anuenciaId))) return null;
  const nome = cleanText(payload.nome_razao_social, 180);
  if (!nome) throw serviceError('Nome/razao social do interessado e obrigatorio.', 400);
  const result = await db.query(
    `
      INSERT INTO anuencia_interessados (
        anuencia_id, nome_razao_social, tipo_pessoa, documento_mascarado, telefone, email,
        endereco_correspondencia, representante_legal, observacoes, principal
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `,
    [
      anuenciaId,
      nome,
      normalizeEnum(payload.tipo_pessoa, 'NAO_INFORMADO'),
      cleanText(payload.documento_mascarado, 80),
      cleanText(payload.telefone, 80),
      cleanText(payload.email, 160),
      cleanText(payload.endereco_correspondencia, 2000),
      cleanText(payload.representante_legal, 180),
      cleanText(payload.observacoes, 2000),
      payload.principal !== false,
    ]
  );
  await audit({ anuenciaId, acao: 'anuencia.interessado.create', descricao: 'Interessado registrado.', user, req, dados: { interessado_id: result.rows[0].id } });
  return result.rows[0];
}

async function listByAnuencia(table, id, order = 'created_at DESC, id DESC') {
  const result = await db.query(`SELECT * FROM ${table} WHERE anuencia_id = $1 ORDER BY ${order};`, [requireId(id)]);
  return result.rows;
}

async function addDocumento(id, payload = {}, user, req) {
  const anuenciaId = requireId(id);
  const tipo = cleanText(payload.tipo_documento, 100);
  if (!tipo) throw serviceError('Tipo de documento e obrigatorio.', 400);
  const result = await db.query(
    `
      INSERT INTO anuencia_documentos (anuencia_id, tipo_documento, descricao, referencia_documental)
      VALUES ($1,$2,$3,$4) RETURNING *;
    `,
    [anuenciaId, tipo, cleanText(payload.descricao, 2000), cleanText(payload.referencia_documental, 180)]
  );
  await audit({ anuenciaId, acao: 'anuencia.documento.create', descricao: 'Documento registrado.', user, req, dados: { documento_id: result.rows[0].id } });
  return result.rows[0];
}

async function conferirDocumento(id, documentoId, payload = {}, user, req) {
  const status = normalizeEnum(payload.status_conferencia, 'CONFERIDO');
  const result = await db.query(
    `
      UPDATE anuencia_documentos
      SET status_conferencia = $1, conferido_por = $2, conferido_em = CURRENT_TIMESTAMP, observacoes_conferencia = $3
      WHERE id = $4 AND anuencia_id = $5
      RETURNING *;
    `,
    [status, getUserId(user), cleanText(payload.observacoes_conferencia, 2000), requireId(documentoId, 'documentoId'), requireId(id)]
  );
  if (!result.rows[0]) return null;
  await audit({ anuenciaId: requireId(id), acao: 'anuencia.documento.conferencia', descricao: 'Documento conferido.', user, req, dados: { documento_id: documentoId, status } });
  return result.rows[0];
}

async function addAnalise(id, payload = {}, user, req) {
  const anuenciaId = requireId(id);
  const parecer = cleanText(payload.parecer_resumido, 4000);
  const fundamentacao = cleanText(payload.fundamentacao_tecnica, 6000);
  if (!parecer || !fundamentacao) throw serviceError('Parecer e fundamentacao tecnica sao obrigatorios.', 400);
  const result = await db.query(
    `
      INSERT INTO anuencia_analises_tecnicas (anuencia_id, parecer_resumido, fundamentacao_tecnica, conclusao_tecnica, responsavel_id)
      VALUES ($1,$2,$3,$4,$5) RETURNING *;
    `,
    [anuenciaId, parecer, fundamentacao, normalizeEnum(payload.conclusao_tecnica, 'NECESSITA_COMPLEMENTACAO'), getUserId(user)]
  );
  await db.query("UPDATE anuencias_ambientais SET status = 'AGUARDANDO_DECISAO', atualizado_por = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status NOT IN ('DEFERIDA','DEFERIDA_COM_CONDICIONANTES','INDEFERIDA','ARQUIVADA','CANCELADA');", [getUserId(user), anuenciaId]);
  await audit({ anuenciaId, acao: 'anuencia.analise.create', descricao: 'Analise tecnica registrada.', user, req, statusNovo: 'AGUARDANDO_DECISAO', dados: { analise_id: result.rows[0].id } });
  return result.rows[0];
}

async function addPendencia(id, payload = {}, user, req) {
  const anuenciaId = requireId(id);
  const descricao = cleanText(payload.descricao, 3000);
  if (!descricao) throw serviceError('Descricao da pendencia e obrigatoria.', 400);
  const result = await db.query(
    'INSERT INTO anuencia_pendencias (anuencia_id, descricao, prazo_resposta, criada_por) VALUES ($1,$2,$3,$4) RETURNING *;',
    [anuenciaId, descricao, payload.prazo_resposta || null, getUserId(user)]
  );
  await db.query("UPDATE anuencias_ambientais SET status = 'AGUARDANDO_COMPLEMENTACAO', atualizado_por = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;", [getUserId(user), anuenciaId]);
  await audit({ anuenciaId, acao: 'anuencia.pendencia.create', descricao: 'Pendencia registrada.', user, req, statusNovo: 'AGUARDANDO_COMPLEMENTACAO', dados: { pendencia_id: result.rows[0].id } });
  return result.rows[0];
}

async function updatePendencia(id, pendenciaId, payload = {}, user, req) {
  const status = normalizeEnum(payload.status, 'RESOLVIDA');
  const result = await db.query(
    `
      UPDATE anuencia_pendencias
      SET status = $1, resposta = $2, resolvida_por = CASE WHEN $1::varchar IN ('RESOLVIDA','CANCELADA') THEN $3 ELSE resolvida_por END,
          resolvida_em = CASE WHEN $1::varchar IN ('RESOLVIDA','CANCELADA') THEN CURRENT_TIMESTAMP ELSE resolvida_em END
      WHERE id = $4 AND anuencia_id = $5
      RETURNING *;
    `,
    [status, cleanText(payload.resposta, 3000), getUserId(user), requireId(pendenciaId, 'pendenciaId'), requireId(id)]
  );
  if (!result.rows[0]) return null;
  await audit({ anuenciaId: requireId(id), acao: 'anuencia.pendencia.update', descricao: 'Pendencia atualizada.', user, req, dados: { pendencia_id: pendenciaId, status } });
  return result.rows[0];
}

async function addCondicionante(id, payload = {}, user, req) {
  const anuenciaId = requireId(id);
  const descricao = cleanText(payload.descricao, 3000);
  if (!descricao) throw serviceError('Descricao da condicionante e obrigatoria.', 400);
  const result = await db.query(
    `
      INSERT INTO anuencia_condicionantes (anuencia_id, descricao, prazo, responsavel_monitoramento)
      VALUES ($1,$2,$3,$4) RETURNING *;
    `,
    [anuenciaId, descricao, cleanText(payload.prazo, 120), cleanText(payload.responsavel_monitoramento, 160)]
  );
  await audit({ anuenciaId, acao: 'anuencia.condicionante.create', descricao: 'Condicionante registrada.', user, req, dados: { condicionante_id: result.rows[0].id } });
  return result.rows[0];
}

async function addDecisao(id, payload = {}, user, req) {
  const anuenciaId = requireId(id);
  const decisao = normalizeEnum(payload.decisao, null);
  if (!['DEFERIDA', 'DEFERIDA_COM_CONDICIONANTES', 'INDEFERIDA', 'ARQUIVADA'].includes(decisao)) throw serviceError('Decisao invalida.', 400);
  if (decisao === 'DEFERIDA_COM_CONDICIONANTES') {
    const conds = await listByAnuencia('anuencia_condicionantes', anuenciaId);
    if (!conds.length) throw serviceError('Decisao deferida com condicionantes exige condicionante cadastrada.', 400);
  }
  const fundamentacao = cleanText(payload.fundamentacao_decisao, 6000);
  const autoridade = cleanText(payload.autoridade_responsavel, 180);
  if (!fundamentacao || !autoridade) throw serviceError('Fundamentacao e autoridade responsavel sao obrigatorias.', 400);
  const result = await db.query(
    `
      INSERT INTO anuencia_decisoes (anuencia_id, decisao, fundamentacao_decisao, autoridade_responsavel, decidido_por)
      VALUES ($1,$2,$3,$4,$5) RETURNING *;
    `,
    [anuenciaId, decisao, fundamentacao, autoridade, getUserId(user)]
  );
  await db.query('UPDATE anuencias_ambientais SET status = $1, atualizado_por = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3;', [decisao, getUserId(user), anuenciaId]);
  await audit({ anuenciaId, acao: 'anuencia.decisao.create', descricao: 'Decisao administrativa registrada.', user, req, statusNovo: decisao, dados: { decisao_id: result.rows[0].id, decisao } });
  return result.rows[0];
}

async function assertCanEmitir(anuenciaId) {
  const anuencia = await getAnuencia(anuenciaId);
  if (!anuencia) return { error: serviceError('Anuencia nao encontrada.', 404) };
  const interessados = await listByAnuencia('anuencia_interessados', anuenciaId);
  if (!interessados.length) throw serviceError('Emissao bloqueada: interessado obrigatorio.', 400);
  if (!anuencia.finalidade) throw serviceError('Emissao bloqueada: finalidade obrigatoria.', 400);
  if (!anuencia.geo_localizacao_id && !anuencia.justificativa_ausencia_geo) throw serviceError('Emissao bloqueada: informe localizacao geoambiental ou justificativa tecnica de ausencia.', 400);
  const analises = await listByAnuencia('anuencia_analises_tecnicas', anuenciaId);
  if (!analises.length) throw serviceError('Emissao bloqueada: analise tecnica obrigatoria.', 400);
  const decisoes = await listByAnuencia('anuencia_decisoes', anuenciaId);
  if (!decisoes.length) throw serviceError('Emissao bloqueada: decisao administrativa obrigatoria.', 400);
  const decisao = decisoes[0];
  if (decisao.decisao === 'INDEFERIDA') throw serviceError('Emissao de anuencia indeferida nao gera documento de anuencia.', 400);
  if (decisao.decisao === 'DEFERIDA_COM_CONDICIONANTES') {
    const conds = await listByAnuencia('anuencia_condicionantes', anuenciaId);
    if (!conds.length) throw serviceError('Emissao bloqueada: condicionantes obrigatorias para decisao condicionada.', 400);
  }
  return { anuencia, interessados, analises, decisoes };
}

async function emitir(id, payload = {}, user, req) {
  const anuenciaId = requireId(id);
  const { anuencia, interessados, analises, decisoes } = await assertCanEmitir(anuenciaId);
  const condicionantes = await listByAnuencia('anuencia_condicionantes', anuenciaId);
  const autoridade = cleanText(payload.autoridade_responsavel, 180) || decisoes[0].autoridade_responsavel;
  const numero = buildCodigo('SIGMA-ANU-EMISSAO');
  const texto = [
    'SMAD-demo - Anuencia Ambiental Municipal',
    `Numero da anuencia: ${numero}`,
    `Processo/protocolo: ${anuencia.numero_processo || '-'} / ${anuencia.numero_protocolo || '-'}`,
    `Interessado: ${interessados[0].nome_razao_social}`,
    `Finalidade: ${anuencia.finalidade}`,
    `Localizacao: ${anuencia.resumo_geoambiental || anuencia.justificativa_ausencia_geo || '-'}`,
    `Fundamentacao tecnica resumida: ${analises[0].parecer_resumido}`,
    condicionantes.length ? `Condicionantes: ${condicionantes.map((item, index) => `${index + 1}. ${item.descricao}`).join(' ')}` : 'Condicionantes: nao aplicavel.',
    'Ressalva: esta anuencia nao substitui licenca ambiental, autorizacao de supressao, outorga, alvara, aprovacao urbanistica ou demais atos de competencia de outros orgaos.',
    `Autoridade responsavel: ${autoridade}`,
    `Data de emissao: ${new Date().toLocaleDateString('pt-BR')}`,
  ].join('\n');
  const result = await db.query(
    'INSERT INTO anuencia_emissoes (anuencia_id, numero_emissao, texto_emissao, emitido_por, autoridade_responsavel) VALUES ($1,$2,$3,$4,$5) RETURNING *;',
    [anuenciaId, numero, texto, getUserId(user), autoridade]
  );
  await audit({ anuenciaId, acao: 'anuencia.emissao.create', descricao: 'Emissao textual interna registrada.', user, req, dados: { emissao_id: result.rows[0].id, numero_emissao: numero } });
  return result.rows[0];
}

async function getHistorico(id) {
  return listByAnuencia('anuencia_historico', id);
}

async function getDashboardResumo() {
  const total = await db.query('SELECT COUNT(*)::int AS total FROM anuencias_ambientais;');
  const byStatus = await db.query('SELECT status, COUNT(*)::int AS total FROM anuencias_ambientais GROUP BY status ORDER BY status;');
  const byTipo = await db.query('SELECT tipo_anuencia, COUNT(*)::int AS total FROM anuencias_ambientais GROUP BY tipo_anuencia ORDER BY tipo_anuencia;');
  const byDistrito = await db.query("SELECT COALESCE(distrito, 'Nao informado') AS distrito, COUNT(*)::int AS total FROM anuencias_ambientais GROUP BY COALESCE(distrito, 'Nao informado') ORDER BY total DESC;");
  const movs = await db.query('SELECT * FROM anuencia_historico ORDER BY created_at DESC, id DESC LIMIT 10;');
  const counts = Object.fromEntries(byStatus.rows.map((row) => [row.status, row.total]));
  return {
    total: total.rows[0].total,
    por_status: byStatus.rows,
    por_tipo: byTipo.rows,
    por_distrito: byDistrito.rows,
    pendentes: (counts.RASCUNHO || 0) + (counts.PROTOCOLADA || 0) + (counts.EM_TRIAGEM || 0),
    aguardando_complementacao: counts.AGUARDANDO_COMPLEMENTACAO || 0,
    em_analise_tecnica: counts.EM_ANALISE_TECNICA || 0,
    deferidas: counts.DEFERIDA || 0,
    deferidas_com_condicionantes: counts.DEFERIDA_COM_CONDICIONANTES || 0,
    indeferidas: counts.INDEFERIDA || 0,
    arquivadas: counts.ARQUIVADA || 0,
    ultimas_movimentacoes: movs.rows,
  };
}

module.exports = {
  listAnuencias,
  getAnuencia,
  createAnuencia,
  updateAnuencia,
  addInteressado,
  listInteressados: (id) => listByAnuencia('anuencia_interessados', id),
  addDocumento,
  listDocumentos: (id) => listByAnuencia('anuencia_documentos', id),
  conferirDocumento,
  addAnalise,
  listAnalises: (id) => listByAnuencia('anuencia_analises_tecnicas', id),
  addPendencia,
  updatePendencia,
  addCondicionante,
  listCondicionantes: (id) => listByAnuencia('anuencia_condicionantes', id),
  addDecisao,
  emitir,
  getHistorico,
  getDashboardResumo,
};
