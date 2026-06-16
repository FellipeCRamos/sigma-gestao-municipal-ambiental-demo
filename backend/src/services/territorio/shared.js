const db = require('../../config/db');
const auditService = require('../auditService');

const ORIGEM_CATALOGO = 'catalogo';
const ORIGEM_LEGADO = 'legado_textual';
const ORIGEM_NAO_INFORMADO = 'nao_informado';

const TERRITORIO_CATEGORIAS = new Set(['bairro', 'localidade', 'distrito', 'rural', 'outro']);
const TERRITORIO_STATUS = new Set(['ativo', 'inativo']);
const TERRITORIO_ORIGENS = new Set(['oficial', 'legado_importado', 'manual']);
const ALIAS_STATUS = new Set(['ativo', 'inativo']);
const REVIEW_DECISOES = new Set(['classificado', 'mantido_legado', 'nao_informado']);
const REVIEW_MODULOS = new Set(['animal', 'tutor', 'ocorrencia', 'campanha_inscricao']);

const TARGETS = {
  animal: {
    table: 'animais',
    entity: 'animal',
    legacyValue: 'bairro',
    hasBairro: true,
    where: "COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')"
  },
  tutor: {
    table: 'tutores',
    entity: 'tutor',
    legacyValue: 'bairro',
    hasBairro: true,
    where: "COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')"
  },
  ocorrencia: {
    table: 'animal_ocorrencias',
    entity: 'ocorrencia',
    legacyValue: 'bairro',
    hasBairro: true,
    where: 'true'
  },
  campanha_inscricao: {
    table: 'campanha_inscricoes',
    entity: 'campanha_inscricao',
    legacyValue: 'animal_endereco',
    hasBairro: false,
    where: 'true'
  }
};

function normalizeTerritorioName(value) {
  if (value === undefined || value === null) return '';

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeDisplayName(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim().replace(/\s+/g, ' ');
  return normalized || null;
}

function parsePositiveId(value) {
  if (value === undefined || value === null || value === '') return null;

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function parseNullablePositiveId(value, fieldName) {
  const parsed = parsePositiveId(value);

  if (parsed === undefined) {
    throw createValidationError(`${fieldName} invalido.`);
  }

  return parsed;
}

function parseNullableInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw createValidationError(`${fieldName} invalido.`);
  }

  return parsed;
}

function createValidationError(message, statusCode = 400, code = 'SIGBA_TERRITORIO_VALIDATION') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function createInvalidTerritorioError() {
  return createValidationError('Territorio invalido ou inativo.', 400, 'SIGBA_TERRITORIO_INVALIDO');
}

function ensureCategoria(value) {
  const categoria = normalizeTerritorioName(value || 'bairro');

  if (!TERRITORIO_CATEGORIAS.has(categoria)) {
    throw createValidationError('Categoria territorial invalida.');
  }

  return categoria;
}

function ensureStatus(value, allowed = TERRITORIO_STATUS) {
  const status = normalizeTerritorioName(value || 'ativo');

  if (!allowed.has(status)) {
    throw createValidationError('Status territorial invalido.');
  }

  return status;
}

function ensureOrigem(value) {
  const origem = normalizeTerritorioName(value || 'manual');

  if (!TERRITORIO_ORIGENS.has(origem)) {
    throw createValidationError('Origem territorial invalida.');
  }

  return origem;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  return Boolean(value);
}

function getActorId(actor) {
  return actor?.id || actor?.usuario_id || null;
}

function buildAliasAggregate() {
  return `
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', ta.id,
          'alias', ta.alias,
          'alias_normalizado', ta.alias_normalizado,
          'status', ta.status,
          'observacoes', ta.observacoes,
          'created_at', ta.created_at,
          'updated_at', ta.updated_at
        )
      ) FILTER (WHERE ta.id IS NOT NULL),
      '[]'::jsonb
    ) AS aliases_controlados
  `;
}

function mapTerritorioRow(row) {
  if (!row) return null;

  return {
    ...row,
    aliases_controlados: Array.isArray(row.aliases_controlados) ? row.aliases_controlados : [],
  };
}

async function getTerritorioById(id, { incluir_inativos = false, client = db } = {}) {
  const result = await client.query(
    `
      SELECT
        t.id,
        t.municipio_id,
        m.nome AS municipio_nome,
        t.nome,
        t.nome_normalizado,
        t.categoria,
        t.aliases,
        t.origem,
        t.status,
        t.ordem_exibicao,
        t.observacoes,
        t.homologado,
        t.homologado_em,
        t.homologado_por,
        t.created_at,
        t.updated_at,
        ${buildAliasAggregate()}
      FROM territorios t
      LEFT JOIN municipios m ON m.id = t.municipio_id
      LEFT JOIN territorio_aliases ta ON ta.territorio_id = t.id
      WHERE t.id = $1
        AND ($2::boolean = true OR t.status = 'ativo')
      GROUP BY t.id, m.nome;
    `,
    [id, Boolean(incluir_inativos)]
  );

  return mapTerritorioRow(result.rows[0] || null);
}

async function findById(id) {
  return getTerritorioById(id, { incluir_inativos: false });
}

async function findByName(nome, municipioId = null) {
  const nomeNormalizado = normalizeTerritorioName(nome);

  if (!nomeNormalizado) {
    return null;
  }

  const result = await db.query(
    `
      SELECT
        t.id,
        t.municipio_id,
        t.nome,
        t.nome_normalizado,
        t.categoria,
        t.aliases,
        t.origem,
        t.status,
        CASE WHEN t.nome_normalizado = $1 THEN 0 ELSE 1 END AS match_priority,
        ta.id AS alias_match_id,
        ta.alias AS alias_match
      FROM territorios t
      LEFT JOIN territorio_aliases ta
        ON ta.territorio_id = t.id
       AND ta.status = 'ativo'
       AND ta.alias_normalizado = $1
      WHERE t.status = 'ativo'
        AND (
          t.nome_normalizado = $1
          OR ta.id IS NOT NULL
        )
        AND (
          $2::int IS NULL
          OR t.municipio_id = $2::int
          OR t.municipio_id IS NULL
        )
      ORDER BY
        CASE WHEN t.nome_normalizado = $1 THEN 0 ELSE 1 END,
        CASE WHEN t.municipio_id = $2::int THEN 0 ELSE 1 END,
        t.nome ASC
      LIMIT 1;
    `,
    [nomeNormalizado, municipioId]
  );

  return result.rows[0] || null;
}

async function assertAliasNotAmbiguous(aliasNormalizado, territorioId, client = db) {
  const result = await client.query(
    `
      SELECT 'territorio' AS tipo, id, nome AS label
      FROM territorios
      WHERE status = 'ativo'
        AND nome_normalizado = $1
        AND id <> $2

      UNION ALL

      SELECT 'alias' AS tipo, id, alias AS label
      FROM territorio_aliases
      WHERE status = 'ativo'
        AND alias_normalizado = $1
        AND territorio_id <> $2
      LIMIT 1;
    `,
    [aliasNormalizado, territorioId]
  );

  if (result.rows[0]) {
    throw createValidationError(
      'Alias territorial ja esta vinculado a outro territorio ativo.',
      409,
      'SIGBA_TERRITORIO_ALIAS_CONFLITO'
    );
  }
}

async function enrichTerritorioPayload(data = {}, options = {}) {
  const territorioId = parsePositiveId(data.territorio_id);
  const municipioId = parsePositiveId(data.municipio_id) || options.municipio_id || null;
  const bairro = normalizeDisplayName(data.bairro);

  if (territorioId === undefined) {
    throw createInvalidTerritorioError();
  }

  if (territorioId) {
    const territorio = await findById(territorioId);

    if (!territorio) {
      throw createInvalidTerritorioError();
    }

    return {
      ...data,
      bairro: territorio.nome,
      territorio_id: territorio.id,
      territorio_origem: ORIGEM_CATALOGO,
      territorio_nome: territorio.nome,
      territorio_categoria: territorio.categoria
    };
  }

  const territorio = await findByName(bairro, municipioId);

  if (territorio) {
    return {
      ...data,
      bairro: territorio.nome,
      territorio_id: territorio.id,
      territorio_origem: ORIGEM_CATALOGO,
      territorio_nome: territorio.nome,
      territorio_categoria: territorio.categoria,
      territorio_alias_match_id: territorio.alias_match_id || null
    };
  }

  return {
    ...data,
    bairro,
    territorio_id: null,
    territorio_origem: bairro ? ORIGEM_LEGADO : ORIGEM_NAO_INFORMADO,
    territorio_nome: null,
    territorio_categoria: null
  };
}


module.exports = {
  db,
  auditService,
  ORIGEM_CATALOGO,
  ORIGEM_LEGADO,
  ORIGEM_NAO_INFORMADO,
  TERRITORIO_CATEGORIAS,
  TERRITORIO_STATUS,
  TERRITORIO_ORIGENS,
  ALIAS_STATUS,
  REVIEW_DECISOES,
  REVIEW_MODULOS,
  TARGETS,
  normalizeTerritorioName,
  normalizeDisplayName,
  parsePositiveId,
  parseNullablePositiveId,
  parseNullableInteger,
  createValidationError,
  createInvalidTerritorioError,
  ensureCategoria,
  ensureStatus,
  ensureOrigem,
  toBoolean,
  getActorId,
  buildAliasAggregate,
  mapTerritorioRow,
  getTerritorioById,
  findById,
  findByName,
  assertAliasNotAmbiguous,
  enrichTerritorioPayload,
};
