const db = require('../config/db');
const {
  PUBLIC_GOVERNANCE_SUMMARY,
  TERMOS_USO,
  POLITICA_PRIVACIDADE,
  DATA_CLASSIFICATION_LEVELS,
} = require('../config/governance');
const biTerritorialService = require('./biTerritorialService');

function buildActiveStatusFilter(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(${prefix}status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')`;
}

const ACTIVE_ANIMAL_FILTER = buildActiveStatusFilter();
const ACTIVE_ANIMAL_FILTER_A = buildActiveStatusFilter('a');

function buildPublicIdAliases(publicId) {
  const normalized = String(publicId || '').trim();
  const aliases = new Set([normalized]);

  if (normalized.startsWith('SIGMA-ANIMAL-')) {
    aliases.add(normalized.replace('SIGMA-ANIMAL-', 'SIGBA-ANIMAL-'));
  }

  if (normalized.startsWith('SIGBA-ANIMAL-')) {
    aliases.add(normalized.replace('SIGBA-ANIMAL-', 'SIGMA-ANIMAL-'));
  }

  return [...aliases].filter(Boolean);
}

exports.getIndicadoresPublicos = async () => {
  const indicadoresResult = await db.query(`
    SELECT
      COUNT(*)::int AS animais,
      COUNT(*) FILTER (WHERE especie = 'canino')::int AS caninos,
      COUNT(*) FILTER (WHERE especie = 'felino')::int AS felinos,
      COUNT(*) FILTER (WHERE castrado = true)::int AS castrados,
      COUNT(*) FILTER (
        WHERE vacinado = true
           OR EXISTS (
            SELECT 1
            FROM animal_vacinacoes av
            WHERE av.animal_id = animais.id
              AND av.status_registro <> 'cancelado'
          )
      )::int AS vacinados,
      COUNT(*) FILTER (WHERE microchip IS NOT NULL AND TRIM(microchip) <> '')::int AS microchipados
    FROM animais
    WHERE ${ACTIVE_ANIMAL_FILTER};
  `);

  const campanhasResult = await db.query(`
    SELECT
      id,
      nome,
      descricao,
      data_inicio,
      data_fim,
      status
    FROM campanhas
    WHERE status = 'ativa'
    ORDER BY data_inicio DESC NULLS LAST, id DESC
    LIMIT 5;
  `);

  const territorialResult = await db.query(`
    SELECT
      COALESCE(ta.nome, tt.nome, NULLIF(TRIM(a.bairro), ''), NULLIF(TRIM(t.bairro), ''), 'Nao informado') AS bairro,
      COUNT(a.id)::int AS animais,
      COUNT(a.id) FILTER (WHERE a.castrado = true)::int AS castrados,
      COUNT(a.id) FILTER (
        WHERE a.vacinado = true
           OR EXISTS (
            SELECT 1
            FROM animal_vacinacoes av
            WHERE av.animal_id = a.id
              AND av.status_registro <> 'cancelado'
          )
      )::int AS vacinados,
      COUNT(a.id) FILTER (WHERE a.microchip IS NOT NULL AND TRIM(a.microchip) <> '')::int AS microchipados
    FROM animais a
    LEFT JOIN tutores t ON t.id = a.tutor_id
    LEFT JOIN territorios ta ON ta.id = a.territorio_id
    LEFT JOIN territorios tt ON tt.id = t.territorio_id
    WHERE ${ACTIVE_ANIMAL_FILTER_A}
    GROUP BY 1
    ORDER BY animais DESC, bairro ASC
    LIMIT 12;
  `);

  const ocorrenciasResult = await db.query(`
    SELECT
      tipo,
      status,
      COUNT(*)::int AS total
    FROM animal_ocorrencias
    GROUP BY tipo, status
    ORDER BY tipo, status;
  `);
  const biPublico = await biTerritorialService.getBiPublicoAgregado();

  return {
    indicadores: indicadoresResult.rows[0],
    campanhas_ativas: campanhasResult.rows,
    territorial: biPublico.territorial.length ? biPublico.territorial : territorialResult.rows,
    ocorrencias: ocorrenciasResult.rows,
    series_historicas: biPublico.series_historicas,
    cobertura_vacinal: biPublico.cobertura_vacinal,
    demanda_reprimida: biPublico.demanda_reprimida,
    metodologia_publica: biPublico.metodologia_publica,
    atualizado_em: new Date().toISOString()
  };
};

exports.getAnimalPublico = async (publicId) => {
  const publicIdAliases = buildPublicIdAliases(publicId);
  const result = await db.query(
    `
      SELECT
        public_id,
        nome,
        especie,
        raca,
        sexo,
        porte,
        cor,
        status,
        castrado,
        vacinado,
        COALESCE(tr.nome, bairro) AS bairro,
        territorio_origem,
        created_at,
        CASE WHEN microchip IS NOT NULL AND TRIM(microchip) <> '' THEN true ELSE false END AS microchipado
      FROM animais
      LEFT JOIN territorios tr ON tr.id = animais.territorio_id
      WHERE public_id = ANY($1::text[])
        AND perfil_publico_ativo = true
        AND ${ACTIVE_ANIMAL_FILTER};
    `,
    [publicIdAliases]
  );

  const animal = result.rows[0];

  if (!animal) {
    return null;
  }

  const eventosResult = await db.query(
    `
      SELECT
        tipo,
        titulo,
        descricao,
        data_evento
      FROM animal_eventos
      WHERE animal_id = (
        SELECT id
        FROM animais
        WHERE public_id = ANY($1::text[])
          AND ${ACTIVE_ANIMAL_FILTER}
      )
        AND tipo IN ('vacina', 'castracao', 'microchipagem', 'campanha', 'observacao')
        AND (
          tipo <> 'vacina'
          OR NULLIF(dados->>'vacinacao_id', '') IS NULL
          OR EXISTS (
            SELECT 1
            FROM animal_vacinacoes av
            WHERE av.id::text = dados->>'vacinacao_id'
              AND av.status_registro <> 'cancelado'
          )
        )
      ORDER BY data_evento DESC, id DESC
      LIMIT 12;
    `,
    [publicIdAliases]
  );

  const carteiraResult = await db.query(
    `
      SELECT
        av.vacina_nome,
        av.vacina_nome_popular,
        av.data_aplicacao,
        av.proxima_dose_em,
        av.origem_registro,
        av.status_registro
      FROM animal_vacinacoes av
      JOIN animais a ON a.id = av.animal_id
      WHERE a.public_id = ANY($1::text[])
        AND ${ACTIVE_ANIMAL_FILTER_A}
        AND av.status_registro <> 'cancelado'
      ORDER BY av.data_aplicacao DESC NULLS LAST, av.id DESC
      LIMIT 12;
    `,
    [publicIdAliases]
  );

  return {
    ...animal,
    eventos: eventosResult.rows,
    carteira_vacinal: carteiraResult.rows
  };
};

exports.getGovernancaPublica = async () => {
  return {
    ...PUBLIC_GOVERNANCE_SUMMARY,
    niveis_classificacao: DATA_CLASSIFICATION_LEVELS
  };
};

exports.getTermoUso = async () => TERMOS_USO;

exports.getPoliticaPrivacidade = async () => POLITICA_PRIVACIDADE;
