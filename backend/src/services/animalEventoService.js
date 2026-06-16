const db = require('../config/db');
const auditService = require('./auditService');

function toJsonb(value, fallback = {}) {
  return JSON.stringify(value ?? fallback);
}

exports.findByAnimal = async (animalId) => {
  const result = await db.query(
    `
      SELECT
        e.*,
        u.nome AS created_by_nome
      FROM animal_eventos e
      LEFT JOIN usuarios_internos u ON u.id = e.created_by_interno_id
      WHERE e.animal_id = $1
      ORDER BY e.data_evento DESC, e.id DESC;
    `,
    [animalId]
  );

  return result.rows;
};

exports.create = async (data, actor = null) => {
  const result = await db.query(
    `
      INSERT INTO animal_eventos (
        animal_id,
        tutor_id,
        campanha_inscricao_id,
        tipo,
        titulo,
        descricao,
        data_evento,
        dados,
        created_by_interno_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP), $8::jsonb, $9)
      RETURNING *;
    `,
    [
      data.animal_id,
      data.tutor_id || null,
      data.campanha_inscricao_id || null,
      data.tipo,
      data.titulo,
      data.descricao || null,
      data.data_evento || null,
      toJsonb(data.dados),
      actor?.id || data.created_by_interno_id || null
    ]
  );

  const evento = result.rows[0];

  await auditService.log({
    ator_tipo: actor ? 'interno' : 'sistema',
    ator_id: actor?.id || null,
    acao: 'criar_evento_animal',
    entidade: 'animal_eventos',
    entidade_id: evento.id,
    dados: {
      animal_id: evento.animal_id,
      tipo: evento.tipo,
      titulo: evento.titulo
    }
  });

  return evento;
};
