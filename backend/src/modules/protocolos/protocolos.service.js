const db = require('../../config/db');

function sanitizeProtocol(value = '') {
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, 80);
}

function normalizeStatus(status = '') {
  return String(status || '').replace(/_/g, ' ');
}

async function searchProtocolos(query = {}) {
  const protocolo = sanitizeProtocol(query.protocolo || query.busca || '');

  if (!protocolo) {
    return [];
  }

  const demandaResult = await db.query(
    `
      SELECT
        d.id AS entidade_id,
        d.protocolo,
        'demandas_publicas' AS modulo_origem,
        'demanda_publica' AS entidade_tipo,
        d.status,
        d.categoria,
        d.subcategoria,
        d.prioridade,
        d.data_recebimento AS criado_em,
        d.updated_at AS atualizado_em,
        d.responsavel_id,
        ui.nome AS responsavel_nome
      FROM sigma_demandas_publicas d
      LEFT JOIN usuarios_internos ui ON ui.id = d.responsavel_id
      WHERE d.deleted_at IS NULL
        AND UPPER(d.protocolo) LIKE $1
      ORDER BY d.data_recebimento DESC, d.id DESC
      LIMIT 20;
    `,
    [`%${protocolo}%`]
  );

  const fiscalizacaoResult = await db.query(
    `
      SELECT
        f.id AS entidade_id,
        f.protocolo_fiscalizacao AS protocolo,
        'fiscalizacao' AS modulo_origem,
        'fiscalizacao_ambiental' AS entidade_tipo,
        f.status,
        f.categoria,
        f.subcategoria,
        f.prioridade,
        f.created_at AS criado_em,
        f.updated_at AS atualizado_em,
        f.responsavel_id,
        ui.nome AS responsavel_nome,
        f.demanda_publica_id,
        f.protocolo_demanda
      FROM fiscalizacoes_ambientais f
      LEFT JOIN usuarios_internos ui ON ui.id = f.responsavel_id
      WHERE f.deleted_at IS NULL
        AND (
          UPPER(f.protocolo_fiscalizacao) LIKE $1
          OR UPPER(f.protocolo_demanda) LIKE $1
        )
      ORDER BY f.created_at DESC, f.id DESC
      LIMIT 20;
    `,
    [`%${protocolo}%`]
  );

  const vistoriaResult = await db.query(
    `
      SELECT
        v.id AS entidade_id,
        v.protocolo_vistoria AS protocolo,
        'fiscalizacao' AS modulo_origem,
        'vistoria_ambiental' AS entidade_tipo,
        v.status,
        f.categoria,
        f.subcategoria,
        v.prioridade,
        v.created_at AS criado_em,
        v.updated_at AS atualizado_em,
        v.responsavel_id,
        ui.nome AS responsavel_nome,
        v.fiscalizacao_id,
        v.protocolo_fiscalizacao,
        v.demanda_publica_id,
        f.protocolo_demanda
      FROM fiscalizacao_vistorias v
      INNER JOIN fiscalizacoes_ambientais f ON f.id = v.fiscalizacao_id
      LEFT JOIN usuarios_internos ui ON ui.id = v.responsavel_id
      WHERE v.deleted_at IS NULL
        AND (
          UPPER(v.protocolo_vistoria) LIKE $1
          OR UPPER(v.protocolo_fiscalizacao) LIKE $1
          OR UPPER(f.protocolo_demanda) LIKE $1
        )
      ORDER BY v.created_at DESC, v.id DESC
      LIMIT 20;
    `,
    [`%${protocolo}%`]
  );

  const relatorioResult = await db.query(
    `
      SELECT
        r.id AS entidade_id,
        r.protocolo_relatorio AS protocolo,
        'fiscalizacao' AS modulo_origem,
        'relatorio_tecnico_preliminar' AS entidade_tipo,
        r.status,
        f.categoria,
        f.subcategoria,
        'normal' AS prioridade,
        r.created_at AS criado_em,
        r.updated_at AS atualizado_em,
        r.elaborado_por_id AS responsavel_id,
        ui.nome AS responsavel_nome,
        r.fiscalizacao_id,
        v.protocolo_fiscalizacao,
        v.demanda_publica_id,
        f.protocolo_demanda,
        r.vistoria_id,
        v.protocolo_vistoria
      FROM fiscalizacao_relatorios_preliminares r
      INNER JOIN fiscalizacao_vistorias v ON v.id = r.vistoria_id
      INNER JOIN fiscalizacoes_ambientais f ON f.id = r.fiscalizacao_id
      LEFT JOIN usuarios_internos ui ON ui.id = r.elaborado_por_id
      WHERE r.deleted_at IS NULL
        AND (
          UPPER(r.protocolo_relatorio) LIKE $1
          OR UPPER(v.protocolo_vistoria) LIKE $1
          OR UPPER(v.protocolo_fiscalizacao) LIKE $1
          OR UPPER(f.protocolo_demanda) LIKE $1
        )
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 20;
    `,
    [`%${protocolo}%`]
  );

  const demandas = demandaResult.rows.map((row) => ({
    protocolo: row.protocolo,
    modulo_origem: row.modulo_origem,
    modulo_label: 'Demandas Publicas',
    entidade_tipo: row.entidade_tipo,
    entidade_id: row.entidade_id,
    status: row.status,
    status_label: normalizeStatus(row.status),
    categoria: row.categoria,
    subcategoria: row.subcategoria,
    prioridade: row.prioridade,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    responsavel_id: row.responsavel_id,
    responsavel_nome: row.responsavel_nome,
    acao: {
      tipo: 'abrir_pagina_interna',
      pagina: 'demandas-publicas',
      filtro_protocolo: row.protocolo,
    },
  }));

  const fiscalizacoes = fiscalizacaoResult.rows.map((row) => ({
    protocolo: row.protocolo,
    modulo_origem: row.modulo_origem,
    modulo_label: 'Fiscalizacao Ambiental',
    entidade_tipo: row.entidade_tipo,
    entidade_id: row.entidade_id,
    status: row.status,
    status_label: normalizeStatus(row.status),
    categoria: row.categoria,
    subcategoria: row.subcategoria,
    prioridade: row.prioridade,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    responsavel_id: row.responsavel_id,
    responsavel_nome: row.responsavel_nome,
    demanda_publica_id: row.demanda_publica_id,
    protocolo_demanda: row.protocolo_demanda,
    acao: {
      tipo: 'abrir_pagina_interna',
      pagina: 'fiscalizacao',
      filtro_protocolo: row.protocolo,
    },
  }));

  const vistorias = vistoriaResult.rows.map((row) => ({
    protocolo: row.protocolo,
    modulo_origem: row.modulo_origem,
    modulo_label: 'Vistoria Ambiental',
    entidade_tipo: row.entidade_tipo,
    entidade_id: row.entidade_id,
    status: row.status,
    status_label: normalizeStatus(row.status),
    categoria: row.categoria,
    subcategoria: row.subcategoria,
    prioridade: row.prioridade,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    responsavel_id: row.responsavel_id,
    responsavel_nome: row.responsavel_nome,
    fiscalizacao_id: row.fiscalizacao_id,
    protocolo_fiscalizacao: row.protocolo_fiscalizacao,
    demanda_publica_id: row.demanda_publica_id,
    protocolo_demanda: row.protocolo_demanda,
    acao: {
      tipo: 'abrir_pagina_interna',
      pagina: 'vistorias',
      filtro_protocolo: row.protocolo,
    },
  }));

  const relatorios = relatorioResult.rows.map((row) => ({
    protocolo: row.protocolo,
    modulo_origem: row.modulo_origem,
    modulo_label: 'Relatorio Tecnico Preliminar',
    entidade_tipo: row.entidade_tipo,
    entidade_id: row.entidade_id,
    status: row.status,
    status_label: normalizeStatus(row.status),
    categoria: row.categoria,
    subcategoria: row.subcategoria,
    prioridade: row.prioridade,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    responsavel_id: row.responsavel_id,
    responsavel_nome: row.responsavel_nome,
    fiscalizacao_id: row.fiscalizacao_id,
    protocolo_fiscalizacao: row.protocolo_fiscalizacao,
    demanda_publica_id: row.demanda_publica_id,
    protocolo_demanda: row.protocolo_demanda,
    vistoria_id: row.vistoria_id,
    protocolo_vistoria: row.protocolo_vistoria,
    acao: {
      tipo: 'abrir_pagina_interna',
      pagina: 'vistorias',
      filtro_protocolo: row.protocolo,
    },
  }));

  return [...demandas, ...fiscalizacoes, ...vistorias, ...relatorios]
    .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))
    .slice(0, 20);
}

async function getProtocolDetail(protocolo) {
  const results = await searchProtocolos({ protocolo });
  return results.find((item) => item.protocolo.toUpperCase() === sanitizeProtocol(protocolo)) || null;
}

module.exports = {
  sanitizeProtocol,
  searchProtocolos,
  getProtocolDetail,
};
