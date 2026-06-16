const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../../config/db');
const auditService = require('../auditService');
const animalVacinaService = require('../animalVacinaService');
const historicoOperacionalService = require('../operacaoHistoricoService');
const notificacaoOperacionalService = require('../operacaoNotificacaoService');
const workflowService = require('../operacaoWorkflowService');
const territorioService = require('../territorioService');
const webPushService = require('../webPushService');
const logger = require('../../utils/logger');

const ACTIVE_TUTOR_FILTER = "COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')";
const ACTIVE_ANIMAL_FILTER = "COALESCE(status_cadastral, 'ativo') NOT IN ('mesclado', 'inativo')";

function toJsonb(value, fallback = []) {
  return JSON.stringify(value ?? fallback);
}

function generateProtocolo() {
  const year = new Date().getFullYear();
  const suffix = Date.now().toString(36).toUpperCase();
  return `SIGMA-${year}-${suffix}`;
}

function getPorteByPeso(peso) {
  const value = Number(peso);

  if (!Number.isFinite(value) || value <= 0) return null;
  if (value <= 10) return 'pequeno';
  if (value <= 20) return 'medio';
  return 'grande';
}

function sanitizeDocumento(documento) {
  if (!documento) return null;

  const { caminho_arquivo, file_hash_sha256, ...safeDocumento } = documento;
  return safeDocumento;
}

function getFileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function buildStatusNotification(inscricao) {
  const status = inscricao.status;

  const messages = {
    em_analise: {
      titulo: 'Inscricao em analise',
      mensagem: `A inscricao ${inscricao.protocolo} esta em analise pela SMAD.`
    },
    pre_selecionado: {
      titulo: 'Inscricao pre-selecionada',
      mensagem: `A inscricao ${inscricao.protocolo} foi pre-selecionada para a campanha.`
    },
    agendado: {
      titulo: 'Atendimento agendado',
      mensagem: inscricao.agendamento_data
        ? `A inscricao ${inscricao.protocolo} foi agendada para ${new Date(inscricao.agendamento_data).toLocaleString('pt-BR')}.`
        : `A inscricao ${inscricao.protocolo} foi marcada como agendada.`
    },
    pendente_documentacao: {
      titulo: 'Pendencia na inscricao',
      mensagem: `A inscricao ${inscricao.protocolo} esta com pendencia de informacao ou documento.`
    },
    atendido: {
      titulo: 'Atendimento confirmado',
      mensagem: `O atendimento da inscricao ${inscricao.protocolo} foi confirmado.`
    },
    indeferido: {
      titulo: 'Inscricao indeferida',
      mensagem: `A inscricao ${inscricao.protocolo} foi indeferida pela triagem da SMAD.`
    },
    ausente: {
      titulo: 'Ausencia registrada',
      mensagem: `Foi registrada ausencia no atendimento da inscricao ${inscricao.protocolo}.`
    },
    cancelado: {
      titulo: 'Inscricao cancelada',
      mensagem: `A inscricao ${inscricao.protocolo} foi cancelada.`
    }
  };

  return messages[status] || {
    titulo: 'Atualizacao de inscricao',
    mensagem: `A inscricao ${inscricao.protocolo} foi atualizada.`
  };
}

function getNotificationMetadata(inscricao) {
  const requerAcao = ['pendente_documentacao', 'agendado'].includes(inscricao.status);
  const prioridade = inscricao.status === 'pendente_documentacao' ? 'alta' : 'normal';

  return {
    tipo: 'inscricao_status',
    prioridade,
    requer_acao: requerAcao,
    link_url: '/?view=portal#portal-notificacoes',
    metadata: {
      categoria_preferencia: 'inscricoes',
      comunicacao_essencial: requerAcao,
      status: inscricao.status,
      protocolo: inscricao.protocolo
    }
  };
}

async function createNotification(client, usuarioId, payload) {
  const result = await client.query(
    `
      INSERT INTO notificacoes (
        usuario_id,
        titulo,
        mensagem,
        ref_tipo,
        ref_id,
        tipo,
        prioridade,
        requer_acao,
        link_url,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING *;
    `,
    [
      usuarioId,
      payload.titulo,
      payload.mensagem,
      payload.ref_tipo || null,
      payload.ref_id || null,
      payload.tipo || 'operacional',
      payload.prioridade || 'normal',
      payload.requer_acao === true,
      payload.link_url || null,
      JSON.stringify(payload.metadata || {})
    ]
  );

  return result.rows[0];
}

async function ensureTutorFromInscricao(client, inscricao) {
  if (inscricao.tutor_id) {
    return inscricao.tutor_id;
  }

  const userResult = await client.query(
    `
      SELECT *
      FROM usuarios_externos
      WHERE id = $1;
    `,
    [inscricao.usuario_id]
  );

  const usuario = userResult.rows[0];

  if (!usuario) {
    return null;
  }

  const linkedResult = await client.query(
    `
      SELECT id
      FROM tutores
      WHERE usuario_externo_id = $1
        AND ${ACTIVE_TUTOR_FILTER}
      LIMIT 1;
    `,
    [usuario.id]
  );

  if (linkedResult.rows[0]) {
    return linkedResult.rows[0].id;
  }

  let existingTutor = null;

  if (usuario.cpf) {
    const cpfResult = await client.query(
      `
        SELECT id
        FROM tutores
        WHERE cpf = $1
          AND ${ACTIVE_TUTOR_FILTER}
        LIMIT 1;
      `,
      [usuario.cpf]
    );
    existingTutor = cpfResult.rows[0];
  }

  if (!existingTutor && usuario.email) {
    const emailResult = await client.query(
      `
        SELECT id
        FROM tutores
        WHERE email = $1
          AND ${ACTIVE_TUTOR_FILTER}
        ORDER BY id DESC
        LIMIT 1;
      `,
      [usuario.email]
    );
    existingTutor = emailResult.rows[0];
  }

  if (existingTutor) {
    await client.query(
      `
        UPDATE tutores
        SET
          usuario_externo_id = COALESCE(usuario_externo_id, $1),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2;
      `,
      [usuario.id, existingTutor.id]
    );

    return existingTutor.id;
  }

  const tutorResult = await client.query(
    `
      INSERT INTO tutores (
        nome,
        cpf,
        telefone,
        email,
        endereco,
        usuario_externo_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `,
    [
      usuario.nome,
      usuario.cpf || null,
      usuario.telefone || null,
      usuario.email || null,
      usuario.endereco || null,
      usuario.id
    ]
  );

  return tutorResult.rows[0].id;
}

async function ensureAnimalFromInscricao(client, inscricao, tutorId) {
  if (inscricao.animal_id) {
    return inscricao.animal_id;
  }

  if (inscricao.microchip) {
    const existingResult = await client.query(
      `
        SELECT id
        FROM animais
        WHERE microchip = $1
          AND ${ACTIVE_ANIMAL_FILTER}
        LIMIT 1;
      `,
      [inscricao.microchip]
    );

    const existing = existingResult.rows[0];

    if (existing) {
      await client.query(
        `
          UPDATE animais
          SET
            tutor_id = COALESCE(tutor_id, $1),
            campanha_inscricao_id = COALESCE(campanha_inscricao_id, $2),
            origem_campanha_id = COALESCE(origem_campanha_id, $3),
            territorio_id = COALESCE(territorio_id, $4),
            territorio_origem = COALESCE(territorio_origem, $5),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $6;
        `,
        [
          tutorId,
          inscricao.id,
          inscricao.campanha_id,
          inscricao.territorio_id || null,
          inscricao.territorio_origem || null,
          existing.id
        ]
      );

      return existing.id;
    }
  }

  const isCastracao = inscricao.servico_desejado === 'castracao_microchipagem';
  const isVacinacao = inscricao.servico_desejado === 'vacinacao';
  let territorioNome = null;

  if (inscricao.territorio_id) {
    const territorioResult = await client.query(
      `
        SELECT nome
        FROM territorios
        WHERE id = $1;
      `,
      [inscricao.territorio_id]
    );
    territorioNome = territorioResult.rows[0]?.nome || null;
  }

  const animalResult = await client.query(
    `
      INSERT INTO animais (
        nome,
        especie,
        raca,
        sexo,
        porte,
        peso_kg,
        status,
        microchip,
        castrado,
        castracao_pendente,
        vacinado,
        vacinas,
        grupo_vacinacao,
        alerta_vacinal,
        tutor_id,
        observacoes,
        bairro,
        territorio_id,
        territorio_origem,
        campanha_inscricao_id,
        origem_campanha_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'ativo', $7,
        $8, false, $9, '[]'::jsonb, $10, '[]'::jsonb,
        $11, $12, $13, $14, $15, $16, $17
      )
      RETURNING id;
    `,
    [
      inscricao.animal_nome,
      inscricao.animal_especie,
      inscricao.animal_raca || null,
      inscricao.animal_sexo || null,
      getPorteByPeso(inscricao.peso_kg),
      inscricao.peso_kg || null,
      inscricao.microchip || null,
      isCastracao,
      isVacinacao,
      isVacinacao ? 'vacinacao_incompleta' : 'nao_vacinado',
      tutorId,
      `Cadastro gerado a partir da campanha ${inscricao.protocolo}.`,
      territorioNome,
      inscricao.territorio_id || null,
      inscricao.territorio_origem || 'nao_informado',
      inscricao.id,
      inscricao.campanha_id
    ]
  );

  const animalId = animalResult.rows[0].id;
  const publicId = `SIGMA-ANIMAL-${animalId}`;

  await client.query(
    `
      UPDATE animais
      SET
        public_id = COALESCE(NULLIF(TRIM(public_id), ''), $1),
        qr_token = COALESCE(NULLIF(TRIM(qr_token), ''), $1)
      WHERE id = $2;
    `,
    [publicId, animalId]
  );

  return animalId;
}

module.exports = {
  fs,
  path,
  crypto,
  db,
  auditService,
  animalVacinaService,
  historicoOperacionalService,
  notificacaoOperacionalService,
  workflowService,
  territorioService,
  webPushService,
  logger,
  ACTIVE_TUTOR_FILTER,
  ACTIVE_ANIMAL_FILTER,
  toJsonb,
  generateProtocolo,
  getPorteByPeso,
  sanitizeDocumento,
  getFileHash,
  buildStatusNotification,
  getNotificationMetadata,
  createNotification,
  ensureTutorFromInscricao,
  ensureAnimalFromInscricao,
};
