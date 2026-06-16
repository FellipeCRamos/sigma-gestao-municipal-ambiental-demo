const { db, findAnimal, findDocumentosComprovantesByAnimal, decorateRecord } = require('./shared');

exports.findCatalogo = async ({ especie } = {}) => {
  const values = [];
  let where = "WHERE status = 'ativo'";

  if (especie) {
    values.push(especie);
    where += ` AND especie IN ($${values.length}, 'ambos')`;
  }

  const result = await db.query(
    `
      SELECT *
      FROM vacina_catalogo
      ${where}
      ORDER BY especie, essencial DESC, nome_popular, nome_comercial, id;
    `,
    values
  );

  return result.rows;
};

exports.findCarteiraByAnimal = async (animalId, { includeCanceled = false } = {}) => {
  const animal = await findAnimal(animalId);

  if (!animal) {
    return null;
  }

  const registrosResult = await db.query(
    `
      SELECT
        av.*,
        vc.codigo AS catalogo_codigo,
        vc.essencial AS catalogo_essencial,
        vc.periodicidade_meses AS catalogo_periodicidade_meses,
        c.nome AS campanha_nome,
        c.slug AS campanha_slug,
        ci.protocolo AS campanha_protocolo,
        cvi.status AS atendimento_vacinal_status,
        cd.nome_original AS documento_nome_original,
        cd.tipo AS documento_tipo,
        cd.mime_type AS documento_mime_type,
        cd.tamanho_bytes AS documento_tamanho_bytes,
        ui.nome AS created_by_interno_nome,
        ue.nome AS created_by_externo_nome
      FROM animal_vacinacoes av
      LEFT JOIN vacina_catalogo vc ON vc.id = av.vacina_catalogo_id
      LEFT JOIN campanha_inscricoes ci ON ci.id = av.campanha_inscricao_id
      LEFT JOIN campanha_vacinacao_itens cvi ON cvi.id = av.campanha_vacinacao_item_id
      LEFT JOIN campanhas c ON c.id = COALESCE(av.campanha_id, ci.campanha_id)
      LEFT JOIN campanha_documentos cd ON cd.id = av.documento_id
      LEFT JOIN usuarios_internos ui ON ui.id = av.created_by_interno_id
      LEFT JOIN usuarios_externos ue ON ue.id = av.created_by_externo_id
      WHERE av.animal_id = $1
        AND ($2::boolean = true OR av.status_registro <> 'cancelado')
      ORDER BY av.data_aplicacao DESC NULLS LAST, av.id DESC;
    `,
    [animalId, includeCanceled]
  );

  const catalogo = await exports.findCatalogo({ especie: animal.especie });
  const documentosDisponiveis = await findDocumentosComprovantesByAnimal(animalId);
  const registros = registrosResult.rows.map(decorateRecord);

  return {
    animal: {
      id: animal.id,
      nome: animal.nome,
      especie: animal.especie,
      raca: animal.raca,
      sexo: animal.sexo,
      porte: animal.porte,
      cor: animal.cor,
      data_nascimento: animal.data_nascimento,
      status: animal.status,
      microchip: animal.microchip,
      castrado: animal.castrado,
      vacinado: animal.vacinado,
      public_id: animal.public_id,
      perfil_publico_ativo: animal.perfil_publico_ativo,
      bairro: animal.bairro,
      endereco_referencia: animal.endereco_referencia,
      territorio_id: animal.territorio_id,
      territorio_origem: animal.territorio_origem,
      territorio_nome: animal.territorio_nome,
      territorio_categoria: animal.territorio_categoria,
      confiabilidade_score: animal.confiabilidade_score,
      confiabilidade_nivel: animal.confiabilidade_nivel,
      confiabilidade_pendencias: animal.confiabilidade_pendencias,
      tutor_id: animal.tutor_id
    },
    resumo: exports.buildResumo(animal, registros, catalogo),
    registros,
    catalogo,
    documentos_disponiveis: documentosDisponiveis,
    legado: {
      vacinas: Array.isArray(animal.vacinas) ? animal.vacinas : [],
      alerta_vacinal: Array.isArray(animal.alerta_vacinal) ? animal.alerta_vacinal : []
    }
  };
};

exports.buildResumo = (animal, registros, catalogo) => {
  const ativos = registros.filter((item) => item.status_registro !== 'cancelado');
  const codigosAtivos = new Set(ativos.map((item) => item.vacina_codigo || item.catalogo_codigo).filter(Boolean));
  const essenciais = catalogo.filter((item) => item.essencial);
  const essenciaisPendentes = essenciais.filter((item) => !codigosAtivos.has(item.codigo));
  const vencidos = ativos.filter((item) => item.situacao_calculada === 'vencida');
  const pendentesComprovacao = ativos.filter((item) => item.situacao_calculada === 'pendente_comprovacao');
  const proximosVencer = ativos.filter((item) => {
    const days = item.dias_para_proxima_dose;
    return Number.isInteger(days) && days >= 0 && days <= 30;
  });

  let situacao = 'sem_registro_estruturado';

  if (ativos.length > 0 && vencidos.length > 0) {
    situacao = 'possui_registro_com_vencimento';
  } else if (ativos.length > 0 && pendentesComprovacao.length > 0) {
    situacao = 'possui_registro_pendente_comprovacao';
  } else if (ativos.length > 0 && essenciaisPendentes.length > 0) {
    situacao = 'registro_estruturado_incompleto';
  } else if (ativos.length > 0) {
    situacao = 'registro_estruturado';
  }

  return {
    animal_id: animal.id,
    especie: animal.especie,
    total_registros: registros.length,
    registros_ativos: ativos.length,
    comprovados: ativos.filter((item) => item.status_registro === 'comprovado').length,
    pendentes_comprovacao: pendentesComprovacao.length,
    vencidos: vencidos.length,
    proximos_vencer: proximosVencer.length,
    essenciais_total: essenciais.length,
    essenciais_sem_registro: essenciaisPendentes.length,
    essenciais_pendentes: essenciaisPendentes.map((item) => ({
      codigo: item.codigo,
      nome: item.nome_popular || item.nome_comercial || item.nome_tecnico
    })),
    situacao,
    observacao: 'Ausencia de registro estruturado nao equivale necessariamente a ausencia real de vacinacao.'
  };
};

async function updateLegacyAnimalSummary(animalId) {
  const carteira = await exports.findCarteiraByAnimal(animalId);

  if (!carteira) {
    return null;
  }

  const resumo = carteira.resumo;
  const alertaVacinal = resumo.essenciais_pendentes.map(
    (item) => `Sem registro estruturado: ${item.nome}`
  );

  const grupo =
    resumo.registros_ativos === 0
      ? 'nao_vacinado'
      : resumo.essenciais_sem_registro > 0
      ? 'vacinacao_incompleta'
      : 'vacinacao_essencial_ok';

  await db.query(
    `
      UPDATE animais
      SET
        vacinado = $1,
        grupo_vacinacao = $2,
        alerta_vacinal = $3::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4;
    `,
    [
      resumo.registros_ativos > 0,
      grupo,
      JSON.stringify(alertaVacinal),
      animalId
    ]
  );

  return resumo;
}

exports.reconcileAnimalSummary = updateLegacyAnimalSummary;

