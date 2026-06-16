const auditService = require('../../services/auditService');
const { isViveiroPublicPortalEnabled } = require('../../config/env');
const {
  assertPositiveInteger,
  assertPositive,
  buildProtocol,
  createValidationError,
  db,
  ensureEspecieExists,
  normalizeString,
} = require('./shared');

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const TIPOS_SOLICITANTE_PUBLICO = ['cidadao', 'instituicao', 'escola', 'ong'];

function requireText(payload, fieldName, label, { min = 1, max = 300 } = {}) {
  const value = normalizeString(payload?.[fieldName]);

  if (!value || value.length < min) {
    throw createValidationError(`${label} obrigatorio(a).`, { field: fieldName });
  }

  if (value.length > max) {
    throw createValidationError(`${label} acima do tamanho permitido.`, { field: fieldName, max });
  }

  return value;
}

function optionalText(payload, fieldName, label, { max = 300 } = {}) {
  const value = normalizeString(payload?.[fieldName]);

  if (!value) return null;

  if (value.length > max) {
    throw createValidationError(`${label} acima do tamanho permitido.`, { field: fieldName, max });
  }

  return value;
}

function optionalEmail(payload, fieldName, label) {
  const value = optionalText(payload, fieldName, label, { max: 160 });

  if (!value) return null;

  if (!SIMPLE_EMAIL_REGEX.test(value)) {
    throw createValidationError(`${label} invalido(a).`, { field: fieldName });
  }

  return value.toLowerCase();
}

function validatePublicSolicitacaoPayload(payload = {}) {
  const itens = Array.isArray(payload.itens) ? payload.itens : [];
  const solicitanteEmail = optionalEmail(payload, 'solicitante_email', 'E-mail');
  const solicitanteTelefone = optionalText(payload, 'solicitante_telefone', 'Telefone', { max: 40 });
  const tipoSolicitante = normalizeString(payload.tipo_solicitante || 'cidadao') || 'cidadao';

  if (payload.solicitante_documento || payload.cpf || payload.documento) {
    throw createValidationError('Documento ou documento pessoal nao deve ser informado nesta fase do portal publico.', {
      field: 'solicitante_documento',
    });
  }

  if (!solicitanteEmail && !solicitanteTelefone) {
    throw createValidationError('Informe telefone ou e-mail para contato administrativo.', {
      field: 'contato',
    });
  }

  if (!TIPOS_SOLICITANTE_PUBLICO.includes(tipoSolicitante)) {
    throw createValidationError('Tipo de solicitante invalido para solicitacao publica.', {
      field: 'tipo_solicitante',
      allowedValues: TIPOS_SOLICITANTE_PUBLICO,
    });
  }

  if (payload.aceite_ciencia !== true) {
    throw createValidationError('Confirme a ciencia administrativa antes de enviar.', {
      field: 'aceite_ciencia',
    });
  }

  if (!itens.length) {
    throw createValidationError('Informe ao menos uma especie desejada.', { field: 'itens' });
  }

  if (itens.length > 5) {
    throw createValidationError('Informe no maximo cinco itens por solicitacao publica.', {
      field: 'itens',
      max: 5,
    });
  }

  return {
    solicitante_nome: requireText(payload, 'solicitante_nome', 'Nome do solicitante', { min: 3, max: 160 }),
    solicitante_email: solicitanteEmail,
    solicitante_telefone: solicitanteTelefone,
    tipo_solicitante: tipoSolicitante,
    instituicao_nome: optionalText(payload, 'instituicao_nome', 'Instituicao', { max: 180 }),
    bairro_localidade: requireText(payload, 'bairro_localidade', 'Bairro/localidade', { min: 2, max: 180 }),
    finalidade: requireText(payload, 'finalidade', 'Finalidade da solicitacao', { min: 10, max: 1000 }),
    observacoes: optionalText(payload, 'observacoes', 'Observacoes', { max: 1000 }),
    ciencia_solicitante: true,
    itens: itens.map((item, index) => {
      const quantidade = assertPositive(item.quantidade_solicitada, `itens[${index}].quantidade_solicitada`);
      const observacoes = normalizeString(item.observacoes);

      if (quantidade > 100) {
        throw createValidationError('Quantidade solicitada acima do limite do MVP publico.', {
          field: `itens[${index}].quantidade_solicitada`,
          max: 100,
        });
      }

      if (observacoes.length > 300) {
        throw createValidationError('Observacoes do item acima do tamanho permitido.', {
          field: `itens[${index}].observacoes`,
          max: 300,
        });
      }

      return {
        especie_id: assertPositiveInteger(item.especie_id, `itens[${index}].especie_id`),
        quantidade_solicitada: quantidade,
        observacoes: observacoes || null,
      };
    }),
  };
}

function assertPortalEnabled() {
  if (isViveiroPublicPortalEnabled()) {
    return;
  }

  const error = new Error('Solicitacao publica de mudas ainda indisponivel. Procure a SMAD pelos canais institucionais.');
  error.statusCode = 403;
  error.code = 'VIVEIRO_PUBLIC_PORTAL_DISABLED';
  throw error;
}

async function getPublicStatus() {
  const enabled = isViveiroPublicPortalEnabled();

  return {
    enabled,
    status: enabled ? 'pre_portal_controlado' : 'indisponivel',
    message: enabled
      ? 'Solicitacao publica em MVP controlado/homologacao assistida. O envio nao garante aprovacao, reserva, prazo, protocolo conclusivo, comprovante publico ou entrega; a SMAD fara triagem interna e podera indeferir a demanda.'
      : 'Solicitacao publica de mudas ainda indisponivel. Nenhum dado publico deve ser enviado por este canal enquanto a flag estiver desligada.',
  };
}

async function listPublicEspecies() {
  const result = await db.query(
    `
      SELECT
        id,
        nome,
        nome_cientifico,
        categoria,
        porte,
        unidade_medida
      FROM viveiro_especies
      WHERE status = 'ativo'
      ORDER BY nome ASC;
    `
  );

  return result.rows.map((item) => ({
    id: item.id,
    nome: item.nome,
    nome_cientifico: item.nome_cientifico,
    categoria: item.categoria,
    porte: item.porte,
    unidade_medida: item.unidade_medida,
    disponibilidade: 'sob_consulta',
  }));
}

async function createPublicSolicitacao(payload, req) {
  assertPortalEnabled();
  const input = validatePublicSolicitacaoPayload(payload);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    for (const item of input.itens) {
      const especie = await ensureEspecieExists(client, item.especie_id, { activeOnly: true });

      if (!especie) {
        throw createValidationError('Especie informada nao esta disponivel para solicitacao publica.', {
          field: 'itens.especie_id',
          especie_id: item.especie_id,
        });
      }
    }

    const insertResult = await client.query(
      `
        INSERT INTO viveiro_solicitacoes (
          protocolo,
          solicitante_nome,
          solicitante_documento,
          solicitante_email,
          solicitante_telefone,
          tipo_solicitante,
          instituicao_nome,
          finalidade,
          local_plantio,
          status,
          observacoes,
          origem_solicitacao,
          ciencia_solicitante,
          created_by_interno_id
        )
        VALUES ('PENDENTE', $1, NULL, $2, $3, $4, $5, $6, $7, 'pendente', $8, 'portal_publico', true, NULL)
        RETURNING *;
      `,
      [
        input.solicitante_nome,
        input.solicitante_email,
        input.solicitante_telefone,
        input.tipo_solicitante,
        input.instituicao_nome,
        input.finalidade,
        input.bairro_localidade,
        input.observacoes,
      ]
    );

    const solicitacao = insertResult.rows[0];
    const protocolo = buildProtocol('VIV-SOL', solicitacao.id, solicitacao.created_at);

    await client.query(
      `
        UPDATE viveiro_solicitacoes
        SET protocolo = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [solicitacao.id, protocolo]
    );

    for (const item of input.itens) {
      await client.query(
        `
          INSERT INTO viveiro_solicitacao_itens (
            solicitacao_id,
            especie_id,
            quantidade_solicitada,
            observacoes
          )
          VALUES ($1, $2, $3, $4);
        `,
        [solicitacao.id, item.especie_id, item.quantidade_solicitada, item.observacoes]
      );
    }

    await client.query('COMMIT');

    await auditService.log({
      ator_tipo: 'publico',
      acao: 'viveiro.solicitacao.public_create',
      entidade: 'viveiro_solicitacoes',
      entidade_id: solicitacao.id,
      dados: {
        origem_solicitacao: 'portal_publico',
        status: 'pendente',
        total_itens: input.itens.length,
      },
      req,
    });

    return {
      status: 'pendente',
      origem_solicitacao: 'portal_publico',
      recebimento: solicitacao.created_at,
      mensagem:
        'Solicitacao recebida para triagem administrativa da SMAD. O envio nao garante aprovacao, reserva de estoque, prazo, protocolo conclusivo, comprovante publico ou entrega de mudas; a demanda podera ser indeferida conforme criterios administrativos, tecnicos ou de disponibilidade.',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getPublicStatus,
  listPublicEspecies,
  createPublicSolicitacao,
  validatePublicSolicitacaoPayload,
};
