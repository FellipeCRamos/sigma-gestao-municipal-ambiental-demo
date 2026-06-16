const db = require('../../config/db');
const auditService = require('../auditService');

const ORIGENS = new Set(['orgao_ambiental', 'tutor_declarado', 'campanha', 'legado_jsonb']);
const STATUS = new Set(['registrado', 'comprovado', 'pendente_comprovacao', 'vencido', 'cancelado']);

function normalizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return text.slice(0, 10);
}

function isBeforeToday(value) {
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function daysUntil(value) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function getSituacaoCalculada(row) {
  if (!row) return 'sem_registro';
  if (row.status_registro === 'cancelado') return 'cancelada';
  if (row.status_registro === 'pendente_comprovacao') return 'pendente_comprovacao';
  if (row.status_registro === 'vencido') return 'vencida';
  if (row.proxima_dose_em && isBeforeToday(row.proxima_dose_em)) return 'vencida';
  if (!row.data_aplicacao) return 'sem_data_aplicacao';
  return row.status_registro === 'comprovado' ? 'comprovada' : 'registrada';
}

function decorateRecord(row) {
  if (!row) return row;
  return {
    ...row,
    situacao_calculada: getSituacaoCalculada(row),
    dias_para_proxima_dose: daysUntil(row.proxima_dose_em)
  };
}

function hasOwn(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload || {}, key);
}

function normalizePayload(data = {}, defaults = {}) {
  const origem = normalizeOptionalString(data.origem_registro) || defaults.origem_registro || 'orgao_ambiental';
  const status =
    normalizeOptionalString(data.status_registro) ||
    defaults.status_registro ||
    (origem === 'tutor_declarado' ? 'pendente_comprovacao' : 'registrado');

  if (!ORIGENS.has(origem)) {
    const error = new Error('Origem do registro vacinal invalida.');
    error.statusCode = 400;
    throw error;
  }

  if (!STATUS.has(status)) {
    const error = new Error('Status do registro vacinal invalido.');
    error.statusCode = 400;
    throw error;
  }

  return {
    vacina_catalogo_id: data.vacina_catalogo_id ? Number(data.vacina_catalogo_id) : null,
    vacina_codigo: normalizeOptionalString(data.vacina_codigo),
    vacina_nome: normalizeOptionalString(data.vacina_nome),
    vacina_nome_popular: normalizeOptionalString(data.vacina_nome_popular),
    especie: normalizeOptionalString(data.especie),
    dose: normalizeOptionalString(data.dose),
    data_aplicacao: toDateOnly(data.data_aplicacao),
    proxima_dose_em: toDateOnly(data.proxima_dose_em),
    lote: normalizeOptionalString(data.lote),
    fabricante: normalizeOptionalString(data.fabricante),
    origem_registro: origem,
    status_registro: status,
    fonte_lancamento: normalizeOptionalString(data.fonte_lancamento) || defaults.fonte_lancamento || null,
    campanha_id: data.campanha_id ? Number(data.campanha_id) : null,
    campanha_inscricao_id: data.campanha_inscricao_id ? Number(data.campanha_inscricao_id) : null,
    campanha_vacinacao_item_id: data.campanha_vacinacao_item_id ? Number(data.campanha_vacinacao_item_id) : null,
    documento_id: data.documento_id ? Number(data.documento_id) : null,
    observacoes: normalizeOptionalString(data.observacoes)
  };
}

async function findAnimal(animalId) {
  const result = await db.query(
    `
      SELECT
        a.id,
        a.nome,
        a.especie,
        a.raca,
        a.sexo,
        a.porte,
        a.cor,
        a.data_nascimento,
        a.status,
        a.microchip,
        a.castrado,
        a.vacinado,
        a.public_id,
        a.perfil_publico_ativo,
        a.bairro,
        a.endereco_referencia,
        a.territorio_id,
        a.territorio_origem,
        tr.nome AS territorio_nome,
        tr.categoria AS territorio_categoria,
        a.confiabilidade_score,
        a.confiabilidade_nivel,
        a.confiabilidade_pendencias,
        a.vacinas,
        a.alerta_vacinal,
        a.tutor_id
      FROM animais a
      LEFT JOIN territorios tr ON tr.id = a.territorio_id
      WHERE a.id = $1;
    `,
    [animalId]
  );

  return result.rows[0] || null;
}

async function findCatalogoById(id) {
  if (!id) return null;

  const result = await db.query(
    `
      SELECT *
      FROM vacina_catalogo
      WHERE id = $1
        AND status = 'ativo';
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findCampanhaInscricaoForAnimal(animalId, inscricaoId) {
  if (!inscricaoId) return null;

  const result = await db.query(
    `
      SELECT
        i.id,
        i.campanha_id,
        i.protocolo,
        i.animal_id,
        c.nome AS campanha_nome
      FROM campanha_inscricoes i
      JOIN campanhas c ON c.id = i.campanha_id
      WHERE i.id = $1
        AND i.animal_id = $2;
    `,
    [inscricaoId, animalId]
  );

  return result.rows[0] || null;
}

async function findDocumentoForAnimal(animalId, documentoId) {
  if (!documentoId) return null;

  const result = await db.query(
    `
      SELECT
        d.id,
        d.inscricao_id,
        d.tipo,
        d.nome_original,
        d.mime_type,
        d.tamanho_bytes,
        d.created_at,
        i.campanha_id,
        i.protocolo,
        c.nome AS campanha_nome
      FROM campanha_documentos d
      JOIN campanha_inscricoes i ON i.id = d.inscricao_id
      JOIN campanhas c ON c.id = i.campanha_id
      WHERE d.id = $1
        AND i.animal_id = $2;
    `,
    [documentoId, animalId]
  );

  return result.rows[0] || null;
}

async function findDocumentosComprovantesByAnimal(animalId) {
  const result = await db.query(
    `
      SELECT
        d.id,
        d.inscricao_id,
        d.tipo,
        d.nome_original,
        d.mime_type,
        d.tamanho_bytes,
        d.created_at,
        i.protocolo,
        i.campanha_id,
        c.nome AS campanha_nome
      FROM campanha_documentos d
      JOIN campanha_inscricoes i ON i.id = d.inscricao_id
      JOIN campanhas c ON c.id = i.campanha_id
      WHERE i.animal_id = $1
      ORDER BY d.created_at DESC, d.id DESC;
    `,
    [animalId]
  );

  return result.rows;
}

async function enrichCampanhaDocumentos(animalId, data) {
  const next = { ...data };

  if (next.documento_id) {
    const documento = await findDocumentoForAnimal(animalId, next.documento_id);

    if (!documento) {
      const error = new Error('Comprovante nao encontrado para este animal.');
      error.statusCode = 400;
      throw error;
    }

    next.campanha_inscricao_id = next.campanha_inscricao_id || documento.inscricao_id;
    next.campanha_id = next.campanha_id || documento.campanha_id;

    if (next.status_registro === 'registrado') {
      next.status_registro = 'comprovado';
    }
  }

  if (next.campanha_inscricao_id) {
    const inscricao = await findCampanhaInscricaoForAnimal(animalId, next.campanha_inscricao_id);

    if (!inscricao) {
      const error = new Error('Inscricao de campanha nao encontrada para este animal.');
      error.statusCode = 400;
      throw error;
    }

    next.campanha_id = next.campanha_id || inscricao.campanha_id;
  }

  return next;
}

async function insertTimelineEvent(vacinacao, actor) {
  await db.query(
    `
      INSERT INTO animal_eventos (
        animal_id,
        campanha_inscricao_id,
        tipo,
        titulo,
        descricao,
        data_evento,
        dados,
        created_by_interno_id
      )
      VALUES ($1, $2, 'vacina', $3, $4, COALESCE($5::timestamp, CURRENT_TIMESTAMP), $6::jsonb, $7);
    `,
    [
      vacinacao.animal_id,
      vacinacao.campanha_inscricao_id || null,
      `Registro vacinal: ${vacinacao.vacina_nome}`,
      vacinacao.observacoes || 'Registro estruturado na carteira vacinal.',
      vacinacao.data_aplicacao || null,
      JSON.stringify({
        vacinacao_id: vacinacao.id,
        vacina_codigo: vacinacao.vacina_codigo,
        origem_registro: vacinacao.origem_registro,
        status_registro: vacinacao.status_registro,
        proxima_dose_em: vacinacao.proxima_dose_em
      }),
      actor?.id || null
    ]
  );
}


module.exports = {
  db,
  auditService,
  ORIGENS,
  STATUS,
  normalizeString,
  normalizeOptionalString,
  toDateOnly,
  isBeforeToday,
  daysUntil,
  getSituacaoCalculada,
  decorateRecord,
  hasOwn,
  normalizePayload,
  findAnimal,
  findCatalogoById,
  findCampanhaInscricaoForAnimal,
  findDocumentoForAnimal,
  findDocumentosComprovantesByAnimal,
  enrichCampanhaDocumentos,
  insertTimelineEvent,
};
