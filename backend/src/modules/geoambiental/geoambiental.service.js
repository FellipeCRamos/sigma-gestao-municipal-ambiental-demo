const db = require('../../config/db');
const auditService = require('../../services/auditService');

const TIPOS_GEOMETRIA = new Set(['PONTO', 'LINHA', 'POLIGONO', 'MULTIPOLIGONO']);
const SISTEMAS_REFERENCIA = new Set(['SIRGAS_2000_UTM', 'WGS84', 'OUTRO']);
const STATUS_LOCALIZACAO = new Set(['RASCUNHO', 'EM_ANALISE', 'VALIDADA', 'SUBSTITUIDA', 'CANCELADA', 'INATIVO']);
const SENSIBILIDADES = new Set(['NAO_SENSIVEL', 'POTENCIALMENTE_SENSIVEL', 'SENSIVEL']);
const ZONAS = new Set(['URBANA', 'RURAL', 'MISTA', 'NAO_INFORMADA']);

function serviceError(message, statusCode = 400, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function cleanText(value, max = 500) {
  if (value === undefined || value === null) return null;
  return String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) || null;
}

function normalizeEnum(value, fallback) {
  const cleaned = cleanText(value, 80);
  return cleaned ? cleaned.toUpperCase() : fallback;
}

function parseNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw serviceError(`Campo numerico invalido: ${fieldName}.`, 400, { field: fieldName });
  }

  return parsed;
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

function buildCodigo() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `SIGMA-GEO-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function validatePayload(payload = {}, { partial = false } = {}) {
  const tipo = normalizeEnum(payload.tipo_geometria, partial ? undefined : 'PONTO');
  const sistema = normalizeEnum(payload.sistema_referencia, partial ? undefined : 'WGS84');
  const status = normalizeEnum(payload.status, partial ? undefined : 'RASCUNHO');
  const sensibilidade = normalizeEnum(payload.sensibilidade_lgpd, partial ? undefined : 'NAO_SENSIVEL');
  const zona = normalizeEnum(payload.zona_urbana_rural);

  if (!partial && !cleanText(payload.titulo, 180)) {
    throw serviceError('Titulo da localizacao e obrigatorio.', 400, { field: 'titulo' });
  }

  if (tipo !== undefined && !TIPOS_GEOMETRIA.has(tipo)) {
    throw serviceError('Tipo de geometria invalido.', 400, { field: 'tipo_geometria' });
  }

  if (sistema !== undefined && !SISTEMAS_REFERENCIA.has(sistema)) {
    throw serviceError('Sistema de referencia invalido.', 400, { field: 'sistema_referencia' });
  }

  if (status !== undefined && !STATUS_LOCALIZACAO.has(status)) {
    throw serviceError('Status geoambiental invalido.', 400, { field: 'status' });
  }

  if (sensibilidade !== undefined && !SENSIBILIDADES.has(sensibilidade)) {
    throw serviceError('Sensibilidade LGPD invalida.', 400, { field: 'sensibilidade_lgpd' });
  }

  if (zona && !ZONAS.has(zona)) {
    throw serviceError('Zona urbana/rural invalida.', 400, { field: 'zona_urbana_rural' });
  }

  const latitude = parseNumber(payload.latitude, 'latitude');
  const longitude = parseNumber(payload.longitude, 'longitude');

  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    throw serviceError('Latitude fora do intervalo valido.', 400, { field: 'latitude' });
  }

  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    throw serviceError('Longitude fora do intervalo valido.', 400, { field: 'longitude' });
  }

  return {
    codigo: cleanText(payload.codigo, 80),
    titulo: cleanText(payload.titulo, 180),
    descricao: cleanText(payload.descricao, 4000),
    tipo_geometria: tipo,
    sistema_referencia: sistema,
    zona_utm: cleanText(payload.zona_utm, 20),
    coordenadas_texto: cleanText(payload.coordenadas_texto, 8000),
    latitude,
    longitude,
    area_m2: parseNumber(payload.area_m2, 'area_m2'),
    perimetro_m: parseNumber(payload.perimetro_m, 'perimetro_m'),
    distrito: cleanText(payload.distrito, 120),
    bairro_localidade: cleanText(payload.bairro_localidade, 140),
    zona_urbana_rural: zona,
    observacoes_tecnicas: cleanText(payload.observacoes_tecnicas, 4000),
    sensibilidade_lgpd: sensibilidade,
    status,
  };
}

function publicRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    titulo: row.titulo,
    descricao: row.descricao,
    tipo_geometria: row.tipo_geometria,
    sistema_referencia: row.sistema_referencia,
    zona_utm: row.zona_utm,
    coordenadas_texto: row.coordenadas_texto,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    area_m2: row.area_m2 === null ? null : Number(row.area_m2),
    perimetro_m: row.perimetro_m === null ? null : Number(row.perimetro_m),
    distrito: row.distrito,
    bairro_localidade: row.bairro_localidade,
    zona_urbana_rural: row.zona_urbana_rural,
    observacoes_tecnicas: row.observacoes_tecnicas,
    sensibilidade_lgpd: row.sensibilidade_lgpd,
    status: row.status,
    criado_por: row.criado_por,
    atualizado_por: row.atualizado_por,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function logGeo({ localizacaoId, acao, user, dados = {}, req }) {
  await db.query(
    `
      INSERT INTO geo_auditoria (geo_localizacao_id, acao, usuario_id, dados)
      VALUES ($1, $2, $3, $4::jsonb);
    `,
    [localizacaoId || null, acao, getUserId(user), JSON.stringify(dados)]
  );

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: getUserId(user),
    acao,
    entidade: 'geo_localizacoes',
    entidade_id: localizacaoId || null,
    dados,
    req,
  });
}

async function listLocalizacoes(filters = {}) {
  const values = [];
  const where = [];

  if (filters.status) {
    values.push(normalizeEnum(filters.status));
    where.push(`gl.status = $${values.length}`);
  }

  if (filters.tipo_geometria) {
    values.push(normalizeEnum(filters.tipo_geometria));
    where.push(`gl.tipo_geometria = $${values.length}`);
  }

  if (filters.modulo_origem) {
    values.push(cleanText(filters.modulo_origem, 80));
    where.push(`EXISTS (
      SELECT 1 FROM geo_vinculos gv
      WHERE gv.geo_localizacao_id = gl.id
        AND gv.modulo_origem = $${values.length}
    )`);
  }

  if (filters.busca) {
    values.push(`%${cleanText(filters.busca, 120).toUpperCase()}%`);
    where.push(`(UPPER(gl.codigo) LIKE $${values.length} OR UPPER(gl.titulo) LIKE $${values.length})`);
  }

  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  values.push(limit);

  const result = await db.query(
    `
      SELECT gl.*
      FROM geo_localizacoes gl
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY gl.created_at DESC, gl.id DESC
      LIMIT $${values.length};
    `,
    values
  );

  return result.rows.map(publicRow);
}

async function getLocalizacao(id, { user, req } = {}) {
  const result = await db.query('SELECT * FROM geo_localizacoes WHERE id = $1;', [requireId(id)]);
  const row = result.rows[0];

  if (!row) return null;

  if (row.sensibilidade_lgpd !== 'NAO_SENSIVEL') {
    await logGeo({
      localizacaoId: row.id,
      acao: 'geo.localizacao.consulta_sensivel',
      user,
      req,
      dados: { sensibilidade_lgpd: row.sensibilidade_lgpd },
    });
  }

  return publicRow(row);
}

async function createLocalizacao(payload = {}, user, req) {
  const data = validatePayload(payload);
  const codigo = data.codigo || buildCodigo();
  const result = await db.query(
    `
      INSERT INTO geo_localizacoes (
        codigo, titulo, descricao, tipo_geometria, sistema_referencia, zona_utm,
        coordenadas_texto, latitude, longitude, area_m2, perimetro_m, distrito,
        bairro_localidade, zona_urbana_rural, observacoes_tecnicas, sensibilidade_lgpd,
        status, criado_por, atualizado_por
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $18
      )
      RETURNING *;
    `,
    [
      codigo,
      data.titulo,
      data.descricao,
      data.tipo_geometria,
      data.sistema_referencia,
      data.zona_utm,
      data.coordenadas_texto,
      data.latitude,
      data.longitude,
      data.area_m2,
      data.perimetro_m,
      data.distrito,
      data.bairro_localidade,
      data.zona_urbana_rural,
      data.observacoes_tecnicas,
      data.sensibilidade_lgpd,
      data.status,
      getUserId(user),
    ]
  );

  const created = result.rows[0];
  await db.query(
    `
      INSERT INTO geo_geometrias (
        geo_localizacao_id, tipo_geometria, formato, dados, coordenadas_texto, criado_por
      )
      VALUES ($1, $2, 'TEXTO_CONTROLADO', $3::jsonb, $4, $5);
    `,
    [
      created.id,
      created.tipo_geometria,
      JSON.stringify({ latitude: data.latitude, longitude: data.longitude, area_m2: data.area_m2 }),
      data.coordenadas_texto,
      getUserId(user),
    ]
  );

  await logGeo({
    localizacaoId: created.id,
    acao: 'geo.localizacao.create',
    user,
    req,
    dados: { codigo: created.codigo, tipo_geometria: created.tipo_geometria, status: created.status },
  });

  return publicRow(created);
}

async function updateLocalizacao(id, payload = {}, user, req) {
  const localizacaoId = requireId(id);
  const beforeResult = await db.query('SELECT * FROM geo_localizacoes WHERE id = $1;', [localizacaoId]);
  const before = beforeResult.rows[0];

  if (!before) return null;

  const data = validatePayload(payload, { partial: true });
  const allowed = Object.entries(data).filter(
    ([key, value]) => Object.prototype.hasOwnProperty.call(payload, key) && value !== undefined
  );

  if (!allowed.length) {
    throw serviceError('Nenhum campo valido informado para atualizacao.', 400);
  }

  const setClauses = [];
  const values = [];

  allowed.forEach(([key, value]) => {
    values.push(value);
    setClauses.push(`${key} = $${values.length}`);
  });

  values.push(getUserId(user));
  setClauses.push(`atualizado_por = $${values.length}`);
  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  values.push(localizacaoId);

  const result = await db.query(
    `
      UPDATE geo_localizacoes
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING *;
    `,
    values
  );

  const updated = result.rows[0];

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: getUserId(user),
    acao: 'geo.localizacao.update',
    entidade: 'geo_localizacoes',
    entidade_id: localizacaoId,
    before,
    after: updated,
    req,
  });

  await db.query(
    `
      INSERT INTO geo_auditoria (geo_localizacao_id, acao, usuario_id, dados)
      VALUES ($1, 'geo.localizacao.update', $2, $3::jsonb);
    `,
    [localizacaoId, getUserId(user), JSON.stringify({ status: updated.status })]
  );

  return publicRow(updated);
}

async function createVinculo(id, payload = {}, user, req) {
  const localizacaoId = requireId(id);
  const exists = await db.query('SELECT id FROM geo_localizacoes WHERE id = $1;', [localizacaoId]);

  if (!exists.rows[0]) return null;

  const modulo = cleanText(payload.modulo_origem, 80);
  const entidadeTipo = cleanText(payload.entidade_origem_tipo, 100);
  const entidadeId = payload.entidade_origem_id ? requireId(payload.entidade_origem_id, 'entidade_origem_id') : null;
  const processoNumero = cleanText(payload.processo_numero, 100);
  const protocoloNumero = cleanText(payload.protocolo_numero, 100);
  const finalidade = cleanText(payload.finalidade_vinculo, 160);

  if (!modulo || !entidadeTipo || !finalidade) {
    throw serviceError('Modulo, entidade e finalidade do vinculo sao obrigatorios.', 400);
  }

  if (!entidadeId && !processoNumero && !protocoloNumero) {
    throw serviceError('Informe entidade, processo ou protocolo para o vinculo.', 400);
  }

  const result = await db.query(
    `
      INSERT INTO geo_vinculos (
        geo_localizacao_id, modulo_origem, entidade_origem_tipo, entidade_origem_id,
        processo_numero, protocolo_numero, finalidade_vinculo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `,
    [localizacaoId, modulo, entidadeTipo, entidadeId, processoNumero, protocoloNumero, finalidade]
  );

  await logGeo({
    localizacaoId,
    acao: 'geo.vinculo.create',
    user,
    req,
    dados: { modulo_origem: modulo, entidade_origem_tipo: entidadeTipo, protocolo_numero: protocoloNumero },
  });

  return result.rows[0];
}

async function listVinculos(id) {
  const result = await db.query(
    `
      SELECT *
      FROM geo_vinculos
      WHERE geo_localizacao_id = $1
      ORDER BY created_at DESC, id DESC;
    `,
    [requireId(id)]
  );
  return result.rows;
}

async function listCamadas() {
  const result = await db.query(
    `
      SELECT id, codigo, nome, tipo_camada, descricao, status, created_at, updated_at
      FROM geo_camadas_referencia
      ORDER BY nome ASC;
    `
  );
  return result.rows;
}

async function simularIntersecoes(payload = {}, user, req) {
  const localizacaoId = payload.geo_localizacao_id ? requireId(payload.geo_localizacao_id, 'geo_localizacao_id') : null;
  const camadaCodigos = Array.isArray(payload.camadas)
    ? payload.camadas.map((item) => cleanText(item, 80)).filter(Boolean)
    : [];

  const camadasResult = await db.query(
    `
      SELECT id, codigo, nome, tipo_camada
      FROM geo_camadas_referencia
      WHERE status = 'ATIVA'
        AND ($1::text[] IS NULL OR codigo = ANY($1::text[]))
      ORDER BY nome ASC;
    `,
    [camadaCodigos.length ? camadaCodigos : null]
  );

  let localizacao = null;
  if (localizacaoId) {
    const locResult = await db.query('SELECT * FROM geo_localizacoes WHERE id = $1;', [localizacaoId]);
    localizacao = locResult.rows[0] || null;
    if (!localizacao) {
      throw serviceError('Localizacao geoambiental nao encontrada.', 404);
    }
  }

  const texto = [
    payload.coordenadas_texto,
    localizacao?.coordenadas_texto,
    localizacao?.titulo,
    localizacao?.descricao,
    localizacao?.bairro_localidade,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  const results = [];

  for (const camada of camadasResult.rows) {
    const normalizedName = `${camada.codigo} ${camada.nome} ${camada.tipo_camada}`.toUpperCase();
    const possible = texto && normalizedName.split(/[\s_/]+/).some((token) => token.length >= 4 && texto.includes(token));
    const resultado = possible ? 'POSSIVEL_INTERSECAO' : 'INDETERMINADO';
    const observacao = possible
      ? 'Simulacao textual preliminar indicou possivel relacao. Requer motor GIS e validacao tecnica.'
      : 'Sem motor GIS real nesta sprint. Resultado indeterminado e apenas interno/preliminar.';

    const insertResult = await db.query(
      `
        INSERT INTO geo_intersecoes (
          geo_localizacao_id, camada_referencia_id, camada_codigo, resultado, observacao, criado_por
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `,
      [localizacaoId, camada.id, camada.codigo, resultado, observacao, getUserId(user)]
    );

    results.push({
      ...insertResult.rows[0],
      camada_nome: camada.nome,
      aviso: 'Analise preliminar interna, sem valor conclusivo e sem emissao de ato administrativo.',
    });
  }

  await logGeo({
    localizacaoId,
    acao: 'geo.intersecoes.simular',
    user,
    req,
    dados: { total_camadas: results.length, metodo: 'SIMULACAO_PRELIMINAR_SEM_MOTOR_GIS' },
  });

  return {
    metodo: 'SIMULACAO_PRELIMINAR_SEM_MOTOR_GIS',
    conclusivo: false,
    aviso: 'Simulacao interna preliminar. Nao substitui analise tecnica, vistoria, licenciamento ou anuencia.',
    items: results,
  };
}

module.exports = {
  listLocalizacoes,
  getLocalizacao,
  createLocalizacao,
  updateLocalizacao,
  createVinculo,
  listVinculos,
  listCamadas,
  simularIntersecoes,
};
